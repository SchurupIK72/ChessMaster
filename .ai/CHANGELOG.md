## [Unreleased]

### Added - Chess Timer
- [shared/schema.ts](../shared/schema.ts): Added persisted time-control and `clockState` contract for games and move snapshots
  - Stores `timeControlSeconds` on each game with a default rapid preset
  - Persists `ClockState` snapshots in move history for undo-safe clock rebuilds
- [server/startup-migrations.ts](../server/startup-migrations.ts): Backfills timer columns for existing environments
  - Adds startup-safe schema alignment for `time_control_seconds` and `clock_state`
- [client/src/components/time-control-modal.tsx](../client/src/components/time-control-modal.tsx): Introduced a dedicated pre-game time control selection step
  - Exposes preset bullet, blitz, and rapid-style durations before match creation
- [client/src/components/game-clock.tsx](../client/src/components/game-clock.tsx): Added reusable player clock UI
  - Highlights the active side and low-time state for players and spectators
- [client/src/lib/clock.ts](../client/src/lib/clock.ts): Added client helpers for live countdown rendering
  - Formats remaining time and projects server snapshots across refresh and reconnect

### Changed - Match Lifecycle
- [server/routes.ts](../server/routes.ts): Made match clocks server-authoritative across start, move, draw, undo, and timeout flows
  - Starts clocks when the second player joins
  - Switches active side only after accepted moves and terminalizes matches on timeout
  - Keeps `Void` on a single shared timer per side until the full turn is finalized
- [server/storage.ts](../server/storage.ts): Persists normalized timer state during game creation, join, and restore flows
  - Restores clock snapshots during undo and keeps join/start transitions deterministic
- [client/src/pages/chess-game.tsx](../client/src/pages/chess-game.tsx): Rendered live countdowns in the main match view
  - Resyncs when a local countdown reaches zero so the server can publish timeout
  - Shows the selected time control and the shared-clock note for `Void`
- [client/src/components/game-status.tsx](../client/src/components/game-status.tsx): Displays the configured time control in the match status panel
- [client/src/components/game-over-modal.tsx](../client/src/components/game-over-modal.tsx): Handles timeout as a first-class game result

### Added - Test Coverage
- [tests/test_chess_timer.py](../tests/test_chess_timer.py): Added timer-focused regression coverage
  - Verifies live countdown helpers, timeout wiring, and `Void`/undo clock snapshot behavior

### Fixed - Security & Session Hardening
- [shared/schema.ts](../shared/schema.ts): Split public API request schemas from DB insert schemas
  - Keeps auth, create game, join, draw, resign, and move payloads server-facing without trusting DB models as public contracts
- [server/routes.ts](../server/routes.ts): Hardened session ownership, move normalization, explicit terminal flows, and host clock sync on join
  - Restricts mutating actions to game participants resolved from `session.userId`
  - Normalizes server-owned move fields and removes dangerous direct state mutations
  - Broadcasts `status` when the second player joins so the host clock starts without a manual refresh
- [server/storage.ts](../server/storage.ts): Starts persisted clock state deterministically when the second seat is filled
- [client/src/App.tsx](../client/src/App.tsx): Clears client auth state from React Query and local storage only after server logout
- [client/src/pages/auth.tsx](../client/src/pages/auth.tsx): Uses hardened auth contracts and clearer duplicate-field handling
- [client/src/pages/chess-game.tsx](../client/src/pages/chess-game.tsx): Stops client-owned terminal transitions and relies on server-authoritative logout flow
- [server/index.ts](../server/index.ts): Final route error handler now logs and returns safely without rethrowing into the Node process
- [tests/test_match_links_and_spectators.py](../tests/test_match_links_and_spectators.py): Covers route guards and participant-only mutating access
- [tests/test_chess_timer.py](../tests/test_chess_timer.py): Adds host-clock join regression coverage
  - Verifies the host receives a status refresh when the opponent connects and clocks start live
