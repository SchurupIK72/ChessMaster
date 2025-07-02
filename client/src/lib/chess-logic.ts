import { ChessGameState, ChessPiece } from "@shared/schema";

export class ChessLogic {
  getValidMoves(gameState: ChessGameState, fromSquare: string): string[] {
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
        moves.push(...this.getPawnMoves(gameState, fromSquare, piece));
        break;
      case 'rook':
        moves.push(...this.getRookMoves(gameState, fromSquare, piece));
        break;
      case 'knight':
        moves.push(...this.getKnightMoves(gameState, fromSquare, piece));
        break;
      case 'bishop':
        moves.push(...this.getBishopMoves(gameState, fromSquare, piece));
        break;
      case 'queen':
        moves.push(...this.getQueenMoves(gameState, fromSquare, piece));
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
  hasLegalMoves(gameState: ChessGameState, color: 'white' | 'black'): boolean {
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === color) {
        const moves = this.getValidMovesForPiece(gameState, square, piece, true);
        if (moves.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Update game state to detect checkmate and stalemate
  updateGameStatus(gameState: ChessGameState): ChessGameState {
    const currentPlayerInCheck = this.isKingInCheck(gameState, gameState.currentTurn);
    const hasLegalMoves = this.hasLegalMoves(gameState, gameState.currentTurn);

    return {
      ...gameState,
      isCheck: currentPlayerInCheck,
      isCheckmate: currentPlayerInCheck && !hasLegalMoves,
      isStalemate: !currentPlayerInCheck && !hasLegalMoves
    };
  }

  private getPawnMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
    const moves: string[] = [];
    const [file, rank] = fromSquare;
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankNum = parseInt(rank);
    const direction = piece.color === 'white' ? 1 : -1;
    const startRank = piece.color === 'white' ? 2 : 7;

    // Forward move
    const oneForward = `${file}${rankNum + direction}`;
    if (this.isValidSquare(oneForward) && !gameState.board[oneForward]) {
      moves.push(oneForward);

      // Two squares forward from starting position
      if (rankNum === startRank) {
        const twoForward = `${file}${rankNum + 2 * direction}`;
        if (this.isValidSquare(twoForward) && !gameState.board[twoForward]) {
          moves.push(twoForward);
        }
      }
    }

    // Captures
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

  private getBishopMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
    const moves: string[] = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

    for (const [dx, dy] of directions) {
      moves.push(...this.getMovesInDirection(gameState, fromSquare, piece, dx, dy));
    }

    return moves;
  }

  private getQueenMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
    return [
      ...this.getRookMoves(gameState, fromSquare, piece),
      ...this.getBishopMoves(gameState, fromSquare, piece)
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

  private getKingMoves(gameState: ChessGameState, fromSquare: string, piece: ChessPiece): string[] {
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

    // TODO: Add castling logic
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
        const moves = this.getValidMovesForPiece(gameState, square, piece, false); // Don't check for check to avoid recursion
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
    checkForCheck: boolean = true
  ): string[] {
    let moves: string[] = [];

    switch (piece.type) {
      case 'pawn':
        moves = this.getPawnMoves(gameState, fromSquare, piece);
        break;
      case 'rook':
        moves = this.getRookMoves(gameState, fromSquare, piece);
        break;
      case 'knight':
        moves = this.getKnightMoves(gameState, fromSquare, piece);
        break;
      case 'bishop':
        moves = this.getBishopMoves(gameState, fromSquare, piece);
        break;
      case 'queen':
        moves = this.getQueenMoves(gameState, fromSquare, piece);
        break;
      case 'king':
        moves = this.getKingMoves(gameState, fromSquare, piece);
        break;
    }

    if (checkForCheck) {
      moves = moves.filter(move => !this.wouldBeInCheck(gameState, fromSquare, move, piece.color));
    }

    return moves;
  }
}
