# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: Project.prd_page rules shared by the web-app and public-API serializers and the page views."""

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import Page, Project, ProjectPage


def validate_prd_page(page, project):
    """A project's PRD page must be a public, non-archived page linked to that project.

    Returns the page unchanged (None is allowed and clears the field).
    Raises serializers.ValidationError({"prd_page": ...}) otherwise.
    """
    if page is None:
        return page

    error = {"prd_page": "PRD page must be a public, non-archived page linked to this project."}

    if project is None or page.workspace_id != project.workspace_id:
        raise serializers.ValidationError(error)

    if page.access != Page.PUBLIC_ACCESS or page.archived_at is not None:
        raise serializers.ValidationError(error)

    # ProjectPage.objects excludes soft-deleted rows; filter explicitly to be safe.
    if not ProjectPage.objects.filter(project_id=project.id, page_id=page.id, deleted_at__isnull=True).exists():
        raise serializers.ValidationError(error)

    return page


def is_unchanged_prd_page(page, project):
    """True when an update resends the project's current PRD page (accepted even if it no longer qualifies)."""
    return page is not None and project is not None and page.pk == project.prd_page_id


def prd_page_queryset(serializer):
    """Pages a serializer's prd_page field may resolve: only the request's workspace.

    A page from another workspace then gets DRF's "does not exist" error, same as a missing id.
    The workspace comes from the view context (workspace_id), else the instance on update.
    """
    workspace_id = serializer.context.get("workspace_id") or getattr(serializer.instance, "workspace_id", None)
    if workspace_id is None:
        return Page.objects.none()
    return Page.objects.filter(workspace_id=workspace_id)


def scope_prd_page_field(serializer, fields):
    """Restrict fields["prd_page"] (if present and writable) to the request's workspace. Returns fields."""
    field = fields.get("prd_page")
    if field is not None and not field.read_only:
        field.queryset = prd_page_queryset(serializer)
    return fields


def clear_prd_page_links(page_ids, project_id=None):
    """Unset prd_page on projects pointing at these pages (optionally only one project).

    Called synchronously by the page views when a page stops qualifying as a PRD:
    made private, archived (with descendants), deleted, or unlinked from a project.
    """
    page_ids = [page_id for page_id in page_ids if page_id is not None]
    if not page_ids:
        return 0
    # all_objects: a soft-deleted project must not come back (restore) still pointing at the page
    projects = Project.all_objects.filter(prd_page_id__in=page_ids)
    if project_id is not None:
        projects = projects.filter(id=project_id)
    return projects.update(prd_page=None)
