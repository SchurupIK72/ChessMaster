import { ChessGameState, ChessPiece, GameRulesArray } from './schema';

export class ChessUtils {
  // Square validation
  static isValidSquare(square: string): boolean {
    return /^[a-h][1-8]$/.test(square);
  }

  // Position conversion helpers
  static squareToCoords(square: string): [number, number] {
    return [
      square.charCodeAt(0) - 'a'.charCodeAt(0),
      parseInt(square[1]) - 1
    ];
  }

  static coordsToSquare(file: number, rank: number): string {
    return String.fromCharCode('a'.charCodeAt(0) + file) + (rank + 1);
  }

  // Distance calculation
  static getDistance(from: string, to: string): number {
    const [fromFile, fromRank] = ChessUtils.squareToCoords(from);
    const [toFile, toRank] = ChessUtils.squareToCoords(to);
    const dx = Math.abs(toFile - fromFile);
    const dy = Math.abs(toRank - fromRank);
    return Math.max(dx, dy);
  }

  // Direction calculation
  static getDirection(from: string, to: string): [number, number] {
    const [fromFile, fromRank] = ChessUtils.squareToCoords(from);
    const [toFile, toRank] = ChessUtils.squareToCoords(to);
    const dx = toFile - fromFile;
    const dy = toRank - fromRank;
    return [
      dx === 0 ? 0 : dx / Math.abs(dx),
      dy === 0 ? 0 : dy / Math.abs(dy)
    ];
  }

  // Check if path is clear between two squares
  static isPathClear(gameState: ChessGameState, from: string, to: string): boolean {
    const [fromFile, fromRank] = ChessUtils.squareToCoords(from);
    const [toFile, toRank] = ChessUtils.squareToCoords(to);
    
    const dx = toFile - fromFile;
    const dy = toRank - fromRank;
    const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
    const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
    
    let currentFile = fromFile + stepX;
    let currentRank = fromRank + stepY;
    
    while (currentFile !== toFile || currentRank !== toRank) {
      const currentSquare = ChessUtils.coordsToSquare(currentFile, currentRank);
      if (gameState.board[currentSquare]) {
        return false;
      }
      currentFile += stepX;
      currentRank += stepY;
    }
    
    return true;
  }

  // Find king position
  static findKing(gameState: ChessGameState, color: 'white' | 'black'): string | null {
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.type === 'king' && piece.color === color) {
        return square;
      }
    }
    return null;
  }

  // Basic move validation for pieces
  static isValidPieceMove(piece: ChessPiece, from: string, to: string, gameState: ChessGameState, gameRules: GameRulesArray = ['standard']): boolean {
    const [fromFile, fromRank] = ChessUtils.squareToCoords(from);
    const [toFile, toRank] = ChessUtils.squareToCoords(to);
    const dx = toFile - fromFile;
    const dy = toRank - fromRank;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    switch (piece.type) {
      case 'pawn':
        return ChessUtils.validatePawnMove(piece, from, to, gameState, gameRules);
      case 'rook':
        return (dx === 0 || dy === 0) && ChessUtils.isPathClear(gameState, from, to);
      case 'bishop':
        return absDx === absDy && absDx > 0 && ChessUtils.isPathClear(gameState, from, to);
      case 'queen':
        return ((dx === 0 || dy === 0) || (absDx === absDy)) && 
               absDx + absDy > 0 && ChessUtils.isPathClear(gameState, from, to);
      case 'knight':
        return (absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2);
      case 'king':
        return absDx <= 1 && absDy <= 1 && (absDx + absDy > 0);
      default:
        return false;
    }
  }

  // Pawn move validation with rotation support
  static validatePawnMove(piece: ChessPiece, from: string, to: string, gameState: ChessGameState, gameRules: GameRulesArray): boolean {
    const [fromFile, fromRank] = ChessUtils.squareToCoords(from);
    const [toFile, toRank] = ChessUtils.squareToCoords(to);
    const dx = toFile - fromFile;
    const dy = toRank - fromRank;
    const direction = piece.color === 'white' ? 1 : -1;
    const targetPiece = gameState.board[to];

    // Capture diagonally
    if (Math.abs(dx) === 1 && dy === direction) {
      return !!targetPiece;
    }

    // En passant
    if (Math.abs(dx) === 1 && dy === direction && !targetPiece && gameState.enPassantTarget === to) {
      return true;
    }

    // Forward moves
    if (dx === 0 && !targetPiece) {
      if (dy === direction) return true; // Single step
      if (dy === 2 * direction) { // Double step
        const startRank = piece.color === 'white' ? 1 : 6;
        return fromRank === startRank || gameRules.includes('pawn-rotation');
      }
    }

    // Horizontal moves (PawnRotation only)
    if (gameRules.includes('pawn-rotation') && dy === 0 && !targetPiece) {
      if (Math.abs(dx) === 1) return true; // Single horizontal
      if (Math.abs(dx) === 2) return true; // Double horizontal
    }

    return false;
  }

  // Check if a square is under attack
  static isSquareUnderAttack(gameState: ChessGameState, square: string, byColor: 'white' | 'black', gameRules: GameRulesArray = ['standard']): boolean {
    for (const [pieceSquare, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === byColor) {
        if (ChessUtils.isValidPieceMove(piece, pieceSquare, square, gameState, gameRules)) {
          return true;
        }
      }
    }
    return false;
  }

  // Check if king is in check
  static isKingInCheck(gameState: ChessGameState, color: 'white' | 'black', gameRules: GameRulesArray = ['standard']): boolean {
    const kingSquare = ChessUtils.findKing(gameState, color);
    if (!kingSquare) return false;
    
    const opponentColor = color === 'white' ? 'black' : 'white';
    return ChessUtils.isSquareUnderAttack(gameState, kingSquare, opponentColor, gameRules);
  }

  // Simulate a move and check if it leaves king in check
  static wouldLeaveKingInCheck(gameState: ChessGameState, from: string, to: string, gameRules: GameRulesArray = ['standard']): boolean {
    const piece = gameState.board[from];
    if (!piece) return true;

    // Create a temporary game state
    const tempState = JSON.parse(JSON.stringify(gameState));
    const capturedPiece = tempState.board[to];
    
    // Make the move
    tempState.board[to] = piece;
    tempState.board[from] = null;
    
    // Check if king is in check
    return ChessUtils.isKingInCheck(tempState, piece.color, gameRules);
  }

  // Get all legal moves for a piece
  static getLegalMoves(gameState: ChessGameState, from: string, gameRules: GameRulesArray = ['standard']): string[] {
    const piece = gameState.board[from];
    if (!piece) return [];

    const moves: string[] = [];
    
    // Generate all possible squares
    for (let file = 0; file < 8; file++) {
      for (let rank = 0; rank < 8; rank++) {
        const to = ChessUtils.coordsToSquare(file, rank);
        if (from === to) continue;
        
        const targetPiece = gameState.board[to];
        
        // Can't capture own pieces
        if (targetPiece && targetPiece.color === piece.color) continue;
        
        // Check if move is valid for this piece type
        if (ChessUtils.isValidPieceMove(piece, from, to, gameState, gameRules)) {
          // Check if move leaves king in check
          if (!ChessUtils.wouldLeaveKingInCheck(gameState, from, to, gameRules)) {
            moves.push(to);
          }
        }
      }
    }
    
    return moves;
  }

  // Check if player has any legal moves
  static hasLegalMoves(gameState: ChessGameState, color: 'white' | 'black', gameRules: GameRulesArray = ['standard']): boolean {
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === color) {
        if (ChessUtils.getLegalMoves(gameState, square, gameRules).length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Update game status (checkmate, stalemate, etc.)
  static updateGameStatus(gameState: ChessGameState, gameRules: GameRulesArray = ['standard']): ChessGameState {
    const inCheck = ChessUtils.isKingInCheck(gameState, gameState.currentTurn, gameRules);
    const hasLegalMoves = ChessUtils.hasLegalMoves(gameState, gameState.currentTurn, gameRules);
    
    return {
      ...gameState,
      isCheck: inCheck,
      isCheckmate: inCheck && !hasLegalMoves,
      isStalemate: !inCheck && !hasLegalMoves
    };
  }
}