# app/permissions — role checks

## Key files
- `base.py` — ROLE enum (admin, member, guest)
- `project.py` — ProjectBasePermission, ProjectMemberPermission, ProjectEntityPermission, ProjectAdminPermission, ProjectLitePermission
- `workspace.py` — workspace-level permissions; `page.py` — page access

## Rules
- Every new view sets `permission_classes`. Default for project data: ProjectEntityPermission.
- Our mapping: Admin (Mayank) = project admin; employees = members. Both may create tasks.

## Our changes (Neuric)
- None yet.
