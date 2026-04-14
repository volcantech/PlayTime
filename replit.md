# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Real-time**: WebSocket (ws library) at /ws
- **Database**: PostgreSQL + Drizzle ORM (cards + admins stored in DB; game state in memory)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Blanc Manger Coco (`/`)
A full online multiplayer card game based on Blanc Manger Coco rules:
- Real-time multiplayer via WebSocket
- Shareable room links (?room=CODE)
- Question Master mechanic
- 50 question cards + 110 answer cards (in French)
- Configurable win condition (5/10/15 points)

### API Server (`/api`, `/ws`)
- Express 5 backend
- WebSocket server at /ws for real-time game state
- In-memory room/game management (rooms expire after 6 hours)
- Game engine in `src/lib/gameEngine.ts`
- Card data in `src/lib/gameData.ts`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
