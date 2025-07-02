import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertMoveSchema } from "@shared/schema";

// Simple chess logic for server-side checkmate detection
function isKingInCheck(gameState: any, color: 'white' | 'black'): boolean {
  // Find the king
  let kingSquare: string | null = null;
  for (const [square, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).type === 'king' && (piece as any).color === color) {
      kingSquare = square;
      break;
    }
  }

  if (!kingSquare) return false;

  // Check if any opponent piece can attack the king
  const opponentColor = color === 'white' ? 'black' : 'white';
  for (const [square, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).color === opponentColor) {
      // Simple attack pattern check (basic implementation)
      if (canAttackSquare(gameState, square, kingSquare, piece as any)) {
        return true;
      }
    }
  }

  return false;
}

function canAttackSquare(gameState: any, fromSquare: string, toSquare: string, piece: any): boolean {
  // Basic attack pattern check - simplified for demonstration
  const fromFile = fromSquare[0];
  const fromRank = fromSquare[1];
  const toFile = toSquare[0];
  const toRank = toSquare[1];
  const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
  const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRankNum = parseInt(fromRank);
  const toRankNum = parseInt(toRank);
  
  const dx = toFileIndex - fromFileIndex;
  const dy = toRankNum - fromRankNum;
  
  switch (piece.type) {
    case 'pawn':
      const direction = piece.color === 'white' ? 1 : -1;
      return dy === direction && Math.abs(dx) === 1;
    case 'rook':
      return (dx === 0 || dy === 0);
    case 'bishop':
      return Math.abs(dx) === Math.abs(dy);
    case 'queen':
      return (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy));
    case 'king':
      return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
    case 'knight':
      return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);
    default:
      return false;
  }
}

function hasLegalMoves(gameState: any, color: 'white' | 'black'): boolean {
  // Simplified check - in a real implementation, this would be more thorough
  for (const [square, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).color === color) {
      // For simplicity, assume there are always legal moves unless it's obvious checkmate
      return true;
    }
  }
  return false;
}

function applyDoubleKnightRule(gameState: any, fromSquare: string, toSquare: string): any {
  const piece = gameState.board[toSquare]; // Piece is now at the destination square
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
    } else {
      // Invalid move - not the required knight
      // Keep the current state unchanged
    }
  } else {
    // First move with a knight
    if (piece?.type === 'knight') {
      // Set up for required second move
      newGameState.doubleKnightMove = {
        knightSquare: toSquare, // Store where the knight moved to
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Create a new game
  app.post("/api/games", async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body);
      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get a specific game
  app.get("/api/games/:id", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update game state (make a move)
  app.post("/api/games/:id/moves", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const moveData = insertMoveSchema.parse({
        ...req.body,
        gameId,
      });

      // Get current game state
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Update the board state by making the move
      let gameState = game.gameState as any;
      const piece = gameState.board[moveData.from];
      const targetPiece = gameState.board[moveData.to];
      
      // Special validation for double knight rule: cannot capture king
      if (game.rules === 'double-knight' && gameState.doubleKnightMove && 
          targetPiece && targetPiece.type === 'king') {
        return res.status(400).json({ message: "Cannot capture king during double knight move" });
      }
      
      // Check for en passant move (capturing) BEFORE resetting enPassantTarget
      const currentEnPassantTarget = gameState.enPassantTarget;
      if (piece && piece.type === 'pawn' && moveData.to === currentEnPassantTarget) {
        // This is an en passant capture
        const captureRank = piece.color === 'white' ? '5' : '4';
        const captureSquare = moveData.to[0] + captureRank;
        delete gameState.board[captureSquare]; // Remove the captured pawn
      }
      
      // Reset en passant target (will be set again if needed)
      gameState.enPassantTarget = null;
      
      // Check for castling before moving the piece
      let isCastling = false;
      if (piece && piece.type === 'king') {
        const fromFile = moveData.from[0];
        const toFile = moveData.to[0];
        
        // Check if this is a castling move (king moves 2 squares)
        if (Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0)) === 2) {
          isCastling = true;
          
          // Move the rook as well
          if (toFile === 'g') {
            // Kingside castling
            const rank = moveData.to[1];
            const rookFrom = `h${rank}`;
            const rookTo = `f${rank}`;
            gameState.board[rookTo] = gameState.board[rookFrom];
            delete gameState.board[rookFrom];
          } else if (toFile === 'c') {
            // Queenside castling
            const rank = moveData.to[1];
            const rookFrom = `a${rank}`;
            const rookTo = `d${rank}`;
            gameState.board[rookTo] = gameState.board[rookFrom];
            delete gameState.board[rookFrom];
          }
        }
      }

      // Move the piece
      gameState.board[moveData.to] = piece;
      delete gameState.board[moveData.from];

      // Update castling rights after moving pieces
      if (piece && piece.type === 'king') {
        if (piece.color === 'white') {
          gameState.castlingRights.whiteKingside = false;
          gameState.castlingRights.whiteQueenside = false;
        } else {
          gameState.castlingRights.blackKingside = false;
          gameState.castlingRights.blackQueenside = false;
        }
      } else if (piece && piece.type === 'rook') {
        // Check which rook moved and disable appropriate castling
        if (moveData.from === 'a1') {
          gameState.castlingRights.whiteQueenside = false;
        } else if (moveData.from === 'h1') {
          gameState.castlingRights.whiteKingside = false;
        } else if (moveData.from === 'a8') {
          gameState.castlingRights.blackQueenside = false;
        } else if (moveData.from === 'h8') {
          gameState.castlingRights.blackKingside = false;
        }
      }
      
      // Check for pawn double move (set en passant target)
      if (piece && piece.type === 'pawn') {
        const fromRank = parseInt(moveData.from[1]);
        const toRank = parseInt(moveData.to[1]);
        
        if (Math.abs(toRank - fromRank) === 2) {
          // Pawn moved two squares, set en passant target
          const enPassantRank = piece.color === 'white' ? '3' : '6';
          gameState.enPassantTarget = moveData.to[0] + enPassantRank;
        }
        
        // Check for pawn promotion
        const shouldPromote = (piece.color === 'white' && toRank === 8) || 
                             (piece.color === 'black' && toRank === 1);
        
        if (shouldPromote) {
          // Extract piece type from moveData.piece (format: "color-pieceType")
          const [_, promotedPieceType] = moveData.piece.split('-');
          gameState.board[moveData.to] = {
            type: promotedPieceType as any,
            color: piece.color
          };
        }
      }
      
      // Update move counters
      if (piece?.type === 'pawn' || moveData.captured) {
        gameState.halfmoveClock = 0; // Reset on pawn move or capture
      } else {
        gameState.halfmoveClock++;
      }
      
      if (game.currentTurn === 'black') {
        gameState.fullmoveNumber++; // Increment after black's move
      }
      
      // Apply special rules before changing turns
      let nextTurn: 'white' | 'black';
      if (game.rules === 'double-knight') {
        gameState = applyDoubleKnightRule(gameState, moveData.from, moveData.to);
        nextTurn = gameState.currentTurn;
      } else {
        // Standard rules - toggle turn normally
        nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
        gameState.currentTurn = nextTurn;
      }
      
      // Check for check, checkmate, and stalemate
      const isCheck = isKingInCheck(gameState, nextTurn);
      const hasMovesAvailable = hasLegalMoves(gameState, nextTurn);
      
      gameState.isCheck = isCheck;
      gameState.isCheckmate = isCheck && !hasMovesAvailable;
      gameState.isStalemate = !isCheck && !hasMovesAvailable;
      
      // Update game state on server (includes the new turn)
      await storage.updateGameState(gameId, gameState);
      
      // Update current turn in database
      await storage.updateGameTurn(gameId, nextTurn);
      
      // Add the move to history
      const move = await storage.addMove(moveData);

      res.json(move);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get game moves
  app.get("/api/games/:id/moves", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const moves = await storage.getGameMoves(gameId);
      res.json(moves);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update game status (resign, draw, etc.)
  app.patch("/api/games/:id/status", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const { status, winner } = req.body;
      const game = await storage.updateGameStatus(gameId, status, winner);
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update captured pieces
  app.patch("/api/games/:id/captured", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const { capturedPieces } = req.body;
      const game = await storage.updateCapturedPieces(gameId, capturedPieces);
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
