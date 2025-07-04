import type { ChessGameState, ChessPiece, GameRulesArray } from '@shared/schema';

export class ChessLogic {
  getValidMoves(gameState: ChessGameState, fromSquare: string, gameRules?: string[]): string[] {
    const piece = gameState.board[fromSquare];
    if (!piece) return [];

    // Check if we're in the middle of a double knight move
    if (gameState.doubleKnightMove) {
      // Only the required knight can move
      if (piece.type !== 'knight' || 
          gameState.doubleKnightMove.knightSquare !== fromSquare ||
          piece.color !== gameState.doubleKnightMove.color) {
        return []; // Can only move the required knight
      }
    }

    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    switch (piece.type) {
      case 'pawn':
        moves.push(...this.getPawnMoves(gameState, fromSquare, piece, gameRules));
        break;
      case 'rook':
        moves.push(...this.getRookMoves(gameState, fromSquare, piece));
        break;
      case 'knight':
        moves.push(...this.getKnightMoves(gameState, fromSquare, piece));
        break;
      case 'bishop':
        moves.push(...this.getBishopMoves(gameState, fromSquare, piece, gameRules));
        break;
      case 'queen':
        moves.push(...this.getQueenMoves(gameState, fromSquare, piece, gameRules));
        break;
      case 'king':
        moves.push(...this.getKingMoves(gameState, fromSquare, piece, gameRules));
        break;
    }

    // Filter out moves that would leave the king in check
    const validMoves = moves.filter(move => {
      return !this.wouldBeInCheck(gameState, fromSquare, move, piece.color, gameRules);
    });

    return validMoves;
  }

  hasLegalMoves(gameState: ChessGameState, color: 'white' | 'black', gameRules?: string[]): boolean {
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === color) {
        const validMoves = this.getValidMoves(gameState, square, gameRules);
        if (validMoves.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  updateGameStatus(gameState: ChessGameState, gameRules?: string[]): ChessGameState {
    const newGameState = { ...gameState };
    const currentPlayerColor = newGameState.currentTurn;
    const isInCheck = this.isKingInCheck(newGameState, currentPlayerColor, gameRules);
    const hasLegalMoves = this.hasLegalMoves(newGameState, currentPlayerColor, gameRules);

    newGameState.isCheck = isInCheck;
    newGameState.isCheckmate = isInCheck && !hasLegalMoves;
    newGameState.isStalemate = !isInCheck && !hasLegalMoves;

    return newGameState;
  }

  private getPawnMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    const direction = piece.color === 'white' ? 1 : -1;
    const startRank = piece.color === 'white' ? 2 : 7;
    const promotionRank = piece.color === 'white' ? 8 : 1;

    // Check if PawnRotation rule is active
    const hasPawnRotation = gameRules?.includes('pawn-rotation');
    
    // Check if this pawn has moved (for rotation rule)
    let hasMoved = false;
    if (hasPawnRotation && gameState.pawnRotationMoves) {
      const standardOriginalSquare = `${file}${piece.color === 'white' ? 2 : 7}`;
      const pawnWallStartSquare = `${file}${piece.color === 'white' ? 3 : 6}`;
      hasMoved = gameState.pawnRotationMoves[standardOriginalSquare] || gameState.pawnRotationMoves[pawnWallStartSquare];
    }

    // Forward moves
    const oneForward = `${file}${rankNum + direction}`;
    if (this.isValidSquare(oneForward) && !gameState.board[oneForward]) {
      moves.push(oneForward);

      // Two squares forward if on starting rank or if pawn hasn't moved in rotation mode
      const twoForward = `${file}${rankNum + 2 * direction}`;
      if (this.isValidSquare(twoForward) && !gameState.board[twoForward]) {
        if (rankNum === startRank || (hasPawnRotation && !hasMoved)) {
          moves.push(twoForward);
        }
      }
    }

    // Diagonal captures
    const captureLeft = `${String.fromCharCode(file.charCodeAt(0) - 1)}${rankNum + direction}`;
    const captureRight = `${String.fromCharCode(file.charCodeAt(0) + 1)}${rankNum + direction}`;

    if (this.isValidSquare(captureLeft)) {
      const target = gameState.board[captureLeft];
      if (target && target.color !== piece.color) {
        moves.push(captureLeft);
      }
    }

    if (this.isValidSquare(captureRight)) {
      const target = gameState.board[captureRight];
      if (target && target.color !== piece.color) {
        moves.push(captureRight);
      }
    }

    // En passant
    if (gameState.enPassantTarget) {
      const enPassantFile = gameState.enPassantTarget[0];
      const enPassantRank = parseInt(gameState.enPassantTarget[1]);
      
      // Check if pawn can capture en passant
      const canCaptureEnPassant = 
        Math.abs(fileIndex - (enPassantFile.charCodeAt(0) - 'a'.charCodeAt(0))) === 1 &&
        rankNum + direction === enPassantRank;
      
      if (canCaptureEnPassant) {
        moves.push(gameState.enPassantTarget);
      }
    }

    // Horizontal moves for PawnRotation rule
    if (hasPawnRotation) {
      // Horizontal forward moves
      const leftSquare = `${String.fromCharCode(file.charCodeAt(0) - 1)}${rankNum}`;
      const rightSquare = `${String.fromCharCode(file.charCodeAt(0) + 1)}${rankNum}`;

      if (this.isValidSquare(leftSquare) && !gameState.board[leftSquare]) {
        moves.push(leftSquare);
        
        // Double horizontal move if pawn hasn't moved
        if (!hasMoved) {
          const doubleLeftSquare = `${String.fromCharCode(file.charCodeAt(0) - 2)}${rankNum}`;
          if (this.isValidSquare(doubleLeftSquare) && !gameState.board[doubleLeftSquare]) {
            moves.push(doubleLeftSquare);
          }
        }
      }

      if (this.isValidSquare(rightSquare) && !gameState.board[rightSquare]) {
        moves.push(rightSquare);
        
        // Double horizontal move if pawn hasn't moved
        if (!hasMoved) {
          const doubleRightSquare = `${String.fromCharCode(file.charCodeAt(0) + 2)}${rankNum}`;
          if (this.isValidSquare(doubleRightSquare) && !gameState.board[doubleRightSquare]) {
            moves.push(doubleRightSquare);
          }
        }
      }

      // Horizontal captures
      if (this.isValidSquare(leftSquare)) {
        const target = gameState.board[leftSquare];
        if (target && target.color !== piece.color) {
          moves.push(leftSquare);
        }
      }

      if (this.isValidSquare(rightSquare)) {
        const target = gameState.board[rightSquare];
        if (target && target.color !== piece.color) {
          moves.push(rightSquare);
        }
      }

      // Horizontal en passant
      if (gameState.enPassantTarget) {
        const enPassantFile = gameState.enPassantTarget[0];
        const enPassantRank = parseInt(gameState.enPassantTarget[1]);
        
        // Check if pawn can capture horizontally en passant
        const canCaptureHorizontalEnPassant = 
          Math.abs(fileIndex - (enPassantFile.charCodeAt(0) - 'a'.charCodeAt(0))) === 1 &&
          rankNum === enPassantRank;
        
        if (canCaptureHorizontalEnPassant) {
          moves.push(gameState.enPassantTarget);
        }
      }
    }

    return moves;
  }

  private getRookMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    // Horizontal and vertical directions
    const directions = [
      [0, 1], [0, -1], [1, 0], [-1, 0]
    ];

    for (const [dx, dy] of directions) {
      moves.push(...this.getMovesInDirection(gameState, fromSquare, dx, dy, piece));
    }

    return moves;
  }

  private getBishopMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    // Diagonal directions
    const directions = [
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    for (const [dx, dy] of directions) {
      // Check if X-ray bishop rule is active
      if (gameRules?.includes('xray-bishop')) {
        moves.push(...this.getXrayMovesInDirection(gameState, fromSquare, dx, dy, piece));
      } else {
        moves.push(...this.getMovesInDirection(gameState, fromSquare, dx, dy, piece));
      }
    }

    return moves;
  }

  private getQueenMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    // All 8 directions (rook + bishop)
    const directions = [
      [0, 1], [0, -1], [1, 0], [-1, 0], // Rook moves
      [1, 1], [1, -1], [-1, 1], [-1, -1] // Bishop moves
    ];

    for (const [dx, dy] of directions) {
      moves.push(...this.getMovesInDirection(gameState, fromSquare, dx, dy, piece));
    }

    return moves;
  }

  private getKnightMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    // Knight moves in L-shape
    const knightMoves = [
      [2, 1], [2, -1], [-2, 1], [-2, -1],
      [1, 2], [1, -2], [-1, 2], [-1, -2]
    ];

    for (const [dx, dy] of knightMoves) {
      const newFileIndex = fileIndex + dx;
      const newRankNum = rankNum + dy;
      
      if (newFileIndex >= 0 && newFileIndex < 8 && newRankNum >= 1 && newRankNum <= 8) {
        const newSquare = `${String.fromCharCode(newFileIndex + 'a'.charCodeAt(0))}${newRankNum}`;
        const target = gameState.board[newSquare];
        
        if (!target || target.color !== piece.color) {
          moves.push(newSquare);
        }
      }
    }

    return moves;
  }

  private getKingMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    console.log('getKingMoves called with gameRules:', gameRules);
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    // Regular king moves (one square in any direction)
    const directions = [
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    for (const [dx, dy] of directions) {
      const newFileIndex = fileIndex + dx;
      const newRankNum = rankNum + dy;
      
      if (newFileIndex >= 0 && newFileIndex < 8 && newRankNum >= 1 && newRankNum <= 8) {
        const newSquare = `${String.fromCharCode(newFileIndex + 'a'.charCodeAt(0))}${newRankNum}`;
        const target = gameState.board[newSquare];
        
        if (!target || target.color !== piece.color) {
          moves.push(newSquare);
        }
      }
    }

    // Check for Blink rule first
    const hasBlinkRule = Array.isArray(gameRules) && gameRules.includes('blink');
    const blinkUsed = gameState.blinkUsed?.[piece.color];
    
    // Castling (available in Blink mode until Blink is used)
    if (!this.isKingInCheck(gameState, piece.color, gameRules)) {
      const backRank = piece.color === 'white' ? 1 : 8;
      
      // Kingside castling
      if (gameState.castlingRights[piece.color === 'white' ? 'whiteKingside' : 'blackKingside']) {
        const f = `f${backRank}`;
        const g = `g${backRank}`;
        
        if (!gameState.board[f] && !gameState.board[g] &&
            !this.isSquareUnderAttack(gameState, f, piece.color, gameRules) &&
            !this.isSquareUnderAttack(gameState, g, piece.color, gameRules)) {
          moves.push(g);
        }
      }
      
      // Queenside castling
      if (gameState.castlingRights[piece.color === 'white' ? 'whiteQueenside' : 'blackQueenside']) {
        const b = `b${backRank}`;
        const c = `c${backRank}`;
        const d = `d${backRank}`;
        
        if (!gameState.board[b] && !gameState.board[c] && !gameState.board[d] &&
            !this.isSquareUnderAttack(gameState, c, piece.color, gameRules) &&
            !this.isSquareUnderAttack(gameState, d, piece.color, gameRules)) {
          moves.push(c);
        }
      }
    }

    // Blink move (teleport)
    console.log('Checking for blink mode:', {
      gameRules,
      hasBlinkRule,
      gameRulesType: typeof gameRules,
      gameRulesContent: gameRules
    });
    

    
    // Add Blink teleportation moves if available
    if (hasBlinkRule) {
      const blinkUsed = gameState.blinkUsed?.[piece.color];
      console.log('Blink mode detected', { gameRules, blinkUsed });
      
      if (!blinkUsed) {
        // King can teleport to any empty square (not adjacent squares, those are already added)
        for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
          for (let rankIdx = 1; rankIdx <= 8; rankIdx++) {
            const targetSquare = `${String.fromCharCode(fileIdx + 'a'.charCodeAt(0))}${rankIdx}`;
            
            // Skip current position
            if (targetSquare === fromSquare) continue;
            
            // Skip if already added as standard move
            if (moves.includes(targetSquare)) continue;
            
            const target = gameState.board[targetSquare];
            if (!target) {
              moves.push(targetSquare);
            } else {
              console.log(`Blink blocked to ${targetSquare}: occupied by ${target.color === piece.color ? 'own' : 'enemy'} ${target.type}`);
            }
          }
        }
      }
    } else {
      console.log('Blink mode not detected', { gameRules });
    }

    return moves;
  }

  private getMovesInDirection(
    gameState: ChessGameState,
    fromSquare: string,
    dx: number,
    dy: number,
    piece: ChessPiece
  ): string[] {
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    let newFileIndex = fileIndex + dx;
    let newRankNum = rankNum + dy;

    while (newFileIndex >= 0 && newFileIndex < 8 && newRankNum >= 1 && newRankNum <= 8) {
      const newSquare = `${String.fromCharCode(newFileIndex + 'a'.charCodeAt(0))}${newRankNum}`;
      const target = gameState.board[newSquare];

      if (!target) {
        moves.push(newSquare);
      } else {
        if (target.color !== piece.color) {
          moves.push(newSquare);
        }
        break; // Stop at first piece encountered
      }

      newFileIndex += dx;
      newRankNum += dy;
    }

    return moves;
  }

  private getXrayMovesInDirection(
    gameState: ChessGameState,
    fromSquare: string,
    dx: number,
    dy: number,
    piece: ChessPiece
  ): string[] {
    const moves: string[] = [];
    const file = fromSquare[0];
    const rank = fromSquare[1];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    let newFileIndex = fileIndex + dx;
    let newRankNum = rankNum + dy;
    let pieceCount = 0;

    while (newFileIndex >= 0 && newFileIndex < 8 && newRankNum >= 1 && newRankNum <= 8) {
      const newSquare = `${String.fromCharCode(newFileIndex + 'a'.charCodeAt(0))}${newRankNum}`;
      const target = gameState.board[newSquare];

      if (!target) {
        if (pieceCount <= 1) {
          moves.push(newSquare);
        }
      } else {
        pieceCount++;
        if (pieceCount === 1) {
          // First piece encountered - can move here if it's an enemy
          if (target.color !== piece.color) {
            moves.push(newSquare);
          }
        } else if (pieceCount === 2) {
          // Second piece encountered - can capture if it's an enemy
          if (target.color !== piece.color) {
            moves.push(newSquare);
          }
          break; // Stop after second piece
        }
      }

      newFileIndex += dx;
      newRankNum += dy;
    }

    return moves;
  }

  private isValidSquare(square: string): boolean {
    if (square.length !== 2) return false;
    const file = square[0];
    const rank = square[1];
    return file >= 'a' && file <= 'h' && rank >= '1' && rank <= '8';
  }

  private wouldBeInCheck(
    gameState: ChessGameState,
    fromSquare: string,
    toSquare: string,
    kingColor: 'white' | 'black',
    gameRules?: string[]
  ): boolean {
    // Create a copy of the game state with the move applied
    const newGameState = { ...gameState };
    newGameState.board = { ...gameState.board };
    
    const piece = newGameState.board[fromSquare];
    if (!piece) return false;

    // Apply the move
    newGameState.board[toSquare] = piece;
    delete newGameState.board[fromSquare];

    // Check if king is in check after the move
    return this.isKingInCheck(newGameState, kingColor, gameRules);
  }

  private isSquareUnderAttack(gameState: ChessGameState, square: string, kingColor: 'white' | 'black', gameRules?: string[]): boolean {
    const enemyColor = kingColor === 'white' ? 'black' : 'white';
    
    for (const [fromSquare, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === enemyColor) {
        const rawMoves = this.getRawMovesForPiece(gameState, fromSquare, piece, gameRules);
        if (rawMoves.includes(square)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private getRawMovesForPiece(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    // Get moves without checking if they leave the king in check
    switch (piece.type) {
      case 'pawn':
        return this.getPawnMoves(gameState, fromSquare, piece, gameRules);
      case 'rook':
        return this.getRookMoves(gameState, fromSquare, piece);
      case 'knight':
        return this.getKnightMoves(gameState, fromSquare, piece);
      case 'bishop':
        return this.getBishopMoves(gameState, fromSquare, piece, gameRules);
      case 'queen':
        return this.getQueenMoves(gameState, fromSquare, piece, gameRules);
      case 'king':
        // For king, we need to get basic moves without castling to avoid infinite recursion
        const moves: string[] = [];
        const file = fromSquare[0];
        const rank = fromSquare[1];
        const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
        const rankNum = parseInt(rank);

        const directions = [
          [0, 1], [0, -1], [1, 0], [-1, 0],
          [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];

        for (const [dx, dy] of directions) {
          const newFileIndex = fileIndex + dx;
          const newRankNum = rankNum + dy;
          
          if (newFileIndex >= 0 && newFileIndex < 8 && newRankNum >= 1 && newRankNum <= 8) {
            const newSquare = `${String.fromCharCode(newFileIndex + 'a'.charCodeAt(0))}${newRankNum}`;
            const target = gameState.board[newSquare];
            
            if (!target || target.color !== piece.color) {
              moves.push(newSquare);
            }
          }
        }
        return moves;
      default:
        return [];
    }
  }

  private isKingInCheck(gameState: ChessGameState, color: 'white' | 'black', gameRules?: string[]): boolean {
    // Find the king
    let kingSquare = '';
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.type === 'king' && piece.color === color) {
        kingSquare = square;
        break;
      }
    }

    if (!kingSquare) return false;

    return this.isSquareUnderAttack(gameState, kingSquare, color, gameRules);
  }

  private getValidMovesForPiece(
    gameState: ChessGameState,
    fromSquare: string,
    piece: ChessPiece,
    gameRules?: string[]
  ): string[] {
    const allMoves = this.getRawMovesForPiece(gameState, fromSquare, piece, gameRules);
    
    // Filter out moves that would leave the king in check
    return allMoves.filter(move => {
      return !this.wouldBeInCheck(gameState, fromSquare, move, piece.color, gameRules);
    });
  }
}