# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: worklog.activity.* mappers (plane.bgtasks.worklog_activity) via issue_activity."""

import json
from unittest import mock

import pytest
from django.utils import timezone

from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import IssueActivity, Project
from plane.tests.factories import IssueFactory

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="WL", identifier="WLA", workspace=workspace, created_by=create_user)
    issue = IssueFactory(project=project, workspace=workspace)
    return {"project": project, "issue": issue, "user": create_user}


def entry(env, **kwargs):
    data = {
        "id": "0b6f4f43-8a1d-4b0a-9a51-8a4a7d1b2c3d",
        "user": str(env["user"].id),
        "user_detail": {"display_name": "me"},
        "started_at": "2026-01-01T10:00:00Z",
        "duration_minutes": 90,
        "note": "",
    }
    data.update(kwargs)
    return data


def run(env, kind, requested, current):
    with mock.patch("plane.bgtasks.issue_activities_task.notifications.delay") as notify:
        issue_activity(
            type=f"worklog.activity.{kind}",
            requested_data=json.dumps(requested) if requested is not None else None,
            current_instance=json.dumps(current) if current is not None else None,
            issue_id=str(env["issue"].id),
            actor_id=str(env["user"].id),
            project_id=str(env["project"].id),
            epoch=int(timezone.now().timestamp()),
            notification=False,
        )
    notify.assert_not_called()
    return list(IssueActivity.objects.filter(issue=env["issue"], field="worklog"))


def test_created(env):
    rows = run(env, "created", entry(env), None)
    assert len(rows) == 1
    row = rows[0]
    assert row.verb == "created"
    assert row.new_value == "90"
    assert str(row.new_identifier) == entry(env)["id"]
    assert row.comment == "logged 90 minutes"
    assert row.actor_id == env["user"].id


def test_created_on_behalf_names_user(env):
    rows = run(
        env,
        "created",
        entry(env, user="11111111-1111-1111-1111-111111111111", user_detail={"display_name": "sam"}),
        None,
    )
    assert rows[0].comment == "logged 90 minutes for sam"


def test_updated(env):
    rows = run(env, "updated", entry(env, duration_minutes=120), entry(env))
    assert len(rows) == 1
    assert rows[0].verb == "updated"
    assert (rows[0].old_value, rows[0].new_value) == ("90", "120")
    assert rows[0].comment == "updated logged time from 90 to 120 minutes"


def test_updated_note_only(env):
    rows = run(env, "updated", entry(env, note="more"), entry(env))
    assert len(rows) == 1
    assert (rows[0].old_value, rows[0].new_value) == ("90", "90")


def test_noop_update_writes_no_row(env):
    assert run(env, "updated", entry(env), entry(env)) == []


def test_deleted(env):
    rows = run(env, "deleted", {"worklog_id": entry(env)["id"]}, entry(env))
    assert len(rows) == 1
    assert rows[0].verb == "deleted"
    assert rows[0].old_value == "90"
    assert rows[0].new_value == ""
    assert str(rows[0].old_identifier) == entry(env)["id"]
