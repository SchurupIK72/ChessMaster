import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertMoveSchema } from "@shared/schema";

// Simple chess logic for server-side checkmate detection
function isKingInCheck(gameState: any, color: 'white' | 'black', gameRules?: string[]): boolean {
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
      // Check attack pattern with game rules consideration
      if (canAttackSquare(gameState, square, kingSquare, piece as any, gameRules)) {
        return true;
      }
    }
  }

  return false;
}

function canAttackSquare(gameState: any, fromSquare: string, toSquare: string, piece: any, gameRules?: string[]): boolean {
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
      if (dx === 0 || dy === 0) {
        // Check if path is clear
        const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
        const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
        let checkX = fromFileIndex + stepX;
        let checkY = fromRankNum + stepY;
        
        while (checkX !== toFileIndex || checkY !== toRankNum) {
          const checkSquare = String.fromCharCode(checkX + 'a'.charCodeAt(0)) + checkY;
          if (gameState.board[checkSquare]) return false;
          checkX += stepX;
          checkY += stepY;
        }
        return true;
      }
      return false;
    
    case 'bishop':
      if (Math.abs(dx) === Math.abs(dy)) {
        // Проверяем диагональный путь
        const stepX = dx / Math.abs(dx);
        const stepY = dy / Math.abs(dy);
        let checkX = fromFileIndex + stepX;
        let checkY = fromRankNum + stepY;
        let piecesEncountered = 0;
        
        while (checkX !== toFileIndex || checkY !== toRankNum) {
          const checkSquare = String.fromCharCode(checkX + 'a'.charCodeAt(0)) + checkY;
          if (gameState.board[checkSquare]) {
            piecesEncountered++;
          }
          checkX += stepX;
          checkY += stepY;
        }
        
        // Стандартный ход или рентген-ход через одну фигуру
        if (piecesEncountered === 0) {
          return true; // Стандартный ход
        } else if (piecesEncountered === 1) {
          // Рентген-ход доступен только при включенном правиле xray-bishop
          return !!(gameRules && gameRules.includes('xray-bishop'));
        }
        return false;
      }
      return false;
    
    case 'queen':
      return (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && 
             canAttackSquare(gameState, fromSquare, toSquare, { ...piece, type: dx === 0 || dy === 0 ? 'rook' : 'bishop' });
    
    case 'knight':
      return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);
    
    default:
      return false;
  }
}

function hasLegalMoves(gameState: any, color: 'white' | 'black', gameRules?: string[]): boolean {
  // Check each piece of the current player
  for (const [fromSquare, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).color === color) {
      // Get possible moves for this piece
      const possibleMoves = getPossibleMoves(gameState, fromSquare, piece as any, gameRules);
      
      // Check if any move is legal (doesn't leave king in check)
      for (const toSquare of possibleMoves) {
        if (isMoveLegal(gameState, fromSquare, toSquare, color, gameRules)) {
          return true;
        }
      }
    }
  }
  return false;
}

function getPossibleMoves(gameState: any, fromSquare: string, piece: any, gameRules?: string[]): string[] {
  const moves: string[] = [];
  const fromFile = fromSquare[0];
  const fromRank = fromSquare[1];
  const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRankNum = parseInt(fromRank);

  switch (piece.type) {
    case 'pawn':
      const direction = piece.color === 'white' ? 1 : -1;
      const startRank = piece.color === 'white' ? 2 : 7;
      
      // One square forward
      const oneForward = `${fromFile}${fromRankNum + direction}`;
      if (fromRankNum + direction >= 1 && fromRankNum + direction <= 8 && !gameState.board[oneForward]) {
        moves.push(oneForward);
        
        // Two squares forward from starting position (only if pawn hasn't moved)
        let canDoubleMoveForward = fromRankNum === startRank;
        
        // In pawn-wall mode, pawns on 3rd rank (white) and 6th rank (black) can also double move
        if (gameRules && gameRules.includes('pawn-wall')) {
          const pawnWallStartRank = piece.color === 'white' ? 3 : 6;
          canDoubleMoveForward = canDoubleMoveForward || fromRankNum === pawnWallStartRank;
        }
        
        if (gameRules && gameRules.includes('pawn-rotation')) {
          // In PawnRotation mode, check if pawn has moved at all
          const pawnRotationMoves = gameState.pawnRotationMoves || {};
          const originalSquare = `${fromFile}${startRank}`;
          const hasPawnMoved = pawnRotationMoves[originalSquare];
          canDoubleMoveForward = canDoubleMoveForward && !hasPawnMoved;
        }
        
        if (canDoubleMoveForward) {
          const twoForward = `${fromFile}${fromRankNum + 2 * direction}`;
          if (!gameState.board[twoForward]) {
            moves.push(twoForward);
          }
        }
      }
      
      // Diagonal captures
      for (const dx of [-1, 1]) {
        const captureFile = String.fromCharCode(fromFileIndex + dx + 'a'.charCodeAt(0));
        if (captureFile >= 'a' && captureFile <= 'h') {
          const captureSquare = `${captureFile}${fromRankNum + direction}`;
          const targetPiece = gameState.board[captureSquare];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(captureSquare);
          }
        }
      }
      
      // PawnRotation rule: horizontal moves
      if (gameRules && gameRules.includes('pawn-rotation')) {
        const pawnRotationMoves = gameState.pawnRotationMoves || {};
        
        // Generate pawn ID based on original starting position
        const originalRank = piece.color === 'white' ? 2 : 7;
        const originalSquare = `${fromFile}${originalRank}`;
        const hasPawnMoved = pawnRotationMoves[originalSquare];
        
        // Horizontal moves (left and right)
        for (const dx of [-1, 1]) {
          const newFile = String.fromCharCode(fromFileIndex + dx + 'a'.charCodeAt(0));
          if (newFile >= 'a' && newFile <= 'h') {
            const horizontalSquare = `${newFile}${fromRankNum}`;
            const targetPiece = gameState.board[horizontalSquare];
            
            if (!targetPiece) {
              moves.push(horizontalSquare);
              
              // Allow 2-square horizontal move only if pawn hasn't moved at all
              if (!hasPawnMoved) {
                const newFile2 = String.fromCharCode(fromFileIndex + 2 * dx + 'a'.charCodeAt(0));
                if (newFile2 >= 'a' && newFile2 <= 'h') {
                  const horizontalSquare2 = `${newFile2}${fromRankNum}`;
                  const targetPiece2 = gameState.board[horizontalSquare2];
                  if (!targetPiece2) {
                    moves.push(horizontalSquare2);
                  }
                }
              }
            }
          }
        }
      }
      break;
      
    case 'rook':
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        for (let i = 1; i < 8; i++) {
          const newFile = fromFileIndex + dx * i;
          const newRank = fromRankNum + dy * i;
          
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
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        let piecesEncountered = 0;
        let passedThroughPiece = false;
        
        for (let i = 1; i < 8; i++) {
          const newFile = fromFileIndex + dx * i;
          const newRank = fromRankNum + dy * i;
          
          if (newFile < 0 || newFile >= 8 || newRank < 1 || newRank > 8) break;
          
          const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
          const targetPiece = gameState.board[newSquare];
          
          if (!targetPiece) {
            moves.push(newSquare);
          } else {
            piecesEncountered++;
            
            if (piecesEncountered === 1) {
              // Первая фигура - можем захватить если вражеская
              if (targetPiece.color !== piece.color) {
                moves.push(newSquare);
              }
              // При рентген-правиле продолжаем движение
              if (gameRules && gameRules.includes('xray-bishop')) {
                passedThroughPiece = true;
                continue;
              } else {
                break;
              }
            } else if (piecesEncountered === 2 && passedThroughPiece) {
              // Вторая фигура при рентгене - можем захватить если вражеская
              if (targetPiece.color !== piece.color) {
                moves.push(newSquare);
              }
              break;
            } else {
              break;
            }
          }
        }
      }
      break;
      
    case 'queen':
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i < 8; i++) {
          const newFile = fromFileIndex + dx * i;
          const newRank = fromRankNum + dy * i;
          
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
      
    case 'knight':
      for (const [dx, dy] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        const newFile = fromFileIndex + dx;
        const newRank = fromRankNum + dy;
        
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
      for (const [dx, dy] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        const newFile = fromFileIndex + dx;
        const newRank = fromRankNum + dy;
        
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

function isMoveLegal(gameState: any, fromSquare: string, toSquare: string, color: 'white' | 'black', gameRules?: string[]): boolean {
  // Create a temporary game state with the move made
  const tempState = JSON.parse(JSON.stringify(gameState));
  const piece = tempState.board[fromSquare];
  tempState.board[toSquare] = piece;
  delete tempState.board[fromSquare];
  
  // Check if this move leaves the king in check
  return !isKingInCheck(tempState, color, gameRules);
}

function hasLegalKnightMoves(gameState: any, knightSquare: string, color: 'white' | 'black'): boolean {
  const piece = gameState.board[knightSquare];
  if (!piece || piece.type !== 'knight' || piece.color !== color) {
    return false;
  }
  
  // Get all possible knight moves from this square
  const knightMoves = getPossibleMoves(gameState, knightSquare, piece, ['double-knight']);
  
  // Check if any of these moves is legal (doesn't leave king in check)
  for (const toSquare of knightMoves) {
    if (isMoveLegal(gameState, knightSquare, toSquare, color, ['double-knight'])) {
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
      
      // Validate move is legal (doesn't leave king in check)
      if (!isMoveLegal(gameState, moveData.from, moveData.to, game.currentTurn as 'white' | 'black', game.rules as any)) {
        return res.status(400).json({ message: "Illegal move: would leave king in check" });
      }
      
      // Special validation for double knight rule: cannot capture king
      if (Array.isArray(game.rules) && game.rules.includes('double-knight') && gameState.doubleKnightMove && 
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
      
      // Check for pawn moves (set en passant target and track horizontal moves)
      if (piece && piece.type === 'pawn') {
        const fromRank = parseInt(moveData.from[1]);
        const toRank = parseInt(moveData.to[1]);
        const fromFile = moveData.from[0];
        const toFile = moveData.to[0];
        
        // Track pawn moves for PawnRotation rule (any move, not just horizontal)
        if (Array.isArray(game.rules) && game.rules.includes('pawn-rotation')) {
          if (!gameState.pawnRotationMoves) {
            gameState.pawnRotationMoves = {};
          }
          // Mark this pawn as having moved using its original starting position
          const originalRank = piece.color === 'white' ? 2 : 7;
          const originalSquare = `${fromFile}${originalRank}`;
          gameState.pawnRotationMoves[originalSquare] = true;
        }
        
        if (Math.abs(toRank - fromRank) === 2) {
          // Pawn moved two squares, set en passant target
          let enPassantRank;
          if (piece.color === 'white') {
            enPassantRank = fromRank === 2 ? '3' : '4'; // From 2nd rank -> 3, from 3rd rank -> 4
          } else {
            enPassantRank = fromRank === 7 ? '6' : '5'; // From 7th rank -> 6, from 6th rank -> 5
          }
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
      if (Array.isArray(game.rules) && game.rules.includes('double-knight')) {
        gameState = applyDoubleKnightRule(gameState, moveData.from, moveData.to);
        nextTurn = gameState.currentTurn;
      } else {
        // Standard rules - toggle turn normally
        nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
        gameState.currentTurn = nextTurn;
      }
      
      // Check for check, checkmate, and stalemate
      const isCheck = isKingInCheck(gameState, nextTurn, game.rules as any);
      let hasMovesAvailable = hasLegalMoves(gameState, nextTurn, game.rules as any);
      
      // Special check for double knight rule stalemate
      if (Array.isArray(game.rules) && game.rules.includes('double-knight') && gameState.doubleKnightMove) {
        // In double knight mode, if player is waiting for second knight move
        // but all possible knight moves would put king in check, it's stalemate
        hasMovesAvailable = hasLegalKnightMoves(gameState, gameState.doubleKnightMove.knightSquare, nextTurn);
      }
      
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
