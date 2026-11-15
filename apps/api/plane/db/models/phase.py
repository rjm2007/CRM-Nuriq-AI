# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: phases group keywords (Plane ``Module``) on a project's keyword map (Step 2).

Rules live in ``plane/utils/keyword_map.py``; see docs/DECISIONS.md "Step 2 keywords, phases, map".
"""

# Django imports
from django.db import models
from django.db.models import F, Q

# Module imports
from .project import ProjectBaseModel

PHASE_SEQUENCE_DEFAULT = 65535


class Phase(ProjectBaseModel):
    """An ordered stage of a project (e.g. "Discovery", "Build"). Keywords join it through PhaseModule."""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    sequence = models.FloatField(default=PHASE_SEQUENCE_DEFAULT)
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Phase"
        verbose_name_plural = "Phases"
        db_table = "phases"
        ordering = ("sequence", "created_at")
        indexes = [models.Index(fields=["project", "sequence"], name="phase_project_sequence_idx")]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=Q(deleted_at__isnull=True),
                name="phase_unique_project_name_when_deleted_at_null",
            ),
            models.CheckConstraint(
                condition=(
                    Q(start_date__isnull=True)
                    | Q(target_date__isnull=True)
                    | Q(start_date__lte=F("target_date"))
                ),
                name="phase_start_date_lte_target_date",
            ),
        ]

    def __str__(self):
        return f"{self.name} <{self.project_id}>"


class PhaseModule(ProjectBaseModel):
    """A keyword's place in a phase. A keyword is in at most one phase (partial unique on ``module``)."""

    phase = models.ForeignKey("db.Phase", on_delete=models.CASCADE, related_name="phase_modules")
    module = models.ForeignKey("db.Module", on_delete=models.CASCADE, related_name="phase_modules")
    sequence = models.FloatField(default=PHASE_SEQUENCE_DEFAULT)

    class Meta:
        verbose_name = "Phase Module"
        verbose_name_plural = "Phase Modules"
        db_table = "phase_modules"
        ordering = ("sequence", "created_at")
        indexes = [models.Index(fields=["phase", "sequence"], name="phase_module_phase_seq_idx")]
        constraints = [
            models.UniqueConstraint(
                fields=["module"],
                condition=Q(deleted_at__isnull=True),
                name="phase_module_unique_module_when_deleted_at_null",
            )
        ]

    def __str__(self):
        return f"{self.phase_id} {self.module_id}"
