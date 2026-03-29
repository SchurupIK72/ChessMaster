import type { Game } from "@shared/schema";

export type GameRole = "white" | "black" | "spectator";
type MatchRoleGame = Pick<Game, "whitePlayerId" | "blackPlayerId">;

export function getGameRole(game: MatchRoleGame, userId: number): GameRole {
  if (game.whitePlayerId === userId) return "white";
  if (game.blackPlayerId === userId) return "black";
  return "spectator";
}

export function resolveViewerRole(userId: number | null | undefined, game: MatchRoleGame): GameRole {
  if (!userId) return "spectator";
  return getGameRole(game, userId);
}

export function isParticipantRole(role: GameRole): role is "white" | "black" {
  return role === "white" || role === "black";
}

export function createMatchIdCandidate(randomValue: number = Math.random()): string {
  return randomValue.toString(36).substring(2, 10).toUpperCase();
}

export async function generateUniqueMatchId(
  getGameByMatchId: (matchId: string) => Promise<unknown>,
  nextCandidate: () => string = () => createMatchIdCandidate(),
): Promise<string> {
  while (true) {
    const matchId = nextCandidate();
    const existingGame = await getGameByMatchId(matchId);
    if (!existingGame) {
      return matchId;
    }
  }
}
