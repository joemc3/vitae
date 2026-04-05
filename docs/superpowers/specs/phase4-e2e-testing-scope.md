# Phase 4: End-to-End Testing — Scope Notes

## Status: Planned (not started)

E2E testing was explicitly deferred from Phase 3e to keep that phase focused on features and deployment readiness.

## Planned Scope

- **Full pipeline tests**: upload document → parse → synthesize profile → generate site → verify static output
- **Cross-service integration**: API + worker + generator + Nginx serving
- **Resume pipeline**: generate resume → verify PDF → verify public URL
- **Preview pipeline**: request preview → verify SSR renders correctly
- **Automated Docker Compose smoke tests**: bring up all services, run health checks, exercise critical paths
- **Photo upload flow**: upload → verify resize → generate site → verify photo in output

## Technical Notes

- Consider `testcontainers` for full Docker Compose test orchestration
- Browser-based tests (Playwright/Cypress) for verifying generated site rendering
- API integration tests already exist in `src-api/tests/integration/` — E2E extends these to cross-service flows
