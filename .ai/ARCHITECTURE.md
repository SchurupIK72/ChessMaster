# Architecture Notes

## Chess Timer

### Shared contract
- `shared/schema.ts` defines `timeControlSeconds` on `games` and `ClockState` snapshots for both `games.clockState` and `moves.clockState`.
- The shared clock payload is the single source of truth for remaining time, active color, pause state, and the last server timestamp used for countdown projection.

### Server clock engine
- `server/routes.ts` owns authoritative clock transitions.
- Clock state is normalized on read, synchronized before mutating routes, and paused whenever a game reaches a terminal status such as `draw`, `resigned`, `completed`, or `timeout`.
- Standard matches hand off the active timer after every accepted move.
- `Void` matches use one timer per side for both boards and switch only when the full turn is finalized, including `void-transfer`, auto-finalize, and `Double Knight` continuation paths.
- `server/storage.ts` persists the latest normalized snapshot and restores prior snapshots during undo.

### Client projection
- `client/src/lib/clock.ts` projects the latest server snapshot into a live countdown without becoming authoritative.
- `client/src/components/game-clock.tsx` is the visual wrapper for side-specific clocks.
- `client/src/pages/chess-game.tsx` polls local time on a short interval only while a live server clock is active, displays both sides, and triggers a query resync when the local projection reaches zero.

### Match creation flow
- `client/src/components/time-control-modal.tsx` inserts a dedicated time-control selection step after rule selection and before match creation.
- The selected preset is sent through the existing create-game flow and then rendered in the live match status UI.

### Recovery and consistency
- Refresh and reconnect rebuild the countdown from the latest server snapshot instead of trusting prior client state.
- Undo restores the latest persisted clock snapshot from move history, which keeps time state aligned with board state rebuilds.
