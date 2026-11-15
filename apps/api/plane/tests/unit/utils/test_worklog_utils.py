# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: time-tracking helpers in plane.utils.worklog."""

from datetime import datetime, timezone as dt_timezone
from types import SimpleNamespace

import pytest
from django.utils import timezone
from rest_framework import serializers

from plane.db.models import Issue, IssueWorkLog, Project, ProjectMember
from plane.tests.factories import IssueFactory, IssueWorkLogFactory, UserFactory
from plane.utils.worklog import (
    TimeTrackingDisabled,
    apply_worklog_filters,
    can_manage_worklog,
    ensure_time_tracking_enabled,
    logged_minutes_expr,
    total_logged_minutes_expr,
    worklog_errors,
    worklog_summary,
)

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="WL", identifier="WLU", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    parent = IssueFactory(project=project, workspace=workspace)
    return {"project": project, "workspace": workspace, "user": create_user, "parent": parent}


def sub(env, **kwargs):
    return IssueFactory(project=env["project"], workspace=env["workspace"], parent=env["parent"], **kwargs)


def log(env, issue, minutes, **kwargs):
    kwargs.setdefault("user", env["user"])
    return IssueWorkLogFactory(issue=issue, duration_minutes=minutes, **kwargs)


def totals(issue):
    row = (
        Issue.all_objects.filter(pk=issue.pk)
        .annotate(own=logged_minutes_expr(), total=total_logged_minutes_expr())
        .values("own", "total")
        .get()
    )
    return row["own"], row["total"]


class TestRollup:
    def test_zero_when_nothing_logged(self, env):
        assert totals(env["parent"]) == (0, 0)

    def test_own_vs_total(self, env):
        log(env, env["parent"], 30)
        log(env, env["parent"], 15)
        child = sub(env)
        log(env, child, 60)
        assert totals(env["parent"]) == (45, 105)
        assert totals(child) == (60, 60)

    def test_archived_subtask_counted(self, env):
        child = sub(env, archived_at=timezone.now())
        log(env, child, 40)
        assert totals(env["parent"]) == (0, 40)

    def test_deleted_subtask_excluded(self, env):
        child = sub(env)
        log(env, child, 40)
        Issue.all_objects.filter(pk=child.pk).update(deleted_at=timezone.now())
        assert totals(env["parent"]) == (0, 0)

    def test_deleted_entry_excluded(self, env):
        entry = log(env, env["parent"], 40)
        log(env, env["parent"], 10)
        IssueWorkLog.all_objects.filter(pk=entry.pk).update(deleted_at=timezone.now())
        assert totals(env["parent"]) == (10, 10)

    def test_grandchildren_not_counted(self, env):
        child = sub(env)
        grandchild = IssueFactory(project=env["project"], workspace=env["workspace"], parent=child)
        log(env, grandchild, 5)
        assert totals(env["parent"]) == (0, 0)


class TestRules:
    def test_flag_off_raises_403(self, env):
        with pytest.raises(TimeTrackingDisabled) as exc:
            ensure_time_tracking_enabled(env["project"])
        assert exc.value.status_code == 403
        assert exc.value.detail["error_code"] == "TIME_TRACKING_DISABLED"

    def test_flag_on_passes(self, env):
        env["project"].is_time_tracking_enabled = True
        ensure_time_tracking_enabled(env["project"])

    def test_can_manage(self):
        me = SimpleNamespace(id=1)
        assert can_manage_worklog(me, SimpleNamespace(user_id=1), False)
        assert not can_manage_worklog(me, SimpleNamespace(user_id=2), False)
        assert can_manage_worklog(me, SimpleNamespace(user_id=2), True)

    def test_worklog_errors_flattens_code(self):
        assert worklog_errors({"user": ["x"], "error_code": ["INVALID_WORKLOG_USER"]})["error_code"] == (
            "INVALID_WORKLOG_USER"
        )
        assert worklog_errors({"note": ["x"]}) == {"note": ["x"]}


class TestFilters:
    def test_filters_and_summary(self, env):
        other = UserFactory()
        child = sub(env)
        a = log(env, env["parent"], 30, started_at=datetime(2026, 1, 1, 10, tzinfo=dt_timezone.utc))
        b = log(env, child, 20, started_at=datetime(2026, 1, 2, 10, tzinfo=dt_timezone.utc))
        c = log(env, env["parent"], 50, user=other, started_at=datetime(2026, 1, 3, 10, tzinfo=dt_timezone.utc))
        qs = IssueWorkLog.objects.filter(project=env["project"])

        def ids(params):
            return set(apply_worklog_filters(qs, params).values_list("id", flat=True))

        assert ids({"user": str(other.id)}) == {c.id}
        assert ids({"user": f"{env['user'].id},{other.id}"}) == {a.id, b.id, c.id}
        assert ids({"issue": str(env["parent"].id)}) == {a.id, c.id}
        assert ids({"issue": str(env["parent"].id), "include_subtasks": "true"}) == {a.id, b.id, c.id}
        assert ids({"started_at__gte": "2026-01-02"}) == {b.id, c.id}
        assert ids({"started_at__lt": "2026-01-02T10:00:00Z"}) == {a.id}

        summary = worklog_summary(apply_worklog_filters(qs, {}))
        assert summary["total_minutes"] == 100
        assert summary["by_user"] == [
            {"user_id": str(other.id), "minutes": 50},
            {"user_id": str(env["user"].id), "minutes": 50},
        ] or summary["by_user"] == [
            {"user_id": str(env["user"].id), "minutes": 50},
            {"user_id": str(other.id), "minutes": 50},
        ]

    @pytest.mark.parametrize(
        "params",
        [{"user": "nope"}, {"issue": "nope"}, {"started_at__gte": "yesterday"}, {"started_at__lt": "2026-13-45"}],
    )
    def test_bad_filters(self, env, params):
        with pytest.raises(serializers.ValidationError) as exc:
            apply_worklog_filters(IssueWorkLog.objects.all(), params)
        assert exc.value.detail["error_code"] == "INVALID_WORKLOG_FILTER"


def test_no_extra_query_per_issue(env, django_assert_num_queries):
    for _ in range(3):
        log(env, sub(env), 10)
    with django_assert_num_queries(1):
        list(Issue.issue_objects.filter(project=env["project"]).annotate(total=total_logged_minutes_expr()))


def test_grouper_time_totals_opt_out_for_share_links(env):
    from plane.utils.grouper import issue_queryset_grouper

    log(env, env["parent"], 10)
    qs = Issue.issue_objects.filter(pk=env["parent"].pk)
    grouped = issue_queryset_grouper(qs, None, None)
    assert grouped.values_list("total_logged_minutes", flat=True).get() == 10
    # space (public share links) passes with_time_totals=False; issue_on_results then omits the field
    assert (
        "total_logged_minutes" not in issue_queryset_grouper(qs, None, None, with_time_totals=False).query.annotations
    )
