# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: keyword map service rules (plane.utils.keyword_map, Step 2)."""

from datetime import date
from unittest import mock

import pytest
from django.utils import timezone
from rest_framework import serializers

from plane.celery import app as celery_app
from plane.bgtasks.phase_activity import MOVES_PER_TASK
from plane.db.models import ModuleRelation, Phase, PhaseModule, Project, ProjectMember
from plane.tests.factories import ModuleFactory, PhaseFactory, UserFactory
from plane.utils import keyword_map as km

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def celery_eager():
    original = (celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates)
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False
    yield
    celery_app.conf.task_always_eager, celery_app.conf.task_eager_propagates = original


@pytest.fixture
def project(workspace, create_user):
    return Project.objects.create(name="Map", identifier="MAP", workspace=workspace, created_by=create_user)


@pytest.fixture
def other_project(workspace, create_user):
    return Project.objects.create(name="Other", identifier="OTH", workspace=workspace, created_by=create_user)


def error_code(excinfo):
    return str(excinfo.value.detail["error_code"])


class TestPhases:
    def test_create_goes_last_and_sets_actor(self, project, create_user):
        first = km.create_phase(project, {"name": "Discovery"}, create_user)
        second = km.create_phase(project, {"name": " Build "}, create_user)
        assert second.name == "Build"
        assert second.sequence > first.sequence
        assert second.created_by_id == create_user.id
        assert [p.id for p in km.phase_queryset(project.id)] == [first.id, second.id]

    def test_duplicate_name(self, project, create_user):
        km.create_phase(project, {"name": "Build"}, create_user)
        with pytest.raises(serializers.ValidationError) as exc:
            km.create_phase(project, {"name": "Build"}, create_user)
        assert error_code(exc) == km.PHASE_NAME_TAKEN

    def test_blank_name(self, project, create_user):
        with pytest.raises(serializers.ValidationError) as exc:
            km.create_phase(project, {"name": "  "}, create_user)
        assert error_code(exc) == km.INVALID_PHASE

    def test_target_before_start(self, project, create_user):
        with pytest.raises(serializers.ValidationError) as exc:
            km.create_phase(
                project, {"name": "X", "start_date": date(2026, 3, 1), "target_date": date(2026, 2, 1)}, create_user
            )
        assert error_code(exc) == km.INVALID_PHASE_DATES
        phase = km.create_phase(project, {"name": "X", "start_date": date(2026, 3, 1)}, create_user)
        with pytest.raises(serializers.ValidationError):
            km.update_phase(phase, {"target_date": date(2026, 2, 1)}, create_user)

    def test_update_and_rename_to_taken(self, project, create_user):
        km.create_phase(project, {"name": "A"}, create_user)
        b = km.create_phase(project, {"name": "B"}, create_user)
        km.update_phase(b, {"sequence": 1.0, "description": None}, create_user)
        b.refresh_from_db()
        assert (b.sequence, b.description, b.updated_by_id) == (1.0, "", create_user.id)
        with pytest.raises(serializers.ValidationError) as exc:
            km.update_phase(b, {"name": "A"}, create_user)
        assert error_code(exc) == km.PHASE_NAME_TAKEN


class TestAssign:
    def test_assign_keeps_order_and_moves_between_phases(self, project, create_user):
        a, b = PhaseFactory(project=project), PhaseFactory(project=project)
        m1, m2, m3 = (ModuleFactory(project=project) for _ in range(3))
        km.assign_modules_to_phase(a, [m2.id, m1.id], create_user)
        assert km.phase_module_ids(Phase.objects.get(pk=a.pk)) == [m2.id, m1.id]
        km.assign_modules_to_phase(b, [m3.id, m1.id], create_user)
        assert km.phase_module_ids(Phase.objects.get(pk=a.pk)) == [m2.id]
        assert km.phase_module_ids(Phase.objects.get(pk=b.pk)) == [m3.id, m1.id]
        # one live link per keyword; the old one is soft-deleted
        assert PhaseModule.objects.filter(module=m1).count() == 1
        assert PhaseModule.all_objects.filter(module=m1).count() == 2

    def test_reassign_same_phase_is_noop(self, project, create_user):
        a = PhaseFactory(project=project)
        m = ModuleFactory(project=project)
        km.assign_modules_to_phase(a, [m.id], create_user)
        with mock.patch("plane.utils.keyword_map._send_phase_moves") as send:
            km.assign_modules_to_phase(a, [m.id], create_user)
        assert send.call_args.args[2] == []
        assert PhaseModule.all_objects.filter(module=m).count() == 1

    def test_cross_project_keyword_rejected(self, project, other_project, create_user):
        phase = PhaseFactory(project=project)
        foreign = ModuleFactory(project=other_project)
        with pytest.raises(serializers.ValidationError) as exc:
            km.assign_modules_to_phase(phase, [foreign.id], create_user)
        assert error_code(exc) == km.INVALID_KEYWORD
        assert not PhaseModule.objects.exists()

    def test_phase_of_other_project_rejects_keyword(self, project, other_project, create_user):
        # the phase's project, not the keyword's, decides: a keyword of project A never joins a phase of B
        foreign_phase = PhaseFactory(project=other_project)
        module = ModuleFactory(project=project)
        with pytest.raises(serializers.ValidationError) as exc:
            km.assign_modules_to_phase(foreign_phase, [module.id], create_user)
        assert error_code(exc) == km.INVALID_KEYWORD
        assert not PhaseModule.objects.exists()

    def test_bulk_assign_sets_audit_fields(self, project, create_user):
        a, b = PhaseFactory(project=project), PhaseFactory(project=project)
        modules = [ModuleFactory(project=project) for _ in range(3)]
        km.assign_modules_to_phase(a, [m.id for m in modules[:2]], create_user)
        km.assign_modules_to_phase(b, [m.id for m in modules], create_user)
        links = list(PhaseModule.objects.filter(phase=b).order_by("sequence"))
        assert [link.module_id for link in links] == [m.id for m in modules]
        assert all(
            (link.created_by_id, link.workspace_id, link.project_id)
            == (create_user.id, project.workspace_id, project.id)
            for link in links
        )
        moved_out = PhaseModule.all_objects.filter(phase=a)
        assert all(link.deleted_at is not None and link.updated_by_id == create_user.id for link in moved_out)

    def test_assign_to_deleted_phase_rejected(self, project, create_user):
        phase = PhaseFactory(project=project)
        module = ModuleFactory(project=project)
        stale = Phase.objects.get(pk=phase.pk)
        km.delete_phase(phase, create_user)
        with pytest.raises(serializers.ValidationError) as exc:
            km.assign_modules_to_phase(stale, [module.id], create_user)
        assert error_code(exc) == km.INVALID_PHASE
        assert not PhaseModule.all_objects.filter(module=module).exists()

    def test_delete_already_deleted_phase_is_not_found(self, project, create_user):
        phase = PhaseFactory(project=project)
        stale = Phase.objects.get(pk=phase.pk)
        km.delete_phase(phase, create_user)
        with pytest.raises(Phase.DoesNotExist):
            km.delete_phase(stale, create_user)

    def test_archived_keyword_rejected(self, project, create_user):
        phase = PhaseFactory(project=project)
        module = ModuleFactory(project=project, archived_at=timezone.now())
        with pytest.raises(serializers.ValidationError) as exc:
            km.assign_modules_to_phase(phase, [module.id], create_user)
        assert error_code(exc) == km.KEYWORD_ARCHIVED

    def test_empty_list_rejected(self, project, create_user):
        with pytest.raises(serializers.ValidationError):
            km.assign_modules_to_phase(PhaseFactory(project=project), [], create_user)

    def test_remove(self, project, create_user):
        phase = PhaseFactory(project=project)
        m = ModuleFactory(project=project)
        km.assign_modules_to_phase(phase, [m.id], create_user)
        km.remove_module_from_phase(phase, m.id, create_user)
        assert not PhaseModule.objects.filter(module=m).exists()
        with pytest.raises(serializers.ValidationError) as exc:
            km.remove_module_from_phase(phase, m.id, create_user)
        assert error_code(exc) == km.KEYWORD_NOT_IN_PHASE

    def test_delete_phase_unlinks_keywords(self, project, create_user):
        phase = PhaseFactory(project=project)
        m = ModuleFactory(project=project)
        km.assign_modules_to_phase(phase, [m.id], create_user)
        assert km.delete_phase(phase, create_user) == [m.id]
        assert not Phase.objects.filter(pk=phase.pk).exists()
        assert not PhaseModule.objects.filter(module=m).exists()

    def test_soft_deleted_keyword_leaves_phase(self, project, create_user, django_capture_on_commit_callbacks):
        phase = PhaseFactory(project=project)
        m = ModuleFactory(project=project)
        km.assign_modules_to_phase(phase, [m.id], create_user)
        with django_capture_on_commit_callbacks(execute=True):
            m.delete()
        assert km.phase_module_ids(Phase.objects.get(pk=phase.pk)) == []
        assert not PhaseModule.objects.filter(module_id=m.id).exists()

    def test_archived_keyword_hidden_from_phase(self, project, create_user):
        phase = PhaseFactory(project=project)
        m = ModuleFactory(project=project)
        km.assign_modules_to_phase(phase, [m.id], create_user)
        m.archived_at = timezone.now()
        m.save()
        assert km.phase_module_ids(km.phase_queryset(project.id).get(pk=phase.pk)) == []


class TestPhaseMoveBatches:
    def test_epoch_is_sub_second_and_moves_are_chunked(self, project, create_user):
        moves = [km._move(f"00000000-0000-0000-0000-{i:012d}", None, None) for i in range(MOVES_PER_TASK + 1)]
        with mock.patch("plane.bgtasks.phase_activity.phase_module_activity.delay") as delay:
            with mock.patch("plane.utils.keyword_map.transaction.on_commit", side_effect=lambda fn: fn()):
                km._send_phase_moves(project.id, create_user, moves)
                km._send_phase_moves(project.id, create_user, moves[:1])
        calls = [c.kwargs for c in delay.call_args_list]
        assert [len(c["moves"]) for c in calls] == [MOVES_PER_TASK, 1, 1]
        assert calls[0]["epoch"] == calls[1]["epoch"]
        assert isinstance(calls[0]["epoch"], float)
        assert calls[2]["epoch"] != calls[0]["epoch"]


class TestGuestGate:
    def test_restricted_guest_only(self, project, create_user, workspace):
        guest, member = UserFactory(), UserFactory()
        ProjectMember.objects.create(project=project, member=guest, workspace=workspace, role=5)
        ProjectMember.objects.create(project=project, member=member, workspace=workspace, role=15)
        slug = workspace.slug
        assert km.keyword_map_hidden_from_guest(guest.id, slug, project.id)
        assert not km.keyword_map_hidden_from_guest(member.id, slug, project.id)
        project.guest_view_all_features = True
        project.save()
        assert not km.keyword_map_hidden_from_guest(guest.id, slug, project.id)


class TestRelations:
    def test_create_and_reverse(self, project, create_user):
        a, b = ModuleFactory(project=project), ModuleFactory(project=project)
        edge = km.create_module_relation(project, a.id, b.id, create_user, label=" depends on ")
        assert edge.label == "depends on"
        assert km.create_module_relation(project, b.id, a.id, create_user).pk

    def test_self_relation(self, project, create_user):
        a = ModuleFactory(project=project)
        with pytest.raises(serializers.ValidationError) as exc:
            km.create_module_relation(project, a.id, a.id, create_user)
        assert error_code(exc) == km.SELF_RELATION

    def test_duplicate(self, project, create_user):
        a, b = ModuleFactory(project=project), ModuleFactory(project=project)
        km.create_module_relation(project, a.id, b.id, create_user)
        with pytest.raises(serializers.ValidationError) as exc:
            km.create_module_relation(project, a.id, b.id, create_user)
        assert error_code(exc) == km.DUPLICATE_RELATION

    def test_cross_project(self, project, other_project, create_user):
        a, foreign = ModuleFactory(project=project), ModuleFactory(project=other_project)
        with pytest.raises(serializers.ValidationError) as exc:
            km.create_module_relation(project, a.id, foreign.id, create_user)
        assert error_code(exc) == km.INVALID_KEYWORD

    def test_update_ends_checked(self, project, create_user):
        a, b, c = (ModuleFactory(project=project) for _ in range(3))
        km.create_module_relation(project, a.id, c.id, create_user)
        edge = km.create_module_relation(project, a.id, b.id, create_user)
        with pytest.raises(serializers.ValidationError) as exc:
            km.update_module_relation(edge, {"target_module_id": c.id}, create_user)
        assert error_code(exc) == km.DUPLICATE_RELATION
        with pytest.raises(serializers.ValidationError) as exc:
            km.update_module_relation(edge, {"target_module_id": a.id}, create_user)
        assert error_code(exc) == km.SELF_RELATION
        km.update_module_relation(edge, {"source_module_id": c.id, "label": "x"}, create_user)
        edge.refresh_from_db()
        assert (edge.source_module_id, edge.target_module_id, edge.label) == (c.id, b.id, "x")

    def test_soft_deleted_keyword_drops_edges(self, project, create_user, django_capture_on_commit_callbacks):
        a, b = ModuleFactory(project=project), ModuleFactory(project=project)
        km.create_module_relation(project, a.id, b.id, create_user)
        with django_capture_on_commit_callbacks(execute=True):
            b.delete()
        assert not km.relation_queryset(project.id).exists()
        assert not ModuleRelation.objects.filter(target_module_id=b.id).exists()

    def test_delete(self, project, create_user):
        a, b = ModuleFactory(project=project), ModuleFactory(project=project)
        edge = km.create_module_relation(project, a.id, b.id, create_user)
        km.delete_module_relation(edge, create_user)
        assert not ModuleRelation.objects.exists()
        assert km.create_module_relation(project, a.id, b.id, create_user).pk
