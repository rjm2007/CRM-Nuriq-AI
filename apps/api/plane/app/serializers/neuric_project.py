# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import Page, ProjectPage


def validate_prd_page(page, project):
    """Neuric: a project's PRD page must be a public, non-archived page linked to that project.

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
