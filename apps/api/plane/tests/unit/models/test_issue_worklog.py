# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: IssueWorkLog model (duration constraint, soft delete, cascade from the issue)."""

from unittest import mock

import pytest
from django.db import IntegrityError, transaction

from plane.bgtasks.deletion_task import soft_delete_related_objects
from plane.db.models import IssueWorkLog, Project
from plane.tests.factories import IssueFactory, IssueWorkLogFactory

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def issue(workspace, create_user):
    project = Project.objects.create(name="WL", identifier="WLM", workspace=workspace, created_by=create_user)
    return IssueFactory(project=project, workspace=workspace)


@pytest.mark.parametrize("minutes", [0, 1441])
def test_duration_out_of_range_rejected_by_db(issue, create_user, minutes):
    with pytest.raises(IntegrityError), transaction.atomic():
        IssueWorkLogFactory(issue=issue, user=create_user, duration_minutes=minutes)


@pytest.mark.parametrize("minutes", [1, 1440])
def test_duration_bounds_allowed(issue, create_user, minutes):
    worklog = IssueWorkLogFactory(issue=issue, user=create_user, duration_minutes=minutes)
    assert IssueWorkLog.objects.get(pk=worklog.pk).duration_minutes == minutes


def test_workspace_follows_project(issue, create_user):
    worklog = IssueWorkLogFactory(issue=issue, user=create_user)
    assert worklog.workspace_id == issue.project.workspace_id


def test_soft_delete_hides_entry(issue, create_user):
    worklog = IssueWorkLogFactory(issue=issue, user=create_user)
    with mock.patch("plane.db.mixins.soft_delete_related_objects.delay"):
        worklog.delete()
    assert not IssueWorkLog.objects.filter(pk=worklog.pk).exists()
    assert IssueWorkLog.all_objects.get(pk=worklog.pk).deleted_at is not None


def test_issue_soft_delete_cascades_to_entries(issue, create_user):
    worklog = IssueWorkLogFactory(issue=issue, user=create_user)
    with mock.patch("plane.db.mixins.soft_delete_related_objects.delay"):
        issue.delete()
    # run the cascade task inline (it is .delay()ed in production)
    soft_delete_related_objects("db", "issue", issue.pk)
    assert IssueWorkLog.all_objects.get(pk=worklog.pk).deleted_at is not None
    assert not IssueWorkLog.objects.filter(pk=worklog.pk).exists()


def test_issue_hard_delete_cascades(issue, create_user):
    worklog = IssueWorkLogFactory(issue=issue, user=create_user)
    issue.delete(soft=False)
    assert not IssueWorkLog.all_objects.filter(pk=worklog.pk).exists()
