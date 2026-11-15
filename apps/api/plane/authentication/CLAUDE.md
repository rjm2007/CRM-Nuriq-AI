# authentication

## Purpose
Login/signup (email, magic link, password), sessions, OAuth providers (`provider/oauth`), separate flows for app and space (`views/app`, `views/space`).

## Rules
- Security-sensitive: changes need cloud-reviewer + tests.
- "Sign in with ChatGPT" for the AI agent is NOT user login. It is an AI provider connection (see docs/DATA_MODEL.md AIProviderConnection) and does not belong here.

## Our changes (Neuric)
- None yet.
