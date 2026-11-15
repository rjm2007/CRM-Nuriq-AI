# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Neuric: keyword map service (Step 2). Phases, keyword-to-phase assignment and keyword relations.

Every write path calls these functions: the web-app views, the public API views, and the Step 3
AI agent. They work without a request (``actor`` is passed in; ``created_by`` / ``updated_by`` are
set explicitly), raise ``rest_framework.serializers.ValidationError`` with an ``error_code`` on bad
input, and enqueue side effects only after the transaction commits:

- webhook ``model_activity`` / ``webhook_activity`` for Phase and ModuleRelation writes
  (events ``phase`` / ``module_relation``, sent to webhooks subscribed to modules)
- ``bgtasks.phase_activity.phase_module_activity`` when a keyword joins, leaves or moves phase
  (one ``phase`` IssueActivity row per live work item in that keyword)

Rules (docs/DECISIONS.md "Step 2 keywords, phases, map" and "Step 2 choices"):
- a keyword (Module) is in at most one phase; assigning it to another phase moves it
- keywords and both ends of a relation must be live, non-archived modules of the same project
- relations are directed, never self-links, one live edge per ordered pair (A->B and B->A may coexist)
"""

# Python imports
import json

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction
from django.db.models import Max, Prefetch
from django.utils import timezone

# Third party imports
from rest_framework import serializers

# Module imports
from plane.app.permissions.base import ROLE
from plane.db.models import Module, ModuleRelation, Phase, PhaseModule, Project, ProjectMember

INVALID_PHASE = "INVALID_PHASE"
PHASE_NAME_TAKEN = "PHASE_NAME_TAKEN"
INVALID_PHASE_DATES = "INVALID_PHASE_DATES"
INVALID_KEYWORD = "INVALID_KEYWORD"
KEYWORD_ARCHIVED = "KEYWORD_ARCHIVED"
KEYWORD_NOT_IN_PHASE = "KEYWORD_NOT_IN_PHASE"
SELF_RELATION = "SELF_RELATION"
DUPLICATE_RELATION = "DUPLICATE_RELATION"
KEYWORD_MAP_CONFLICT = "KEYWORD_MAP_CONFLICT"

SEQUENCE_STEP = 10000
MAX_MODULES_PER_ASSIGN = 500
PHASE_FIELDS = ("name", "description", "sequence", "start_date", "target_date")
RELATION_FIELDS = ("source_module_id", "target_module_id", "label")


def _error(field, message, code):
    return serializers.ValidationError({field: [message], "error_code": code})


def keyword_map_errors(errors):
    """Serializer errors with ``error_code`` as a plain string (DRF wraps it in a list inside ``validate``)."""
    errors = dict(errors)
    code = errors.get("error_code")
    if isinstance(code, (list, tuple)) and code:
        errors["error_code"] = str(code[0])
    return errors


def validate_phase_dates(start_date, target_date):
    if start_date and target_date and start_date > target_date:
        raise _error("target_date", "The end date must be on or after the start date.", INVALID_PHASE_DATES)


# --------------------------------------------------------------------------- reads

LIVE_PHASE_MODULES = "live_phase_modules"


def phase_queryset(project_id):
    """Live phases of a project, ordered, with their keywords (live, non-archived) prefetched in order."""
    links = PhaseModule.objects.filter(module__deleted_at__isnull=True, module__archived_at__isnull=True).order_by(
        "sequence", "created_at"
    )
    return (
        Phase.objects.filter(project_id=project_id)
        .prefetch_related(Prefetch("phase_modules", queryset=links, to_attr=LIVE_PHASE_MODULES))
        .order_by("sequence", "created_at")
    )


def phase_module_ids(phase):
    """Keyword ids of ``phase`` in PhaseModule order (archived and deleted keywords left out)."""
    links = getattr(phase, LIVE_PHASE_MODULES, None)
    if links is None:
        links = PhaseModule.objects.filter(
            phase_id=phase.id, module__deleted_at__isnull=True, module__archived_at__isnull=True
        ).order_by("sequence", "created_at")
    return [link.module_id for link in links]


def relation_queryset(project_id):
    """Live edges of a project whose two keywords are live and not archived, oldest first."""
    return ModuleRelation.objects.filter(
        project_id=project_id,
        source_module__deleted_at__isnull=True,
        source_module__archived_at__isnull=True,
        target_module__deleted_at__isnull=True,
        target_module__archived_at__isnull=True,
    ).order_by("created_at")


def get_live_project(slug, project_id):
    """The URL project if it is in the URL workspace and not archived (``Project.DoesNotExist`` otherwise)."""
    return Project.objects.get(pk=project_id, workspace__slug=slug, archived_at__isnull=True)


def get_project_phase(slug, project_id, phase_id):
    """A live phase of the URL project (keywords prefetched); ``Phase.DoesNotExist`` otherwise."""
    return phase_queryset(project_id).filter(workspace__slug=slug, project__archived_at__isnull=True).get(pk=phase_id)


def get_project_relation(slug, project_id, relation_id):
    """A live edge of the URL project (ends may be archived); ``ModuleRelation.DoesNotExist`` otherwise."""
    return ModuleRelation.objects.get(
        pk=relation_id, project_id=project_id, workspace__slug=slug, project__archived_at__isnull=True
    )


def keyword_map_hidden_from_guest(user_id, slug, project_id):
    """True for a project GUEST when the project's ``guest_view_all_features`` is off.

    Such guests may not read phases or keyword relations (views answer 403); admins, members and
    guests of projects that share all features read as usual. Same membership check as Plane's
    ``issue_hidden_from_guest`` / ``is_restricted_guest``.
    """
    return ProjectMember.objects.filter(
        workspace__slug=slug,
        project_id=project_id,
        member_id=user_id,
        role=ROLE.GUEST.value,
        is_active=True,
        project__guest_view_all_features=False,
    ).exists()


# --------------------------------------------------------------------------- side effects


def _dump(data):
    return json.dumps(data, cls=DjangoJSONEncoder)


def _phase_snapshot(phase):
    return {field: getattr(phase, field) for field in PHASE_FIELDS}


def _relation_snapshot(relation):
    return {
        "source_module": relation.source_module_id,
        "target_module": relation.target_module_id,
        "label": relation.label,
    }


def _send_webhook(event, instance, requested, current, actor, origin, deleted=False):
    """Enqueue webhook activity for ``instance`` (Phase or ModuleRelation) once the transaction commits."""
    from plane.bgtasks.webhook_task import model_activity, webhook_activity  # avoid an import cycle

    slug = instance.workspace.slug
    actor_id = str(actor.id) if actor else None
    instance_id = str(instance.id)

    def send():
        if deleted:
            webhook_activity.delay(
                event=event,
                verb="deleted",
                field=None,
                old_value=None,
                new_value=None,
                actor_id=actor_id,
                slug=slug,
                current_site=origin,
                event_id=instance_id,
                old_identifier=None,
                new_identifier=None,
            )
            return
        model_activity.delay(
            model_name=event,
            model_id=instance_id,
            requested_data=json.loads(_dump(requested)),
            current_instance=_dump(current) if current is not None else None,
            actor_id=actor_id,
            slug=slug,
            origin=origin,
        )

    transaction.on_commit(send)


def _send_phase_moves(project_id, actor, moves):
    """Enqueue the per-work-item ``phase`` activity rows for keyword moves once the transaction commits.

    One task per ``MOVES_PER_TASK`` moves. ``epoch`` (the task's idempotency key with actor and phases)
    is a float timestamp with microseconds taken while the caller holds the PhaseModule/Phase row locks,
    so batches touching the same keyword are serialized and never share it (an int-seconds epoch let
    A->B, B->A, A->B within one second drop the third batch's rows).
    """
    if not moves:
        return
    from plane.bgtasks.phase_activity import chunk_moves, phase_module_activity

    epoch = timezone.now().timestamp()
    payloads = [
        {
            "project_id": str(project_id),
            "actor_id": str(actor.id) if actor else None,
            "moves": chunk,
            "epoch": epoch,
        }
        for chunk in chunk_moves(moves)
    ]

    def send():
        for payload in payloads:
            phase_module_activity.delay(**payload)

    transaction.on_commit(send)


def _move(module_id, old_phase, new_phase):
    return {
        "module_id": str(module_id),
        "old_phase_id": str(old_phase.id) if old_phase else None,
        "old_phase_name": old_phase.name if old_phase else None,
        "new_phase_id": str(new_phase.id) if new_phase else None,
        "new_phase_name": new_phase.name if new_phase else None,
    }


def _save_new(instance, actor):
    instance.created_by = actor
    instance.updated_by = None
    instance.save(disable_auto_set_user=True)


def _save_changed(instance, actor, fields):
    instance.updated_by = actor
    instance.save(update_fields=[*fields, "updated_by", "updated_at"], disable_auto_set_user=True)


# --------------------------------------------------------------------------- phases


def _check_phase_name(project_id, name, exclude_id=None):
    queryset = Phase.objects.filter(project_id=project_id, name=name)
    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)
    if queryset.exists():
        raise _error("name", "A phase with this name already exists in the project.", PHASE_NAME_TAKEN)


def _next_phase_sequence(project_id):
    largest = Phase.objects.filter(project_id=project_id).aggregate(largest=Max("sequence"))["largest"]
    return (largest + SEQUENCE_STEP) if largest is not None else Phase._meta.get_field("sequence").default


def create_phase(project, data, actor, origin=None):
    """Create a phase. ``data``: name (required), description, sequence, start_date, target_date.

    Without ``sequence`` the phase goes last.
    """
    name = (data.get("name") or "").strip()
    if not name:
        raise _error("name", "A phase needs a name.", INVALID_PHASE)
    validate_phase_dates(data.get("start_date"), data.get("target_date"))
    with transaction.atomic():
        _check_phase_name(project.id, name)
        phase = Phase(
            project=project,
            name=name,
            description=data.get("description") or "",
            sequence=data["sequence"] if data.get("sequence") is not None else _next_phase_sequence(project.id),
            start_date=data.get("start_date"),
            target_date=data.get("target_date"),
        )
        try:
            with transaction.atomic():
                _save_new(phase, actor)
        except IntegrityError:
            raise _error("name", "A phase with this name already exists in the project.", PHASE_NAME_TAKEN)
        _send_webhook("phase", phase, _phase_snapshot(phase), None, actor, origin)
    return phase


def update_phase(phase, data, actor, origin=None):
    """Change any of name, description, sequence, start_date, target_date (only keys present in ``data``)."""
    changes = {field: data[field] for field in PHASE_FIELDS if field in data}
    if "name" in changes:
        changes["name"] = (changes["name"] or "").strip()
        if not changes["name"]:
            raise _error("name", "A phase needs a name.", INVALID_PHASE)
    if "description" in changes and changes["description"] is None:
        changes["description"] = ""
    if "sequence" in changes and changes["sequence"] is None:
        changes.pop("sequence")
    validate_phase_dates(
        changes.get("start_date", phase.start_date),
        changes.get("target_date", phase.target_date),
    )
    if not changes:
        return phase
    with transaction.atomic():
        if "name" in changes and changes["name"] != phase.name:
            _check_phase_name(phase.project_id, changes["name"], exclude_id=phase.id)
        before = _phase_snapshot(phase)
        for field, value in changes.items():
            setattr(phase, field, value)
        try:
            with transaction.atomic():
                _save_changed(phase, actor, list(changes))
        except IntegrityError:
            raise _error("name", "A phase with this name already exists in the project.", PHASE_NAME_TAKEN)
        _send_webhook("phase", phase, changes, before, actor, origin)
    return phase


def delete_phase(phase, actor, origin=None):
    """Soft-delete a phase and its keyword assignments. Its keywords leave the phase (activity rows).

    Locks the phase row first (same order as ``assign_modules_to_phase``); ``Phase.DoesNotExist`` (404)
    when another request deleted it meanwhile.
    """
    with transaction.atomic():
        if Phase.objects.select_for_update().filter(pk=phase.pk).first() is None:
            raise Phase.DoesNotExist("Phase not found.")
        links = list(PhaseModule.objects.filter(phase=phase).select_for_update().values_list("module_id", flat=True))
        now = timezone.now()
        PhaseModule.objects.filter(phase=phase).update(deleted_at=now, updated_by=actor, updated_at=now)
        phase.updated_by = actor
        phase.deleted_at = now
        phase.save(update_fields=["deleted_at", "updated_by", "updated_at"], disable_auto_set_user=True)
        _send_webhook("phase", phase, None, None, actor, origin, deleted=True)
        _send_phase_moves(phase.project_id, actor, [_move(module_id, phase, None) for module_id in links])
    return links


# --------------------------------------------------------------------------- keywords in phases


def _project_modules(project_id, module_ids, field):
    """Live, non-archived modules of the project for ``module_ids``; 400 otherwise."""
    wanted = {str(pk) for pk in module_ids}
    modules = {str(m.id): m for m in Module.objects.filter(pk__in=wanted, project_id=project_id)}
    missing = wanted - set(modules)
    if missing:
        raise _error(field, "Keywords must belong to this project.", INVALID_KEYWORD)
    if any(m.archived_at is not None for m in modules.values()):
        raise _error(field, "Archived keywords cannot be used on the map.", KEYWORD_ARCHIVED)
    return modules


def assign_modules_to_phase(phase, module_ids, actor):
    """Put keywords into ``phase`` (appended in the given order). Keywords in another phase move here.

    Keywords already in ``phase`` are left as they are. Returns the phase's live PhaseModule rows.
    """
    ordered = list(dict.fromkeys(str(pk) for pk in module_ids))
    if not ordered:
        raise _error("module_ids", "Pick at least one keyword.", INVALID_KEYWORD)
    if len(ordered) > MAX_MODULES_PER_ASSIGN:
        raise _error("module_ids", f"At most {MAX_MODULES_PER_ASSIGN} keywords at once.", INVALID_KEYWORD)
    moves = []
    with transaction.atomic():
        # Lock the phase so concurrent assigns into it get distinct sequences, and so a concurrent
        # delete_phase cannot leave keywords linked to a deleted phase.
        if Phase.objects.select_for_update().filter(pk=phase.pk).first() is None:
            raise _error("phase", "This phase no longer exists.", INVALID_PHASE)
        _project_modules(phase.project_id, ordered, "module_ids")
        current = {
            str(link.module_id): link
            for link in PhaseModule.objects.filter(module_id__in=ordered).select_related("phase").select_for_update()
        }
        largest = PhaseModule.objects.filter(phase=phase).aggregate(largest=Max("sequence"))["largest"]
        sequence = largest if largest is not None else 0.0
        moved_out = []
        new_links = []
        for module_id in ordered:
            link = current.get(module_id)
            if link is not None and link.phase_id == phase.id:
                continue
            if link is not None:
                moved_out.append(link.pk)
            sequence += SEQUENCE_STEP
            new_links.append(
                PhaseModule(
                    project_id=phase.project_id,
                    workspace_id=phase.workspace_id,
                    phase=phase,
                    module_id=module_id,
                    sequence=sequence,
                    created_by=actor,
                    updated_by=None,
                )
            )
            moves.append(_move(module_id, link.phase if link is not None else None, phase))
        now = timezone.now()
        try:
            with transaction.atomic():
                if moved_out:
                    PhaseModule.objects.filter(pk__in=moved_out).update(
                        deleted_at=now, updated_by=actor, updated_at=now
                    )
                PhaseModule.objects.bulk_create(new_links)
        except IntegrityError:
            raise _error(
                "module_ids", "Another change to these keywords happened first. Try again.", KEYWORD_MAP_CONFLICT
            )
        _send_phase_moves(phase.project_id, actor, moves)
    return list(PhaseModule.objects.filter(phase=phase).order_by("sequence", "created_at"))


def remove_module_from_phase(phase, module_id, actor):
    """Take a keyword out of ``phase``. 400 ``KEYWORD_NOT_IN_PHASE`` when it is not in it."""
    with transaction.atomic():
        link = PhaseModule.objects.select_for_update().filter(phase=phase, module_id=module_id).first()
        if link is None:
            raise _error("module_id", "This keyword is not in the phase.", KEYWORD_NOT_IN_PHASE)
        now = timezone.now()
        PhaseModule.objects.filter(pk=link.pk).update(deleted_at=now, updated_by=actor, updated_at=now)
        _send_phase_moves(phase.project_id, actor, [_move(module_id, phase, None)])


# --------------------------------------------------------------------------- relations


def _check_relation(project_id, source_id, target_id, exclude_id=None):
    if str(source_id) == str(target_id):
        raise _error("target_module", "A keyword cannot be linked to itself.", SELF_RELATION)
    _project_modules(project_id, [source_id, target_id], "target_module")
    duplicates = ModuleRelation.objects.filter(source_module_id=source_id, target_module_id=target_id)
    if exclude_id:
        duplicates = duplicates.exclude(pk=exclude_id)
    if duplicates.exists():
        raise _error("target_module", "These keywords are already linked in this direction.", DUPLICATE_RELATION)


def create_module_relation(project, source_module_id, target_module_id, actor, label="", origin=None):
    """Directed edge ``source -> target`` with an optional label."""
    with transaction.atomic():
        _check_relation(project.id, source_module_id, target_module_id)
        relation = ModuleRelation(
            project=project,
            source_module_id=source_module_id,
            target_module_id=target_module_id,
            label=(label or "").strip(),
        )
        try:
            with transaction.atomic():
                _save_new(relation, actor)
        except IntegrityError:
            raise _error("target_module", "These keywords are already linked in this direction.", DUPLICATE_RELATION)
        _send_webhook("module_relation", relation, _relation_snapshot(relation), None, actor, origin)
    return relation


def update_module_relation(relation, data, actor, origin=None):
    """Change ``label`` and/or the ends (``source_module_id`` / ``target_module_id``)."""
    changes = {field: data[field] for field in RELATION_FIELDS if field in data}
    if "label" in changes:
        changes["label"] = (changes["label"] or "").strip()
    if not changes:
        return relation
    with transaction.atomic():
        source_id = changes.get("source_module_id", relation.source_module_id)
        target_id = changes.get("target_module_id", relation.target_module_id)
        if "source_module_id" in changes or "target_module_id" in changes:
            _check_relation(relation.project_id, source_id, target_id, exclude_id=relation.id)
        before = _relation_snapshot(relation)
        for field, value in changes.items():
            setattr(relation, field, value)
        try:
            with transaction.atomic():
                _save_changed(relation, actor, [f.removesuffix("_id") for f in changes])
        except IntegrityError:
            raise _error("target_module", "These keywords are already linked in this direction.", DUPLICATE_RELATION)
        _send_webhook("module_relation", relation, _relation_snapshot(relation), before, actor, origin)
    return relation


def delete_module_relation(relation, actor, origin=None):
    """Soft-delete an edge."""
    with transaction.atomic():
        now = timezone.now()
        relation.updated_by = actor
        relation.deleted_at = now
        relation.save(update_fields=["deleted_at", "updated_by", "updated_at"], disable_auto_set_user=True)
        _send_webhook("module_relation", relation, None, None, actor, origin, deleted=True)
