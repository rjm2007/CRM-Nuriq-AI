# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: subtask rules on the public API (``/api/v1/.../work-items/``)."""

from datetime import date
from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from plane.api.views.issue import IssueDetailAPIEndpoint
from plane.db.models import Issue, Project, ProjectMember
from plane.tests.factories import IssueFactory

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="Api", identifier="API", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    base = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/"
    return {"project": project, "workspace": workspace, "user": create_user, "base": base}


@pytest.fixture(autouse=True)
def no_tasks():
    with (
        mock.patch("plane.api.views.issue.issue_activity"),
        mock.patch("plane.api.views.issue.model_activity"),
    ):
        yield


def make(env, **kwargs):
    return IssueFactory(project=env["project"], workspace=env["workspace"], **kwargs)


def test_post_under_subtask_rejected(api_key_client, env):
    top = make(env)
    sub = make(env, parent=top)
    res = api_key_client.post(env["base"], {"name": "n", "parent": str(sub.id)}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == ["SUBTASK_PARENT_IS_SUBTASK"]
    assert "parent" in res.data


def test_post_date_after_parent_rejected(api_key_client, env):
    parent = make(env, target_date=date(2026, 7, 1))
    res = api_key_client.post(
        env["base"], {"name": "n", "parent": str(parent.id), "target_date": "2026-07-02"}, format="json"
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == ["SUBTASK_DATE_AFTER_PARENT"]


def test_post_valid_subtask(api_key_client, env):
    parent = make(env, target_date=date(2026, 7, 1))
    res = api_key_client.post(
        env["base"], {"name": "n", "parent": str(parent.id), "target_date": "2026-07-01"}, format="json"
    )
    assert res.status_code == status.HTTP_201_CREATED, res.data


def test_patch_has_children_rejected(api_key_client, env):
    issue = make(env)
    make(env, parent=issue)
    other = make(env)
    res = api_key_client.patch(f"{env['base']}{issue.id}/", {"parent": str(other.id)}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == ["SUBTASK_HAS_CHILDREN"]
    assert Issue.objects.get(pk=issue.id).parent_id is None


def test_patch_self_parent_rejected(api_key_client, env):
    issue = make(env)
    res = api_key_client.patch(f"{env['base']}{issue.id}/", {"parent": str(issue.id)}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == ["SUBTASK_SELF_PARENT"]


def test_patch_parent_date_before_subtasks_rejected(api_key_client, env):
    parent = make(env, target_date=date(2026, 7, 10))
    child = make(env, parent=parent, target_date=date(2026, 7, 9))
    res = api_key_client.patch(f"{env['base']}{parent.id}/", {"target_date": "2026-07-01"}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == ["PARENT_DATE_BEFORE_SUBTASKS"]
    assert res.data["subtask_identifiers"] == [f"API-{child.sequence_id}"]


def _put(env, data):
    # PUT (upsert by external_id) is implemented on IssueDetailAPIEndpoint but not routed
    # (``http_method_names=["get", "patch", "delete"]``), so call the view directly.
    request = APIRequestFactory().put(env["base"], data, format="json")
    force_authenticate(request, user=env["user"])
    view = IssueDetailAPIEndpoint.as_view()
    return view(request, slug=env["workspace"].slug, project_id=env["project"].id)


def test_put_update_rejected(env):
    parent = make(env, target_date=date(2026, 7, 10))
    child = make(env, parent=parent, external_id="ext-1", external_source="jira")
    res = _put(env, {"external_id": "ext-1", "external_source": "jira", "target_date": "2026-07-11"})
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == ["SUBTASK_DATE_AFTER_PARENT"]
    assert Issue.objects.get(pk=child.id).target_date is None


def test_put_create_rejected(env):
    top = make(env)
    sub = make(env, parent=top)
    res = _put(env, {"external_id": "ext-2", "external_source": "jira", "name": "n", "parent": str(sub.id)})
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert res.data["error_code"] == ["SUBTASK_PARENT_IS_SUBTASK"]
