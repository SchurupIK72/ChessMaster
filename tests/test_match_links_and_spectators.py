import json
import re
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


def test_match_link_helpers_support_canonical_and_legacy_routes():
    result = run_ts_json(
        """
        import { extractInvitePath, normalizeShareId, parseDirectMatchRoute } from "./client/src/lib/match-links.ts";

        console.log(JSON.stringify({
          canonicalUrl: extractInvitePath("https://chessmasterx.onrender.com/matchAbC123xy"),
          canonicalPath: extractInvitePath("/matchZX90abcd"),
          legacyUrl: extractInvitePath("https://chessmasterx.onrender.com/join/ab12cd"),
          legacyCode: normalizeShareId("ab12cd"),
          invalidInvite: extractInvitePath("not-a-match"),
          directMatchRoute: parseDirectMatchRoute("/matchAbC123xy"),
          directLegacyRoute: parseDirectMatchRoute("/join/ab12cd"),
        }));
        """
    )

    assert result["canonicalUrl"] == "/matchAbC123xy"
    assert result["canonicalPath"] == "/matchZX90abcd"
    assert result["legacyUrl"] == "/join/AB12CD"
    assert result["legacyCode"] == "AB12CD"
    assert result["invalidInvite"] is None
    assert result["directMatchRoute"] == {"matchId": "AbC123xy", "legacyShareId": None}
    assert result["directLegacyRoute"] == {"matchId": None, "legacyShareId": "AB12CD"}


def test_match_access_helpers_resolve_roles_and_restrict_spectators():
    result = run_ts_json(
        """
        import { getGameRole, resolveViewerRole, isParticipantRole } from "./server/match-access.ts";

        const game = { whitePlayerId: 11, blackPlayerId: 22 };
        console.log(JSON.stringify({
          whiteRole: getGameRole(game, 11),
          blackRole: getGameRole(game, 22),
          outsiderRole: getGameRole(game, 99),
          guestViewerRole: resolveViewerRole(null, game),
          whiteViewerRole: resolveViewerRole(11, game),
          whiteCanMutate: isParticipantRole("white"),
          spectatorCanMutate: isParticipantRole("spectator"),
        }));
        """
    )

    assert result["whiteRole"] == "white"
    assert result["blackRole"] == "black"
    assert result["outsiderRole"] == "spectator"
    assert result["guestViewerRole"] == "spectator"
    assert result["whiteViewerRole"] == "white"
    assert result["whiteCanMutate"] is True
    assert result["spectatorCanMutate"] is False


def test_generate_unique_match_id_retries_after_collision():
    result = run_ts_json(
        """
        import { createMatchIdCandidate, generateUniqueMatchId } from "./server/match-access.ts";

        let attempts = 0;
        const values = ["DUPLICAT", "UNIQUE42"];
        const matchId = await generateUniqueMatchId(
          async (candidate) => candidate === "DUPLICAT" ? { id: 1 } : undefined,
          () => values[attempts++],
        );

        console.log(JSON.stringify({
          matchId,
          attempts,
          sampleCandidate: createMatchIdCandidate(0.123456789),
        }));
        """
    )

    assert result["matchId"] == "UNIQUE42"
    assert result["attempts"] == 2
    assert re.fullmatch(r"[A-Z0-9]{8}", result["sampleCandidate"])


def test_mutating_game_routes_keep_participant_guard():
    routes_text = (ROOT / "server" / "routes.ts").read_text(encoding="utf-8")
    guarded_routes = [
        'app.post("/api/games/:id/moves"',
        'app.post("/api/games/:id/undo"',
        'app.patch("/api/games/:id/status"',
        'app.patch("/api/games/:id/captured"',
        "app.post('/api/games/:id/offer-draw'",
        "app.post('/api/games/:id/accept-draw'",
        "app.post('/api/games/:id/decline-draw'",
    ]

    for route_marker in guarded_routes:
        start = routes_text.index(route_marker)
        window = routes_text[start : start + 500]
        assert "const context = await requireGameParticipant(req, res, gameId);" in window, route_marker

