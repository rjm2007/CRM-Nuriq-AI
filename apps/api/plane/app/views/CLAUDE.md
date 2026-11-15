# app/views — web-app viewsets

## Purpose

Request handlers by domain (issue, cycle, module, page, project, state, search, workspace, …).

## Rules

- Extend `BaseViewSet` / `BaseAPIView` from `base.py` (timezone, read-replica, pagination built in).
- Scope every queryset by `workspace__slug` and `project_id` from the URL. Never trust IDs from the body for scoping.
- Use `select_related` / `prefetch_related`; avoid N+1 queries.
- Keep views thin: validation in serializers, slow work in bgtasks.
- New domains (phases, worklogs, tests, ai) get their own subfolder with its own CLAUDE.md.

## Our changes (Neuric)

- 2026-11-15: `project/base.py` `list()` `.values(...)` also returns `target_date` and `prd_page`. Retrieve/list_detail use `__all__` serializers, so they include them automatically.
