# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: time tracking (IssueWorkLog) on the web-app API."""

from datetime import datetime, timedelta, timezone as dt_timezone

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.celery import app as celery_app
from plane.db.models import IssueActivity, IssueWorkLog, Project, ProjectMember, WorkspaceMember
from plane.tests.factories import IssueFactory, IssueWorkLogFactory, StateFactory, UserFactory

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
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(
        name="Time", identifier="TIME", workspace=workspace, created_by=create_user, is_time_tracking_enabled=True
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    state = StateFactory(project=project, name="Todo", group="unstarted", default=True)
    member = _member(workspace, project, 15)
    member2 = _member(workspace, project, 15)
    guest = _member(workspace, project, 5)
    issue = IssueFactory(project=project, workspace=workspace, state=state)
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}"
    return {
        "workspace": workspace,
        "project": project,
        "state": state,
        "admin": create_user,
        "member": member,
        "member2": member2,
        "guest": guest,
        "issue": issue,
        "base": base,
        "url": f"{base}/issues/{issue.id}/worklogs/",
    }


def body(**kwargs):
    data = {"started_at": timezone.now().isoformat(), "duration_minutes": 90, "note": " fixed it "}
    data.update(kwargs)
    return data


def entry(env, user, minutes=60, issue=None, **kwargs):
    return IssueWorkLogFactory(issue=issue or env["issue"], user=user, duration_minutes=minutes, **kwargs)


class TestCreate:
    def test_member_logs_own_time(self, env):
        res = _client(env["member"]).post(env["url"], body(), format="json")
        assert res.status_code == status.HTTP_201_CREATED, res.data
        assert res.data["user"] == str(env["member"].id)
        assert res.data["note"] == "fixed it"
        assert res.data["issue"] == str(env["issue"].id)
        worklog = IssueWorkLog.objects.get(pk=res.data["id"])
        assert worklog.created_by_id == env["member"].id
        assert worklog.project_id == env["project"].id

    def test_admin_logs_on_behalf(self, env):
        res = _client(env["admin"]).post(env["url"], body(user=str(env["member"].id)), format="json")
        assert res.status_code == status.HTTP_201_CREATED, res.data
        worklog = IssueWorkLog.objects.get(pk=res.data["id"])
        assert worklog.user_id == env["member"].id
        assert worklog.created_by_id == env["admin"].id

    def test_member_on_behalf_rejected(self, env):
        res = _client(env["member"]).post(env["url"], body(user=str(env["member2"].id)), format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "INVALID_WORKLOG_USER"
        assert not IssueWorkLog.objects.exists()

    def test_admin_on_behalf_of_guest_rejected(self, env):
        res = _client(env["admin"]).post(env["url"], body(user=str(env["guest"].id)), format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "INVALID_WORKLOG_USER"

    @pytest.mark.parametrize("minutes", [0, 1441])
    def test_bad_duration(self, env, minutes):
        res = _client(env["member"]).post(env["url"], body(duration_minutes=minutes), format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "duration_minutes" in res.data

    def test_future_start_rejected(self, env):
        future = (timezone.now() + timedelta(days=2)).isoformat()
        res = _client(env["member"]).post(env["url"], body(started_at=future), format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "started_at" in res.data

    def test_cross_project_issue_404(self, env):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=env["workspace"])
        other_issue = IssueFactory(project=other, workspace=env["workspace"])
        url = f"{env['base']}/issues/{other_issue.id}/worklogs/"
        assert _client(env["member"]).post(url, body(), format="json").status_code == status.HTTP_404_NOT_FOUND
        assert _client(env["member"]).get(url).status_code == status.HTTP_404_NOT_FOUND


class TestFlag:
    def test_writes_403_reads_200_when_off(self, env):
        own = entry(env, env["member"])
        Project.objects.filter(pk=env["project"].pk).update(is_time_tracking_enabled=False)
        client = _client(env["member"])

        res = client.post(env["url"], body(), format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.data["error_code"] == "TIME_TRACKING_DISABLED"
        assert "error" in res.data

        res = client.patch(f"{env['url']}{own.id}/", {"duration_minutes": 5}, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.data["error_code"] == "TIME_TRACKING_DISABLED"

        res = client.delete(f"{env['url']}{own.id}/")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.data["error_code"] == "TIME_TRACKING_DISABLED"
        assert IssueWorkLog.objects.filter(pk=own.pk).exists()

        assert client.get(env["url"]).status_code == status.HTTP_200_OK
        assert client.get(f"{env['base']}/worklogs/").status_code == status.HTTP_200_OK
        assert client.get(f"{env['base']}/worklogs/summary/").status_code == status.HTTP_200_OK


class TestGuest:
    def test_guest_forbidden_everywhere(self, env):
        own = entry(env, env["member"])
        client = _client(env["guest"])
        assert client.get(env["url"]).status_code == status.HTTP_403_FORBIDDEN
        assert client.post(env["url"], body(), format="json").status_code == status.HTTP_403_FORBIDDEN
        patch = client.patch(f"{env['url']}{own.id}/", {"duration_minutes": 5}, format="json")
        assert patch.status_code == status.HTTP_403_FORBIDDEN
        assert client.delete(f"{env['url']}{own.id}/").status_code == status.HTTP_403_FORBIDDEN
        assert client.get(f"{env['base']}/worklogs/").status_code == status.HTTP_403_FORBIDDEN
        assert client.get(f"{env['base']}/worklogs/summary/").status_code == status.HTTP_403_FORBIDDEN

    def test_non_member_forbidden(self, env):
        outsider = UserFactory()
        WorkspaceMember.objects.create(workspace=env["workspace"], member=outsider, role=15)
        assert _client(outsider).get(env["url"]).status_code == status.HTTP_403_FORBIDDEN


class TestEditDelete:
    def test_member_edits_own(self, env):
        own = entry(env, env["member"])
        res = _client(env["member"]).patch(f"{env['url']}{own.id}/", {"duration_minutes": 45}, format="json")
        assert res.status_code == status.HTTP_200_OK, res.data
        assert res.data["duration_minutes"] == 45

    def test_member_cannot_edit_or_delete_others(self, env):
        theirs = entry(env, env["member2"])
        client = _client(env["member"])
        res = client.patch(f"{env['url']}{theirs.id}/", {"duration_minutes": 45}, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert client.delete(f"{env['url']}{theirs.id}/").status_code == status.HTTP_403_FORBIDDEN
        assert IssueWorkLog.objects.get(pk=theirs.pk).duration_minutes == 60

    def test_member_cannot_reassign_own_entry(self, env):
        own = entry(env, env["member"])
        res = _client(env["member"]).patch(f"{env['url']}{own.id}/", {"user": str(env["member2"].id)}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "INVALID_WORKLOG_USER"

    def test_admin_edits_and_deletes_any(self, env):
        theirs = entry(env, env["member"])
        client = _client(env["admin"])
        res = client.patch(f"{env['url']}{theirs.id}/", {"duration_minutes": 30}, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["user"] == str(env["member"].id)
        assert client.delete(f"{env['url']}{theirs.id}/").status_code == status.HTTP_204_NO_CONTENT
        assert not IssueWorkLog.objects.filter(pk=theirs.pk).exists()
        assert IssueWorkLog.all_objects.get(pk=theirs.pk).deleted_at is not None

    def test_issue_cannot_change(self, env):
        own = entry(env, env["member"])
        other = IssueFactory(project=env["project"], workspace=env["workspace"], state=env["state"])
        res = _client(env["member"]).patch(f"{env['url']}{own.id}/", {"issue": str(other.id)}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "WORKLOG_ISSUE_IMMUTABLE"

    def test_entry_of_another_issue_404(self, env):
        other = IssueFactory(project=env["project"], workspace=env["workspace"], state=env["state"])
        theirs = entry(env, env["member"], issue=other)
        res = _client(env["member"]).patch(f"{env['url']}{theirs.id}/", {"duration_minutes": 5}, format="json")
        assert res.status_code == status.HTTP_404_NOT_FOUND


class TestLists:
    def test_issue_list(self, env):
        entry(env, env["member"], started_at=timezone.now() - timedelta(days=1))
        newest = entry(env, env["member2"])
        res = _client(env["member"]).get(env["url"])
        assert res.status_code == status.HTTP_200_OK
        assert [row["id"] for row in res.data][0] == newest.id
        assert len(res.data) == 2
        assert res.data[0]["user_detail"]["id"] == env["member2"].id

    def test_project_list_filters_and_summary(self, env):
        child = IssueFactory(
            project=env["project"], workspace=env["workspace"], state=env["state"], parent=env["issue"]
        )
        other = IssueFactory(project=env["project"], workspace=env["workspace"], state=env["state"])
        day = datetime(2026, 3, 1, 9, tzinfo=dt_timezone.utc)
        a = entry(env, env["member"], 30, started_at=day)
        b = entry(env, env["member2"], 20, issue=child, started_at=day + timedelta(days=1))
        c = entry(env, env["member"], 10, issue=other, started_at=day + timedelta(days=2))
        client = _client(env["member"])
        url = f"{env['base']}/worklogs/"

        def ids(query=""):
            res = client.get(f"{url}?{query}")
            assert res.status_code == status.HTTP_200_OK, res.data
            return {row["id"] for row in res.data["results"]}

        assert ids() == {a.id, b.id, c.id}
        assert ids(f"user={env['member2'].id}") == {b.id}
        assert ids(f"user={env['member'].id},{env['member2'].id}") == {a.id, b.id, c.id}
        assert ids(f"issue={env['issue'].id}") == {a.id}
        assert ids(f"issue={env['issue'].id}&include_subtasks=true") == {a.id, b.id}
        assert ids("started_at__gte=2026-03-02&started_at__lt=2026-03-03") == {b.id}

        res = client.get(f"{url}?started_at__gte=not-a-date")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "INVALID_WORKLOG_FILTER"
        assert client.get(f"{url}?user=xyz").status_code == status.HTTP_400_BAD_REQUEST

        res = client.get(f"{url}summary/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["total_minutes"] == 60
        assert res.data["by_user"] == [
            {"user_id": str(env["member"].id), "minutes": 40},
            {"user_id": str(env["member2"].id), "minutes": 20},
        ]
        res = client.get(f"{url}summary/?issue={env['issue'].id}&include_subtasks=true")
        assert res.data["total_minutes"] == 50
        assert client.get(f"{url}summary/?started_at__lt=bad").status_code == status.HTTP_400_BAD_REQUEST

    def test_project_list_paginates(self, env):
        for _ in range(3):
            entry(env, env["member"])
        res = _client(env["member"]).get(f"{env['base']}/worklogs/?per_page=2")
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data["results"]) == 2
        assert res.data["next_page_results"] is True


class TestIssueTotals:
    def _setup(self, env):
        child = IssueFactory(
            project=env["project"], workspace=env["workspace"], state=env["state"], parent=env["issue"]
        )
        entry(env, env["member"], 30)
        entry(env, env["member"], 45, issue=child)
        return child

    def test_issue_detail(self, env):
        self._setup(env)
        res = _client(env["member"]).get(f"{env['base']}/issues/{env['issue'].id}/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["logged_minutes"] == 30
        assert res.data["total_logged_minutes"] == 75

    def test_issue_detail_by_identifier(self, env):
        self._setup(env)
        res = _client(env["member"]).get(
            f"/api/workspaces/{env['workspace'].slug}/work-items/TIME-{env['issue'].sequence_id}/"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["logged_minutes"] == 30
        assert res.data["total_logged_minutes"] == 75

    @pytest.mark.parametrize("path", ["issues/", "issues/?group_by=state_id", "v2/issues/", "issues/list/"])
    def test_issue_lists(self, env, path):
        child = self._setup(env)
        url = f"{env['base']}/{path}"
        if path == "issues/list/":
            url = f"{url}?issues={env['issue'].id},{child.id}"
        res = _client(env["member"]).get(url)
        assert res.status_code == status.HTTP_200_OK, res.data
        rows = {str(row["id"]): row for row in _flatten(res.data)}
        assert rows[str(env["issue"].id)]["total_logged_minutes"] == 75
        assert rows[str(child.id)]["total_logged_minutes"] == 45
        assert "logged_minutes" not in rows[str(env["issue"].id)]

    def test_project_list_has_flag(self, env):
        res = _client(env["member"]).get(f"/api/workspaces/{env['workspace'].slug}/projects/")
        assert res.status_code == status.HTTP_200_OK
        row = next(p for p in _flatten(res.data) if str(p["id"]) == str(env["project"].id))
        assert row["is_time_tracking_enabled"] is True


def _flatten(data):
    data = data.get("results", data) if isinstance(data, dict) else data
    if isinstance(data, dict):
        out = []
        for group in data.values():
            out.extend(_flatten(group) if isinstance(group, dict) else group)
        return out
    return list(data)


class TestActivity:
    def test_rows_for_create_update_delete(self, env):
        client = _client(env["member"])
        res = client.post(env["url"], body(duration_minutes=90), format="json")
        worklog_id = res.data["id"]
        client.patch(f"{env['url']}{worklog_id}/", {"duration_minutes": 120}, format="json")
        client.patch(f"{env['url']}{worklog_id}/", {"duration_minutes": 120}, format="json")  # no-op
        client.delete(f"{env['url']}{worklog_id}/")

        rows = list(IssueActivity.objects.filter(issue=env["issue"], field="worklog").order_by("created_at"))
        assert [row.verb for row in rows] == ["created", "updated", "deleted"]
        assert rows[0].new_value == "90" and rows[0].comment == "logged 90 minutes"
        assert (rows[1].old_value, rows[1].new_value) == ("90", "120")
        assert rows[2].old_value == "120"
        assert all(row.actor_id == env["member"].id for row in rows)
        assert all(str(row.new_identifier or row.old_identifier) == str(worklog_id) for row in rows)
