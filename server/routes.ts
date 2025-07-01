import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertMoveSchema } from "@shared/schema";

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
      const gameState = game.gameState as any;
      const piece = gameState.board[moveData.from];
      
      // Move the piece
      gameState.board[moveData.to] = piece;
      delete gameState.board[moveData.from];
      
      // Check for pawn promotion
      if (piece && piece.type === 'pawn') {
        const toRank = parseInt(moveData.to[1]);
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
      
      // Toggle turn in game state
      const nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
      gameState.currentTurn = nextTurn;
      
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
