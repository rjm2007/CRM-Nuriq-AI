# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: public share links (space, ``ProjectIssuesPublicEndpoint``) work with time tracking on
and never expose time data."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import DeployBoard, Project, ProjectMember
from plane.tests.factories import IssueFactory, IssueWorkLogFactory, StateFactory

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def board(workspace, create_user):
    project = Project.objects.create(
        name="Shared", identifier="SHR", workspace=workspace, created_by=create_user, is_time_tracking_enabled=True
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    state = StateFactory(project=project, name="Todo", group="unstarted", default=True)
    parent = IssueFactory(project=project, workspace=workspace, state=state)
    child = IssueFactory(project=project, workspace=workspace, state=state, parent=parent)
    IssueWorkLogFactory(issue=parent, user=create_user, duration_minutes=30)
    IssueWorkLogFactory(issue=child, user=create_user, duration_minutes=45)
    deploy_board = DeployBoard.objects.create(
        entity_name="project", entity_identifier=project.id, project=project, workspace=workspace
    )
    return {"anchor": deploy_board.anchor, "ids": {str(parent.id), str(child.id)}}


def _rows(data):
    data = data.get("results", data) if isinstance(data, dict) else data
    if isinstance(data, dict):
        out = []
        for group in data.values():
            out.extend(_rows(group) if isinstance(group, dict) else group)
        return out
    return list(data)


@pytest.mark.parametrize("query", ["", "?group_by=state_id", "?group_by=state_id&sub_group_by=priority"])
def test_public_issue_list_ok_without_time(board, query):
    res = APIClient().get(f"/api/public/anchor/{board['anchor']}/issues/{query}")
    assert res.status_code == status.HTTP_200_OK, res.content[:500]
    rows = _rows(res.data)
    assert {str(row["id"]) for row in rows} == board["ids"]
    for row in rows:
        assert "total_logged_minutes" not in row
        assert "logged_minutes" not in row
