import { ChessGameState, ChessPiece } from "@shared/schema";

export class ChessLogic {
  getValidMoves(gameState: ChessGameState, fromSquare: string, gameRules?: string[]): string[] {
    const piece = gameState.board[fromSquare];
    if (!piece || piece.color !== gameState.currentTurn) {
      return [];
    }

    // Check for double knight rule restriction
    if (gameState.doubleKnightMove) {
      // Must move the specific knight that was moved in the first part
      if (fromSquare !== gameState.doubleKnightMove.knightSquare || 
          piece.type !== 'knight' || 
          piece.color !== gameState.doubleKnightMove.color) {
        return []; // Can only move the required knight
      }
    }

    const moves: string[] = [];
    const [file, rank] = fromSquare;
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
        moves.push(...this.getKingMoves(gameState, fromSquare, piece));
        break;
    }

    // Filter out moves that would put own king in check
    let validMoves = moves.filter(move => !this.wouldBeInCheck(gameState, fromSquare, move, piece.color));
    
    // Special rule for double knight: cannot capture the king
    if (gameState.doubleKnightMove) {
      validMoves = validMoves.filter(move => {
        const targetPiece = gameState.board[move];
        return !(targetPiece && targetPiece.type === 'king');
      });
    }
    
    return validMoves;
  }

  // Check if the current player has any legal moves
  hasLegalMoves(gameState: ChessGameState, color: 'white' | 'black', gameRules?: string[]): boolean {
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === color) {
        const moves = this.getValidMovesForPiece(gameState, square, piece, gameRules);
        if (moves.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Update game state to detect checkmate and stalemate
  updateGameStatus(gameState: ChessGameState, gameRules?: string[]): ChessGameState {
    const currentPlayerInCheck = this.isKingInCheck(gameState, gameState.currentTurn);
    const hasLegalMoves = this.hasLegalMoves(gameState, gameState.currentTurn, gameRules);

    return {
      ...gameState,
      isCheck: currentPlayerInCheck,
      isCheckmate: currentPlayerInCheck && !hasLegalMoves,
      isStalemate: !currentPlayerInCheck && !hasLegalMoves
    };
  }

  private getPawnMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    const moves: string[] = [];
    const [file, rank] = fromSquare;
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);
    const direction = piece.color === 'white' ? 1 : -1;
    const startRank = piece.color === 'white' ? 2 : 7;

    // Standard forward move
    const oneForward = `${file}${rankNum + direction}`;
    if (this.isValidSquare(oneForward) && !gameState.board[oneForward]) {
      moves.push(oneForward);

      // Two squares forward from starting position (only if pawn hasn't moved)
      let canDoubleMoveForward = rankNum === startRank;
      if (gameRules && gameRules.includes('pawn-rotation')) {
        // In PawnRotation mode, check if pawn has moved at all
        const pawnRotationMoves = gameState.pawnRotationMoves || {};
        const originalSquare = `${file}${startRank}`;
        const hasPawnMoved = pawnRotationMoves[originalSquare];
        canDoubleMoveForward = canDoubleMoveForward && !hasPawnMoved;
      }
      
      if (canDoubleMoveForward) {
        const twoForward = `${file}${rankNum + 2 * direction}`;
        if (this.isValidSquare(twoForward) && !gameState.board[twoForward]) {
          moves.push(twoForward);
        }
      }
    }

    // Standard diagonal captures
    for (const fileOffset of [-1, 1]) {
      const newFileIndex = fileIndex + fileOffset;
      if (newFileIndex >= 0 && newFileIndex < 8) {
        const newFile = String.fromCharCode(newFileIndex + 'a'.charCodeAt(0));
        const captureSquare = `${newFile}${rankNum + direction}`;
        
        if (this.isValidSquare(captureSquare)) {
          const targetPiece = gameState.board[captureSquare];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(captureSquare);
          }
          // En passant
          if (captureSquare === gameState.enPassantTarget) {
            moves.push(captureSquare);
          }
        }
      }
    }

    // PawnRotation rule: horizontal moves
    if (gameRules && gameRules.includes('pawn-rotation')) {
      const pawnRotationMoves = gameState.pawnRotationMoves || {};
      
      // Generate pawn ID based on original starting position
      const originalRank = piece.color === 'white' ? 2 : 7;
      const originalSquare = `${file}${originalRank}`;
      const hasPawnMoved = pawnRotationMoves[originalSquare];
      
      // Horizontal moves (left and right)
      for (const fileOffset of [-1, 1]) {
        const newFileIndex = fileIndex + fileOffset;
        if (newFileIndex >= 0 && newFileIndex < 8) {
          const newFile = String.fromCharCode(newFileIndex + 'a'.charCodeAt(0));
          const horizontalSquare = `${newFile}${rankNum}`;
          
          if (!gameState.board[horizontalSquare]) {
            moves.push(horizontalSquare);
            
            // Allow 2-square horizontal move only if pawn hasn't moved at all
            if (!hasPawnMoved) {
              const newFileIndex2 = fileIndex + 2 * fileOffset;
              if (newFileIndex2 >= 0 && newFileIndex2 < 8) {
                const newFile2 = String.fromCharCode(newFileIndex2 + 'a'.charCodeAt(0));
                const horizontalSquare2 = `${newFile2}${rankNum}`;
                if (!gameState.board[horizontalSquare2]) {
                  moves.push(horizontalSquare2);
                }
              }
            }
          }
        }
      }
    }

    return moves;
  }

  private getRookMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
    const moves: string[] = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (const [dx, dy] of directions) {
      moves.push(...this.getMovesInDirection(gameState, fromSquare, piece, dx, dy));
    }

    return moves;
  }

  private getBishopMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    const moves: string[] = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

    for (const [dx, dy] of directions) {
      if (gameRules && gameRules.includes('xray-bishop')) {
        // Рентген-режим: слон может проходить сквозь одну фигуру
        moves.push(...this.getXrayMovesInDirection(gameState, fromSquare, piece, dx, dy));
      } else {
        // Стандартное движение слона
        moves.push(...this.getMovesInDirection(gameState, fromSquare, piece, dx, dy));
      }
    }

    return moves;
  }

  private getQueenMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    return [
      ...this.getRookMoves(gameState, fromSquare, piece),
      ...this.getBishopMoves(gameState, fromSquare, piece, gameRules)
    ];
  }

  private getKnightMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
    const moves: string[] = [];
    const [file, rank] = fromSquare;
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    const knightMoves = [
      [2, 1], [2, -1], [-2, 1], [-2, -1],
      [1, 2], [1, -2], [-1, 2], [-1, -2]
    ];

    for (const [dx, dy] of knightMoves) {
      const newFileIndex = fileIndex + dx;
      const newRank = rankNum + dy;

      if (newFileIndex >= 0 && newFileIndex < 8 && newRank >= 1 && newRank <= 8) {
        const newFile = String.fromCharCode(newFileIndex + 'a'.charCodeAt(0));
        const newSquare = `${newFile}${newRank}`;
        
        const targetPiece = gameState.board[newSquare];
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push(newSquare);
        }
      }
    }

    return moves;
  }

  private getKingMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    const moves: string[] = [];
    const [file, rank] = fromSquare;
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    const kingMoves = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    for (const [dx, dy] of kingMoves) {
      const newFileIndex = fileIndex + dx;
      const newRank = rankNum + dy;

      if (newFileIndex >= 0 && newFileIndex < 8 && newRank >= 1 && newRank <= 8) {
        const newFile = String.fromCharCode(newFileIndex + 'a'.charCodeAt(0));
        const newSquare = `${newFile}${newRank}`;
        
        const targetPiece = gameState.board[newSquare];
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push(newSquare);
        }
      }
    }

    // Add castling logic
    if (!this.isKingInCheck(gameState, piece.color)) {
      // Check kingside castling
      if (piece.color === 'white' && gameState.castlingRights.whiteKingside) {
        if (!gameState.board['f1'] && !gameState.board['g1'] && gameState.board['h1']?.type === 'rook') {
          // Check if squares are not under attack
          if (!this.isSquareUnderAttack(gameState, 'f1', piece.color, gameRules) && 
              !this.isSquareUnderAttack(gameState, 'g1', piece.color, gameRules)) {
            moves.push('g1');
          }
        }
      } else if (piece.color === 'black' && gameState.castlingRights.blackKingside) {
        if (!gameState.board['f8'] && !gameState.board['g8'] && gameState.board['h8']?.type === 'rook') {
          if (!this.isSquareUnderAttack(gameState, 'f8', piece.color, gameRules) && 
              !this.isSquareUnderAttack(gameState, 'g8', piece.color, gameRules)) {
            moves.push('g8');
          }
        }
      }

      // Check queenside castling
      if (piece.color === 'white' && gameState.castlingRights.whiteQueenside) {
        if (!gameState.board['d1'] && !gameState.board['c1'] && !gameState.board['b1'] && gameState.board['a1']?.type === 'rook') {
          if (!this.isSquareUnderAttack(gameState, 'd1', piece.color, gameRules) && 
              !this.isSquareUnderAttack(gameState, 'c1', piece.color, gameRules)) {
            moves.push('c1');
          }
        }
      } else if (piece.color === 'black' && gameState.castlingRights.blackQueenside) {
        if (!gameState.board['d8'] && !gameState.board['c8'] && !gameState.board['b8'] && gameState.board['a8']?.type === 'rook') {
          if (!this.isSquareUnderAttack(gameState, 'd8', piece.color, gameRules) && 
              !this.isSquareUnderAttack(gameState, 'c8', piece.color, gameRules)) {
            moves.push('c8');
          }
        }
      }
    }

    return moves;
  }

  private getMovesInDirection(
    gameState: ChessGameState,
    fromSquare: string,
    piece: ChessPiece,
    dx: number,
    dy: number
  ): string[] {
    const moves: string[] = [];
    const [file, rank] = fromSquare;
    let fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    let rankNum = parseInt(rank);

    while (true) {
      fileIndex += dx;
      rankNum += dy;

      if (fileIndex < 0 || fileIndex >= 8 || rankNum < 1 || rankNum > 8) {
        break;
      }

      const newFile = String.fromCharCode(fileIndex + 'a'.charCodeAt(0));
      const newSquare = `${newFile}${rankNum}`;
      const targetPiece = gameState.board[newSquare];

      if (!targetPiece) {
        moves.push(newSquare);
      } else {
        if (targetPiece.color !== piece.color) {
          moves.push(newSquare);
        }
        break; // Can't move past any piece
      }
    }

    return moves;
  }

  private getXrayMovesInDirection(
    gameState: ChessGameState,
    fromSquare: string,
    piece: ChessPiece,
    dx: number,
    dy: number
  ): string[] {
    const moves: string[] = [];
    const [file, rank] = fromSquare;
    let fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    let rankNum = parseInt(rank);
    let passedThroughPiece = false;

    while (true) {
      fileIndex += dx;
      rankNum += dy;

      if (fileIndex < 0 || fileIndex >= 8 || rankNum < 1 || rankNum > 8) {
        break;
      }

      const newFile = String.fromCharCode(fileIndex + 'a'.charCodeAt(0));
      const newSquare = `${newFile}${rankNum}`;
      const targetPiece = gameState.board[newSquare];

      if (targetPiece) {
        if (!passedThroughPiece) {
          // Первая встреченная фигура - проходим сквозь неё
          passedThroughPiece = true;
          
          // Если это вражеская фигура, можем захватить её
          if (targetPiece.color !== piece.color) {
            moves.push(newSquare);
          }
        } else {
          // Вторая фигура - останавливаемся, но можем захватить если вражеская
          if (targetPiece.color !== piece.color) {
            moves.push(newSquare);
          }
          break;
        }
      } else {
        // Пустая клетка - можем ходить туда
        moves.push(newSquare);
      }
    }

    return moves;
  }

  private isValidSquare(square: string): boolean {
    if (square.length !== 2) return false;
    const file = square[0];
    const rank = parseInt(square[1]);
    return file >= 'a' && file <= 'h' && rank >= 1 && rank <= 8;
  }

  private wouldBeInCheck(
    gameState: ChessGameState,
    fromSquare: string,
    toSquare: string,
    color: 'white' | 'black'
  ): boolean {
    // Create a temporary game state with the move made
    const tempState = { ...gameState };
    tempState.board = { ...gameState.board };
    
    const piece = tempState.board[fromSquare];
    tempState.board[toSquare] = piece;
    delete tempState.board[fromSquare];

    return this.isKingInCheck(tempState, color);
  }

  private isSquareUnderAttack(gameState: ChessGameState, square: string, kingColor: 'white' | 'black', gameRules?: string[]): boolean {
    const opponentColor = kingColor === 'white' ? 'black' : 'white';
    
    // Check if any opponent piece can attack this square
    for (const [fromSquare, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === opponentColor) {
        // Get raw moves without check validation to avoid recursion
        const moves = this.getRawMovesForPiece(gameState, fromSquare, piece, gameRules);
        if (moves.includes(square)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Get moves without check validation to avoid recursion
  private getRawMovesForPiece(gameState: ChessGameState, fromSquare: string, piece: ChessPiece, gameRules?: string[]): string[] {
    const moves: string[] = [];
    const [file, rank] = fromSquare;
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);

    switch (piece.type) {
      case 'pawn':
        // Direct pawn moves without calling getPawnMoves
        const direction = piece.color === 'white' ? 1 : -1;
        const startRank = piece.color === 'white' ? 2 : 7;
        
        // One square forward
        const oneForward = `${file}${rankNum + direction}`;
        if (rankNum + direction >= 1 && rankNum + direction <= 8 && !gameState.board[oneForward]) {
          moves.push(oneForward);
          
          // Two squares forward from starting position
          if (rankNum === startRank) {
            const twoForward = `${file}${rankNum + 2 * direction}`;
            if (!gameState.board[twoForward]) {
              moves.push(twoForward);
            }
          }
        }
        
        // Diagonal captures
        for (const captureFile of [String.fromCharCode(fileIndex - 1 + 'a'.charCodeAt(0)), String.fromCharCode(fileIndex + 1 + 'a'.charCodeAt(0))]) {
          if (captureFile >= 'a' && captureFile <= 'h') {
            const captureSquare = `${captureFile}${rankNum + direction}`;
            const targetPiece = gameState.board[captureSquare];
            if (targetPiece && targetPiece.color !== piece.color) {
              moves.push(captureSquare);
            }
          }
        }
        break;
        
      case 'rook':
        // Direct rook moves
        const rookDirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of rookDirs) {
          for (let i = 1; i < 8; i++) {
            const newFile = fileIndex + dx * i;
            const newRank = rankNum + dy * i;
            
            if (newFile < 0 || newFile >= 8 || newRank < 1 || newRank > 8) break;
            
            const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
            const targetPiece = gameState.board[newSquare];
            
            if (!targetPiece) {
              moves.push(newSquare);
            } else {
              if (targetPiece.color !== piece.color) {
                moves.push(newSquare);
              }
              break;
            }
          }
        }
        break;
        
      case 'bishop':
        // Bishop moves - учитываем правило рентген-слона
        if (gameRules && gameRules.includes('xray-bishop')) {
          // Рентген-режим: слон может проходить сквозь одну фигуру
          const bishopDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
          for (const [dx, dy] of bishopDirections) {
            moves.push(...this.getXrayMovesInDirection(gameState, fromSquare, piece, dx, dy));
          }
        } else {
          // Стандартное движение слона
          const bishopDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
          for (const [dx, dy] of bishopDirections) {
            moves.push(...this.getMovesInDirection(gameState, fromSquare, piece, dx, dy));
          }
        }
        break;
        
      case 'queen':
        // Queen moves (combination of rook and bishop) - учитываем правило рентген-слона для диагональных ходов
        const queenRookDirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const queenBishopDirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        
        // Ладья-подобные ходы (всегда стандартные)
        for (const [dx, dy] of queenRookDirs) {
          moves.push(...this.getMovesInDirection(gameState, fromSquare, piece, dx, dy));
        }
        
        // Слон-подобные ходы (учитываем рентген)
        for (const [dx, dy] of queenBishopDirs) {
          if (gameRules && gameRules.includes('xray-bishop')) {
            moves.push(...this.getXrayMovesInDirection(gameState, fromSquare, piece, dx, dy));
          } else {
            moves.push(...this.getMovesInDirection(gameState, fromSquare, piece, dx, dy));
          }
        }
        break;
        
      case 'knight':
        // Direct knight moves
        const knightMoves = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        for (const [dx, dy] of knightMoves) {
          const newFile = fileIndex + dx;
          const newRank = rankNum + dy;
          
          if (newFile >= 0 && newFile < 8 && newRank >= 1 && newRank <= 8) {
            const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
            const targetPiece = gameState.board[newSquare];
            
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push(newSquare);
            }
          }
        }
        break;
        
      case 'king':
        // Basic king moves without castling
        const kingDirections = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (const [dx, dy] of kingDirections) {
          const newFile = fileIndex + dx;
          const newRank = rankNum + dy;
          
          if (newFile >= 0 && newFile < 8 && newRank >= 1 && newRank <= 8) {
            const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
            const targetPiece = gameState.board[newSquare];
            
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push(newSquare);
            }
          }
        }
        break;
    }

    return moves;
  }



  private isKingInCheck(gameState: ChessGameState, color: 'white' | 'black'): boolean {
    // Find the king
    let kingSquare: string | null = null;
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.type === 'king' && piece.color === color) {
        kingSquare = square;
        break;
      }
    }

    if (!kingSquare) return false;

    // Check if any opponent piece can attack the king
    const opponentColor = color === 'white' ? 'black' : 'white';
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === opponentColor) {
        const moves = this.getRawMovesForPiece(gameState, square, piece); // Use raw moves to avoid recursion
        if (moves.includes(kingSquare)) {
          return true;
        }
      }
    }

    return false;
  }

  private getValidMovesForPiece(
    gameState: ChessGameState,
    fromSquare: string,
    piece: ChessPiece,
    gameRules?: string[],
    checkForCheck: boolean = true
  ): string[] {
    let moves: string[] = [];

    switch (piece.type) {
      case 'pawn':
        moves = this.getPawnMoves(gameState, fromSquare, piece, gameRules);
        break;
      case 'rook':
        moves = this.getRookMoves(gameState, fromSquare, piece);
        break;
      case 'knight':
        moves = this.getKnightMoves(gameState, fromSquare, piece);
        break;
      case 'bishop':
        moves = this.getBishopMoves(gameState, fromSquare, piece, gameRules);
        break;
      case 'queen':
        moves = this.getQueenMoves(gameState, fromSquare, piece, gameRules);
        break;
      case 'king':
        moves = this.getKingMoves(gameState, fromSquare, piece, gameRules);
        break;
    }

    if (checkForCheck) {
      moves = moves.filter(move => !this.wouldBeInCheck(gameState, fromSquare, move, piece.color));
    }

    return moves;
  }
}
