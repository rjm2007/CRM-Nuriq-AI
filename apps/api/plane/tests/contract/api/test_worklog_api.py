# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: time tracking (IssueWorkLog) on the public API (``/api/v1/``, X-Api-Key)."""

from datetime import datetime, timedelta, timezone as dt_timezone
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.celery import app as celery_app
from plane.db.models import APIToken, IssueActivity, IssueWorkLog, Project, ProjectMember, WorkspaceMember
from plane.tests.factories import IssueFactory, IssueWorkLogFactory, UserFactory

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def celery_eager():
    """Run Celery tasks in-process so nothing reaches a real broker."""
    original_always_eager = celery_app.conf.task_always_eager
    original_eager_propagates = celery_app.conf.task_eager_propagates
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False
    yield
    celery_app.conf.task_always_eager = original_always_eager
    celery_app.conf.task_eager_propagates = original_eager_propagates


def _member(workspace, project, role):
    user = UserFactory()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=role)
    return user


def _client(user):
    token = APIToken.objects.create(user=user, label="t", token=f"wl-{uuid4().hex}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(
        name="Time", identifier="TAPI", workspace=workspace, created_by=create_user, is_time_tracking_enabled=True
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    issue = IssueFactory(project=project, workspace=workspace)
    base = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}"
    return {
        "workspace": workspace,
        "project": project,
        "admin": create_user,
        "member": _member(workspace, project, 15),
        "member2": _member(workspace, project, 15),
        "guest": _member(workspace, project, 5),
        "issue": issue,
        "base": base,
        "url": f"{base}/work-items/{issue.id}/worklogs/",
    }


def body(**kwargs):
    data = {"started_at": timezone.now().isoformat(), "duration_minutes": 90, "note": "api"}
    data.update(kwargs)
    return data


def entry(env, user, minutes=60, issue=None, **kwargs):
    return IssueWorkLogFactory(issue=issue or env["issue"], user=user, duration_minutes=minutes, **kwargs)


@pytest.mark.parametrize("segment", ["work-items", "issues"])
def test_member_create_and_list(env, segment):
    url = f"{env['base']}/{segment}/{env['issue'].id}/worklogs/"
    client = _client(env["member"])
    res = client.post(url, body(), format="json")
    assert res.status_code == status.HTTP_201_CREATED, res.data
    assert res.data["user"] == str(env["member"].id)
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    assert [row["duration_minutes"] for row in res.data["results"]] == [90]


def test_flag_off_writes_403_reads_200(env):
    own = entry(env, env["member"])
    Project.objects.filter(pk=env["project"].pk).update(is_time_tracking_enabled=False)
    client = _client(env["member"])
    for res in (
        client.post(env["url"], body(), format="json"),
        client.patch(f"{env['url']}{own.id}/", {"duration_minutes": 5}, format="json"),
        client.delete(f"{env['url']}{own.id}/"),
    ):
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.data["error_code"] == "TIME_TRACKING_DISABLED"
    assert client.get(env["url"]).status_code == status.HTTP_200_OK
    assert client.get(f"{env['base']}/worklogs/").status_code == status.HTTP_200_OK
    assert client.get(f"{env['base']}/worklogs/summary/").status_code == status.HTTP_200_OK


def test_guest_forbidden(env):
    own = entry(env, env["member"])
    client = _client(env["guest"])
    assert client.get(env["url"]).status_code == status.HTTP_403_FORBIDDEN
    assert client.post(env["url"], body(), format="json").status_code == status.HTTP_403_FORBIDDEN
    assert (
        client.patch(f"{env['url']}{own.id}/", {"duration_minutes": 5}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert client.delete(f"{env['url']}{own.id}/").status_code == status.HTTP_403_FORBIDDEN
    assert client.get(f"{env['base']}/worklogs/").status_code == status.HTTP_403_FORBIDDEN
    assert client.get(f"{env['base']}/worklogs/summary/").status_code == status.HTTP_403_FORBIDDEN


def test_member_edit_own_but_not_others(env):
    own = entry(env, env["member"])
    theirs = entry(env, env["member2"])
    client = _client(env["member"])
    res = client.patch(f"{env['url']}{own.id}/", {"duration_minutes": 15}, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["duration_minutes"] == 15
    res = client.patch(f"{env['url']}{theirs.id}/", {"duration_minutes": 15}, format="json")
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert client.delete(f"{env['url']}{theirs.id}/").status_code == status.HTTP_403_FORBIDDEN


def test_admin_edits_any_and_logs_on_behalf(env):
    theirs = entry(env, env["member"])
    client = _client(env["admin"])
    assert (
        client.patch(f"{env['url']}{theirs.id}/", {"duration_minutes": 15}, format="json").status_code
        == status.HTTP_200_OK
    )
    res = client.post(env["url"], body(user=str(env["member2"].id)), format="json")
    assert res.status_code == status.HTTP_201_CREATED, res.data
    worklog = IssueWorkLog.objects.get(pk=res.data["id"])
    assert (worklog.user_id, worklog.created_by_id) == (env["member2"].id, env["admin"].id)
    assert client.delete(f"{env['url']}{theirs.id}/").status_code == status.HTTP_204_NO_CONTENT


def test_member_on_behalf_400(env):
    res = _client(env["member"]).post(env["url"], body(user=str(env["admin"].id)), format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == "INVALID_WORKLOG_USER"


def test_cross_project_issue_404(env):
    other = Project.objects.create(name="Other", identifier="OTHA", workspace=env["workspace"])
    other_issue = IssueFactory(project=other, workspace=env["workspace"])
    url = f"{env['base']}/work-items/{other_issue.id}/worklogs/"
    client = _client(env["member"])
    assert client.post(url, body(), format="json").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(url).status_code == status.HTTP_404_NOT_FOUND


def test_project_list_and_summary(env):
    child = IssueFactory(project=env["project"], workspace=env["workspace"], parent=env["issue"])
    day = datetime(2026, 3, 1, 9, tzinfo=dt_timezone.utc)
    a = entry(env, env["member"], 30, started_at=day)
    b = entry(env, env["member2"], 20, issue=child, started_at=day + timedelta(days=1))
    client = _client(env["member"])
    url = f"{env['base']}/worklogs/"

    res = client.get(f"{url}?user={env['member2'].id}")
    assert res.status_code == status.HTTP_200_OK
    assert [row["id"] for row in res.data["results"]] == [b.id]
    res = client.get(f"{url}?issue={env['issue'].id}&include_subtasks=true")
    assert {row["id"] for row in res.data["results"]} == {a.id, b.id}
    res = client.get(f"{url}?started_at__lt=2026-03-02")
    assert [row["id"] for row in res.data["results"]] == [a.id]
    res = client.get(f"{url}?started_at__gte=bad")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == "INVALID_WORKLOG_FILTER"

    res = client.get(f"{url}summary/")
    assert res.status_code == status.HTTP_200_OK
    assert res.data == {
        "total_minutes": 50,
        "by_user": [
            {"user_id": str(env["member"].id), "minutes": 30},
            {"user_id": str(env["member2"].id), "minutes": 20},
        ],
    }


def test_issue_detail_has_totals(env):
    child = IssueFactory(project=env["project"], workspace=env["workspace"], parent=env["issue"])
    entry(env, env["member"], 30)
    entry(env, env["member"], 45, issue=child)
    res = _client(env["member"]).get(f"{env['base']}/work-items/{env['issue'].id}/")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["logged_minutes"] == 30
    assert res.data["total_logged_minutes"] == 75


def test_activity_rows(env):
    client = _client(env["member"])
    res = client.post(env["url"], body(duration_minutes=90), format="json")
    worklog_id = res.data["id"]
    client.patch(f"{env['url']}{worklog_id}/", {"duration_minutes": 100}, format="json")
    client.delete(f"{env['url']}{worklog_id}/")
    rows = list(IssueActivity.objects.filter(issue=env["issue"], field="worklog").order_by("created_at"))
    assert [(row.verb, row.old_value, row.new_value) for row in rows] == [
        ("created", None, "90"),
        ("updated", "90", "100"),
        ("deleted", "100", ""),
    ]
