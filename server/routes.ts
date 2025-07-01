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

      // Add the move to history
      const move = await storage.addMove(moveData);
      
      // Update game state and turn
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Toggle turn
      const nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
      await storage.updateGameTurn(gameId, nextTurn);

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
