# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: keyword map on the public API (X-Api-Key): phases, phase keywords, keyword relations."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.celery import app as celery_app
from plane.db.models import ModuleRelation, Phase, PhaseModule, Project, ProjectMember
from plane.db.models.api import APIToken
from plane.tests.factories import ModuleFactory, PhaseFactory, UserFactory, WorkspaceMemberFactory

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ADMIN, MEMBER, GUEST = 20, 15, 5


@pytest.fixture(autouse=True)
def celery_eager():
    original = (celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates)
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False
    yield
    celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates = original


def _key_client(workspace, project, role):
    user = UserFactory()
    WorkspaceMemberFactory(workspace=workspace, member=user, role=role)
    if project is not None:
        ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=role)
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=APIToken.objects.create(user=user).token)
    return client


@pytest.fixture
def env(workspace, create_user, api_key_client):
    project = Project.objects.create(name="Map", identifier="MAP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=ADMIN)
    other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace, created_by=create_user)
    base = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}"
    return {
        "project": project,
        "other": other,
        "admin": api_key_client,
        "member": _key_client(workspace, project, MEMBER),
        "guest": _key_client(workspace, project, GUEST),
        "non_member": _key_client(workspace, None, MEMBER),
        "phases": f"{base}/phases/",
        "relations": f"{base}/module-relations/",
    }


def test_unauthenticated_rejected(env):
    assert APIClient().get(env["phases"]).status_code == status.HTTP_401_UNAUTHORIZED


def test_phase_crud_and_paginated_list(env):
    admin = env["admin"]
    res = admin.post(env["phases"], {"name": "Discovery", "description": "first"}, format="json")
    assert res.status_code == status.HTTP_201_CREATED, res.data
    phase_id = res.data["id"]
    assert res.data["module_ids"] == []
    listed = admin.get(env["phases"])
    assert listed.status_code == status.HTTP_200_OK
    assert [str(p["id"]) for p in listed.data["results"]] == [str(phase_id)]
    assert admin.get(f"{env['phases']}{phase_id}/").data["name"] == "Discovery"
    patched = admin.patch(f"{env['phases']}{phase_id}/", {"name": "Research", "sequence": 5}, format="json")
    assert patched.status_code == status.HTTP_200_OK and patched.data["name"] == "Research"
    bad = admin.patch(
        f"{env['phases']}{phase_id}/", {"start_date": "2026-03-01", "target_date": "2026-01-01"}, format="json"
    )
    assert bad.status_code == status.HTTP_400_BAD_REQUEST and bad.data["error_code"] == "INVALID_PHASE_DATES"
    assert admin.delete(f"{env['phases']}{phase_id}/").status_code == status.HTTP_204_NO_CONTENT
    assert not Phase.objects.exists()


@pytest.mark.parametrize("role", ["member", "guest", "non_member"])
def test_phase_writes_admin_only(env, role):
    client = env[role]
    phase = PhaseFactory(project=env["project"], name="Keep")
    assert client.post(env["phases"], {"name": "New"}, format="json").status_code == 403
    assert client.patch(f"{env['phases']}{phase.id}/", {"name": "x"}, format="json").status_code == 403
    assert client.delete(f"{env['phases']}{phase.id}/").status_code == 403
    assert Phase.objects.get().name == "Keep"


@pytest.mark.parametrize("role,expected", [("member", 200), ("guest", 403), ("non_member", 403)])
def test_reads_by_role(env, role, expected):
    phase = PhaseFactory(project=env["project"])
    assert env[role].get(env["phases"]).status_code == expected
    assert env[role].get(f"{env['phases']}{phase.id}/").status_code == expected
    assert env[role].get(env["relations"]).status_code == expected


def test_guest_reads_when_project_shares_all_features(env):
    env["project"].guest_view_all_features = True
    env["project"].save()
    phase = PhaseFactory(project=env["project"])
    assert env["guest"].get(env["phases"]).status_code == 200
    assert env["guest"].get(f"{env['phases']}{phase.id}/").status_code == 200
    assert env["guest"].get(env["relations"]).status_code == 200


@pytest.mark.parametrize("value", ["NaN", "Infinity"])
def test_non_finite_sequence_rejected(env, value):
    phase = PhaseFactory(project=env["project"], sequence=1000)
    assert env["admin"].post(env["phases"], {"name": "N", "sequence": value}, format="json").status_code == 400
    assert env["admin"].patch(f"{env['phases']}{phase.id}/", {"sequence": value}, format="json").status_code == 400
    phase.refresh_from_db()
    assert phase.sequence == 1000


def test_phase_modules(env):
    member = env["member"]
    a, b = PhaseFactory(project=env["project"]), PhaseFactory(project=env["project"])
    m = ModuleFactory(project=env["project"])
    url_a, url_b = f"{env['phases']}{a.id}/modules/", f"{env['phases']}{b.id}/modules/"
    assert member.post(url_a, {"module_ids": [str(m.id)]}, format="json").data["module_ids"] == [str(m.id)]
    assert member.post(url_b, {"module_ids": [str(m.id)]}, format="json").data["module_ids"] == [str(m.id)]
    assert PhaseModule.objects.get(module=m).phase_id == b.id
    assert member.delete(f"{url_b}{m.id}/").status_code == status.HTTP_204_NO_CONTENT
    foreign = ModuleFactory(project=env["other"])
    res = member.post(url_a, {"module_ids": [str(foreign.id)]}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST and res.data["error_code"] == "INVALID_KEYWORD"
    assert env["guest"].post(url_a, {"module_ids": [str(m.id)]}, format="json").status_code == 403


def test_relations(env):
    member = env["member"]
    a, b = ModuleFactory(project=env["project"]), ModuleFactory(project=env["project"])
    body = {"source_module": str(a.id), "target_module": str(b.id), "label": "feeds"}
    res = member.post(env["relations"], body, format="json")
    assert res.status_code == status.HTTP_201_CREATED, res.data
    dup = member.post(env["relations"], body, format="json")
    assert dup.status_code == status.HTTP_400_BAD_REQUEST and dup.data["error_code"] == "DUPLICATE_RELATION"
    self_link = member.post(env["relations"], {"source_module": str(a.id), "target_module": str(a.id)}, format="json")
    assert self_link.data["error_code"] == "SELF_RELATION"
    assert [str(r["id"]) for r in env["member"].get(env["relations"]).data["results"]] == [str(res.data["id"])]
    url = f"{env['relations']}{res.data['id']}/"
    assert env["guest"].patch(url, {"label": "x"}, format="json").status_code == 403
    assert member.patch(url, {"label": "blocks"}, format="json").data["label"] == "blocks"
    assert member.delete(url).status_code == status.HTTP_204_NO_CONTENT
    assert not ModuleRelation.objects.exists()


def test_other_project_objects_are_404(env):
    foreign_phase = PhaseFactory(project=env["other"])
    assert env["admin"].get(f"{env['phases']}{foreign_phase.id}/").status_code == status.HTTP_404_NOT_FOUND
