# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: database constraints of Phase, PhaseModule and ModuleRelation (Step 2)."""

from datetime import date

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from plane.db.models import ModuleRelation, Phase, PhaseModule, Project
from plane.tests.factories import ModuleFactory, PhaseFactory

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.fixture
def project(workspace, create_user):
    return Project.objects.create(name="Map", identifier="MAP", workspace=workspace, created_by=create_user)


def _raises_integrity(fn):
    with pytest.raises(IntegrityError), transaction.atomic():
        fn()


def test_phase_name_unique_per_project_while_live(project):
    phase = PhaseFactory(project=project, name="Build")
    _raises_integrity(lambda: PhaseFactory(project=project, name="Build"))
    phase.deleted_at = timezone.now()
    phase.save()
    assert PhaseFactory(project=project, name="Build").pk


def test_phase_start_after_target_rejected(project):
    _raises_integrity(lambda: PhaseFactory(project=project, start_date=date(2026, 2, 1), target_date=date(2026, 1, 1)))
    assert PhaseFactory(project=project, start_date=date(2026, 1, 1), target_date=date(2026, 1, 1)).pk


def test_one_live_phase_per_keyword(project):
    module = ModuleFactory(project=project)
    first, second = PhaseFactory(project=project), PhaseFactory(project=project)
    link = PhaseModule.objects.create(project=project, phase=first, module=module)
    _raises_integrity(lambda: PhaseModule.objects.create(project=project, phase=second, module=module))
    link.deleted_at = timezone.now()
    link.save()
    assert PhaseModule.objects.create(project=project, phase=second, module=module).pk


def test_relation_no_self_link(project):
    module = ModuleFactory(project=project)
    _raises_integrity(
        lambda: ModuleRelation.objects.create(project=project, source_module=module, target_module=module)
    )


def test_relation_unique_ordered_pair(project):
    a, b = ModuleFactory(project=project), ModuleFactory(project=project)
    edge = ModuleRelation.objects.create(project=project, source_module=a, target_module=b)
    _raises_integrity(lambda: ModuleRelation.objects.create(project=project, source_module=a, target_module=b))
    # the reverse direction is a different edge
    assert ModuleRelation.objects.create(project=project, source_module=b, target_module=a).pk
    edge.deleted_at = timezone.now()
    edge.save()
    assert ModuleRelation.objects.create(project=project, source_module=a, target_module=b).pk


def test_phase_workspace_follows_project(project):
    assert Phase.objects.create(project=project, name="X").workspace_id == project.workspace_id
