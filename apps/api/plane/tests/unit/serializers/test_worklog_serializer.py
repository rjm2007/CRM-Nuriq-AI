# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: validation of the app and public-API IssueWorkLog serializers."""

from datetime import timedelta

import pytest
from django.utils import timezone

from plane.api.serializers import IssueWorkLogSerializer as ApiWorkLogSerializer
from plane.app.serializers import IssueWorkLogSerializer as AppWorkLogSerializer
from plane.db.models import Project, ProjectMember, WorkspaceMember
from plane.tests.factories import IssueFactory, IssueWorkLogFactory, UserFactory

pytestmark = [pytest.mark.unit, pytest.mark.django_db]

SERIALIZERS = [AppWorkLogSerializer, ApiWorkLogSerializer]


@pytest.fixture
def env(workspace, create_user):
    project = Project.objects.create(name="WL", identifier="WLS", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    member = UserFactory()
    WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
    ProjectMember.objects.create(project=project, member=member, workspace=workspace, role=15)
    guest = UserFactory()
    WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
    ProjectMember.objects.create(project=project, member=guest, workspace=workspace, role=5)
    issue = IssueFactory(project=project, workspace=workspace)
    return {"project": project, "admin": create_user, "member": member, "guest": guest, "issue": issue}


def ctx(env, actor, is_admin):
    return {"actor": actor, "project_id": env["project"].id, "is_admin": is_admin}


def payload(**kwargs):
    data = {"started_at": timezone.now().isoformat(), "duration_minutes": 90, "note": "work"}
    data.update(kwargs)
    return data


@pytest.mark.parametrize("serializer_cls", SERIALIZERS)
class TestFields:
    @pytest.mark.parametrize("minutes", [0, 1441, -5, "1.5", "abc", None])
    def test_bad_duration(self, env, serializer_cls, minutes):
        s = serializer_cls(data=payload(duration_minutes=minutes), context=ctx(env, env["member"], False))
        assert not s.is_valid()
        assert "duration_minutes" in s.errors

    @pytest.mark.parametrize("minutes", [1, 1440, "90"])
    def test_good_duration(self, env, serializer_cls, minutes):
        s = serializer_cls(data=payload(duration_minutes=minutes), context=ctx(env, env["member"], False))
        assert s.is_valid(), s.errors

    def test_started_at_required(self, env, serializer_cls):
        data = payload()
        data.pop("started_at")
        s = serializer_cls(data=data, context=ctx(env, env["member"], False))
        assert not s.is_valid()
        assert "started_at" in s.errors

    def test_started_at_more_than_24h_ahead(self, env, serializer_cls):
        future = (timezone.now() + timedelta(hours=25)).isoformat()
        s = serializer_cls(data=payload(started_at=future), context=ctx(env, env["member"], False))
        assert not s.is_valid()
        assert "started_at" in s.errors

    def test_started_at_within_24h_ahead(self, env, serializer_cls):
        future = (timezone.now() + timedelta(hours=23)).isoformat()
        s = serializer_cls(data=payload(started_at=future), context=ctx(env, env["member"], False))
        assert s.is_valid(), s.errors

    def test_note_stripped_and_limited(self, env, serializer_cls):
        s = serializer_cls(data=payload(note="  hi  "), context=ctx(env, env["member"], False))
        assert s.is_valid(), s.errors
        assert s.validated_data["note"] == "hi"
        s = serializer_cls(data=payload(note="x" * 2001), context=ctx(env, env["member"], False))
        assert not s.is_valid()
        assert "note" in s.errors
        s = serializer_cls(data=payload(note="x" * 2000), context=ctx(env, env["member"], False))
        assert s.is_valid(), s.errors

    def test_member_for_self_ok(self, env, serializer_cls):
        s = serializer_cls(data=payload(user=str(env["member"].id)), context=ctx(env, env["member"], False))
        assert s.is_valid(), s.errors

    def test_member_for_other_rejected(self, env, serializer_cls):
        s = serializer_cls(data=payload(user=str(env["admin"].id)), context=ctx(env, env["member"], False))
        assert not s.is_valid()
        assert s.errors["error_code"] == ["INVALID_WORKLOG_USER"]

    def test_admin_for_member_ok(self, env, serializer_cls):
        s = serializer_cls(data=payload(user=str(env["member"].id)), context=ctx(env, env["admin"], True))
        assert s.is_valid(), s.errors
        assert s.validated_data["user_id"] == env["member"].id

    def test_admin_for_guest_rejected(self, env, serializer_cls):
        s = serializer_cls(data=payload(user=str(env["guest"].id)), context=ctx(env, env["admin"], True))
        assert not s.is_valid()
        assert s.errors["error_code"] == ["INVALID_WORKLOG_USER"]

    def test_admin_for_inactive_member_rejected(self, env, serializer_cls):
        ProjectMember.objects.filter(member=env["member"], project=env["project"]).update(is_active=False)
        s = serializer_cls(data=payload(user=str(env["member"].id)), context=ctx(env, env["admin"], True))
        assert not s.is_valid()
        assert s.errors["error_code"] == ["INVALID_WORKLOG_USER"]

    def test_admin_for_unknown_user_rejected(self, env, serializer_cls):
        s = serializer_cls(data=payload(user=str(UserFactory().id)), context=ctx(env, env["admin"], True))
        assert not s.is_valid()
        assert s.errors["error_code"] == ["INVALID_WORKLOG_USER"]

    def test_issue_cannot_change_on_update(self, env, serializer_cls):
        worklog = IssueWorkLogFactory(issue=env["issue"], user=env["member"])
        other = IssueFactory(project=env["project"], workspace=env["project"].workspace)
        s = serializer_cls(worklog, data={"issue": str(other.id)}, partial=True, context=ctx(env, env["member"], False))
        assert not s.is_valid()
        assert s.errors["error_code"] == ["WORKLOG_ISSUE_IMMUTABLE"]

    def test_same_issue_on_update_ok(self, env, serializer_cls):
        worklog = IssueWorkLogFactory(issue=env["issue"], user=env["member"])
        s = serializer_cls(
            worklog,
            data={"issue": str(env["issue"].id), "duration_minutes": 30},
            partial=True,
            context=ctx(env, env["member"], False),
        )
        assert s.is_valid(), s.errors


def test_issue_detail_serializer_without_annotation_skips_totals(env):
    from plane.app.serializers import IssueDetailSerializer

    data = IssueDetailSerializer(env["issue"]).data
    assert "logged_minutes" not in data
    assert "total_logged_minutes" not in data
