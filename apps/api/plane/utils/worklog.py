# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: time tracking (IssueWorkLog) rules shared by the app API, the public API and the issue views.

See docs/DECISIONS.md, "Time tracking (IssueWorkLog)" and "Time tracking choices":
- ``Project.is_time_tracking_enabled`` gates writes only; reads stay allowed
- project ADMIN/MEMBER may log; a member edits/deletes only entries whose ``user`` is them,
  a project admin edits/deletes any and may log for another active ADMIN/MEMBER
- totals are query-only annotations; archived subtasks count, deleted issues/entries don't
"""

# Python imports
import uuid
from datetime import datetime, time, timedelta, timezone as dt_timezone

# Django imports
from django.db.models import F, Func, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

# Third party imports
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

# Module imports
from plane.db.models import IssueWorkLog, ProjectMember, WorkspaceMember

TIME_TRACKING_DISABLED = "TIME_TRACKING_DISABLED"
INVALID_WORKLOG_USER = "INVALID_WORKLOG_USER"
WORKLOG_ISSUE_IMMUTABLE = "WORKLOG_ISSUE_IMMUTABLE"
INVALID_WORKLOG_FILTER = "INVALID_WORKLOG_FILTER"

WORKLOG_MAX_NOTE_LENGTH = 2000
WORKLOG_MAX_FUTURE = timedelta(hours=24)

# Project roles that may log time (ADMIN=20, MEMBER=15). Guests may not read or write.
WORKLOG_ROLES = (20, 15)
PROJECT_ADMIN_ROLE = 20


class TimeTrackingDisabled(APIException):
    """403 raised by write endpoints when the project's time tracking flag is off."""

    status_code = status.HTTP_403_FORBIDDEN
    default_code = "time_tracking_disabled"

    def __init__(self):
        super().__init__(
            detail={
                "error": "Time tracking is disabled for this project.",
                "error_code": TIME_TRACKING_DISABLED,
            }
        )


def ensure_time_tracking_enabled(project):
    """Raise ``TimeTrackingDisabled`` (403) unless the project has time tracking on."""
    if not getattr(project, "is_time_tracking_enabled", False):
        raise TimeTrackingDisabled()


def is_project_admin(user_id, project_id):
    """True when the user is an active project ADMIN."""
    return ProjectMember.objects.filter(
        project_id=project_id, member_id=user_id, role=PROJECT_ADMIN_ROLE, is_active=True
    ).exists()


def can_manage_worklog(user, worklog, is_admin):
    """Edit/delete rule: project admins manage any entry; others only entries logged for themselves."""
    return bool(is_admin) or worklog.user_id == user.id


def is_worklog_member(user_id, project_id):
    """True when the user is an active ADMIN or MEMBER of the project (a valid ``user`` for an entry)."""
    return ProjectMember.objects.filter(
        project_id=project_id, member_id=user_id, role__in=WORKLOG_ROLES, is_active=True
    ).exists()


def validate_worklog_user(user_id, actor, project_id, is_admin):
    """``user`` rule for create/update. Returns the id or raises a 400 with ``INVALID_WORKLOG_USER``.

    Anyone may name themselves. Only a project admin may name someone else, and that person must be
    an active ADMIN/MEMBER of the project (an unknown id fails the same way).
    """
    if user_id is None or str(user_id) == str(actor.id):
        return user_id
    if is_admin and is_worklog_member(user_id, project_id):
        return user_id
    message = (
        "Time can only be logged for active project admins or members."
        if is_admin
        else "Only project admins can log time for another member."
    )
    raise serializers.ValidationError({"user": [message], "error_code": INVALID_WORKLOG_USER})


def validate_started_at(value):
    """``started_at`` may be at most 24h in the future."""
    if value is None:
        raise serializers.ValidationError("This field is required.")
    if value > timezone.now() + WORKLOG_MAX_FUTURE:
        raise serializers.ValidationError("Start time cannot be more than 24 hours in the future.")
    return value


def validate_issue_unchanged(serializer):
    """On update, a payload ``issue`` / ``issue_id`` that differs from the entry's issue is a 400."""
    if serializer.instance is None:
        return
    data = getattr(serializer, "initial_data", None) or {}
    for key in ("issue", "issue_id"):
        if key in data and str(data[key]) != str(serializer.instance.issue_id):
            raise serializers.ValidationError(
                {"issue": ["A time entry cannot be moved to another work item."], "error_code": WORKLOG_ISSUE_IMMUTABLE}
            )


def validate_worklog_attrs(serializer, attrs):
    """Cross-field rules for the app and public-API worklog serializers.

    Needs ``actor``, ``project_id`` and ``is_admin`` in the serializer context.
    """
    validate_issue_unchanged(serializer)
    if "user_id" in attrs:
        context = serializer.context
        validate_worklog_user(attrs["user_id"], context["actor"], context["project_id"], context.get("is_admin", False))
    return attrs


def _sum_subquery(queryset):
    # SUM without GROUP BY (same trick as Plane's link_count/Func Count): one row per outer issue.
    return Coalesce(
        Subquery(
            queryset.order_by().annotate(total=Func(F("duration_minutes"), function="SUM")).values("total"),
            output_field=IntegerField(),
        ),
        0,
    )


def logged_minutes_expr():
    """Annotation: minutes logged on the issue itself (live entries only)."""
    return _sum_subquery(IssueWorkLog.objects.filter(issue_id=OuterRef("id")))


def total_logged_minutes_expr():
    """Annotation: own minutes + minutes on direct subtasks.

    Deleted subtasks and deleted entries are excluded; archived subtasks are counted.
    """
    return _sum_subquery(
        IssueWorkLog.objects.filter(
            Q(issue_id=OuterRef("id")) | Q(issue__parent_id=OuterRef("id"), issue__deleted_at__isnull=True)
        )
    )


def _filter_error(message):
    return serializers.ValidationError({"error": message, "error_code": INVALID_WORKLOG_FILTER})


def _parse_bound(value, name):
    """ISO datetime or date (midnight UTC); 400 when unparsable."""
    parsed = None
    try:
        parsed = parse_datetime(value)
        if parsed is None:
            day = parse_date(value)
            if day is not None:
                parsed = datetime.combine(day, time.min)
    except ValueError:
        parsed = None
    if parsed is None:
        raise _filter_error(f"Invalid {name}. Use an ISO date or datetime.")
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, dt_timezone.utc)
    return parsed


def _parse_uuid(value, name):
    try:
        return uuid.UUID(str(value).strip())
    except (TypeError, ValueError, AttributeError):
        raise _filter_error(f"Invalid {name}.")


def apply_worklog_filters(queryset, params):
    """Project list / summary filters. Raises a 400 ``INVALID_WORKLOG_FILTER`` on bad input.

    - ``user``: comma-separated user ids
    - ``issue``: one issue id; with ``include_subtasks=true`` also its direct live subtasks
    - ``started_at__gte`` / ``started_at__lt``: ISO date or datetime (naive = UTC)
    """
    users = params.get("user")
    if users:
        user_ids = [_parse_uuid(part, "user") for part in users.split(",") if part.strip()]
        if user_ids:
            queryset = queryset.filter(user_id__in=user_ids)

    issue = params.get("issue")
    if issue:
        issue_id = _parse_uuid(issue, "issue")
        include_subtasks = str(params.get("include_subtasks", "false")).lower() == "true"
        if include_subtasks:
            queryset = queryset.filter(
                Q(issue_id=issue_id) | Q(issue__parent_id=issue_id, issue__deleted_at__isnull=True)
            )
        else:
            queryset = queryset.filter(issue_id=issue_id)

    gte = params.get("started_at__gte")
    if gte:
        queryset = queryset.filter(started_at__gte=_parse_bound(gte, "started_at__gte"))

    lt = params.get("started_at__lt")
    if lt:
        queryset = queryset.filter(started_at__lt=_parse_bound(lt, "started_at__lt"))

    return queryset


def project_worklog_queryset(slug, project_id):
    """Live entries of a project whose issue is not deleted (archived issues included)."""
    return IssueWorkLog.objects.filter(
        workspace__slug=slug,
        project_id=project_id,
        issue__deleted_at__isnull=True,
    )


def worklog_summary(queryset):
    """``{"total_minutes", "by_user": [{"user_id", "minutes"}]}`` for an already-filtered queryset."""
    rows = list(
        queryset.order_by().values("user_id").annotate(minutes=Sum("duration_minutes")).order_by("-minutes", "user_id")
    )
    return {
        "total_minutes": sum(row["minutes"] or 0 for row in rows),
        "by_user": [{"user_id": str(row["user_id"]), "minutes": row["minutes"] or 0} for row in rows],
    }


def worklog_errors(errors):
    """Serializer errors with ``error_code`` as a plain string (DRF wraps it in a list inside ``validate``)."""
    errors = dict(errors)
    code = errors.get("error_code")
    if isinstance(code, (list, tuple)) and code:
        errors["error_code"] = str(code[0])
    return errors


def can_access_time_tracking(user_id, slug, project_id):
    """Who may use the worklog endpoints: same rule as ``allow_permission([ADMIN, MEMBER])``.

    Active project ADMIN/MEMBER, or a workspace admin who is an active member of the project.
    Used by the public API, whose views don't go through ``allow_permission``.
    """
    if ProjectMember.objects.filter(
        workspace__slug=slug, project_id=project_id, member_id=user_id, role__in=WORKLOG_ROLES, is_active=True
    ).exists():
        return True
    return (
        ProjectMember.objects.filter(
            workspace__slug=slug, project_id=project_id, member_id=user_id, is_active=True
        ).exists()
        and WorkspaceMember.objects.filter(
            workspace__slug=slug, member_id=user_id, role=PROJECT_ADMIN_ROLE, is_active=True
        ).exists()
    )
