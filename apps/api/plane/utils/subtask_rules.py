# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: subtask rules shared by the app API, the public API, sub-issue bulk attach,
Gantt bulk dates and issue search.

Rules (see docs/DECISIONS.md, "Subtask rules, progress, parent auto-done"):
- one level only: a subtask cannot have subtasks, and a parent cannot itself be a subtask
- an issue cannot be its own parent
- a subtask's ``target_date`` must be on or before its parent's ``target_date``
- a parent's ``target_date`` cannot move before any of its live subtasks' ``target_date``
- null dates are always allowed
"""

# Python imports
import uuid
from datetime import date, datetime

# Django imports
from django.db import models
from django.db.models import Count, Exists, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce

# Module imports
from plane.db.models import Issue, StateGroup

SUBTASK_SELF_PARENT = "SUBTASK_SELF_PARENT"
SUBTASK_PARENT_IS_SUBTASK = "SUBTASK_PARENT_IS_SUBTASK"
SUBTASK_HAS_CHILDREN = "SUBTASK_HAS_CHILDREN"
SUBTASK_DATE_AFTER_PARENT = "SUBTASK_DATE_AFTER_PARENT"
PARENT_DATE_BEFORE_SUBTASKS = "PARENT_DATE_BEFORE_SUBTASKS"

_MISSING = object()


class SubtaskRuleError(Exception):
    """A broken subtask rule. ``extra`` is merged into the error payload."""

    def __init__(self, code, field, message, issue_ids=None, extra=None):
        super().__init__(message)
        self.code = code
        self.field = field
        self.message = message
        self.issue_ids = [str(issue_id) for issue_id in (issue_ids or [])]
        self.extra = extra or {}

    def to_drf_error(self):
        """Payload for ``serializers.ValidationError``: ``{field: [message], "error_code": code, ...}``."""
        return {self.field: [self.message], "error_code": self.code, **self.extra}

    def to_bulk_error(self):
        """Payload for bulk endpoints: ``{"error", "error_code", "issue_ids", ...}``."""
        return {"error": self.message, "error_code": self.code, "issue_ids": self.issue_ids, **self.extra}


def _to_date(value):
    if value is None or isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.strptime(str(value), "%Y-%m-%d").date()


def _pk(value):
    if value is None:
        return None
    if isinstance(value, models.Model):
        return value.pk
    return value


def _as_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _identifier(row):
    return f"{row['project__identifier']}-{row['sequence_id']}"


def validate_issue_hierarchy(instance, attrs, parent_key, date_overrides=None, attr_key=None):
    """Check the subtask rules for one create/update. Raises ``SubtaskRuleError``.

    ``instance``: the Issue (or DraftIssue) being updated, ``None`` on create.
    ``attrs``: validated serializer data. A missing key falls back to the instance value;
    an explicit ``None`` clears it.
    ``parent_key``: the field name used in the error payload (``parent_id`` or ``parent``).
    ``attr_key``: the key read from ``attrs`` (defaults to ``parent_key``; DRF stores
    ``parent_id`` under its source, ``parent``).
    ``date_overrides``: ``{issue_id: target_date}`` for a batch that changes several
    issues at once (Gantt); used for the parent's and the children's dates.
    """
    attr_key = attr_key or parent_key
    overrides = {str(key): _to_date(value) for key, value in (date_overrides or {}).items()}

    parent_given = attr_key in attrs
    target_given = "target_date" in attrs
    if instance is not None and not parent_given and not target_given:
        return

    raw_parent = attrs.get(attr_key) if parent_given else _MISSING
    if raw_parent is _MISSING:
        parent_id = getattr(instance, "parent_id", None) if instance is not None else None
    else:
        parent_id = _pk(raw_parent)

    target_date = (
        _to_date(attrs.get("target_date")) if target_given else _to_date(getattr(instance, "target_date", None))
    )

    # Only Issue rows can be parents; a DraftIssue never has children.
    instance_id = instance.pk if isinstance(instance, Issue) else None
    old_parent_id = getattr(instance, "parent_id", None) if instance is not None else None
    parent_changed = parent_given and (instance is None or str(parent_id or "") != str(old_parent_id or ""))

    parent_row = None
    if parent_id is not None:
        if isinstance(raw_parent, Issue):
            parent_row = {"id": raw_parent.pk, "parent_id": raw_parent.parent_id, "target_date": raw_parent.target_date}
        else:
            parent_row = Issue.all_objects.filter(pk=parent_id).values("id", "parent_id", "target_date").first()

    # Structure rules: only when the parent is being set or changed, so edits to legacy
    # deeper trees are not blocked by unrelated changes.
    if parent_changed and parent_id is not None:
        if instance_id is not None and str(parent_id) == str(instance_id):
            raise SubtaskRuleError(SUBTASK_SELF_PARENT, parent_key, "A work item cannot be its own parent.")
        if parent_row is not None and parent_row["parent_id"] is not None:
            raise SubtaskRuleError(
                SUBTASK_PARENT_IS_SUBTASK,
                parent_key,
                "The selected parent is itself a sub-work item. Only one level of sub-work items is allowed.",
            )
        if instance_id is not None and Issue.objects.filter(parent_id=instance_id).exists():
            raise SubtaskRuleError(
                SUBTASK_HAS_CHILDREN,
                parent_key,
                "This work item has sub-work items, so it cannot become a sub-work item.",
            )

    if target_date is None:
        return

    # Subtask date must not be after the parent's date.
    if parent_row is not None and (parent_changed or target_given):
        parent_target = overrides.get(str(parent_row["id"]), _to_date(parent_row["target_date"]))
        if parent_target is not None and target_date > parent_target:
            raise SubtaskRuleError(
                SUBTASK_DATE_AFTER_PARENT,
                "target_date",
                f"A sub-work item's due date cannot be after its parent's due date ({parent_target.isoformat()}).",
                extra={"parent_target_date": parent_target.isoformat()},
            )

    # Parent date must not move before any live subtask's date.
    if instance_id is not None and target_given:
        children = Issue.issue_objects.filter(parent_id=instance_id).values(
            "id", "target_date", "sequence_id", "project__identifier"
        )
        conflicts = []
        latest = None
        for child in children:
            child_date = overrides.get(str(child["id"]), _to_date(child["target_date"]))
            if child_date is not None and child_date > target_date:
                conflicts.append(_identifier(child))
                latest = child_date if latest is None or child_date > latest else latest
        if conflicts:
            raise SubtaskRuleError(
                PARENT_DATE_BEFORE_SUBTASKS,
                "target_date",
                f"The due date cannot be before the due date of its sub-work items ({', '.join(sorted(conflicts))}).",
                extra={"subtask_identifiers": sorted(conflicts), "latest_subtask_target_date": latest.isoformat()},
            )


def validate_bulk_attach(parent, children):
    """Check that every issue in ``children`` can become a subtask of ``parent``.

    All or nothing: raises ``SubtaskRuleError`` (with ``issue_ids``) on the first broken rule.
    """
    children = list(children)
    if not children:
        return
    if parent.parent_id is not None:
        raise SubtaskRuleError(
            SUBTASK_PARENT_IS_SUBTASK,
            "parent",
            "The parent is itself a sub-work item. Only one level of sub-work items is allowed.",
            issue_ids=[parent.pk],
        )
    if any(str(child.pk) == str(parent.pk) for child in children):
        raise SubtaskRuleError(
            SUBTASK_SELF_PARENT, "sub_issue_ids", "A work item cannot be its own parent.", issue_ids=[parent.pk]
        )
    child_ids = [child.pk for child in children]
    with_children = list(Issue.objects.filter(parent_id__in=child_ids).values_list("parent_id", flat=True).distinct())
    if with_children:
        raise SubtaskRuleError(
            SUBTASK_HAS_CHILDREN,
            "sub_issue_ids",
            "Some work items have sub-work items, so they cannot become sub-work items.",
            issue_ids=with_children,
        )
    parent_target = _to_date(parent.target_date)
    if parent_target is not None:
        late = [
            child.pk
            for child in children
            if child.target_date is not None and _to_date(child.target_date) > parent_target
        ]
        if late:
            raise SubtaskRuleError(
                SUBTASK_DATE_AFTER_PARENT,
                "sub_issue_ids",
                f"Some work items are due after the parent's due date ({parent_target.isoformat()}).",
                issue_ids=late,
                extra={"parent_target_date": parent_target.isoformat()},
            )


def validate_bulk_target_dates(issues_by_id, updates):
    """Gantt bulk dates: check every row before anything is written.

    ``issues_by_id``: ``{str(issue.id): issue}``; ``updates``: ``[{"id", "start_date", "target_date"}]``.
    Dates of the whole batch are used as overrides, so moving a parent and its subtasks
    together is judged on the final dates. Raises ``SubtaskRuleError`` with the row's id.
    """
    overrides = {
        str(update["id"]): update.get("target_date")
        for update in updates
        if update.get("target_date") and str(update["id"]) in issues_by_id
    }
    for issue_id, target_date in overrides.items():
        try:
            validate_issue_hierarchy(
                issues_by_id[issue_id], {"target_date": target_date}, "parent", date_overrides=overrides
            )
        except SubtaskRuleError as err:
            err.issue_ids = [issue_id]
            raise


def filter_parent_candidates(qs, issue_id):
    """Issues that can be picked as the parent of ``issue_id``: top-level issues,
    excluding the issue itself and its children."""
    qs = qs.filter(parent__isnull=True)
    issue_uuid = _as_uuid(issue_id)
    if issue_uuid is None:
        return qs
    return qs.exclude(pk=issue_uuid).exclude(parent_id=issue_uuid)


def filter_child_candidates(qs, issue_id):
    """Issues that can be attached as subtasks of ``issue_id``: no parent and no children.

    Empty when ``issue_id`` is itself a subtask. Safe when ``issue_id`` does not exist.
    """
    qs = qs.filter(parent__isnull=True).filter(~Exists(Issue.objects.filter(parent_id=OuterRef("pk"))))
    issue_uuid = _as_uuid(issue_id)
    if issue_uuid is None:
        return qs
    issue = Issue.objects.filter(pk=issue_uuid).values("parent_id").first()
    if issue is not None and issue["parent_id"] is not None:
        return qs.none()
    return qs.exclude(pk=issue_uuid)


def completed_sub_issues_count_expr():
    """Annotation: number of live children in the ``completed`` state group (cancelled excluded)."""
    return Coalesce(
        Subquery(
            Issue.issue_objects.filter(parent=OuterRef("id"), state__group=StateGroup.COMPLETED.value)
            .order_by()
            .values("parent")
            .annotate(count=Count("id"))
            .values("count"),
            output_field=IntegerField(),
        ),
        0,
    )
