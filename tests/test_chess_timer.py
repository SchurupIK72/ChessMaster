import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_ts_json(source: str) -> dict:
    completed = subprocess.run(
        ["node", "--input-type=module", "--eval", source],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(completed.stdout.strip())


def test_clock_helpers_support_live_countdown_and_reconnect_rendering():
    result = run_ts_json(
        """
        import { getClockDisplayOrder, getLiveClockState, formatClockMs, formatTimeControl, isLowTime } from "./client/src/lib/clock.ts";

        const active = getLiveClockState(
          {
            whiteRemainingMs: 60000,
            blackRemainingMs: 45000,
            activeColor: "white",
            lastUpdatedAt: "2026-03-29T12:00:00.000Z",
            isPaused: false,
          },
          Date.parse("2026-03-29T12:00:15.000Z"),
        );

        const paused = getLiveClockState(
          {
            whiteRemainingMs: 120000,
            blackRemainingMs: 30000,
            activeColor: null,
            lastUpdatedAt: null,
            isPaused: true,
          },
          Date.parse("2026-03-29T12:00:15.000Z"),
        );

        console.log(JSON.stringify({
          active,
          paused,
          formattedActive: formatClockMs(active.whiteMs),
          lowTime: isLowTime(25000),
          timeControlMinutes: formatTimeControl(300),
          timeControlMixed: formatTimeControl(75),
          whitePerspective: getClockDisplayOrder("white"),
          blackPerspective: getClockDisplayOrder("black"),
          spectatorPerspective: getClockDisplayOrder(null),
        }));
        """
    )

    assert result["active"] == {
        "whiteMs": 45000,
        "blackMs": 45000,
        "activeColor": "white",
        "isPaused": False,
        "expiredColor": None,
    }
    assert result["paused"] == {
        "whiteMs": 120000,
        "blackMs": 30000,
        "activeColor": None,
        "isPaused": True,
        "expiredColor": None,
    }
    assert result["formattedActive"] == "00:45"
    assert result["lowTime"] is True
    assert result["timeControlMinutes"] == "5 min"
    assert result["timeControlMixed"] == "01:15"
    assert result["whitePerspective"] == {"top": "black", "bottom": "white"}
    assert result["blackPerspective"] == {"top": "white", "bottom": "black"}
    assert result["spectatorPerspective"] == {"top": "black", "bottom": "white"}


def test_client_timeout_modal_and_clock_rendering_are_wired_on_game_page():
    page_text = (ROOT / "client" / "src" / "pages" / "chess-game.tsx").read_text(encoding="utf-8")
    modal_text = (ROOT / "client" / "src" / "components" / "game-over-modal.tsx").read_text(encoding="utf-8")

    assert 'import GameClock from "@/components/game-clock";' in page_text
    assert 'getClockDisplayOrder' in page_text
    assert 'getLiveClockState' in page_text
    assert 'queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });' in page_text
    assert "if (game.status === 'timeout' && game.winner)" in page_text
    assert "result: 'timeout' as const" in page_text
    assert "shared across both Void boards" in page_text
    assert 'const clockDisplayOrder = getClockDisplayOrder(viewerColor);' in page_text
    assert 'clockDisplayState[clockDisplayOrder.top]' in page_text
    assert 'clockDisplayState[clockDisplayOrder.bottom]' in page_text
    assert '"checkmate" | "stalemate" | "draw" | "resignation" | "timeout"' in modal_text
    assert 'wins on time' in modal_text


def test_server_clock_flow_persists_void_snapshots_and_restores_undo_state():
    routes_text = (ROOT / "server" / "routes.ts").read_text(encoding="utf-8")
    storage_text = (ROOT / "server" / "storage.ts").read_text(encoding="utf-8")

    assert "const currentGame = await syncGameClockState(game);" in routes_text
    assert "const moveClockState = startClock(clockStateBeforeMove, nextActiveColor, new Date());" in routes_text
    assert "special: `void-transfer:${fromBoardId}->${toBoardId}`" in routes_text
    assert routes_text.count("clockState: moveClockState") >= 2
    assert "const restoredClockState =" in routes_text
    assert "await storage.updateGameClockState(gameId, restoredClockState);" in routes_text
    assert "updateData.clockState = createStartedClockState(game.clockState, 'white');" in storage_text
