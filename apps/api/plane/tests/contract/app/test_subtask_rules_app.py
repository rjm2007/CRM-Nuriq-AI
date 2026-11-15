# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: subtask rules, completed sub-issue counts and parent auto-done on the web-app API."""

from datetime import date
from unittest import mock

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status

from plane.celery import app as celery_app
from plane.db.models import Cycle, CycleIssue, Issue, IssueActivity, Module, ModuleIssue, Project, ProjectMember
from plane.tests.factories import IssueFactory, StateFactory

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="Sub", identifier="SUB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    states = {
        "todo": StateFactory(project=project, name="Todo", group="unstarted", default=True),
        "done": StateFactory(project=project, name="Done", group="completed"),
        "cancelled": StateFactory(project=project, name="Cancelled", group="cancelled"),
    }
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}"
    return {"project": project, "workspace": workspace, "user": create_user, "states": states, "base": base}


def make(env, state="todo", **kwargs):
    return IssueFactory(project=env["project"], workspace=env["workspace"], state=env["states"][state], **kwargs)


def results(data):
    """Flatten a paginated (optionally grouped) list response into a list of issue dicts."""
    data = data.get("results", data) if isinstance(data, dict) else data
    if isinstance(data, dict):
        out = []
        for group in data.values():
            out.extend(results(group) if isinstance(group, dict) else group)
        return out
    return list(data)


def count_by_id(items):
    return {str(item["id"]): item.get("completed_sub_issues_count") for item in items}


@pytest.fixture
def no_tasks():
    with (
        mock.patch("plane.app.views.issue.base.issue_activity"),
        mock.patch("plane.app.views.issue.base.model_activity"),
        mock.patch("plane.app.views.issue.base.issue_description_version_task"),
        mock.patch("plane.app.views.issue.base.recent_visited_task"),
        mock.patch("plane.app.views.issue.sub_issue.issue_activity"),
    ):
        yield


class TestPatchRules:
    def test_parent_is_subtask(self, session_client, env, no_tasks):
        top = make(env)
        sub = make(env, parent=top)
        issue = make(env)
        res = session_client.patch(f"{env['base']}/issues/{issue.id}/", {"parent_id": str(sub.id)}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == ["SUBTASK_PARENT_IS_SUBTASK"]
        assert Issue.objects.get(pk=issue.id).parent_id is None

    def test_self_parent(self, session_client, env, no_tasks):
        issue = make(env)
        res = session_client.patch(f"{env['base']}/issues/{issue.id}/", {"parent_id": str(issue.id)}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == ["SUBTASK_SELF_PARENT"]

    def test_has_children(self, session_client, env, no_tasks):
        issue = make(env)
        make(env, parent=issue)
        other = make(env)
        res = session_client.patch(f"{env['base']}/issues/{issue.id}/", {"parent_id": str(other.id)}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == ["SUBTASK_HAS_CHILDREN"]

    def test_subtask_date_after_parent(self, session_client, env, no_tasks):
        parent = make(env, target_date=date(2026, 5, 1))
        child = make(env, parent=parent)
        res = session_client.patch(f"{env['base']}/issues/{child.id}/", {"target_date": "2026-05-02"}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == ["SUBTASK_DATE_AFTER_PARENT"]

    def test_parent_date_before_subtasks(self, session_client, env, no_tasks):
        parent = make(env, target_date=date(2026, 5, 10))
        child = make(env, parent=parent, target_date=date(2026, 5, 8))
        res = session_client.patch(f"{env['base']}/issues/{parent.id}/", {"target_date": "2026-05-01"}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == ["PARENT_DATE_BEFORE_SUBTASKS"]
        assert res.data["subtask_identifiers"] == [f"SUB-{child.sequence_id}"]
        assert Issue.objects.get(pk=parent.id).target_date == date(2026, 5, 10)

    def test_valid_patch(self, session_client, env, no_tasks):
        parent = make(env, target_date=date(2026, 5, 10))
        issue = make(env, target_date=date(2026, 5, 9))
        res = session_client.patch(f"{env['base']}/issues/{issue.id}/", {"parent_id": str(parent.id)}, format="json")
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert Issue.objects.get(pk=issue.id).parent_id == parent.id

    def test_create_under_subtask(self, session_client, env, no_tasks):
        top = make(env)
        sub = make(env, parent=top)
        res = session_client.post(f"{env['base']}/issues/", {"name": "n", "parent_id": str(sub.id)}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == ["SUBTASK_PARENT_IS_SUBTASK"]


class TestBulkSubIssues:
    def test_one_bad_item_changes_nothing(self, session_client, env, no_tasks):
        parent = make(env, target_date=date(2026, 5, 10))
        good = make(env, target_date=date(2026, 5, 1))
        late = make(env, target_date=date(2026, 5, 20))
        res = session_client.post(
            f"{env['base']}/issues/{parent.id}/sub-issues/",
            {"sub_issue_ids": [str(good.id), str(late.id)]},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "SUBTASK_DATE_AFTER_PARENT"
        assert res.data["issue_ids"] == [str(late.id)]
        assert "error" in res.data
        assert not Issue.objects.filter(parent_id=parent.id).exists()

    def test_child_with_children_rejected(self, session_client, env, no_tasks):
        parent = make(env)
        has_kids = make(env)
        make(env, parent=has_kids)
        res = session_client.post(
            f"{env['base']}/issues/{parent.id}/sub-issues/", {"sub_issue_ids": [str(has_kids.id)]}, format="json"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "SUBTASK_HAS_CHILDREN"

    def test_valid_attach(self, session_client, env, no_tasks):
        parent = make(env)
        a, b = make(env), make(env)
        res = session_client.post(
            f"{env['base']}/issues/{parent.id}/sub-issues/", {"sub_issue_ids": [str(a.id), str(b.id)]}, format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        assert Issue.objects.filter(parent_id=parent.id).count() == 2


class TestGanttDates:
    def test_bad_date_rejected_before_any_update(self, session_client, env):
        parent = make(env, target_date=date(2026, 5, 10))
        child = make(env, parent=parent, target_date=date(2026, 5, 1))
        other = make(env, target_date=date(2026, 5, 1))
        with mock.patch("plane.app.views.issue.base.issue_activity") as activity:
            res = session_client.post(
                f"{env['base']}/issue-dates/",
                {
                    "updates": [
                        {"id": str(other.id), "target_date": "2026-06-01"},
                        {"id": str(child.id), "target_date": "2026-05-11"},
                    ]
                },
                format="json",
            )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "SUBTASK_DATE_AFTER_PARENT"
        assert res.data["issue_ids"] == [str(child.id)]
        activity.delay.assert_not_called()
        assert Issue.objects.get(pk=other.id).target_date == date(2026, 5, 1)

    def test_moving_parent_and_child_together_ok(self, session_client, env):
        parent = make(env, target_date=date(2026, 5, 10))
        child = make(env, parent=parent, target_date=date(2026, 5, 9))
        with mock.patch("plane.app.views.issue.base.issue_activity"):
            res = session_client.post(
                f"{env['base']}/issue-dates/",
                {
                    "updates": [
                        {"id": str(parent.id), "target_date": "2026-06-10"},
                        {"id": str(child.id), "target_date": "2026-06-09"},
                    ]
                },
                format="json",
            )
        assert res.status_code == status.HTTP_200_OK
        assert Issue.objects.get(pk=child.id).target_date == date(2026, 6, 9)


class TestCompletedSubIssuesCount:
    def _tree(self, env, n_parents=1):
        parents = []
        for _ in range(n_parents):
            parent = make(env)
            make(env, "done", parent=parent)
            make(env, "done", parent=parent)
            make(env, "cancelled", parent=parent)
            make(env, parent=parent)
            parents.append(parent)
        return parents

    def test_list_returns_count_without_n_plus_one(self, session_client, env, django_assert_max_num_queries):
        url = f"{env['base']}/issues/"
        parent = self._tree(env)[0]
        with CaptureQueriesContext(connection) as small:
            res = session_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        counts = count_by_id(results(res.data))
        assert counts[str(parent.id)] == 2
        assert all(value is not None for value in counts.values())

        self._tree(env, n_parents=5)
        with django_assert_max_num_queries(len(small.captured_queries)):
            res = session_client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert sorted(count_by_id(results(res.data)).values()).count(2) == 6

    def test_list_grouped(self, session_client, env):
        parent = self._tree(env)[0]
        res = session_client.get(f"{env['base']}/issues/?group_by=state_id")
        assert res.status_code == status.HTTP_200_OK
        assert count_by_id(results(res.data))[str(parent.id)] == 2

    def test_v2_paginated(self, session_client, env):
        parent = self._tree(env)[0]
        res = session_client.get(f"{env['base']}/v2/issues/")
        assert res.status_code == status.HTTP_200_OK
        assert count_by_id(results(res.data))[str(parent.id)] == 2

    def test_cycle_module_archived_profile(self, session_client, env):
        parent = self._tree(env)[0]
        project, workspace = env["project"], env["workspace"]
        cycle = Cycle.objects.create(name="C", project=project, workspace=workspace, owned_by=env["user"])
        CycleIssue.objects.create(cycle=cycle, issue=parent, project=project, workspace=workspace)
        module = Module.objects.create(name="M", project=project, workspace=workspace)
        ModuleIssue.objects.create(module=module, issue=parent, project=project, workspace=workspace)

        res = session_client.get(f"{env['base']}/cycles/{cycle.id}/cycle-issues/")
        assert res.status_code == status.HTTP_200_OK
        assert count_by_id(results(res.data))[str(parent.id)] == 2

        res = session_client.get(f"{env['base']}/modules/{module.id}/issues/")
        assert res.status_code == status.HTTP_200_OK
        assert count_by_id(results(res.data))[str(parent.id)] == 2

        Issue.objects.filter(pk=parent.pk).update(created_by=env["user"])
        res = session_client.get(f"/api/workspaces/{workspace.slug}/user-issues/{env['user'].id}/")
        assert res.status_code == status.HTTP_200_OK
        assert count_by_id(results(res.data))[str(parent.id)] == 2

        Issue.objects.filter(pk=parent.pk).update(archived_at=timezone.now().date(), state=env["states"]["done"])
        res = session_client.get(f"{env['base']}/archived-issues/")
        assert res.status_code == status.HTTP_200_OK
        assert count_by_id(results(res.data))[str(parent.id)] == 2


class TestSearch:
    def test_parent_search(self, session_client, env):
        issue = make(env)
        own_child = make(env, parent=issue)
        top = make(env)
        other_child = make(env, parent=top)
        res = session_client.get(f"{env['base']}/search-issues/?parent=true&issue_id={issue.id}")
        assert res.status_code == status.HTTP_200_OK
        ids = {str(row["id"]) for row in res.data}
        assert str(top.id) in ids
        assert not ids & {str(issue.id), str(own_child.id), str(other_child.id)}

    def test_sub_issue_search(self, session_client, env):
        issue = make(env)
        make(env, parent=issue)
        free = make(env)
        has_kids = make(env)
        make(env, parent=has_kids)
        res = session_client.get(f"{env['base']}/search-issues/?sub_issue=true&issue_id={issue.id}")
        assert res.status_code == status.HTTP_200_OK
        assert {str(row["id"]) for row in res.data} == {str(free.id)}

    def test_sub_issue_search_for_subtask_is_empty(self, session_client, env):
        top = make(env)
        sub = make(env, parent=top)
        make(env)
        res = session_client.get(f"{env['base']}/search-issues/?sub_issue=true&issue_id={sub.id}")
        assert res.status_code == status.HTTP_200_OK
        assert list(res.data) == []

    def test_sub_issue_search_unknown_issue_does_not_crash(self, session_client, env):
        free = make(env)
        missing = "00000000-0000-4000-8000-000000000000"
        res = session_client.get(f"{env['base']}/search-issues/?sub_issue=true&issue_id={missing}")
        assert res.status_code == status.HTTP_200_OK
        assert str(free.id) in {str(row["id"]) for row in res.data}


@pytest.fixture
def celery_eager():
    """Run Celery tasks in-process; there is no broker in the test stack."""
    original_always_eager = celery_app.conf.task_always_eager
    original_eager_propagates = celery_app.conf.task_eager_propagates
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False
    yield
    celery_app.conf.task_always_eager = original_always_eager
    celery_app.conf.task_eager_propagates = original_eager_propagates


def test_end_to_end_parent_auto_done(session_client, env, celery_eager, django_capture_on_commit_callbacks):
    parent = make(env)
    done_child = make(env, "done", parent=parent)
    make(env, "cancelled", parent=parent)
    last = make(env, parent=parent)
    assert done_child

    with django_capture_on_commit_callbacks(execute=True):
        res = session_client.patch(
            f"{env['base']}/issues/{last.id}/", {"state_id": str(env["states"]["done"].id)}, format="json"
        )
    assert res.status_code == status.HTTP_204_NO_CONTENT

    parent.refresh_from_db()
    assert parent.state_id == env["states"]["done"].id
    assert parent.completed_at is not None
    activity = IssueActivity.objects.filter(issue=parent, field="state").get()
    assert activity.actor_id == env["user"].id
    assert activity.new_identifier == env["states"]["done"].id


def test_end_to_end_open_sibling_keeps_parent_open(
    session_client, env, celery_eager, django_capture_on_commit_callbacks
):
    parent = make(env)
    make(env, parent=parent)
    other = make(env, parent=parent)
    with django_capture_on_commit_callbacks(execute=True):
        res = session_client.patch(
            f"{env['base']}/issues/{other.id}/", {"state_id": str(env["states"]["done"].id)}, format="json"
        )
    assert res.status_code == status.HTTP_204_NO_CONTENT
    parent.refresh_from_db()
    assert parent.state_id == env["states"]["todo"].id
