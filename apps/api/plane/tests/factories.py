# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import factory
from uuid import uuid4
from django.utils import timezone

from plane.db.models import (
    Issue,
    Module,
    Page,
    Phase,
    Project,
    ProjectMember,
    ProjectPage,
    State,
    User,
    Workspace,
    WorkspaceMember,
)


class UserFactory(factory.django.DjangoModelFactory):
    """Factory for creating User instances"""

    class Meta:
        model = User
        django_get_or_create = ("email",)

    id = factory.LazyFunction(uuid4)
    email = factory.Sequence(lambda n: f"user{n}@plane.so")
    username = factory.LazyFunction(lambda: uuid4().hex)  # unique; the conftest user has ""
    password = factory.PostGenerationMethodCall("set_password", "password")
    first_name = factory.Sequence(lambda n: f"First{n}")
    last_name = factory.Sequence(lambda n: f"Last{n}")
    is_active = True
    is_superuser = False
    is_staff = False


class WorkspaceFactory(factory.django.DjangoModelFactory):
    """Factory for creating Workspace instances"""

    class Meta:
        model = Workspace
        django_get_or_create = ("slug",)

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Workspace {n}")
    slug = factory.Sequence(lambda n: f"workspace-{n}")
    owner = factory.SubFactory(UserFactory)
    created_at = factory.LazyFunction(timezone.now)
    updated_at = factory.LazyFunction(timezone.now)


class WorkspaceMemberFactory(factory.django.DjangoModelFactory):
    """Factory for creating WorkspaceMember instances"""

    class Meta:
        model = WorkspaceMember

    id = factory.LazyFunction(uuid4)
    workspace = factory.SubFactory(WorkspaceFactory)
    member = factory.SubFactory(UserFactory)
    role = 20  # Admin role by default
    created_at = factory.LazyFunction(timezone.now)
    updated_at = factory.LazyFunction(timezone.now)


class ProjectFactory(factory.django.DjangoModelFactory):
    """Factory for creating Project instances"""

    class Meta:
        model = Project
        django_get_or_create = ("name", "workspace")

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Project {n}")
    workspace = factory.SubFactory(WorkspaceFactory)
    created_by = factory.SelfAttribute("workspace.owner")
    updated_by = factory.SelfAttribute("workspace.owner")
    created_at = factory.LazyFunction(timezone.now)
    updated_at = factory.LazyFunction(timezone.now)


class ProjectMemberFactory(factory.django.DjangoModelFactory):
    """Factory for creating ProjectMember instances"""

    class Meta:
        model = ProjectMember

    id = factory.LazyFunction(uuid4)
    project = factory.SubFactory(ProjectFactory)
    member = factory.SubFactory(UserFactory)
    role = 20  # Admin role by default
    created_at = factory.LazyFunction(timezone.now)
    updated_at = factory.LazyFunction(timezone.now)


# Neuric
class PageFactory(factory.django.DjangoModelFactory):
    """Factory for creating Page instances (public, not archived by default)"""

    class Meta:
        model = Page

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Page {n}")
    workspace = factory.SubFactory(WorkspaceFactory)
    owned_by = factory.SelfAttribute("workspace.owner")
    access = Page.PUBLIC_ACCESS


def link_page_to_project(page, project):
    """Create the ProjectPage row linking ``page`` to ``project``."""
    return ProjectPage.objects.create(project=project, page=page, workspace_id=project.workspace_id)


# Neuric
class StateFactory(factory.django.DjangoModelFactory):
    """Factory for creating State instances (``unstarted`` group by default)"""

    class Meta:
        model = State

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"State {n}")
    color = "#000000"
    group = "unstarted"
    project = factory.SubFactory(ProjectFactory)
    workspace = factory.SelfAttribute("project.workspace")


# Neuric
class IssueFactory(factory.django.DjangoModelFactory):
    """Factory for creating Issue instances. Pass ``state`` to pin the state."""

    class Meta:
        model = Issue

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Issue {n}")
    project = factory.SubFactory(ProjectFactory)
    workspace = factory.SelfAttribute("project.workspace")


# Neuric: time tracking
class IssueWorkLogFactory(factory.django.DjangoModelFactory):
    """Factory for IssueWorkLog. Pass ``issue`` (project/workspace follow it) and ``user``."""

    class Meta:
        model = "db.IssueWorkLog"

    id = factory.LazyFunction(uuid4)
    issue = factory.SubFactory(IssueFactory)
    project = factory.SelfAttribute("issue.project")
    workspace = factory.SelfAttribute("issue.workspace")
    user = factory.SubFactory(UserFactory)
    started_at = factory.LazyFunction(timezone.now)
    duration_minutes = 60
    note = ""


# Neuric: keyword map (Step 2)
class ModuleFactory(factory.django.DjangoModelFactory):
    """Factory for Module (a "keyword"). Pass ``project``."""

    class Meta:
        model = Module

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Keyword {n}")
    project = factory.SubFactory(ProjectFactory)
    workspace = factory.SelfAttribute("project.workspace")


# Neuric: keyword map (Step 2)
class PhaseFactory(factory.django.DjangoModelFactory):
    """Factory for Phase. Pass ``project``."""

    class Meta:
        model = Phase

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Phase {n}")
    project = factory.SubFactory(ProjectFactory)
    workspace = factory.SelfAttribute("project.workspace")
