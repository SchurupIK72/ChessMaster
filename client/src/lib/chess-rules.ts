import { ChessGameState, GameRules } from "@shared/schema";

export class ChessRules {
  static applySpecialRules(gameState: ChessGameState, rules: GameRules, fromSquare: string, toSquare: string): ChessGameState {
    // Only standard chess rules - no special rules to apply
    return gameState;
  }

  private static applyKingOfTheHill(gameState: ChessGameState, fromSquare: string, toSquare: string): ChessGameState {
    const piece = gameState.board[fromSquare];
    const centerSquares = ['d4', 'd5', 'e4', 'e5'];

    // Check if king moved to center
    if (piece?.type === 'king' && centerSquares.includes(toSquare)) {
      return {
        ...gameState,
        isCheckmate: true, // Use checkmate to indicate game end
      };
    }

    return gameState;
  }

  private static applyAtomicRules(gameState: ChessGameState, fromSquare: string, toSquare: string): ChessGameState {
    const newGameState = { ...gameState };
    const capturedPiece = gameState.board[toSquare];

    // If there was a capture, create explosion
    if (capturedPiece) {
      const explosionSquares = this.getAdjacentSquares(toSquare);
      explosionSquares.push(toSquare);

      // Remove all pieces in explosion radius except pawns
      for (const square of explosionSquares) {
        const piece = newGameState.board[square];
        if (piece && piece.type !== 'pawn') {
          delete newGameState.board[square];
        }
      }

      // Also remove the capturing piece (except if it's a pawn)
      const capturingPiece = gameState.board[fromSquare];
      if (capturingPiece?.type !== 'pawn') {
        delete newGameState.board[fromSquare];
      }
    }

    return newGameState;
  }

  private static applyThreeCheck(gameState: ChessGameState, fromSquare: string, toSquare: string): ChessGameState {
    // This would require tracking check count in game state
    // For now, just return the original state
    return gameState;
  }

  private static getAdjacentSquares(square: string): string[] {
    const [file, rank] = square;
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);
    const adjacent: string[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip the center square itself

        const newFileIndex = fileIndex + dx;
        const newRank = rankNum + dy;

        if (newFileIndex >= 0 && newFileIndex < 8 && newRank >= 1 && newRank <= 8) {
          const newFile = String.fromCharCode(newFileIndex + 'a'.charCodeAt(0));
          adjacent.push(`${newFile}${newRank}`);
        }
      }
    }

    return adjacent;
  }

  static getInitialPosition(rules: GameRules): { [square: string]: any } {
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
