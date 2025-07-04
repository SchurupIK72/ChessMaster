import type { ChessGameState, ChessPiece, GameRulesArray } from '@shared/schema';
import { ChessUtils } from '@shared/chess-utils';

export class ChessLogic {
  getValidMoves(gameState: ChessGameState, fromSquare: string, gameRules?: string[]): string[] {
    const piece = gameState.board[fromSquare];
    if (!piece) return [];

    // Check if we're in the middle of a double knight move
    if (gameState.doubleKnightMove) {
      if (piece.type !== 'knight' || 
          gameState.doubleKnightMove.knightSquare !== fromSquare ||
          piece.color !== gameState.doubleKnightMove.color) {
        return [];
      }
    }

    const rules = gameRules as GameRulesArray || ['standard'];
    console.log(`UI: Found moves for ${piece.type} at ${fromSquare}`);
    return ChessUtils.getLegalMoves(gameState, fromSquare, rules);
  }

  hasLegalMoves(gameState: ChessGameState, color: 'white' | 'black', gameRules?: string[]): boolean {
    const rules = gameRules as GameRulesArray || ['standard'];
    return ChessUtils.hasLegalMoves(gameState, color, rules);
  }

  updateGameStatus(gameState: ChessGameState, gameRules?: string[]): ChessGameState {
    const rules = gameRules as GameRulesArray || ['standard'];
    return ChessUtils.updateGameStatus(gameState, rules);
  }
}