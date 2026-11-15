# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: subtask rules in the app, draft and public API issue serializers."""

from datetime import date

import pytest

from plane.api.serializers import IssueSerializer as ApiIssueSerializer
from plane.app.serializers import DraftIssueCreateSerializer, IssueCreateSerializer
from plane.db.models import DraftIssue, Project
from plane.tests.factories import IssueFactory

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    return Project.objects.create(name="Ser", identifier="SER", workspace=workspace, created_by=create_user)


def make(project, **kwargs):
    return IssueFactory(project=project, workspace=project.workspace, **kwargs)


def app_ctx(project):
    return {"project_id": project.id, "workspace_id": project.workspace_id, "default_assignee_id": None}


class TestAppIssueCreateSerializer:
    def test_create_under_subtask_rejected(self, project):
        top = make(project)
        sub = make(project, parent=top)
        serializer = IssueCreateSerializer(data={"name": "x", "parent_id": str(sub.id)}, context=app_ctx(project))
        assert not serializer.is_valid()
        assert serializer.errors["error_code"][0] == "SUBTASK_PARENT_IS_SUBTASK"
        assert "parent_id" in serializer.errors

    def test_patch_self_parent_rejected(self, project):
        issue = make(project)
        serializer = IssueCreateSerializer(
            issue, data={"parent_id": str(issue.id)}, partial=True, context=app_ctx(project)
        )
        assert not serializer.is_valid()
        assert serializer.errors["error_code"][0] == "SUBTASK_SELF_PARENT"

    def test_patch_date_after_parent_rejected(self, project):
        parent = make(project, target_date=date(2026, 3, 1))
        child = make(project, parent=parent)
        serializer = IssueCreateSerializer(
            child, data={"target_date": "2026-03-02"}, partial=True, context=app_ctx(project)
        )
        assert not serializer.is_valid()
        assert serializer.errors["error_code"][0] == "SUBTASK_DATE_AFTER_PARENT"
        assert "target_date" in serializer.errors

    def test_valid_subtask(self, project):
        parent = make(project, target_date=date(2026, 3, 1))
        serializer = IssueCreateSerializer(
            data={"name": "x", "parent_id": str(parent.id), "target_date": "2026-03-01"}, context=app_ctx(project)
        )
        assert serializer.is_valid(), serializer.errors


class TestDraftSerializer:
    def test_draft_under_subtask_rejected(self, project):
        top = make(project)
        sub = make(project, parent=top)
        serializer = DraftIssueCreateSerializer(data={"name": "d", "parent_id": str(sub.id)}, context=app_ctx(project))
        assert not serializer.is_valid()
        assert serializer.errors["error_code"][0] == "SUBTASK_PARENT_IS_SUBTASK"

    def test_draft_date_after_parent_rejected(self, project):
        parent = make(project, target_date=date(2026, 3, 1))
        draft = DraftIssue.objects.create(name="d", project=project, workspace=project.workspace, parent=parent)
        serializer = DraftIssueCreateSerializer(
            draft, data={"target_date": "2026-04-01"}, partial=True, context=app_ctx(project)
        )
        assert not serializer.is_valid()
        assert serializer.errors["error_code"][0] == "SUBTASK_DATE_AFTER_PARENT"


class TestApiIssueSerializer:
    def test_parent_is_subtask_rejected(self, project):
        top = make(project)
        sub = make(project, parent=top)
        serializer = ApiIssueSerializer(data={"name": "x", "parent": str(sub.id)}, context=app_ctx(project))
        assert not serializer.is_valid()
        assert serializer.errors["error_code"][0] == "SUBTASK_PARENT_IS_SUBTASK"
        assert "parent" in serializer.errors

    def test_parent_date_before_subtasks_rejected(self, project):
        parent = make(project, target_date=date(2026, 3, 10))
        make(project, parent=parent, target_date=date(2026, 3, 9))
        serializer = ApiIssueSerializer(
            parent, data={"target_date": "2026-03-01"}, partial=True, context=app_ctx(project)
        )
        assert not serializer.is_valid()
        assert serializer.errors["error_code"][0] == "PARENT_DATE_BEFORE_SUBTASKS"
        assert serializer.errors["latest_subtask_target_date"][0] == "2026-03-09"
