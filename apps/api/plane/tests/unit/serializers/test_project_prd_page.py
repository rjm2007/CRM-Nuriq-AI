# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: unit tests for ``validate_prd_page`` (app/serializers/neuric_project.py)."""

import pytest
from django.utils import timezone
from rest_framework import serializers

from plane.app.serializers.neuric_project import validate_prd_page
from plane.db.models import Page, Project, ProjectPage, Workspace
from plane.tests.factories import PageFactory, link_page_to_project


@pytest.fixture
def project(workspace):
    return Project.objects.create(name="PRD Project", identifier="PRD", workspace=workspace)


@pytest.fixture
def linked_page(project, create_user):
    page = PageFactory(workspace=project.workspace, owned_by=create_user)
    link_page_to_project(page, project)
    return page


def assert_rejected(page, project):
    with pytest.raises(serializers.ValidationError) as exc:
        validate_prd_page(page, project)
    assert "prd_page" in exc.value.detail


@pytest.mark.unit
class TestValidatePrdPage:
    @pytest.mark.django_db
    def test_none_is_allowed(self, project):
        assert validate_prd_page(None, project) is None

    @pytest.mark.django_db
    def test_public_linked_page_is_valid(self, project, linked_page):
        assert validate_prd_page(linked_page, project) == linked_page

    @pytest.mark.django_db
    def test_other_workspace_rejected(self, project, create_user):
        other_ws = Workspace.objects.create(name="Other WS", owner=create_user, slug="other-ws")
        other_project = Project.objects.create(name="Other", identifier="OTH", workspace=other_ws)
        page = PageFactory(workspace=other_ws, owned_by=create_user)
        link_page_to_project(page, other_project)
        assert_rejected(page, project)

    @pytest.mark.django_db
    def test_unlinked_page_rejected(self, project, create_user):
        page = PageFactory(workspace=project.workspace, owned_by=create_user)
        assert_rejected(page, project)

    @pytest.mark.django_db
    def test_page_linked_to_other_project_rejected(self, project, create_user):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=project.workspace)
        page = PageFactory(workspace=project.workspace, owned_by=create_user)
        link_page_to_project(page, other)
        assert_rejected(page, project)

    @pytest.mark.django_db
    def test_soft_deleted_link_rejected(self, project, linked_page):
        ProjectPage.all_objects.filter(project=project, page=linked_page).update(deleted_at=timezone.now())
        assert_rejected(linked_page, project)

    @pytest.mark.django_db
    def test_private_page_rejected(self, project, linked_page):
        linked_page.access = Page.PRIVATE_ACCESS
        linked_page.save()
        assert_rejected(linked_page, project)

    @pytest.mark.django_db
    def test_archived_page_rejected(self, project, linked_page):
        linked_page.archived_at = timezone.now().date()
        linked_page.save()
        assert_rejected(linked_page, project)
