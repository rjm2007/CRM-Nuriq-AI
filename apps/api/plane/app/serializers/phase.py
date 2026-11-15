# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: web-app serializers for the keyword map (Phase, ModuleRelation). Rules live in
plane/utils/keyword_map.py; the views validate input here and write through that service."""

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
    """Phase with ``module_ids`` (its keywords in map order; read-only, change them via phases/{id}/modules/)."""

    project = serializers.UUIDField(source="project_id", read_only=True)
    workspace = serializers.UUIDField(source="workspace_id", read_only=True)
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    description = serializers.CharField(
        max_length=PHASE_DESCRIPTION_MAX_LENGTH, allow_blank=True, required=False, trim_whitespace=False
    )
    sequence = serializers.FloatField(required=False)
    module_ids = serializers.SerializerMethodField()

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

    def get_module_ids(self, phase):
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
    """Body of POST phases/{id}/modules/."""

    module_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, max_length=MAX_MODULES_PER_ASSIGN
    )


class ModuleRelationSerializer(BaseSerializer):
    """Directed keyword edge ``source_module -> target_module`` with an optional free-text ``label``."""

    project = serializers.UUIDField(source="project_id", read_only=True)
    workspace = serializers.UUIDField(source="workspace_id", read_only=True)
    source_module = serializers.UUIDField(source="source_module_id")
    target_module = serializers.UUIDField(source="target_module_id")
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
