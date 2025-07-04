import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertMoveSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";

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
        
        // In PawnRotation mode, pawns can always make double moves (no restrictions)
        if (gameRules && gameRules.includes('pawn-rotation')) {
          canDoubleMoveForward = true;
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
          // En passant capture
          if (captureSquare === gameState.enPassantTarget) {
            moves.push(captureSquare);
          }
        }
      }
      
      // PawnRotation rule: horizontal moves
      if (gameRules && gameRules.includes('pawn-rotation')) {
        const pawnRotationMoves = gameState.pawnRotationMoves || {};
        
        // In PawnRotation mode, no restrictions on double horizontal moves
        
        // Horizontal moves (left and right)
        for (const dx of [-1, 1]) {
          const newFile = String.fromCharCode(fromFileIndex + dx + 'a'.charCodeAt(0));
          if (newFile >= 'a' && newFile <= 'h') {
            const horizontalSquare = `${newFile}${fromRankNum}`;
            const targetPiece = gameState.board[horizontalSquare];
            
            if (!targetPiece) {
              moves.push(horizontalSquare);
              
              // Allow 2-square horizontal move (always available in PawnRotation mode)
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
        
        // Horizontal captures (including en passant)
        for (const dx of [-1, 1]) {
          const captureFile = String.fromCharCode(fromFileIndex + dx + 'a'.charCodeAt(0));
          if (captureFile >= 'a' && captureFile <= 'h') {
            const captureSquare = `${captureFile}${fromRankNum}`;
            const targetPiece = gameState.board[captureSquare];
            if (targetPiece && targetPiece.color !== piece.color) {
              moves.push(captureSquare);
            }
            // Horizontal en passant capture
            if (captureSquare === gameState.enPassantTarget) {
              moves.push(captureSquare);
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
      // Normal king moves
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
      
      // Blink ability - can teleport to any square once per game
      if (gameRules && gameRules.includes('blink')) {
        const blinkUsed = gameState.blinkUsed || { white: false, black: false };
        if (!blinkUsed[piece.color]) {
          // King can blink to any empty square or capture any enemy piece
          for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
            for (let rankIdx = 1; rankIdx <= 8; rankIdx++) {
              const file = String.fromCharCode(fileIdx + 'a'.charCodeAt(0));
              const square = `${file}${rankIdx}`;
              
              // Skip current position
              if (square === fromSquare) continue;
              
              // Skip if already added as standard move
              if (moves.includes(square)) continue;
              
              const targetPiece = gameState.board[square];
              // Can blink only to empty squares
              if (!targetPiece) {
                moves.push(square);
              }
            }
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

// Centralized function to apply all special rules
function applyAllSpecialRules(gameState: any, rules: string[], fromSquare: string, toSquare: string, piece: any): any {
  let newGameState = { ...gameState };

  if (!Array.isArray(rules)) return newGameState;

  // Apply each rule sequentially
  for (const rule of rules) {
    switch (rule) {
      case 'double-knight':
        newGameState = applyDoubleKnightRule(newGameState, fromSquare, toSquare);
        break;
      case 'blink':
        newGameState = applyBlinkRule(newGameState, fromSquare, toSquare, piece);
        break;
      case 'pawn-rotation':
        newGameState = applyPawnRotationRule(newGameState, fromSquare, toSquare, piece);
        break;
      case 'xray-bishop':
        newGameState = applyXrayBishopRule(newGameState, fromSquare, toSquare, piece);
        break;
      case 'pawn-wall':
        newGameState = applyPawnWallRule(newGameState, fromSquare, toSquare, piece);
        break;
      case 'standard':
        // Standard rules don't need special handling
        break;
      default:
        console.warn(`Unknown rule: ${rule}`);
        break;
    }
  }

  return newGameState;
}

function applyBlinkRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  if (!piece || piece.type !== 'king') return gameState;

  const newGameState = { ...gameState };
  
  const fromCol = fromSquare.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRow = parseInt(fromSquare[1]) - 1;
  const toCol = toSquare.charCodeAt(0) - 'a'.charCodeAt(0);
  const toRow = parseInt(toSquare[1]) - 1;
  
  const colDiff = Math.abs(toCol - fromCol);
  const rowDiff = Math.abs(toRow - fromRow);
  
  // Check if this is castling (king moves 2 squares horizontally on the same rank)
  const isCastling = (colDiff === 2 && rowDiff === 0);
  
  // Check if this is a blink move (beyond normal king range, but not castling)
  if ((colDiff > 1 || rowDiff > 1) && !isCastling) {
    // Initialize blink tracking if not present
    if (!newGameState.blinkUsed) {
      newGameState.blinkUsed = { white: false, black: false };
    }
    // Mark blink as used for this color
    newGameState.blinkUsed[piece.color] = true;
  }

  return newGameState;
}

function applyPawnRotationRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  if (!piece || piece.type !== 'pawn') return gameState;

  const newGameState = { ...gameState };
  
  // Initialize pawn rotation tracking if not present
  if (!newGameState.pawnRotationMoves) {
    newGameState.pawnRotationMoves = {};
  }
  
  // Track that this pawn has moved
  const fromFile = fromSquare[0];
  const fromRank = parseInt(fromSquare[1]);
  const standardOriginalRank = piece.color === 'white' ? 2 : 7;
  const standardOriginalSquare = `${fromFile}${standardOriginalRank}`;
  
  // Mark the position it moved from
  newGameState.pawnRotationMoves[standardOriginalSquare] = true;

  return newGameState;
}

function applyXrayBishopRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  // X-ray bishop rule doesn't need special state tracking
  // The logic is handled in move validation
  return gameState;
}

function applyPawnWallRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  // Pawn wall rule affects initial setup, not individual moves
  // No special state tracking needed during gameplay
  return gameState;
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
      
      // Create a unique player for this game session
      const playerName = `Player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const player = await storage.createUser({
        username: playerName,
        password: 'temp_password',
        email: `${playerName}@temp.com`,
        phone: '0000000000'
      });
      
      // Add player ID to game data
      const gameWithPlayer = {
        ...gameData,
        whitePlayerId: player.id,
        shareId: Math.random().toString(36).substring(2, 8).toUpperCase()
      };
      
      const game = await storage.createGame(gameWithPlayer);
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

  // Get game by share ID
  app.get("/api/games/share/:shareId", async (req, res) => {
    try {
      const shareId = req.params.shareId;
      const game = await storage.getGameByShareId(shareId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Join game by share ID
  app.post("/api/join-game", async (req, res) => {
    try {
      console.log('Join game request:', req.body);
      const { shareId } = req.body;
      
      if (!shareId) {
        return res.status(400).json({ message: "shareId is required" });
      }
      
      // Create a unique player for this game session
      const playerName = `Player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const player = await storage.createUser({
        username: playerName,
        password: 'temp_password',
        email: `${playerName}@temp.com`,
        phone: '0000000000'
      });
      
      console.log('Created player:', player);
      
      const game = await storage.joinGame(shareId, player.id);
      console.log('Joined game:', game);
      res.json(game);
    } catch (error: any) {
      console.error('Join game error:', error);
      res.status(400).json({ message: error.message });
    }
  });
  app.post("/api/games/join/:shareId", async (req, res) => {
    try {
      const shareId = req.params.shareId;
      // Generate new player ID for joining player (will be black)
      const playerId = Math.floor(Math.random() * 1000) + 2; // Ensure different from creator
      const game = await storage.joinGame(shareId, playerId);
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
      
      // Basic validation: cannot capture own pieces
      if (piece && targetPiece && piece.color === targetPiece.color) {
        return res.status(400).json({ message: "Cannot capture your own pieces" });
      }
      
      // Validate piece exists and belongs to current player
      if (!piece || piece.color !== game.currentTurn) {
        return res.status(400).json({ message: "Invalid piece or wrong turn" });
      }
      
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
        const targetFile = moveData.to[0];
        const targetRank = parseInt(moveData.to[1]);
        const fromFile = moveData.from[0];
        const fromRank = parseInt(moveData.from[1]);
        
        // Determine if this is vertical or horizontal en passant
        if (fromRank !== targetRank) {
          // Vertical en passant (standard)
          const captureRank = piece.color === 'white' ? '5' : '4';
          const captureSquare = targetFile + captureRank;
          delete gameState.board[captureSquare]; // Remove the captured pawn
        } else {
          // Horizontal en passant (PawnRotation mode)
          // The captured pawn is NOT at the target square - it's at the square the attacking pawn "jumped over"
          const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
          const targetFileIndex = targetFile.charCodeAt(0) - 'a'.charCodeAt(0);
          
          // The captured pawn is between the from and to squares (the "jumped over" square)
          const capturedFileIndex = fromFileIndex + (targetFileIndex - fromFileIndex) / 2;
          const capturedFile = String.fromCharCode(capturedFileIndex + 'a'.charCodeAt(0));
          const captureSquare = capturedFile + targetRank;
          delete gameState.board[captureSquare]; // Remove the captured pawn
        }
      }
      
      // Reset en passant target (will be set again if needed)
      gameState.enPassantTarget = null;
      
      // Check for castling before moving the piece
      let isCastling = false;
      let isBlinkTeleport = false;
      
      if (piece && piece.type === 'king') {
        const fromFile = moveData.from[0];
        const toFile = moveData.to[0];
        const fromRank = moveData.from[1];
        const toRank = moveData.to[1];
        
        // Check if this could be castling (king moves 2 squares on same rank)
        if (Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0)) === 2 && fromRank === toRank) {
          // Additional checks for valid castling
          const backRank = piece.color === 'white' ? '1' : '8';
          const isOnBackRank = fromRank === backRank && toRank === backRank;
          const hasRights = (toFile === 'g' && gameState.castlingRights[piece.color === 'white' ? 'whiteKingside' : 'blackKingside']) ||
                           (toFile === 'c' && gameState.castlingRights[piece.color === 'white' ? 'whiteQueenside' : 'blackQueenside']);
          
          if (isOnBackRank && hasRights) {
            isCastling = true;
          }
        }
        
        // Check if this is a Blink teleport (not adjacent square)
        if (!isCastling && game.rules && Array.isArray(game.rules) && game.rules.includes('blink')) {
          const blinkUsed = gameState.blinkUsed || { white: false, black: false };
          if (!blinkUsed[piece.color]) {
            // Check if this is teleportation (distance > 1) or regular king move
            const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const fromRankNum = parseInt(fromRank);
            const toRankNum = parseInt(toRank);
            
            const fileDistance = Math.abs(toFileIndex - fromFileIndex);
            const rankDistance = Math.abs(toRankNum - fromRankNum);
            const maxDistance = Math.max(fileDistance, rankDistance);
            
            // Only consider it Blink if moving more than 1 square
            if (maxDistance > 1) {
              isBlinkTeleport = true;
            }
          }
        }
        
        if (isCastling) {
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
        } else if (isBlinkTeleport && !isCastling) {
          // Mark Blink as used for this color (but not for castling)
          if (!gameState.blinkUsed) {
            gameState.blinkUsed = { white: false, black: false };
          }
          gameState.blinkUsed[piece.color] = true;
        }
      }

      // Move the piece
      gameState.board[moveData.to] = piece;
      delete gameState.board[moveData.from];

      // Update castling rights after moving pieces
      if (piece && piece.type === 'king') {
        // King loses castling rights after any move (standard chess rules)
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
          
          // Mark the original starting square of this pawn as having moved
          const standardOriginalRank = piece.color === 'white' ? 2 : 7;
          const standardOriginalSquare = `${fromFile}${standardOriginalRank}`;
          
          // If pawn-wall is enabled, also check if it moved from wall position
          if (Array.isArray(game.rules) && game.rules.includes('pawn-wall')) {
            const pawnWallStartRank = piece.color === 'white' ? 3 : 6;
            const wallOriginalSquare = `${fromFile}${pawnWallStartRank}`;
            
            // Mark the position it actually moved from
            if (fromRank === standardOriginalRank) {
              gameState.pawnRotationMoves[standardOriginalSquare] = true;
            } else if (fromRank === pawnWallStartRank) {
              gameState.pawnRotationMoves[wallOriginalSquare] = true;
            }
          } else {
            // Standard mode - mark original position
            gameState.pawnRotationMoves[standardOriginalSquare] = true;
          }
        }
        
        if (Math.abs(toRank - fromRank) === 2) {
          // Pawn moved two squares vertically, set en passant target
          // The en passant target is the square the pawn "jumped over"
          const enPassantRank = piece.color === 'white' ? fromRank + 1 : fromRank - 1;
          gameState.enPassantTarget = moveData.to[0] + enPassantRank;
        }
        
        // Check for horizontal double move in PawnRotation mode
        if (Array.isArray(game.rules) && game.rules.includes('pawn-rotation')) {
          const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
          const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
          
          if (Math.abs(toFileIndex - fromFileIndex) === 2 && fromRank === toRank) {
            // Pawn moved two squares horizontally, set horizontal en passant target
            // The en passant target is the square the pawn "jumped over"
            const enPassantFileIndex = fromFileIndex + (toFileIndex - fromFileIndex) / 2;
            const enPassantFile = String.fromCharCode(enPassantFileIndex + 'a'.charCodeAt(0));
            gameState.enPassantTarget = enPassantFile + fromRank;
          }
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
      
      // Apply all special rules in a centralized manner
      gameState = applyAllSpecialRules(gameState, game.rules as any, moveData.from, moveData.to, piece);
      
      // Determine next turn (some rules like double-knight may override turn logic)
      let nextTurn: 'white' | 'black';
      if (Array.isArray(game.rules) && game.rules.includes('double-knight')) {
        // Double knight rule manages its own turn logic
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

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Никнейм уже занят' });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email уже зарегистрирован' });
      }

      // Create user
      const user = await storage.createUser({
        username: validatedData.username,
        password: validatedData.password,
        email: validatedData.email,
        phone: validatedData.phone,
      });

      // Create session
      (req as any).session = { userId: user.id };
      
      res.status(201).json({ 
        message: 'Регистрация успешна',
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Ошибка валидации',
          errors: error.errors
        });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Ошибка регистрации' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Никнейм и пароль обязательны' });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Неверный никнейм или пароль' });
      }

      // In a real app, you would hash the password
      if (user.password !== password) {
        return res.status(401).json({ message: 'Неверный никнейм или пароль' });
      }

      // Create a very simple session
      (req as any).session = { userId: user.id };
      
      res.json({ 
        message: 'Авторизация успешна',
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Ошибка авторизации' });
    }
  });

  app.get('/api/auth/session', async (req, res) => {
    const session = (req as any).session;
    if (!session?.userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }
    
    try {
      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(401).json({ message: 'Пользователь не найден' });
      }
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error) {
      console.error('Session error:', error);
      res.status(500).json({ message: 'Ошибка сессии' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    (req as any).session = null;
    res.json({ message: 'Выход выполнен' });
  });

  // Guest user route for anonymous players - simplified without sessions
  app.post('/api/auth/guest', async (req, res) => {
    try {
      // Get a random guest user from pre-created accounts (IDs 12-61 based on the database)
      const guestId = Math.floor(Math.random() * 50) + 12;
      const guestUser = await storage.getUser(guestId);
      
      if (!guestUser) {
        // Fallback: create a new guest user
        const guestUsername = `guest_${Date.now()}`;
        const newGuestUser = await storage.createUser({
          username: guestUsername,
          password: 'guest123',
          email: `${guestUsername}@temp.com`,
          phone: '0000000000'
        });
        
        return res.json({ 
          message: 'Гостевая сессия создана',
          user: { id: newGuestUser.id, username: newGuestUser.username, email: newGuestUser.email },
          success: true
        });
      }
      
      res.json({ 
        message: 'Гостевая сессия создана',
        user: { id: guestUser.id, username: guestUser.username, email: guestUser.email },
        success: true
      });
    } catch (error) {
      console.error('Guest user creation error:', error);
      res.status(500).json({ message: 'Ошибка создания гостевого пользователя' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
