import type { ChessGameState } from "@shared/schema";
import { ChessLogic } from "./chess-logic";

/**
 * Maps a rook click (with the king selected) to the castling destination square in Chess960.
 * Returns the king's destination square ("g1"/"c1" for white or "g8"/"c8" for black) or null
 * if the click doesn't correspond to a valid castling rook for the selected king/color.
 *
 * Contract:
 * - Inputs: gameState (with castlingRooks), kingSquare, rookSquare, rules array (may include 'fischer-random')
 * - Output: string like "g1" | "c1" | "g8" | "c8" or null
 * - Does NOT validate path/rights/check; caller should still verify legality (e.g., via validMoves.contains).
 */
export function getCastlingDestinationFromRookClick(
  gameState: ChessGameState,
  kingSquare: string,
  rookSquare: string,
  rules?: string[] | null
): string | null {
  const king = gameState.board[kingSquare];
  const rook = gameState.board[rookSquare];
  if (!king || king.type !== 'king') return null;
  if (!rook || rook.type !== 'rook') return null;
  if (king.color !== rook.color) return null;

  const color = king.color as 'white' | 'black';
  const backRank = color === 'white' ? '1' : '8';
  const isFischer = Array.isArray(rules) && rules.includes('fischer-random');

  // Chess960-aware mapping via castlingRooks if present
  const cr = (gameState as any).castlingRooks as ChessGameState['castlingRooks'] | undefined;
  if (isFischer && cr && cr[color]) {
    const kingSideRook = cr[color]!.kingSide;
    const queenSideRook = cr[color]!.queenSide;
    if (kingSideRook && rookSquare === kingSideRook) return `g${backRank}`;
    if (queenSideRook && rookSquare === queenSideRook) return `c${backRank}`;
    return null;
  }

  // Fallback to standard squares for non-960
  if (rookSquare === `h${backRank}`) return `g${backRank}`;
  if (rookSquare === `a${backRank}`) return `c${backRank}`;
  return null;
}

/**
 * Convenience helper: returns castling destination only if it’s already present in validMoves.
 * Useful to keep UI submission guard simple.
 */
export function getLegalCastlingDestinationFromRookClick(
  gameState: ChessGameState,
  kingSquare: string,
  rookSquare: string,
  rules: string[] | null | undefined,
  validMoves: string[]
): string | null {
  const dest = getCastlingDestinationFromRookClick(gameState, kingSquare, rookSquare, rules);
  if (!dest) return null;

  // Determine which side (king or queen) based on destination file
  const side: 'whiteKingside' | 'whiteQueenside' | 'blackKingside' | 'blackQueenside' | null = (() => {
    const king = gameState.board[kingSquare];
    if (!king || king.type !== 'king') return null;
    const color = king.color as 'white' | 'black';
    const isKingSide = dest[0] === 'g';
    if (color === 'white') return isKingSide ? 'whiteKingside' : 'whiteQueenside';
    return isKingSide ? 'blackKingside' : 'blackQueenside';
  })();

  // Require castling rights for that side; prevents triggering Blink to c/g when castling not allowed
  if (!side || !gameState.castlingRights || !gameState.castlingRights[side]) return null;

  // Do NOT require dest to be present in client-side king moves: in Chess960 the king's destination
  // may be initially occupied by its own rook (e.g., rook on g8). Server-side validation allows this
  // and will move the rook accordingly. We rely on castling rights and server legality checks.
  return dest;
}
