# Implementation Plan: Chrome/Edge Browser Extension

**Branch**: `006-browser-extension` | **Date**: 2026-01-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-browser-extension/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a Manifest V3 browser extension for Chrome and Edge that enables users to quickly save the current tab or batch-save multiple tabs to their Recall inbox. The extension provides a **popup UI** for save actions and tab selection, plus a **side panel** that embeds the Recall web app for browsing saved content. Authentication uses **chrome.identity.launchWebAuthFlow** with PKCE to obtain Entra External ID tokens, which are shared with the side panel web app via postMessage for single sign-on.

## Technical Context

**Language/Version**: TypeScript ES2022  
**Primary Dependencies**: React 19, Vite 6, chrome.* APIs (sidePanel, identity, tabs, storage)  
**Build Tooling**: Vite with CRXJS plugin for MV3 HMR development  
**Storage**: chrome.storage.local for settings and token cache; chrome.storage.session for ephemeral state  
**Testing**: Vitest for unit tests; manual testing for extension-specific APIs (no official automation support)  
**Target Platform**: Chrome 114+ and Microsoft Edge 114+ (Chromium-based, MV3 sidePanel support)  
**Project Type**: Browser extension (standalone project at `src/extension/`)  
**Performance Goals**: Save current tab < 3s e2e; side panel open < 2s; batch save 10 tabs < 15s  
**Constraints**: MV3 compliance (no background pages, service worker only); minimal permissions (activeTab, sidePanel, storage, identity); no page content capture  
**Scale/Scope**: Personal use extension (~1 user per installation); Chrome Web Store submission ready

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check (Phase 0)

| Gate | Status | Notes |
|------|--------|-------|
| Feature aligns with Product Focus (minimal scope)? | ✅ PASS | Extension enables fast URL saving and browsing saved items—core mission |
| Privacy requirements addressed (sanitization, no tracking)? | ✅ PASS | Only URL/title captured; no page content; no analytics; user-owned data |
| Architecture follows domain/app/infra layers? | ✅ PASS | Extension has services (auth, api), components (popup, sidepanel), config |
| Testing strategy defined for each layer? | ✅ PASS | Vitest for services; manual E2E for extension APIs |
| Performance budget established (<200ms save, pagination)? | ✅ PASS | <3s save with feedback; API latency governed by existing backend |
| Reliability patterns included (timeouts, retries)? | ✅ PASS | Token refresh, API error handling, graceful degradation |
| Accessibility requirements specified? | ✅ PASS | Popup uses semantic HTML; side panel inherits web app accessibility |
| Observability hooks planned (logs, correlation IDs)? | ⚪ N/A | Client-side extension; no server-side logging applicable |

### Post-Design Check (Phase 1)

| Gate | Status | Notes |
|------|--------|-------|
| Data model follows established patterns? | ✅ PASS | Reuses existing Item entity via API; no new entities |
| API contracts consistent with existing endpoints? | ✅ PASS | Uses existing POST /api/v1/items endpoint |
| Token handling follows security best practices? | ✅ PASS | PKCE flow, no client secret, secure storage |
| Permission minimization validated? | ✅ PASS | activeTab for single save; tabs only for batch selection |
| No sensitive data in logs/errors? | ✅ PASS | Tokens stored in chrome.storage, not logged |
| Cross-browser compatibility verified? | ✅ PASS | Chrome and Edge both support sidePanel API |

**Constitution Check Result**: PASS - All applicable gates satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/006-browser-extension/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/extension/                          # NEW: Browser extension project
├── manifest.json                       # MV3 manifest (permissions, service_worker, side_panel)
├── package.json                        # Extension-specific dependencies
├── tsconfig.json                       # TypeScript config
├── vite.config.ts                      # Vite + CRXJS build configuration
├── .env.development                    # Dev environment (localhost URLs)
├── .env.production                     # Production environment (deployed URLs)
│
├── src/
│   ├── background/
│   │   └── service-worker.ts           # MV3 service worker (message handling, API calls)
│   │
│   ├── popup/
│   │   ├── index.html                  # Popup entry point
│   │   ├── main.tsx                    # React mount
│   │   ├── Popup.tsx                   # Main popup component
│   │   └── components/
│   │       ├── SaveCurrentTab.tsx      # Single tab save UI
│   │       ├── SaveSelectedTabs.tsx    # Batch tab selection UI
│   │       ├── TabList.tsx             # Tab checkbox list
│   │       ├── SaveProgress.tsx        # Progress indicator
│   │       └── AuthStatus.tsx          # Sign-in state display
│   │
│   ├── sidepanel/
│   │   ├── index.html                  # Side panel entry point
│   │   ├── main.tsx                    # React mount + token receiver
│   │   └── SidePanel.tsx               # Embeds web app or shows auth state
│   │
│   ├── services/
│   │   ├── auth.ts                     # Token acquisition via launchWebAuthFlow
│   │   ├── api.ts                      # API client (fetch + Bearer token)
│   │   ├── messaging.ts                # chrome.runtime message helpers
│   │   └── storage.ts                  # chrome.storage wrappers
│   │
│   ├── config/
│   │   └── index.ts                    # Environment-aware config (URLs, clientId, scope)
│   │
│   ├── types/
│   │   └── index.ts                    # Shared TypeScript types
│   │
│   └── assets/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
│
└── tests/
    ├── services/
    │   ├── auth.test.ts
    │   ├── api.test.ts
    │   └── storage.test.ts
    └── setup.ts                        # Vitest setup with chrome API mocks

docs/
└── extension/
    ├── setup.md                        # Extension development setup
    ├── entra-configuration.md          # Entra app registration for extension
    └── testing-checklist.md            # Manual testing checklist
```

**Structure Decision**: Standalone extension project at `src/extension/` with React + Vite build. Shares no code with web app (different build targets) but uses same API endpoints. Service worker handles all API communication; popup and side panel are React SPAs.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New project (src/extension/) | Browser extensions require separate manifest, build, and packaging | Cannot be part of web app build due to different entry points and APIs |
| React in extension | Popup and side panel need interactive UIs with state management | Vanilla JS would require reimplementing component patterns; React matches web app tech |
