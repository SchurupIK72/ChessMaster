import { ChessGameState, GameRules, GameRulesArray } from "@shared/schema";

export class ChessRules {
  static applySpecialRules(gameState: ChessGameState, rules: GameRulesArray, fromSquare: string, toSquare: string): ChessGameState {
    let newGameState = gameState;
    
    // Apply each rule sequentially
    for (const rule of rules) {
      if (rule === 'double-knight') {
        newGameState = this.applyDoubleKnightRule(newGameState, fromSquare, toSquare);
      }
      // xray-bishop rule doesn't need special handling in applySpecialRules
      // as it's handled in the move validation logic
    }
    
    return newGameState;
  }

  private static applyDoubleKnightRule(gameState: ChessGameState, fromSquare: string, toSquare: string): ChessGameState {
    const piece = gameState.board[fromSquare];
    const newGameState = { ...gameState };

    // If we're in the middle of a double knight move
    if (gameState.doubleKnightMove) {
      // This is the second move with the same knight
      if (fromSquare === gameState.doubleKnightMove.knightSquare && 
          piece?.type === 'knight' && 
          piece.color === gameState.doubleKnightMove.color) {
        // Complete the double move - clear the flag and switch turns
        newGameState.doubleKnightMove = null;
        newGameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
      }
    } else {
      // First move with a knight
      if (piece?.type === 'knight') {
        // Set up for required second move
        newGameState.doubleKnightMove = {
          knightSquare: toSquare,
          color: piece.color
        };
        // Don't switch turns yet - same player must move again with this knight
      } else {
        // Normal move with non-knight piece
        newGameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
      }
    }

    return newGameState;
  }



  static getInitialPosition(rules: GameRulesArray): { [square: string]: any } {
    // Standard chess starting position
    return {
      'a8': { type: 'rook', color: 'black' },
      'b8': { type: 'knight', color: 'black' },
      'c8': { type: 'bishop', color: 'black' },
      'd8': { type: 'queen', color: 'black' },
      'e8': { type: 'king', color: 'black' },
      'f8': { type: 'bishop', color: 'black' },
      'g8': { type: 'knight', color: 'black' },
      'h8': { type: 'rook', color: 'black' },
      'a7': { type: 'pawn', color: 'black' },
      'b7': { type: 'pawn', color: 'black' },
      'c7': { type: 'pawn', color: 'black' },
      'd7': { type: 'pawn', color: 'black' },
      'e7': { type: 'pawn', color: 'black' },
      'f7': { type: 'pawn', color: 'black' },
      'g7': { type: 'pawn', color: 'black' },
      'h7': { type: 'pawn', color: 'black' },
      'a2': { type: 'pawn', color: 'white' },
      'b2': { type: 'pawn', color: 'white' },
      'c2': { type: 'pawn', color: 'white' },
      'd2': { type: 'pawn', color: 'white' },
      'e2': { type: 'pawn', color: 'white' },
      'f2': { type: 'pawn', color: 'white' },
      'g2': { type: 'pawn', color: 'white' },
      'h2': { type: 'pawn', color: 'white' },
      'a1': { type: 'rook', color: 'white' },
      'b1': { type: 'knight', color: 'white' },
      'c1': { type: 'bishop', color: 'white' },
      'd1': { type: 'queen', color: 'white' },
      'e1': { type: 'king', color: 'white' },
      'f1': { type: 'bishop', color: 'white' },
      'g1': { type: 'knight', color: 'white' },
      'h1': { type: 'rook', color: 'white' },
    };
  }
}
