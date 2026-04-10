# BurnDeck Implementation Status

Last updated: 2026-04-10

## Purpose

This file records the actual implementation state, the main decisions already locked in, what is still missing, and the remaining sequence to reach the current planned endpoint.

## What Is Ready

### Product and UI

- BurnDeck now runs only with the retained `/1` minimal to-do-list style.
- Accounts can be created, edited, and deleted from the UI.
- The account editor now exposes account type, refresh mode, optional plan/cap fields, and an optional per-account OpenAI project ID.
- The add-account flow is card-based and opens a modal instead of using a permanent form section.
- Account cards are simplified to the retained fields:
  - name
  - provider
  - tracking info
  - health indicator
- Each card has:
  - a pill-shaped edit control
  - a bottom refresh control
- Header actions for `Refresh all`, `Export`, `Import`, and `Reset` are in place.

### Data and Local Behavior

- Account data persists in browser `localStorage`.
- JSON export/import works for snapshot transfer.
- Stored account records are normalized on load.
- Accounts now carry sync metadata:
  - `lastSyncedAt`
  - `syncState`
  - `syncError`
  - adapter metadata

### Refresh Architecture

- A full refresh framework exists in the frontend.
- `Refresh all` is implemented.
- Per-account refresh is implemented.
- Manual accounts use a manual check-in adapter.
- OpenAI API accounts use a live adapter path that calls the backend.
- Live OpenAI API refresh can now be scoped per tracked account with an optional project ID instead of one global project setting only.

### Backend and Deployment Scaffold

- A minimal Node backend exists in-repo.
- The backend serves the built frontend and exposes:
  - `GET /api/health`
  - `POST /api/refresh/openai`
- Docker packaging is in place.
- A Docker Compose file is in place.
- BurnDeck is now deployed on the VPS.
- The container is running and serving health successfully on port `6409`.
- Nginx now fronts the app with HTTPS and basic auth on `burndeck.fmotion.fr`.

## Decisions That Have Been Made

- BurnDeck is a private, self-hosted personal tool, not a SaaS app.
- Clerk is out of scope for this project.
- The retained UI is the `/1` minimal style only. The glass look is no longer a target.
- Production hosting target is the VPS, not the always-on Mac Mini.
- Deployment pattern is:
  - Dockerized app
  - Nginx reverse proxy
  - explicit BurnDeck Nginx site enabled on the VPS
  - HTTPS handled at the Nginx layer for the BurnDeck hostname
  - Nginx basic auth protecting the app
- Provider secrets must stay server-side. Browser-side provider keys are not acceptable.
- OpenAI is the first real provider integration to support.
- The production app should use same-origin frontend/API routing behind Nginx.
- BurnDeck remains local-first for data ownership, with optional server-assisted refresh.

## What Still Needs Work

### OpenAI Integration Completion

- The backend route is live and the server confirms a real deployed OpenAI admin key is present.
- Error handling should be verified against real API failures, bad credentials, and empty usage windows.
- The UI should be checked against real OpenAI refresh payloads after deployment.

### Remaining Product Work

- Account ordering/grouping is still open.
- Representation for unsupported or manual-only subscriptions still needs to be finalized.
- Anthropic and Google AI integrations are still not implemented.

### Operational Completion

- BurnDeck is deployed on the VPS.
- The BurnDeck-specific VPS config note in `docs/VPS_DEPLOYMENT.md` has been updated with the verified live shape.
- One authenticated end-to-end OpenAI refresh from the UI still needs confirmation.

## Next Items Until The Current End State

### Immediate Next Steps

1. Verify one authenticated end-to-end OpenAI refresh from the UI.
2. Fix any live-integration gaps found during that first real refresh run.
3. Record the final Nginx site path, cert path, and auth file path if you want an even more literal runbook.

### Completion Steps For The Current Scope

4. Close the OpenAI integration item once real refresh is confirmed stable.
5. Decide whether account ordering/grouping belongs in the current milestone or the next one.

### After The Current Scope

6. Add Anthropic and Google AI provider integrations if they are still worth automating.
7. Improve unsupported/manual-only subscription handling once real provider coverage is clearer.
