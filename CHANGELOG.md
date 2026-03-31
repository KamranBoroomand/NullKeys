# Changelog

All notable changes to NullKeys will be documented in this file.

## [Unreleased]

### Repository And Documentation Polish

- Reworked the public README to clarify the product pitch, local setup, validation flow, deployment path, current limitations, and release status
- Added GitHub health files for issues, pull requests, dependency updates, ownership, and coding-agent guidance
- Removed tracked machine-specific repo junk and tightened ignore guidance for local runtime artifacts

## [0.1.0] - 2026-03-23

### Release Summary

NullKeys `v0.1.0` is the first public source release of a local-first multilingual typing trainer. The app combines adaptive lessons, standalone typing tests, layout-aware keyboard analysis, and on-device progress history without requiring accounts, remote sync, or hosted storage.

### Major Strengths

- Adaptive practice that reacts to weak characters, recent sessions, and progression state instead of serving a static drill sequence
- Standalone typing test and benchmark flows with replayable local session records and richer review surfaces
- Keyboard layout exploration with language-aware analysis, row and hand metrics, and comparison tools
- Onboarding, help, methodology, privacy, settings, and profile/history views that make the product feel complete as a real local utility

### Local-First And Privacy Positioning

- All core progress data stays on-device through browser storage
- No account system, telemetry pipeline, or required backend is needed to use the product
- Local archive export and import provide a manual portability path without changing the local-first architecture
- This release is source-first and intentionally keeps `"private": true` in `package.json` to avoid accidental npm publication

### Multilingual And Persian/RTL Readiness

- Multilingual content packs are a core capability rather than an add-on
- Persian and other RTL or complex-script flows are treated as first-class release targets
- Joined-script-aware rendering, local content coverage, and composition-aware input handling are all included in the public release
- Layout-aware analysis and script-sensitive prompt generation are already wired into the main training flow

### Release Hardening

- Public product naming was finalized as NullKeys before the first public GitHub release
- Build, dev, start, metadata, and content-pack guardrails were tightened for cleaner release behavior
- Production safety was improved around devtools exposure, startup validation, malformed local archives, content-pack validation, and security headers
- Domain-aware metadata was prepared for `https://nullkeys.kamranboroomand.ir`, along with minimal Cloudflare Workers deployment support

### Known Limitations

- NullKeys is still pre-1.0 and should be treated as an early public release rather than a stable long-term contract
- There is no account system, cloud sync, hosted backup, or cross-device merge flow
- Multiplayer remains intentionally offline and explanatory only
- Archive import replaces local browser data instead of merging it
- IME-heavy languages are supported, but exact composition and candidate-window behavior still depends on browser and operating-system quirks

### What Comes Next

- Deeper content coverage and language-specific quality passes
- Continued refinement of adaptive practice, layout analysis, and long-session review
- Better archive ergonomics and long-term local data workflows without compromising the no-account baseline
- Further deployment and publication polish as the public repository and hosted app mature
