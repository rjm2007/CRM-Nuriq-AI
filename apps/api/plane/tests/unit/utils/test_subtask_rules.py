# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: plane.utils.subtask_rules (one level, dates, search filters, completed count)."""

from datetime import date
from uuid import uuid4

import pytest
from django.utils import timezone

from plane.db.models import Issue, Project
from plane.tests.factories import IssueFactory, StateFactory
from plane.utils.subtask_rules import (
    PARENT_DATE_BEFORE_SUBTASKS,
    SUBTASK_DATE_AFTER_PARENT,
    SUBTASK_HAS_CHILDREN,
    SUBTASK_PARENT_IS_SUBTASK,
    SUBTASK_SELF_PARENT,
    SubtaskRuleError,
    completed_sub_issues_count_expr,
    filter_child_candidates,
    filter_parent_candidates,
    validate_bulk_attach,
    validate_bulk_target_dates,
    validate_issue_hierarchy,
)

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    return Project.objects.create(name="Rules", identifier="RUL", workspace=workspace, created_by=create_user)


def make(project, **kwargs):
    return IssueFactory(project=project, workspace=project.workspace, **kwargs)


def code_of(callable_, *args, **kwargs):
    with pytest.raises(SubtaskRuleError) as exc:
        callable_(*args, **kwargs)
    return exc.value


class TestSubtaskRuleError:
    def test_to_drf_error(self):
        err = SubtaskRuleError("X", "parent_id", "msg", extra={"a": 1})
        assert err.to_drf_error() == {"parent_id": ["msg"], "error_code": "X", "a": 1}

    def test_to_bulk_error(self):
        issue_id = uuid4()
        err = SubtaskRuleError("X", "f", "msg", issue_ids=[issue_id])
        assert err.to_bulk_error() == {"error": "msg", "error_code": "X", "issue_ids": [str(issue_id)]}


class TestValidateIssueHierarchy:
    def test_create_with_top_level_parent_ok(self, project):
        parent = make(project)
        validate_issue_hierarchy(None, {"parent": parent}, "parent_id", attr_key="parent")

    def test_self_parent(self, project):
        issue = make(project)
        err = code_of(validate_issue_hierarchy, issue, {"parent": issue}, "parent_id", attr_key="parent")
        assert err.code == SUBTASK_SELF_PARENT
        assert err.to_drf_error()["parent_id"]

    def test_parent_is_subtask(self, project):
        top = make(project)
        sub = make(project, parent=top)
        err = code_of(validate_issue_hierarchy, None, {"parent": sub}, "parent", attr_key="parent")
        assert err.code == SUBTASK_PARENT_IS_SUBTASK

    def test_has_children_counts_archived(self, project):
        issue = make(project)
        make(project, parent=issue, archived_at=timezone.now().date())
        other = make(project)
        err = code_of(validate_issue_hierarchy, issue, {"parent": other}, "parent_id", attr_key="parent")
        assert err.code == SUBTASK_HAS_CHILDREN

    def test_parent_given_as_id(self, project):
        top = make(project)
        sub = make(project, parent=top)
        err = code_of(validate_issue_hierarchy, None, {"parent": sub.id}, "parent")
        assert err.code == SUBTASK_PARENT_IS_SUBTASK

    def test_date_after_parent(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        err = code_of(
            validate_issue_hierarchy,
            None,
            {"parent": parent, "target_date": date(2026, 1, 11)},
            "parent_id",
            attr_key="parent",
        )
        assert err.code == SUBTASK_DATE_AFTER_PARENT
        assert err.field == "target_date"

    def test_date_equal_to_parent_ok(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        validate_issue_hierarchy(None, {"parent": parent, "target_date": date(2026, 1, 10)}, "parent")

    def test_partial_update_falls_back_to_instance_parent(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        child = make(project, parent=parent)
        err = code_of(validate_issue_hierarchy, child, {"target_date": date(2026, 2, 1)}, "parent")
        assert err.code == SUBTASK_DATE_AFTER_PARENT

    def test_explicit_none_parent_clears(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        child = make(project, parent=parent)
        validate_issue_hierarchy(child, {"parent": None, "target_date": date(2026, 2, 1)}, "parent")

    def test_null_dates_allowed(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        child = make(project, parent=parent, target_date=date(2026, 1, 5))
        validate_issue_hierarchy(child, {"target_date": None}, "parent")
        validate_issue_hierarchy(parent, {"target_date": None}, "parent")
        no_date_parent = make(project)
        validate_issue_hierarchy(None, {"parent": no_date_parent, "target_date": date(2030, 1, 1)}, "parent")

    def test_parent_date_before_subtasks(self, project):
        parent = make(project, target_date=date(2026, 1, 31))
        a = make(project, parent=parent, target_date=date(2026, 1, 20))
        b = make(project, parent=parent, target_date=date(2026, 1, 25))
        make(project, parent=parent, target_date=date(2026, 1, 5))
        err = code_of(validate_issue_hierarchy, parent, {"target_date": date(2026, 1, 15)}, "parent")
        assert err.code == PARENT_DATE_BEFORE_SUBTASKS
        data = err.to_drf_error()
        assert data["subtask_identifiers"] == sorted([f"RUL-{a.sequence_id}", f"RUL-{b.sequence_id}"])
        assert data["latest_subtask_target_date"] == "2026-01-25"

    def test_parent_date_ignores_archived_subtasks(self, project):
        parent = make(project, target_date=date(2026, 1, 31))
        make(project, parent=parent, target_date=date(2026, 1, 25), archived_at=timezone.now().date())
        validate_issue_hierarchy(parent, {"target_date": date(2026, 1, 15)}, "parent")

    def test_unrelated_partial_update_skips(self, project, django_assert_num_queries):
        parent = make(project, target_date=date(2026, 1, 10))
        child = make(project, parent=parent, target_date=date(2026, 1, 1))
        with django_assert_num_queries(0):
            validate_issue_hierarchy(child, {"name": "x"}, "parent")

    def test_date_overrides(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        child = make(project, parent=parent, target_date=date(2026, 1, 5))
        # Moving the parent earlier is fine when the child moves too.
        validate_issue_hierarchy(
            parent, {"target_date": "2026-01-03"}, "parent", date_overrides={child.id: "2026-01-02"}
        )
        # Moving the child later is fine when the parent moves too.
        validate_issue_hierarchy(
            child, {"target_date": "2026-01-20"}, "parent", date_overrides={parent.id: "2026-01-25"}
        )


class TestValidateBulkTargetDates:
    def test_batch_overrides_and_row_id(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        child = make(project, parent=parent, target_date=date(2026, 1, 5))
        issues = {str(parent.id): parent, str(child.id): child}
        validate_bulk_target_dates(
            issues,
            [{"id": str(parent.id), "target_date": "2026-01-30"}, {"id": str(child.id), "target_date": "2026-01-29"}],
        )
        err = code_of(validate_bulk_target_dates, issues, [{"id": str(child.id), "target_date": "2026-01-29"}])
        assert err.code == SUBTASK_DATE_AFTER_PARENT
        assert err.issue_ids == [str(child.id)]


class TestValidateBulkAttach:
    def test_ok(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        validate_bulk_attach(parent, [make(project), make(project, target_date=date(2026, 1, 10))])

    def test_parent_is_subtask(self, project):
        top = make(project)
        sub = make(project, parent=top)
        err = code_of(validate_bulk_attach, sub, [make(project)])
        assert err.code == SUBTASK_PARENT_IS_SUBTASK
        assert err.issue_ids == [str(sub.id)]

    def test_self(self, project):
        parent = make(project)
        assert code_of(validate_bulk_attach, parent, [parent]).code == SUBTASK_SELF_PARENT

    def test_child_has_children(self, project):
        parent = make(project)
        child = make(project)
        make(project, parent=child)
        err = code_of(validate_bulk_attach, parent, [make(project), child])
        assert err.code == SUBTASK_HAS_CHILDREN
        assert err.issue_ids == [str(child.id)]

    def test_child_date_after_parent(self, project):
        parent = make(project, target_date=date(2026, 1, 10))
        late = make(project, target_date=date(2026, 1, 11))
        err = code_of(validate_bulk_attach, parent, [make(project), late])
        assert err.code == SUBTASK_DATE_AFTER_PARENT
        assert err.issue_ids == [str(late.id)]


class TestSearchFilters:
    def test_parent_candidates(self, project):
        issue = make(project)
        child = make(project, parent=issue)
        top = make(project)
        other_parent = make(project)
        other_child = make(project, parent=other_parent)
        ids = set(filter_parent_candidates(Issue.issue_objects.all(), issue.id).values_list("id", flat=True))
        assert top.id in ids and other_parent.id in ids
        assert issue.id not in ids and child.id not in ids and other_child.id not in ids

    def test_child_candidates(self, project):
        issue = make(project)
        own_child = make(project, parent=issue)
        free = make(project)
        has_kids = make(project)
        make(project, parent=has_kids)
        ids = set(filter_child_candidates(Issue.issue_objects.all(), issue.id).values_list("id", flat=True))
        assert ids == {free.id}
        assert own_child.id not in ids

    def test_child_candidates_empty_for_subtask(self, project):
        top = make(project)
        sub = make(project, parent=top)
        make(project)
        assert not filter_child_candidates(Issue.issue_objects.all(), sub.id).exists()

    @pytest.mark.parametrize("bad_id", [uuid4(), "not-a-uuid", None])
    def test_missing_or_bad_issue_id_does_not_crash(self, project, bad_id):
        free = make(project)
        assert free.id in set(filter_child_candidates(Issue.issue_objects.all(), bad_id).values_list("id", flat=True))
        assert free.id in set(filter_parent_candidates(Issue.issue_objects.all(), bad_id).values_list("id", flat=True))


class TestCompletedSubIssuesCount:
    def test_counts_completed_only(self, project):
        done = StateFactory(project=project, group="completed")
        cancelled = StateFactory(project=project, group="cancelled")
        todo = StateFactory(project=project, group="unstarted")
        parent = make(project, state=todo)
        make(project, parent=parent, state=done)
        make(project, parent=parent, state=done)
        make(project, parent=parent, state=cancelled)
        make(project, parent=parent, state=todo)
        make(project, parent=parent, state=done, archived_at=timezone.now().date())
        lonely = make(project, state=todo)
        counts = dict(
            Issue.issue_objects.filter(pk__in=[parent.id, lonely.id])
            .annotate(c=completed_sub_issues_count_expr())
            .values_list("id", "c")
        )
        assert counts == {parent.id: 2, lonely.id: 0}
