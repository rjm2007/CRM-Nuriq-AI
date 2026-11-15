# decorators (`@plane/decorators`)

## Purpose

TypeScript decorators for declaring Express REST and WebSocket controllers. Used by the Node collab server `apps/live`. Index: `../CLAUDE.md`.

## Key files

- `src/controller.ts` — `registerController(router, Controller)` and the `HttpMethod` / `ControllerConstructor` types
- `src/rest.ts` — `@Controller(baseRoute)`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Middleware(handler)`
- `src/websocket.ts` — `@WebSocket(route)` (works with `express-ws`)
- `src/index.ts` — barrel
- `README.md` — usage examples

## Rules for this folder

- Uses legacy decorators + `reflect-metadata`: consumers need `experimentalDecorators` and `emitDecoratorMetadata` in their tsconfig.
- Server-only. Never import from browser apps or `blocks`.
- Keep it generic (no Plane business logic).

## Depends on / used by

- Uses: Express/ws types, `reflect-metadata` (dev/inlined).
- Used by: `apps/live`.

## How to test

No unit tests in this package. `pnpm turbo run check --filter=@plane/decorators`

## Our changes (Neuric)

None yet (2026-11-15).
