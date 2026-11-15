# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: public-API serializers for the keyword map (Phase, ModuleRelation). Rules live in
plane/utils/keyword_map.py."""

# Python imports
import math

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import ModuleRelation, Phase
from plane.utils.keyword_map import (
    INVALID_PHASE_DATES,
    MAX_MODULES_PER_ASSIGN,
    SELF_RELATION,
    phase_module_ids,
)

PHASE_DESCRIPTION_MAX_LENGTH = 10000


class PhaseSerializer(BaseSerializer):
    """
    Project phase on the keyword map.

    ``module_ids`` lists the phase's keywords (modules) in map order; change it with
    ``POST phases/{id}/modules/`` and ``DELETE phases/{id}/modules/{module_id}/``.
    """

    project = serializers.UUIDField(source="project_id", read_only=True)
    workspace = serializers.UUIDField(source="workspace_id", read_only=True)
    name = serializers.CharField(max_length=255, trim_whitespace=True, help_text="Unique within the project")
    description = serializers.CharField(
        max_length=PHASE_DESCRIPTION_MAX_LENGTH, allow_blank=True, required=False, trim_whitespace=False
    )
    sequence = serializers.FloatField(required=False, help_text="Sort key, ascending. New phases go last")
    module_ids = serializers.SerializerMethodField(help_text="Keyword (module) ids in this phase, in order")

    class Meta:
        model = Phase
        fields = [
            "id",
            "project",
            "workspace",
            "name",
            "description",
            "sequence",
            "start_date",
            "target_date",
            "module_ids",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "updated_by", "created_at", "updated_at"]

    def validate_sequence(self, value):
        # FloatField accepts "NaN" / "Infinity", which would break ordering.
        if value is not None and not math.isfinite(value):
            raise serializers.ValidationError("Sequence must be a finite number.")
        return value

    def get_module_ids(self, phase) -> list[str]:
        return [str(pk) for pk in phase_module_ids(phase)]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        target = attrs.get("target_date", getattr(self.instance, "target_date", None))
        if start and target and start > target:
            raise serializers.ValidationError(
                {"target_date": ["The end date must be on or after the start date."], "error_code": INVALID_PHASE_DATES}
            )
        return attrs


class PhaseModuleAssignSerializer(serializers.Serializer):
    """Keywords to put into a phase. Keywords already in another phase move here."""

    module_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, max_length=MAX_MODULES_PER_ASSIGN
    )


class ModuleRelationSerializer(BaseSerializer):
    """
    Directed edge between two keywords (modules) of the same project.

    No self-links; one edge per ordered pair (A->B and B->A may both exist). ``label`` is free text.
    """

    project = serializers.UUIDField(source="project_id", read_only=True)
    workspace = serializers.UUIDField(source="workspace_id", read_only=True)
    source_module = serializers.UUIDField(source="source_module_id", help_text="Edge start (module id)")
    target_module = serializers.UUIDField(source="target_module_id", help_text="Edge end (module id)")
    label = serializers.CharField(max_length=255, allow_blank=True, required=False, trim_whitespace=True)

    class Meta:
        model = ModuleRelation
        fields = [
            "id",
            "project",
            "workspace",
            "source_module",
            "target_module",
            "label",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "updated_by", "created_at", "updated_at"]

    def validate(self, attrs):
        source = attrs.get("source_module_id", getattr(self.instance, "source_module_id", None))
        target = attrs.get("target_module_id", getattr(self.instance, "target_module_id", None))
        if source is not None and target is not None and str(source) == str(target):
            raise serializers.ValidationError(
                {"target_module": ["A keyword cannot be linked to itself."], "error_code": SELF_RELATION}
            )
        return attrs
