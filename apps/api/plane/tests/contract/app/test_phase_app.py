# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: keyword map on the web-app API (phases, phase keywords, keyword relations). Step 2.

Shapes match ``apps/web/services/phase.service.ts`` / ``packages/types/src/phase/phase.ts``.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.celery import app as celery_app
from plane.db.models import (
    IssueActivity,
    ModuleIssue,
    ModuleRelation,
    Phase,
    PhaseModule,
    Project,
    ProjectMember,
    WorkspaceMember,
)
from plane.tests.factories import IssueFactory, ModuleFactory, PhaseFactory, UserFactory

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ADMIN, MEMBER, GUEST = 20, 15, 5
PHASE_KEYS = {"id", "name", "description", "sequence", "start_date", "target_date", "module_ids", "project"}
RELATION_KEYS = {"id", "source_module", "target_module", "label"}


@pytest.fixture(autouse=True)
def celery_eager():
    original = (celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates)
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False
    yield
    celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates = original


def _user(workspace, project=None, role=MEMBER, workspace_role=None):
    user = UserFactory()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=workspace_role or role)
    if project is not None:
        ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="Map", identifier="MAP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=ADMIN)
    other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=other, member=create_user, workspace=workspace, role=ADMIN)
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}"
    return {
        "workspace": workspace,
        "project": project,
        "other": other,
        "clients": {
            "admin": _client(create_user),
            "member": _client(_user(workspace, project, MEMBER)),
            "guest": _client(_user(workspace, project, GUEST)),
            "non_member": _client(_user(workspace, None, MEMBER)),
        },
        "phases": f"{base}/phases/",
        "relations": f"{base}/module-relations/",
    }


class TestPhaseCrud:
    def test_create_list_shape_and_order(self, env):
        admin = env["clients"]["admin"]
        a = admin.post(env["phases"], {"name": "Discovery", "start_date": "2026-01-01"}, format="json")
        b = admin.post(env["phases"], {"name": "Build"}, format="json")
        assert a.status_code == b.status_code == status.HTTP_201_CREATED, a.data
        assert PHASE_KEYS <= set(a.data)
        assert a.data["module_ids"] == [] and a.data["project"] == str(env["project"].id)
        listed = admin.get(env["phases"])
        assert listed.status_code == status.HTTP_200_OK
        assert [p["name"] for p in listed.data] == ["Discovery", "Build"]

    def test_reorder_with_sequence_patch(self, env):
        admin = env["clients"]["admin"]
        a = PhaseFactory(project=env["project"], sequence=1000)
        b = PhaseFactory(project=env["project"], sequence=2000)
        res = admin.patch(f"{env['phases']}{b.id}/", {"sequence": 500}, format="json")
        assert res.status_code == status.HTTP_200_OK, res.data
        assert res.data["sequence"] == 500
        assert [str(p["id"]) for p in admin.get(env["phases"]).data] == [str(b.id), str(a.id)]

    def test_validation_errors_have_error_code(self, env):
        admin = env["clients"]["admin"]
        PhaseFactory(project=env["project"], name="Build")
        dup = admin.post(env["phases"], {"name": "Build"}, format="json")
        assert dup.status_code == status.HTTP_400_BAD_REQUEST
        assert dup.data["error_code"] == "PHASE_NAME_TAKEN"
        dates = admin.post(
            env["phases"], {"name": "X", "start_date": "2026-02-01", "target_date": "2026-01-01"}, format="json"
        )
        assert dates.status_code == status.HTTP_400_BAD_REQUEST
        assert dates.data["error_code"] == "INVALID_PHASE_DATES"

    def test_delete(self, env):
        phase = PhaseFactory(project=env["project"])
        res = env["clients"]["admin"].delete(f"{env['phases']}{phase.id}/")
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not Phase.objects.filter(pk=phase.pk).exists()

    def test_phase_of_other_project_is_404(self, env):
        foreign = PhaseFactory(project=env["other"])
        admin = env["clients"]["admin"]
        assert admin.patch(f"{env['phases']}{foreign.id}/", {"name": "x"}, format="json").status_code == 404
        assert admin.delete(f"{env['phases']}{foreign.id}/").status_code == 404


class TestPhasePermissions:
    @pytest.mark.parametrize("role,expected", [("member", 403), ("guest", 403), ("non_member", 403)])
    def test_writes_admin_only(self, env, role, expected):
        client = env["clients"][role]
        phase = PhaseFactory(project=env["project"], name="Keep")
        assert client.post(env["phases"], {"name": "New"}, format="json").status_code == expected
        assert client.patch(f"{env['phases']}{phase.id}/", {"sequence": 1}, format="json").status_code == expected
        assert client.delete(f"{env['phases']}{phase.id}/").status_code == expected
        assert Phase.objects.filter(project=env["project"]).count() == 1

    @pytest.mark.parametrize("role,expected", [("admin", 200), ("member", 200), ("guest", 403), ("non_member", 403)])
    def test_reads(self, env, role, expected):
        phase = PhaseFactory(project=env["project"])
        assert env["clients"][role].get(env["phases"]).status_code == expected
        assert env["clients"][role].get(f"{env['phases']}{phase.id}/").status_code == expected
        assert env["clients"][role].get(env["relations"]).status_code == expected

    def test_guest_reads_when_project_shares_all_features(self, env):
        env["project"].guest_view_all_features = True
        env["project"].save()
        phase = PhaseFactory(project=env["project"])
        guest = env["clients"]["guest"]
        assert guest.get(env["phases"]).status_code == 200
        assert guest.get(f"{env['phases']}{phase.id}/").status_code == 200
        assert guest.get(env["relations"]).status_code == 200

    @pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity"])
    def test_non_finite_sequence_rejected(self, env, value):
        admin = env["clients"]["admin"]
        phase = PhaseFactory(project=env["project"], sequence=1000)
        assert admin.post(env["phases"], {"name": "N", "sequence": value}, format="json").status_code == 400
        res = admin.patch(f"{env['phases']}{phase.id}/", {"sequence": value}, format="json")
        assert res.status_code == 400 and "sequence" in res.data
        phase.refresh_from_db()
        assert phase.sequence == 1000


class TestPhaseModules:
    def test_assign_moves_and_returns_phase(self, env):
        member = env["clients"]["member"]
        a, b = PhaseFactory(project=env["project"]), PhaseFactory(project=env["project"])
        m1, m2 = ModuleFactory(project=env["project"]), ModuleFactory(project=env["project"])
        res = member.post(f"{env['phases']}{a.id}/modules/", {"module_ids": [str(m2.id), str(m1.id)]}, format="json")
        assert res.status_code == status.HTTP_200_OK, res.data
        assert res.data["module_ids"] == [str(m2.id), str(m1.id)]
        res = member.post(f"{env['phases']}{b.id}/modules/", {"module_ids": [str(m1.id)]}, format="json")
        assert res.data["module_ids"] == [str(m1.id)]
        listed = {str(p["id"]): p["module_ids"] for p in member.get(env["phases"]).data}
        assert listed == {str(a.id): [str(m2.id)], str(b.id): [str(m1.id)]}

    def test_remove(self, env):
        member = env["clients"]["member"]
        phase = PhaseFactory(project=env["project"])
        m = ModuleFactory(project=env["project"])
        member.post(f"{env['phases']}{phase.id}/modules/", {"module_ids": [str(m.id)]}, format="json")
        res = member.delete(f"{env['phases']}{phase.id}/modules/{m.id}/")
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not PhaseModule.objects.filter(module=m).exists()
        again = member.delete(f"{env['phases']}{phase.id}/modules/{m.id}/")
        assert again.status_code == status.HTTP_400_BAD_REQUEST
        assert again.data["error_code"] == "KEYWORD_NOT_IN_PHASE"

    def test_cross_project_keyword_rejected(self, env):
        phase = PhaseFactory(project=env["project"])
        foreign = ModuleFactory(project=env["other"])
        res = env["clients"]["admin"].post(
            f"{env['phases']}{phase.id}/modules/", {"module_ids": [str(foreign.id)]}, format="json"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data["error_code"] == "INVALID_KEYWORD"

    def test_bad_body(self, env):
        phase = PhaseFactory(project=env["project"])
        res = env["clients"]["admin"].post(f"{env['phases']}{phase.id}/modules/", {"module_ids": []}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "module_ids" in res.data

    @pytest.mark.parametrize("role", ["guest", "non_member"])
    def test_guest_and_non_member_cannot_assign(self, env, role):
        phase = PhaseFactory(project=env["project"])
        m = ModuleFactory(project=env["project"])
        url = f"{env['phases']}{phase.id}/modules/"
        assert env["clients"][role].post(url, {"module_ids": [str(m.id)]}, format="json").status_code == 403
        PhaseModule.objects.create(project=env["project"], phase=phase, module=m)
        assert env["clients"][role].delete(f"{url}{m.id}/").status_code == 403
        assert PhaseModule.objects.filter(module=m).exists()

    def test_assign_writes_activity_rows(self, env, django_capture_on_commit_callbacks):
        phase = PhaseFactory(project=env["project"], name="Build")
        m = ModuleFactory(project=env["project"])
        issues = [IssueFactory(project=env["project"], workspace=env["workspace"]) for _ in range(2)]
        for issue in issues:
            ModuleIssue.objects.create(module=m, issue=issue, project=env["project"])
        with django_capture_on_commit_callbacks(execute=True):
            res = env["clients"]["member"].post(
                f"{env['phases']}{phase.id}/modules/", {"module_ids": [str(m.id)]}, format="json"
            )
        assert res.status_code == status.HTTP_200_OK
        assert IssueActivity.objects.filter(field="phase", new_value="Build", issue__in=issues).count() == 2


class TestRelations:
    def test_crud_and_shape(self, env):
        member = env["clients"]["member"]
        a, b = ModuleFactory(project=env["project"]), ModuleFactory(project=env["project"])
        res = member.post(
            env["relations"], {"source_module": str(a.id), "target_module": str(b.id), "label": "feeds"}, format="json"
        )
        assert res.status_code == status.HTTP_201_CREATED, res.data
        assert RELATION_KEYS <= set(res.data)
        assert (res.data["source_module"], res.data["target_module"], res.data["label"]) == (
            str(a.id),
            str(b.id),
            "feeds",
        )
        url = f"{env['relations']}{res.data['id']}/"
        patched = member.patch(url, {"label": "blocks"}, format="json")
        assert patched.status_code == status.HTTP_200_OK and patched.data["label"] == "blocks"
        assert [str(r["id"]) for r in env["clients"]["member"].get(env["relations"]).data] == [str(res.data["id"])]
        assert member.delete(url).status_code == status.HTTP_204_NO_CONTENT
        assert not ModuleRelation.objects.exists()

    def test_rules(self, env):
        admin = env["clients"]["admin"]
        a, b = ModuleFactory(project=env["project"]), ModuleFactory(project=env["project"])
        foreign = ModuleFactory(project=env["other"])

        def post(source, target):
            return admin.post(
                env["relations"], {"source_module": str(source.id), "target_module": str(target.id)}, format="json"
            )

        assert post(a, a).data["error_code"] == "SELF_RELATION"
        assert post(a, b).status_code == status.HTTP_201_CREATED
        assert post(a, b).data["error_code"] == "DUPLICATE_RELATION"
        assert post(b, a).status_code == status.HTTP_201_CREATED
        cross = post(a, foreign)
        assert cross.status_code == status.HTTP_400_BAD_REQUEST and cross.data["error_code"] == "INVALID_KEYWORD"

    @pytest.mark.parametrize("role", ["guest", "non_member"])
    def test_guest_and_non_member_cannot_write(self, env, role):
        client = env["clients"][role]
        a, b = ModuleFactory(project=env["project"]), ModuleFactory(project=env["project"])
        edge = ModuleRelation.objects.create(project=env["project"], source_module=a, target_module=b)
        body = {"source_module": str(b.id), "target_module": str(a.id)}
        assert client.post(env["relations"], body, format="json").status_code == 403
        assert client.patch(f"{env['relations']}{edge.id}/", {"label": "x"}, format="json").status_code == 403
        assert client.delete(f"{env['relations']}{edge.id}/").status_code == 403
        assert ModuleRelation.objects.count() == 1

    def test_relation_of_other_project_is_404(self, env):
        a, b = ModuleFactory(project=env["other"]), ModuleFactory(project=env["other"])
        edge = ModuleRelation.objects.create(project=env["other"], source_module=a, target_module=b)
        res = env["clients"]["admin"].delete(f"{env['relations']}{edge.id}/")
        assert res.status_code == status.HTTP_404_NOT_FOUND
