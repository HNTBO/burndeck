# BurnDeck Project Tracker

Last updated: 2026-04-10

## Purpose

BurnDeck is a private dashboard for keeping a bird's-eye view of AI subscriptions, API accounts, OAuth quotas, and burn across providers.

This file exists so project state does not depend on chat/session continuity.

See also: `docs/IMPLEMENTATION_STATUS.md` for the implementation snapshot, locked decisions, and remaining sequence.

## Current State

- Vite + React + TypeScript app is in place.
- Dashboard data persists locally in browser `localStorage`.
- JSON export/import works for account snapshots.
- Existing accounts can be edited manually.
- The account editor can now create real OpenAI API entries with live/manual refresh selection and optional per-account project scope.
- Account records now carry sync metadata and adapter metadata.
- A manual `Refresh all` flow exists with one reference adapter pattern.
- A VPS-ready backend path now exists for real OpenAI org refreshes.
- BurnDeck is now deployed on the VPS behind Nginx and basic auth.
- Internal health on the VPS is confirmed working with a real `OPENAI_ADMIN_KEY`.

## Product Direction

- BurnDeck must support manual management because subscription limits and provider behavior are a moving target.
- BurnDeck should also support automatic refresh from real providers because manual updates alone defeat the purpose of the tool.
- Real-time sync is not required initially.
- A global `Refresh all` flow is the preferred first automation step.

## Roadmap

### Phase 1: Local-first manual dashboard

- [x] Seed data model for tracked accounts
- [x] Read/edit accounts in the UI
- [x] Persist data locally
- [x] Export/import JSON snapshots
- [x] Create new accounts from the UI
- [x] Delete existing accounts from the UI
- [x] Edit provider/access/source fields from the UI
- [x] Support empty-state account list
- [ ] Allow account ordering/grouping that matches personal workflow

### Phase 2: Refresh architecture

- [x] Add `lastSyncedAt`, `syncState`, `syncError`, and adapter metadata to tracked accounts
- [x] Add a `Refresh all` action
- [x] Add optional per-account refresh
- [x] Define adapter interface for provider-specific refresh logic
- [x] Implement one adapter end-to-end as the reference pattern

### Phase 3: Provider integrations

- [ ] OpenAI account/subscription refresh
- [ ] Anthropic refresh
- [ ] Google AI refresh
- [ ] Decide how unsupported/manual-only subscriptions should be represented

## Technical Notes

- The app now has a minimal self-hosted Node backend scaffold in-repo for VPS deployment.
- Automatic refresh now follows the chosen backend path:
  - a small VPS-hosted backend stores provider credentials and performs refreshes
  - the browser never stores provider API keys
- Browser-only integrations may be possible for some providers, but credentials and session handling need careful design.

## Near-Term Decisions

- The retained UI is the `/1` minimal theme only.
- The deployment target is the VPS with Docker, Nginx, HTTPS at the hostname level, and Nginx basic auth.
- Automatic refresh starts with one manual `Refresh all` button rather than background polling.
- OpenAI is the first real provider integration to finish.

## Open Questions

- Which subscription/account types matter most on day one?
- Should ordering be simple manual move up/down, drag-and-drop, or grouped sections?
