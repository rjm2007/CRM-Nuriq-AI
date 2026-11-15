# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: Project.target_date + Project.prd_page via the public API (/api/v1/)."""

import datetime

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Page, Project, ProjectMember, ProjectPage, Workspace
from plane.tests.factories import PageFactory, link_page_to_project


def project_url(slug, pk=None):
    base = f"/api/v1/workspaces/{slug}/projects/"
    return f"{base}{pk}/" if pk else base


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="PRD Project", identifier="PRD", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def linked_page(project, create_user):
    page = PageFactory(workspace=project.workspace, owned_by=create_user)
    link_page_to_project(page, project)
    return page


@pytest.mark.contract
class TestProjectTargetDateV1:
    @pytest.mark.django_db
    def test_create_with_target_date(self, api_key_client, workspace):
        response = api_key_client.post(
            project_url(workspace.slug),
            {"name": "Dated", "identifier": "DTD", "target_date": "2027-01-15"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["target_date"] == "2027-01-15"
        assert Project.objects.get(identifier="DTD").target_date == datetime.date(2027, 1, 15)

    @pytest.mark.django_db
    def test_set_and_clear_target_date(self, api_key_client, workspace, project):
        url = project_url(workspace.slug, project.id)

        response = api_key_client.patch(url, {"target_date": "2026-12-31"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.target_date == datetime.date(2026, 12, 31)

        response = api_key_client.patch(url, {"target_date": None}, format="json")
        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.target_date is None

    @pytest.mark.django_db
    def test_invalid_target_date_returns_400(self, api_key_client, workspace, project):
        response = api_key_client.patch(
            project_url(workspace.slug, project.id), {"target_date": "31/12/2026"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "target_date" in response.data

    @pytest.mark.django_db
    def test_prd_page_ignored_on_create(self, api_key_client, workspace, linked_page):
        # prd_page is not a create field on the public API; it is dropped, never stored.
        response = api_key_client.post(
            project_url(workspace.slug),
            {"name": "New", "identifier": "NEW", "prd_page": str(linked_page.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert Project.objects.get(identifier="NEW").prd_page_id is None


@pytest.mark.contract
class TestProjectPrdPageV1:
    @pytest.mark.django_db
    def test_accepts_public_linked_page_and_null_clears(self, api_key_client, workspace, project, linked_page):
        url = project_url(workspace.slug, project.id)
        response = api_key_client.patch(url, {"prd_page": str(linked_page.id)}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert str(response.data["prd_page"]) == str(linked_page.id)
        project.refresh_from_db()
        assert project.prd_page_id == linked_page.id

        response = api_key_client.patch(url, {"prd_page": None}, format="json")
        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.prd_page_id is None

    @pytest.mark.django_db
    def test_rejects_page_from_other_project(self, api_key_client, workspace, project, create_user):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        page = PageFactory(workspace=workspace, owned_by=create_user)
        link_page_to_project(page, other)
        response = api_key_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_page_from_other_workspace(self, api_key_client, workspace, project, create_user):
        other_ws = Workspace.objects.create(name="Other WS", owner=create_user, slug="other-ws")
        other_project = Project.objects.create(name="Other", identifier="OTH", workspace=other_ws)
        page = PageFactory(workspace=other_ws, owned_by=create_user)
        link_page_to_project(page, other_project)
        response = api_key_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_private_page(self, api_key_client, workspace, project, linked_page):
        linked_page.access = Page.PRIVATE_ACCESS
        linked_page.save()
        response = api_key_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(linked_page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_archived_page(self, api_key_client, workspace, project, linked_page):
        linked_page.archived_at = timezone.now().date()
        linked_page.save()
        response = api_key_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(linked_page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_soft_deleted_project_page(self, api_key_client, workspace, project, linked_page):
        ProjectPage.all_objects.filter(project=project, page=linked_page).update(deleted_at=timezone.now())
        response = api_key_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(linked_page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_fields_in_list_and_retrieve(self, api_key_client, workspace, project, linked_page):
        project.target_date = datetime.date(2026, 12, 31)
        project.prd_page = linked_page
        project.save()

        response = api_key_client.get(project_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["target_date"] == "2026-12-31"
        assert str(response.data["prd_page"]) == str(linked_page.id)

        response = api_key_client.get(project_url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        row = next(p for p in response.data["results"] if str(p["id"]) == str(project.id))
        assert row["target_date"] == "2026-12-31"
        assert str(row["prd_page"]) == str(linked_page.id)
