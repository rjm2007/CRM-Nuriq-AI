# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: directed edge between two keywords (Plane ``Module``) on the keyword map (Step 2).

Not ``ModuleLink`` (that is Plane's URL-link model). Same-project and not-archived checks live in
``plane/utils/keyword_map.py``; the database enforces no self-edge and one live edge per ordered pair.
"""

# Django imports
from django.db import models
from django.db.models import F, Q

# Module imports
from .project import ProjectBaseModel


class ModuleRelation(ProjectBaseModel):
    """``source_module`` -> ``target_module`` with an optional free-text ``label``. A->B and B->A may both exist."""

    source_module = models.ForeignKey("db.Module", on_delete=models.CASCADE, related_name="outgoing_relations")
    target_module = models.ForeignKey("db.Module", on_delete=models.CASCADE, related_name="incoming_relations")
    label = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Module Relation"
        verbose_name_plural = "Module Relations"
        db_table = "module_relations"
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(
                condition=~Q(source_module=F("target_module")),
                name="module_relation_no_self_link",
            ),
            models.UniqueConstraint(
                fields=["source_module", "target_module"],
                condition=Q(deleted_at__isnull=True),
                name="module_relation_unique_pair_when_deleted_at_null",
            ),
        ]

    def __str__(self):
        return f"{self.source_module_id} -> {self.target_module_id}"
