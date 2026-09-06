# Camp CodeGen – Frontend

A Next.js app for AI-assisted smart contract generation, compile/fix, and deploy to Basecamp.

## Quickstart

- Install deps:
  - `npm ci`
- Dev:
  - `npm run dev`
- Build/Start:
  - `npm run build && npm start`

## Routes

- Console: `http://localhost:3000/smart-contract`
  - `app/smart-contract/page.tsx` re-exports `app/pipeline/page.tsx`.
  - A redirect from `/pipeline` to `/smart-contract` is configured in `next.config.js`.

## Environment

Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE` if you need to point to a non-default backend.

- If `NEXT_PUBLIC_API_BASE` is not set, the app uses the production backend:
  - `https://acadcodegen-production.up.railway.app`
- Example local dev against a local backend:
  - `NEXT_PUBLIC_API_BASE=http://localhost:3000`

## API Client

All network calls are centralized in `lib/api.ts`.

- Pipeline: `Api.runPipeline()`
- Job Status: `Api.getJobStatus()` / `Api.getJobLogs()`
- Artifacts: `Api.getArtifactsSources()` / `Api.getArtifactsAbis()` / `Api.getArtifactsScripts()`
- ERC20 Deploy: `Api.deployErc20()`

The Pipeline page (`app/pipeline/page.tsx`) has been refactored to use this client for a single source of truth on URL resolution and error handling.

## Demo (Mock) API routes

Files under `app/api/...` that end with `generate-contract`, `deploy-contract`, and `job/[jobId]/*` are demo-only mocks for UI illustration. They do not contact the production backend and return simplified shapes.

- Each mock has a banner comment noting its purpose and that it is not used by the main pipeline UI.

## Max Iterations control

On the pipeline console, you can choose the max AI fix iterations under the Network selector. Available values: `11`, `15`, `21`.

## Docs

- Full API reference: `docs/AI_Deployment_API.md`
- UI/UX Guide: `docs/AI_Deploy_UI_UX_Guide.md`

## Notes

- By default, `/pipeline` redirects to `/smart-contract`. If you want to change the canonical route, update `next.config.js` accordingly.
