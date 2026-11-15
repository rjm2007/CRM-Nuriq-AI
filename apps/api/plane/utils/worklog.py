# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: time tracking (IssueWorkLog) rules shared by the app API, the public API and the issue views.

See docs/DECISIONS.md, "Time tracking (IssueWorkLog)" and "Time tracking choices":
- ``Project.is_time_tracking_enabled`` gates writes only; reads stay allowed
- project ADMIN/MEMBER may log; a member edits/deletes only entries whose ``user`` is them,
  a project admin edits/deletes any and may log for another active ADMIN/MEMBER
- totals are query-only annotations; archived subtasks count, deleted issues/entries don't
- only project ADMIN/MEMBER see time data (entries, totals, worklog activity). A workspace admin whose
  project role is GUEST is treated as a guest (``can_view_time``)
"""

# Python imports
import uuid
from datetime import datetime, time, timedelta, timezone as dt_timezone
from functools import wraps

# Django imports
from django.db.models import Case, F, Func, IntegerField, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

# Third party imports
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response

# Module imports
from plane.db.models import Issue, IssueWorkLog, ProjectMember

TIME_TRACKING_DISABLED = "TIME_TRACKING_DISABLED"
INVALID_WORKLOG_USER = "INVALID_WORKLOG_USER"
WORKLOG_ISSUE_IMMUTABLE = "WORKLOG_ISSUE_IMMUTABLE"
INVALID_WORKLOG_FILTER = "INVALID_WORKLOG_FILTER"

WORKLOG_MAX_NOTE_LENGTH = 2000
WORKLOG_MAX_FUTURE = timedelta(hours=24)
WORKLOG_MIN_STARTED_AT = datetime(2000, 1, 1, tzinfo=dt_timezone.utc)
WORKLOG_MAX_FILTER_USERS = 100
WORKLOG_ISSUE_LIST_CAP = 1000
NO_TIME_ACCESS = {"error": "Only project admins and members can use time tracking."}

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
    if value < WORKLOG_MIN_STARTED_AT:
        raise serializers.ValidationError("Start time cannot be before 2000-01-01.")
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

    Two subqueries summed, so each one uses an index (``issue_id``; ``issues.parent_id`` then
    ``issue_id``) instead of an OR that forces a scan per outer row.
    Deleted subtasks and deleted entries are excluded; archived subtasks are counted.
    """
    subtasks = IssueWorkLog.objects.filter(issue__parent_id=OuterRef("id"), issue__deleted_at__isnull=True)
    return logged_minutes_expr() + _sum_subquery(subtasks)


def time_project_ids(user):
    """Ids of projects where ``user`` is an active ADMIN/MEMBER (a queryset, usable in ``__in``)."""
    return ProjectMember.objects.filter(member=user, role__in=WORKLOG_ROLES, is_active=True).values("project_id")


def can_view_time(user, project_id, slug):
    """True when ``user`` (a user or a user id) may see time data of the project.

    Rule: active project role ADMIN or MEMBER. A workspace admin whose project role is GUEST is a
    guest here (no time data), unlike Plane's ``allow_permission`` workspace-admin bypass.
    """
    return ProjectMember.objects.filter(
        workspace__slug=slug,
        project_id=project_id,
        member_id=getattr(user, "id", user),
        role__in=WORKLOG_ROLES,
        is_active=True,
    ).exists()


def time_annotations(show):
    """``logged_minutes`` / ``total_logged_minutes`` annotations, or none when ``show`` is False."""
    if not show:
        return {}
    return {"logged_minutes": logged_minutes_expr(), "total_logged_minutes": total_logged_minutes_expr()}


def total_logged_minutes_for_viewer_expr(user):
    """Cross-project lists: the total for rows in projects where ``user`` may see time, NULL elsewhere."""
    return Case(
        When(project_id__in=time_project_ids(user), then=total_logged_minutes_expr()),
        default=Value(None),
        output_field=IntegerField(),
    )


def worklog_activity_visible_q(user):
    """Activity filter: drop ``field="worklog"`` rows of projects where ``user`` may not see time."""
    return ~Q(field="worklog") | Q(project_id__in=time_project_ids(user))


def require_time_access(view_func):
    """View decorator (after ``allow_permission``): 403 unless ``can_view_time`` for the URL project."""

    @wraps(view_func)
    def _wrapped(instance, request, *args, **kwargs):
        if not can_view_time(request.user, kwargs["project_id"], kwargs["slug"]):
            return Response(NO_TIME_ACCESS, status=status.HTTP_403_FORBIDDEN)
        return view_func(instance, request, *args, **kwargs)

    return _wrapped


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

    - ``user``: comma-separated user ids (at most 100)
    - ``issue``: one issue id; with ``include_subtasks=true`` also its direct live subtasks
    - ``started_at__gte`` / ``started_at__lt``: ISO date or datetime (naive = UTC); gte must be < lt
    """
    users = params.get("user")
    if users:
        parts = [part for part in users.split(",") if part.strip()]
        if len(parts) > WORKLOG_MAX_FILTER_USERS:
            raise _filter_error(f"Filter by at most {WORKLOG_MAX_FILTER_USERS} users.")
        user_ids = [_parse_uuid(part, "user") for part in parts]
        if user_ids:
            queryset = queryset.filter(user_id__in=user_ids)

    issue = params.get("issue")
    if issue:
        issue_id = _parse_uuid(issue, "issue")
        include_subtasks = str(params.get("include_subtasks", "false")).lower() == "true"
        if include_subtasks:
            # Resolve the child ids first: an IN list on the indexed issue_id beats an OR across a join.
            child_ids = list(Issue.objects.filter(parent_id=issue_id).values_list("id", flat=True))
            queryset = queryset.filter(issue_id__in=[issue_id, *child_ids])
        else:
            queryset = queryset.filter(issue_id=issue_id)

    gte = params.get("started_at__gte")
    gte = _parse_bound(gte, "started_at__gte") if gte else None
    lt = params.get("started_at__lt")
    lt = _parse_bound(lt, "started_at__lt") if lt else None
    if gte and lt and gte >= lt:
        raise _filter_error("started_at__gte must be before started_at__lt.")
    if gte:
        queryset = queryset.filter(started_at__gte=gte)
    if lt:
        queryset = queryset.filter(started_at__lt=lt)

    return queryset


def project_worklog_queryset(slug, project_id):
    """Live entries of a live (not archived) project whose issue is not deleted (archived issues included)."""
    return IssueWorkLog.objects.filter(
        workspace__slug=slug,
        project_id=project_id,
        project__archived_at__isnull=True,
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
    """Who may use the worklog endpoints (both APIs): ``can_view_time``.

    Active project ADMIN/MEMBER only; a workspace admin with project role GUEST is denied.
    """
    return can_view_time(user_id, project_id, slug)
