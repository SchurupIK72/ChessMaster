import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  whitePlayerId: integer("white_player_id"),
  blackPlayerId: integer("black_player_id"),
  gameState: jsonb("game_state").notNull(),
  currentTurn: text("current_turn").notNull().default("white"),
  status: text("status").notNull().default("active"), // active, completed, draw, resigned
  rules: text("rules").notNull().default("standard"),
  moveHistory: jsonb("move_history").notNull().default([]),
  capturedPieces: jsonb("captured_pieces").notNull().default({ white: [], black: [] }),
  gameStartTime: timestamp("game_start_time").defaultNow(),
  gameEndTime: timestamp("game_end_time"),
  winner: text("winner"), // white, black, draw
});

export const moves = pgTable("moves", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  moveNumber: integer("move_number").notNull(),
  player: text("player").notNull(), // white or black
  from: text("from").notNull(),
  to: text("to").notNull(),
  piece: text("piece").notNull(),
  captured: text("captured"),
  special: text("special"), // castling, en_passant, promotion
  fen: text("fen").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertGameSchema = createInsertSchema(games).pick({
  whitePlayerId: true,
  blackPlayerId: true,
  rules: true,
});

export const insertMoveSchema = createInsertSchema(moves).pick({
  gameId: true,
  moveNumber: true,
  player: true,
  from: true,
  to: true,
  piece: true,
  captured: true,
  special: true,
  fen: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;
export type InsertMove = z.infer<typeof insertMoveSchema>;
export type Move = typeof moves.$inferSelect;

// Chess game types
export type ChessPiece = {
  type: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
  color: 'white' | 'black';
};

export type ChessSquare = {
  piece: ChessPiece | null;
  square: string; // e.g., 'e4'
};

export type ChessGameState = {
  board: { [square: string]: ChessPiece | null };
  currentTurn: 'white' | 'black';
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  };
  enPassantTarget: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
};

export type GameRules = 'standard' | 'koth' | 'atomic' | 'threetime' | 'fischer';
