import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertMoveSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { ChessUtils } from "@shared/chess-utils";

// Simplified chess logic using shared utilities
function isKingInCheck(gameState: any, color: 'white' | 'black', gameRules?: string[]): boolean {
  const rules = gameRules as any || ['standard'];
  return ChessUtils.isKingInCheck(gameState, color, rules);
}

function hasLegalMoves(gameState: any, color: 'white' | 'black', gameRules?: string[]): boolean {
  const rules = gameRules as any || ['standard'];
  return ChessUtils.hasLegalMoves(gameState, color, rules);
}

function isMoveLegal(gameState: any, fromSquare: string, toSquare: string, color: 'white' | 'black', gameRules?: string[]): boolean {
  const piece = gameState.board[fromSquare];
  if (!piece || piece.color !== color) return false;
  
  const rules = gameRules as any || ['standard'];
  const legalMoves = ChessUtils.getLegalMoves(gameState, fromSquare, rules);
  return legalMoves.includes(toSquare);
}

// Special rules application functions
function applyAllSpecialRules(gameState: any, rules: string[], fromSquare: string, toSquare: string, piece: any): any {
  let newGameState = { ...gameState };
  
  for (const rule of rules) {
    switch (rule) {
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
      case 'double-knight':
        newGameState = applyDoubleKnightRule(newGameState, fromSquare, toSquare);
        break;
    }
  }
  
  return newGameState;
}

function applyBlinkRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  if (piece.type !== 'king') return gameState;
  
  const distance = ChessUtils.getDistance(fromSquare, toSquare);
  const isCastling = Math.abs(fromSquare.charCodeAt(0) - toSquare.charCodeAt(0)) === 2 && 
                    fromSquare[1] === toSquare[1] && piece.type === 'king';
  
  // Only mark as blink if it's a teleport (distance > 1) and not castling
  if (distance > 1 && !isCastling) {
    gameState.blinkUsed = gameState.blinkUsed || { white: false, black: false };
    gameState.blinkUsed[piece.color] = true;
  }
  
  return gameState;
}

function applyPawnRotationRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  if (piece.type !== 'pawn') return gameState;
  
  gameState.pawnRotationMoves = gameState.pawnRotationMoves || {};
  gameState.pawnRotationMoves[fromSquare] = true;
  
  // Handle horizontal en passant
  const [fromFile, fromRank] = ChessUtils.squareToCoords(fromSquare);
  const [toFile, toRank] = ChessUtils.squareToCoords(toSquare);
  
  if (fromRank === toRank && Math.abs(toFile - fromFile) === 2) {
    // Set en passant target for horizontal double move
    const enPassantFile = (fromFile + toFile) / 2;
    gameState.enPassantTarget = ChessUtils.coordsToSquare(enPassantFile, fromRank);
  }
  
  return gameState;
}

function applyXrayBishopRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  // X-ray rule is handled in move validation, no additional state changes needed
  return gameState;
}

function applyPawnWallRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  // Pawn wall rule affects initial setup, no move-specific changes
  return gameState;
}

function applyDoubleKnightRule(gameState: any, fromSquare: string, toSquare: string): any {
  const piece = gameState.board[fromSquare];
  
  if (piece && piece.type === 'knight') {
    if (gameState.doubleKnightMove) {
      // This is the second knight move, clear the flag
      gameState.doubleKnightMove = null;
    } else {
      // This is the first knight move, set up for second move
      gameState.doubleKnightMove = {
        knightSquare: toSquare, // The knight is now at the destination
        color: piece.color
      };
    }
  }
  
  return gameState;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // User authentication routes
  app.post("/api/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь уже существует" });
      }
      
      const user = await storage.createUser(userData);
      res.json({ message: "Пользователь создан", userId: user.id });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Неверные данные" });
      }
      
      res.json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Guest authentication
  app.post("/api/guest-login", async (req, res) => {
    try {
      const guestNumber = Math.floor(Math.random() * 50) + 1;
      const guestUsername = `guest${guestNumber}`;
      
      let user = await storage.getUserByUsername(guestUsername);
      if (!user) {
        user = await storage.createUser({
          username: guestUsername,
          password: "guest123",
          email: `${guestUsername}@example.com`,
          phone: `+7900000${guestNumber.toString().padStart(4, '0')}`
        });
      }
      
      res.json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Game management routes
  app.post("/api/games", async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body);
      
      // Generate share ID for multiplayer games
      if (!gameData.shareId) {
        gameData.shareId = Math.random().toString(36).substr(2, 6).toUpperCase();
      }
      
      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error: any) {
      console.error("Create game error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/games/:id", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: "Игра не найдена" });
      }
      
      res.json(game);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/games/join/:shareId", async (req, res) => {
    try {
      const shareId = req.params.shareId;
      const { playerId } = req.body;
      
      const game = await storage.joinGame(shareId, playerId);
      res.json(game);
    } catch (error: any) {
      console.error("Join game error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Move handling
  app.post("/api/games/:id/moves", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const moveData = req.body;
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Игра не найдена" });
      }

      const gameState = game.gameState as any;
      const piece = gameState.board[moveData.from];

      if (!piece) {
        return res.status(400).json({ message: "Нет фигуры на исходной клетке" });
      }

      // Validate move
      if (!isMoveLegal(gameState, moveData.from, moveData.to, piece.color, game.rules)) {
        return res.status(400).json({ message: "Недопустимый ход" });
      }

      // Create new game state
      let newGameState = JSON.parse(JSON.stringify(gameState));
      
      // Handle captures
      const capturedPiece = newGameState.board[moveData.to];
      if (capturedPiece) {
        newGameState.capturedPieces = newGameState.capturedPieces || { white: [], black: [] };
        const captureColor = capturedPiece.color === 'white' ? 'white' : 'black';
        newGameState.capturedPieces[captureColor].push(capturedPiece.type);
      }

      // Handle en passant capture
      if (piece.type === 'pawn' && newGameState.enPassantTarget === moveData.to) {
        const [epFile, epRank] = ChessUtils.squareToCoords(moveData.to);
        const [fromFile, fromRank] = ChessUtils.squareToCoords(moveData.from);
        
        let capturedPawnSquare;
        if (epRank === fromRank) {
          // Horizontal en passant
          capturedPawnSquare = ChessUtils.coordsToSquare((epFile + fromFile) / 2, epRank);
        } else {
          // Vertical en passant
          const captureRank = piece.color === 'white' ? epRank - 1 : epRank + 1;
          capturedPawnSquare = ChessUtils.coordsToSquare(epFile, captureRank);
        }
        
        const capturedPawn = newGameState.board[capturedPawnSquare];
        if (capturedPawn) {
          newGameState.board[capturedPawnSquare] = null;
          newGameState.capturedPieces = newGameState.capturedPieces || { white: [], black: [] };
          const captureColor = capturedPawn.color === 'white' ? 'white' : 'black';
          newGameState.capturedPieces[captureColor].push('pawn');
        }
      }

      // Make the move
      newGameState.board[moveData.to] = piece;
      newGameState.board[moveData.from] = null;

      // Apply special rules
      newGameState = applyAllSpecialRules(newGameState, game.rules, moveData.from, moveData.to, piece);

      // Switch turns (unless it's a double knight move)
      if (!newGameState.doubleKnightMove) {
        newGameState.currentTurn = newGameState.currentTurn === 'white' ? 'black' : 'white';
      }

      // Update game status
      newGameState = ChessUtils.updateGameStatus(newGameState, game.rules);

      // Update game in storage
      const updatedGame = await storage.updateGameState(gameId, newGameState);

      // Add move to history
      const moveHistory = Array.isArray(game.moveHistory) ? game.moveHistory : [];
      await storage.addMove({
        gameId,
        moveNumber: Math.floor(moveHistory.length / 2) + 1,
        player: piece.color,
        from: moveData.from,
        to: moveData.to,
        piece: piece.type,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", // Simplified FEN
        captured: capturedPiece?.type || null
      });

      res.json(updatedGame);
    } catch (error: any) {
      console.error("Move error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Game status updates
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

  // Draw offer management
  app.post("/api/games/:id/offer-draw", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const { player } = req.body;
      
      const game = await storage.offerDraw(gameId, player);
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/games/:id/accept-draw", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const game = await storage.acceptDraw(gameId);
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/games/:id/decline-draw", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const game = await storage.declineDraw(gameId);
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}