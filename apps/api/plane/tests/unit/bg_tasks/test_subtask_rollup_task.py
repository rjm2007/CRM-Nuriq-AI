# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: parent auto-done (plane.bgtasks.subtask_rollup_task)."""

import json
from unittest import mock

import pytest
from django.utils import timezone

from plane.bgtasks.issue_activities_task import issue_activity
from plane.bgtasks.subtask_rollup_task import (
    SUBTASK_ROLLUP_COMMENT,
    enqueue_parent_rollup,
    subtask_rollup,
)
from plane.db.models import Issue, IssueActivity, Project, ProjectMember
from plane.tests.factories import IssueFactory, StateFactory

pytestmark = [pytest.mark.unit, pytest.mark.django_db(transaction=True)]


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="Roll", identifier="ROL", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    states = {
        "todo": StateFactory(project=project, name="Todo", group="unstarted"),
        "doing": StateFactory(project=project, name="Doing", group="started"),
        "done": StateFactory(project=project, name="Done", group="completed"),
        "done2": StateFactory(project=project, name="Shipped", group="completed"),
        "cancelled": StateFactory(project=project, name="Cancelled", group="cancelled"),
    }
    parent = IssueFactory(project=project, workspace=workspace, state=states["todo"])
    return {"project": project, "user": create_user, "states": states, "parent": parent}


def child(env, state, **kwargs):
    return IssueFactory(
        project=env["project"],
        workspace=env["project"].workspace,
        parent=env["parent"],
        state=env["states"][state],
        **kwargs,
    )


def run(env):
    with mock.patch("plane.bgtasks.issue_activities_task.issue_activity.delay") as delay:
        result = subtask_rollup(str(env["parent"].id), str(env["project"].id), str(env["user"].id))
    env["parent"].refresh_from_db()
    return result, delay


def test_happy_path_moves_parent_to_first_completed_state(env):
    child(env, "done")
    child(env, "done2")
    result, delay = run(env)
    parent = env["parent"]
    assert parent.state_id == env["states"]["done"].id
    assert result == str(env["states"]["done"].id)
    assert parent.completed_at is not None
    delay.assert_called_once()
    kwargs = delay.call_args.kwargs
    assert kwargs["issue_id"] == str(parent.id)
    assert kwargs["actor_id"] == str(env["user"].id)
    assert kwargs["notification"] is True and kwargs["subscriber"] is False
    assert json.loads(kwargs["requested_data"]) == {"subtask_rollup": str(env["states"]["done"].id)}


def test_lowest_sequence_completed_state_wins(env):
    env["states"]["done2"].sequence = 1
    env["states"]["done2"].save()
    child(env, "done")
    run(env)
    assert env["parent"].state_id == env["states"]["done2"].id


def test_cancelled_siblings_ignored(env):
    child(env, "done")
    child(env, "cancelled")
    run(env)
    assert env["parent"].state_id == env["states"]["done"].id


def test_all_cancelled_no_change(env):
    child(env, "cancelled")
    child(env, "cancelled")
    result, delay = run(env)
    assert result is None
    assert env["parent"].state_id == env["states"]["todo"].id
    delay.assert_not_called()


def test_open_child_no_change(env):
    child(env, "done")
    child(env, "doing")
    run(env)
    assert env["parent"].state_id == env["states"]["todo"].id


def test_no_children_no_change(env):
    run(env)
    assert env["parent"].state_id == env["states"]["todo"].id


@pytest.mark.parametrize("parent_state", ["done2", "cancelled"])
def test_parent_already_closed_no_change(env, parent_state):
    Issue.objects.filter(pk=env["parent"].pk).update(state=env["states"][parent_state])
    child(env, "done")
    result, delay = run(env)
    assert result is None
    assert env["parent"].state_id == env["states"][parent_state].id
    delay.assert_not_called()


def test_no_completed_state_no_change(env):
    child(env, "done")
    # Children keep their state row; the project just has no completed state to pick.
    with mock.patch("plane.bgtasks.subtask_rollup_task.State.objects") as states:
        states.filter.return_value.order_by.return_value.first.return_value = None
        result, _ = run(env)
    assert result is None
    assert env["parent"].state_id == env["states"]["todo"].id


def test_archived_children_ignored(env):
    child(env, "done")
    child(env, "doing", archived_at=timezone.now().date())
    run(env)
    assert env["parent"].state_id == env["states"]["done"].id


def test_deleted_children_ignored(env):
    child(env, "done")
    open_child = child(env, "doing")
    open_child.delete()
    run(env)
    assert env["parent"].state_id == env["states"]["done"].id


def test_running_twice_is_safe(env):
    child(env, "done")
    first, delay1 = run(env)
    second, delay2 = run(env)
    assert first is not None and second is None
    assert delay1.call_count == 1 and delay2.call_count == 0
    assert env["parent"].state_id == env["states"]["done"].id


def test_rollup_activity_is_logged_as_state_activity(env):
    child(env, "done")
    with mock.patch("plane.bgtasks.issue_activities_task.notifications.delay"):
        with mock.patch("plane.bgtasks.issue_activities_task.issue_activity.delay") as delay:
            subtask_rollup(str(env["parent"].id), str(env["project"].id), str(env["user"].id))
        issue_activity(**delay.call_args.kwargs)
    activity = IssueActivity.objects.get(issue=env["parent"], field="state")
    assert activity.comment == SUBTASK_ROLLUP_COMMENT
    assert activity.actor_id == env["user"].id
    assert activity.new_identifier == env["states"]["done"].id
    assert activity.old_identifier == env["states"]["todo"].id


class TestEnqueueParentRollup:
    def _activity(self, field="state", comment="updated the state to"):
        return IssueActivity(field=field, comment=comment)

    def test_fires_for_child_state_activity(self, env):
        c = child(env, "done")
        with mock.patch("plane.bgtasks.subtask_rollup_task.subtask_rollup.delay") as delay:
            enqueue_parent_rollup(c, [self._activity("name"), self._activity()], env["user"].id)
        delay.assert_called_once_with(
            parent_id=str(env["parent"].id), project_id=str(env["project"].id), actor_id=str(env["user"].id)
        )

    def test_skips_non_state_activity(self, env):
        c = child(env, "done")
        with mock.patch("plane.bgtasks.subtask_rollup_task.subtask_rollup.delay") as delay:
            enqueue_parent_rollup(c, [self._activity("name")], env["user"].id)
        delay.assert_not_called()

    def test_skips_top_level_issue(self, env):
        with mock.patch("plane.bgtasks.subtask_rollup_task.subtask_rollup.delay") as delay:
            enqueue_parent_rollup(env["parent"], [self._activity()], env["user"].id)
            enqueue_parent_rollup(None, [self._activity()], env["user"].id)
        delay.assert_not_called()

    def test_skips_rollup_activity(self, env):
        c = child(env, "done")
        with mock.patch("plane.bgtasks.subtask_rollup_task.subtask_rollup.delay") as delay:
            enqueue_parent_rollup(c, [self._activity(comment=SUBTASK_ROLLUP_COMMENT)], env["user"].id)
        delay.assert_not_called()

    def test_issue_activity_hook_calls_enqueue_for_child_state_change(self, env):
        c = child(env, "todo")
        with (
            mock.patch("plane.bgtasks.subtask_rollup_task.subtask_rollup.delay") as delay,
            mock.patch("plane.bgtasks.issue_activities_task.notifications.delay"),
        ):
            issue_activity(
                type="issue.activity.updated",
                requested_data=json.dumps({"state_id": str(env["states"]["done"].id)}),
                current_instance=json.dumps({"state_id": str(env["states"]["todo"].id)}),
                issue_id=str(c.id),
                project_id=str(env["project"].id),
                actor_id=str(env["user"].id),
                epoch=int(timezone.now().timestamp()),
            )
            issue_activity(
                type="issue.activity.updated",
                requested_data=json.dumps({"name": "renamed"}),
                current_instance=json.dumps({"name": "old"}),
                issue_id=str(c.id),
                project_id=str(env["project"].id),
                actor_id=str(env["user"].id),
                epoch=int(timezone.now().timestamp()),
            )
        delay.assert_called_once()
