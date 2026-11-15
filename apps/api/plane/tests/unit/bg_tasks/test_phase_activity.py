# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: ``phase`` IssueActivity fan-out when a keyword joins, leaves or moves phase (Step 2)."""

from unittest import mock

import pytest
from django.db import DatabaseError, InterfaceError, OperationalError
from django.utils import timezone

from plane.bgtasks.phase_activity import phase_module_activity
from plane.celery import app as celery_app
from plane.db.models import IssueActivity, ModuleIssue, Project
from plane.tests.factories import IssueFactory, ModuleFactory, PhaseFactory
from plane.utils import keyword_map as km

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def celery_eager():
    original = (celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates)
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates = original


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="Map", identifier="MAP", workspace=workspace, created_by=create_user)
    module = ModuleFactory(project=project)
    issues = [IssueFactory(project=project, workspace=workspace) for _ in range(3)]
    for issue in issues[:2]:
        ModuleIssue.objects.create(module=module, issue=issue, project=project)
    # the third issue is in the keyword but deleted, so it gets no row
    ModuleIssue.objects.create(module=module, issue=issues[2], project=project)
    issues[2].deleted_at = timezone.now()
    issues[2].save()
    return {"project": project, "module": module, "issues": issues, "user": create_user}


def rows(env):
    return list(IssueActivity.objects.filter(project=env["project"], field="phase").order_by("created_at"))


def test_assign_writes_one_row_per_live_work_item(env, django_capture_on_commit_callbacks):
    phase = PhaseFactory(project=env["project"], name="Build")
    with django_capture_on_commit_callbacks(execute=True):
        km.assign_modules_to_phase(phase, [env["module"].id], env["user"])
    written = rows(env)
    assert sorted(r.issue_id for r in written) == sorted(i.id for i in env["issues"][:2])
    row = written[0]
    assert (row.verb, row.old_value, row.new_value) == ("updated", None, "Build")
    assert row.new_identifier == phase.id
    assert row.comment == "moved to phase Build"
    assert row.actor_id == env["user"].id


def test_move_and_remove(env, django_capture_on_commit_callbacks):
    a = PhaseFactory(project=env["project"], name="A")
    b = PhaseFactory(project=env["project"], name="B")
    with django_capture_on_commit_callbacks(execute=True):
        km.assign_modules_to_phase(a, [env["module"].id], env["user"])
    with django_capture_on_commit_callbacks(execute=True):
        km.assign_modules_to_phase(b, [env["module"].id], env["user"])
    moved = [r for r in rows(env) if r.new_value == "B"]
    assert len(moved) == 2 and all(r.old_value == "A" for r in moved)
    with django_capture_on_commit_callbacks(execute=True):
        km.remove_module_from_phase(b, env["module"].id, env["user"])
    removed = [r for r in rows(env) if r.new_value is None]
    assert len(removed) == 2
    assert removed[0].comment == "removed from phase B"


def test_delete_phase_fans_out(env, django_capture_on_commit_callbacks):
    phase = PhaseFactory(project=env["project"], name="Gone")
    with django_capture_on_commit_callbacks(execute=True):
        km.assign_modules_to_phase(phase, [env["module"].id], env["user"])
    with django_capture_on_commit_callbacks(execute=True):
        km.delete_phase(phase, env["user"])
    assert len([r for r in rows(env) if r.old_value == "Gone" and r.new_value is None]) == 2


def test_task_is_idempotent_and_silent(env):
    move = {
        "module_id": str(env["module"].id),
        "old_phase_id": None,
        "old_phase_name": None,
        "new_phase_id": "11111111-1111-1111-1111-111111111111",
        "new_phase_name": "X",
    }
    kwargs = {"project_id": str(env["project"].id), "actor_id": str(env["user"].id), "moves": [move], "epoch": 42}
    with mock.patch("plane.bgtasks.issue_activities_task.notifications.delay") as notify:
        assert phase_module_activity(**kwargs) == 2
        assert phase_module_activity(**kwargs) == 0
    notify.assert_not_called()
    assert len(rows(env)) == 2


def test_unknown_project_is_noop(env):
    assert phase_module_activity("22222222-2222-2222-2222-222222222222", None, [], 1) == 0


def _kwargs(env, epoch=42.5):
    move = {
        "module_id": str(env["module"].id),
        "old_phase_id": None,
        "old_phase_name": None,
        "new_phase_id": "11111111-1111-1111-1111-111111111111",
        "new_phase_name": "X",
    }
    return {"project_id": str(env["project"].id), "actor_id": str(env["user"].id), "moves": [move], "epoch": epoch}


def test_task_options_retry_and_limits():
    retry_on = tuple(phase_module_activity.autoretry_for)
    assert all(issubclass(error, retry_on) for error in (DatabaseError, InterfaceError, OperationalError))
    assert phase_module_activity.max_retries and phase_module_activity.retry_jitter
    assert phase_module_activity.acks_late
    assert phase_module_activity.soft_time_limit < phase_module_activity.time_limit


@pytest.mark.parametrize("error", [DatabaseError, InterfaceError, OperationalError])
def test_retryable_errors_are_raised_not_swallowed(env, error):
    with mock.patch("plane.bgtasks.phase_activity._module_issue_pairs", side_effect=error("db down")):
        with pytest.raises(error):
            phase_module_activity(**_kwargs(env))
    assert rows(env) == []


def test_other_errors_are_logged_and_return_zero(env):
    with mock.patch("plane.bgtasks.phase_activity._module_issue_pairs", side_effect=ValueError("bad")):
        with mock.patch("plane.bgtasks.phase_activity.log_exception") as log:
            assert phase_module_activity(**_kwargs(env)) == 0
    log.assert_called_once()


def test_small_write_batches_stay_idempotent(env):
    with mock.patch("plane.bgtasks.phase_activity.BATCH_SIZE", 1):
        assert phase_module_activity(**_kwargs(env)) == 2
        assert phase_module_activity(**_kwargs(env)) == 0
    assert len(rows(env)) == 2


def test_many_keywords_one_grouped_query(env, django_assert_max_num_queries):
    modules = [env["module"]] + [ModuleFactory(project=env["project"]) for _ in range(5)]
    for module in modules[1:]:
        ModuleIssue.objects.create(module=module, issue=env["issues"][0], project=env["project"])
    moves = [{**_kwargs(env)["moves"][0], "module_id": str(m.id)} for m in modules]
    # project lookup + grouped ModuleIssue read + (dedupe read + insert) per write chunk, plus savepoints
    with django_assert_max_num_queries(8):
        created = phase_module_activity(**{**_kwargs(env), "moves": moves})
    assert created == 2 + 5


def test_back_and_forth_within_one_second_keeps_every_move(env, django_capture_on_commit_callbacks):
    a = PhaseFactory(project=env["project"], name="A")
    b = PhaseFactory(project=env["project"], name="B")
    for phase in (a, b, a, b):
        with django_capture_on_commit_callbacks(execute=True):
            km.assign_modules_to_phase(phase, [env["module"].id], env["user"])
    a_to_b = [r for r in rows(env) if r.old_value == "A" and r.new_value == "B"]
    assert len(a_to_b) == 4  # two live work items x two A->B moves
    assert len({r.epoch for r in a_to_b}) == 2
