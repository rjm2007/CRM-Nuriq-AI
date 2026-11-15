# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: Project.target_date + Project.prd_page via the web-app API (/api/)."""

import datetime
import uuid

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, Workspace, WorkspaceMember
from plane.tests.factories import PageFactory, link_page_to_project


def project_url(slug, pk=None):
    base = f"/api/workspaces/{slug}/projects/"
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
class TestProjectTargetDateApp:
    @pytest.mark.django_db
    def test_set_and_clear_target_date(self, session_client, workspace, project):
        url = project_url(workspace.slug, project.id)

        response = session_client.patch(url, {"target_date": "2026-12-31"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["target_date"] == "2026-12-31"
        project.refresh_from_db()
        assert project.target_date == datetime.date(2026, 12, 31)

        response = session_client.patch(url, {"target_date": None}, format="json")
        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.target_date is None

    @pytest.mark.django_db
    def test_invalid_target_date_returns_400(self, session_client, workspace, project):
        response = session_client.patch(
            project_url(workspace.slug, project.id), {"target_date": "not-a-date"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "target_date" in response.data

    @pytest.mark.django_db
    def test_create_with_target_date(self, session_client, workspace):
        response = session_client.post(
            project_url(workspace.slug),
            {"name": "Dated", "identifier": "DTD", "target_date": "2027-01-15"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Project.objects.get(identifier="DTD").target_date == datetime.date(2027, 1, 15)


@pytest.mark.contract
class TestProjectPrdPageApp:
    @pytest.mark.django_db
    def test_accepts_public_linked_page(self, session_client, workspace, project, linked_page):
        url = project_url(workspace.slug, project.id)
        response = session_client.patch(url, {"prd_page": str(linked_page.id)}, format="json")
        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.prd_page_id == linked_page.id

        # null clears it
        response = session_client.patch(url, {"prd_page": None}, format="json")
        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.prd_page_id is None

    @pytest.mark.django_db
    def test_rejects_page_from_other_project(self, session_client, workspace, project, create_user):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        page = PageFactory(workspace=workspace, owned_by=create_user)
        link_page_to_project(page, other)

        response = session_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_page_from_other_workspace(self, session_client, workspace, project, create_user):
        other_ws = Workspace.objects.create(name="Other WS", owner=create_user, slug="other-ws")
        other_project = Project.objects.create(name="Other", identifier="OTH", workspace=other_ws)
        page = PageFactory(workspace=other_ws, owned_by=create_user)
        link_page_to_project(page, other_project)

        response = session_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_private_page(self, session_client, workspace, project, linked_page):
        linked_page.access = Page.PRIVATE_ACCESS
        linked_page.save()
        response = session_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(linked_page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_archived_page(self, session_client, workspace, project, linked_page):
        linked_page.archived_at = timezone.now().date()
        linked_page.save()
        response = session_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(linked_page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_soft_deleted_project_page(self, session_client, workspace, project, linked_page):
        ProjectPage.all_objects.filter(project=project, page=linked_page).update(deleted_at=timezone.now())
        response = session_client.patch(
            project_url(workspace.slug, project.id), {"prd_page": str(linked_page.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data

    @pytest.mark.django_db
    def test_rejects_prd_page_on_create(self, session_client, workspace, linked_page):
        response = session_client.post(
            project_url(workspace.slug),
            {"name": "New", "identifier": "NEW", "prd_page": str(linked_page.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prd_page" in response.data
        assert not Project.objects.filter(identifier="NEW").exists()

    @pytest.mark.django_db
    def test_non_admin_member_forbidden(self, session_client, workspace, project, linked_page):
        member = User.objects.create_user(email="prd-member@example.com", username="prdmember")
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        ProjectMember.objects.create(project=project, member=member, role=15, is_active=True)
        session_client.force_authenticate(user=member)

        response = session_client.patch(
            project_url(workspace.slug, project.id),
            {"prd_page": str(linked_page.id), "target_date": "2026-12-31"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        project.refresh_from_db()
        assert project.prd_page_id is None
        assert project.target_date is None


@pytest.mark.contract
class TestProjectTargetPrdReadApp:
    @pytest.mark.django_db
    def test_fields_in_list_and_retrieve(self, session_client, workspace, project, linked_page):
        project.target_date = datetime.date(2026, 12, 31)
        project.prd_page = linked_page
        project.save()

        response = session_client.get(project_url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        row = next(p for p in response.data if p["id"] == project.id)
        assert row["target_date"] == datetime.date(2026, 12, 31)
        assert row["prd_page"] == linked_page.id

        response = session_client.get(project_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["target_date"] == "2026-12-31"
        assert str(response.data["prd_page"]) == str(linked_page.id)


def page_url(slug, project_id, page_id, suffix=""):
    return f"/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/{suffix}"


def set_prd_page(project, page):
    # bypass the serializer: these tests start from an already-linked PRD page
    Project.objects.filter(pk=project.pk).update(prd_page=page)


def prd_page_id(project):
    return Project.all_objects.values_list("prd_page_id", flat=True).get(pk=project.pk)


@pytest.mark.contract
class TestProjectPrdPageEdgeCasesApp:
    @pytest.mark.django_db
    def test_unchanged_prd_page_resent_after_page_went_private(self, session_client, workspace, project, linked_page):
        set_prd_page(project, linked_page)
        Page.objects.filter(pk=linked_page.pk).update(access=Page.PRIVATE_ACCESS)

        response = session_client.patch(
            project_url(workspace.slug, project.id),
            {"prd_page": str(linked_page.id), "target_date": "2026-12-31"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert prd_page_id(project) == linked_page.id

    @pytest.mark.django_db
    def test_cross_workspace_page_same_error_as_missing_page(self, session_client, workspace, project, create_user):
        other_ws = Workspace.objects.create(name="Other WS", owner=create_user, slug="other-ws")
        other_project = Project.objects.create(name="Other", identifier="OTH", workspace=other_ws)
        foreign = PageFactory(workspace=other_ws, owned_by=create_user)
        link_page_to_project(foreign, other_project)
        missing_id = uuid.uuid4()
        url = project_url(workspace.slug, project.id)

        foreign_resp = session_client.patch(url, {"prd_page": str(foreign.id)}, format="json")
        missing_resp = session_client.patch(url, {"prd_page": str(missing_id)}, format="json")

        assert foreign_resp.status_code == missing_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert foreign_resp.data["prd_page"][0].code == missing_resp.data["prd_page"][0].code == "does_not_exist"
        assert str(foreign_resp.data["prd_page"][0]).replace(str(foreign.id), "X") == str(
            missing_resp.data["prd_page"][0]
        ).replace(str(missing_id), "X")


@pytest.mark.contract
class TestPrdPageCleanupApp:
    """Page transitions that make a page an invalid PRD unset Project.prd_page synchronously."""

    @pytest.mark.django_db
    def test_access_endpoint_private_clears(self, session_client, workspace, project, linked_page):
        set_prd_page(project, linked_page)
        response = session_client.post(
            page_url(workspace.slug, project.id, linked_page.id, "access/"),
            {"access": Page.PRIVATE_ACCESS},
            format="json",
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert prd_page_id(project) is None

    @pytest.mark.django_db
    def test_access_endpoint_public_keeps(self, session_client, workspace, project, linked_page):
        set_prd_page(project, linked_page)
        response = session_client.post(
            page_url(workspace.slug, project.id, linked_page.id, "access/"),
            {"access": Page.PUBLIC_ACCESS},
            format="json",
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert prd_page_id(project) == linked_page.id

    @pytest.mark.django_db
    def test_partial_update_private_clears(self, session_client, workspace, project, linked_page):
        set_prd_page(project, linked_page)
        response = session_client.patch(
            page_url(workspace.slug, project.id, linked_page.id), {"access": Page.PRIVATE_ACCESS}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert prd_page_id(project) is None

    @pytest.mark.django_db
    def test_partial_update_rename_keeps(self, session_client, workspace, project, linked_page):
        set_prd_page(project, linked_page)
        response = session_client.patch(
            page_url(workspace.slug, project.id, linked_page.id), {"name": "Renamed"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert prd_page_id(project) == linked_page.id

    @pytest.mark.django_db
    def test_partial_update_archived_at_clears(self, session_client, workspace, project, linked_page):
        set_prd_page(project, linked_page)
        response = session_client.patch(
            page_url(workspace.slug, project.id, linked_page.id),
            {"archived_at": timezone.now().date().isoformat()},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert prd_page_id(project) is None

    @pytest.mark.django_db
    def test_archive_clears_page_and_descendants(self, session_client, workspace, project, linked_page, create_user):
        child = PageFactory(workspace=workspace, owned_by=create_user, parent=linked_page)
        link_page_to_project(child, project)
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        link_page_to_project(child, other)
        set_prd_page(project, linked_page)
        set_prd_page(other, child)

        response = session_client.post(page_url(workspace.slug, project.id, linked_page.id, "archive/"))
        assert response.status_code == status.HTTP_200_OK
        assert prd_page_id(project) is None
        assert prd_page_id(other) is None

    @pytest.mark.django_db
    def test_destroy_clears(self, session_client, workspace, project, linked_page):
        Page.objects.filter(pk=linked_page.pk).update(archived_at=timezone.now().date())
        set_prd_page(project, linked_page)

        response = session_client.delete(page_url(workspace.slug, project.id, linked_page.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert prd_page_id(project) is None
