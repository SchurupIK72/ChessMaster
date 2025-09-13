import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  shareId: text("share_id").unique(), // Unique identifier for sharing games
  whitePlayerId: integer("white_player_id"),
  blackPlayerId: integer("black_player_id"),
  gameState: jsonb("game_state").$type<ChessGameState>().notNull(),
  currentTurn: text("current_turn").notNull().default("white"),
  status: text("status").notNull().default("waiting"), // waiting, active, completed, draw, resigned
  rules: jsonb("rules").$type<GameRulesArray>().notNull().default(["standard"]),
  moveHistory: jsonb("move_history").notNull().default([]),
  capturedPieces: jsonb("captured_pieces").notNull().default({ white: [], black: [] }),
  gameStartTime: timestamp("game_start_time").defaultNow(),
  gameEndTime: timestamp("game_end_time"),
  winner: text("winner"), // white, black, draw
  drawOfferedBy: text("draw_offered_by"), // white, black, null (tracks who offered draw)
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
  email: true,
  phone: true,
}).extend({
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов")
    .regex(/^[a-zA-Z0-9]+$/, "Пароль должен содержать только английские буквы и цифры"),
  username: z.string().min(2, "Никнейм должен содержать минимум 2 символа")
    .max(50, "Никнейм не может быть длиннее 50 символов"),
  email: z.string().email("Неправильный формат email"),
  phone: z.string().min(10, "Номер телефона должен содержать минимум 10 цифр")
    .max(20, "Номер телефона не может быть длиннее 20 символов"),
});

export const insertGameSchema = createInsertSchema(games).pick({
  shareId: true,
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

export type VoidMeta = {
  // Track whether a player's full turn is halfway done (one sub-move made on a board)
  pending?: { color: 'white' | 'black'; movedBoards: number[] } | null;
  // Transfer tokens per color
  tokens: { white: number; black: number };
  // Count of completed full turns per color (used to award tokens every 10 turns)
  playerTurnCount: { white: number; black: number };
  // Optional per-board summary of terminal statuses for quick render
  boardDone?: Array<{ isCheck: boolean; isCheckmate: boolean; isStalemate: boolean }>;
};

export type BaseBoardState = {
  board: { [square: string]: ChessPiece | null };
  currentTurn: 'white' | 'black';
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  };
  // For Chess960: starting rook squares used for castling (so we can find correct rook)
  castlingRooks?: {
    white: { kingSide: string | null; queenSide: string | null };
    black: { kingSide: string | null; queenSide: string | null };
  };
  enPassantTarget: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  // Meteor shower rule — list of permanently burned squares (cannot be occupied or crossed)
  burnedSquares?: string[];
  // Counter of half-moves since last meteor strike (increments each move when rule is active)
  meteorCounter?: number;
  // For double knight rule
  doubleKnightMove?: {
    knightSquare: string;
    color: 'white' | 'black';
  } | null;
  // For pawn rotation rule - track which pawns have moved
  pawnRotationMoves?: {
    [pawnId: string]: boolean; // true if pawn has made any move (identified by original position)
  };
  // For blink rule - track if kings have used their blink ability
  blinkUsed?: {
    white: boolean;
    black: boolean;
  };
};

export type ChessGameState = BaseBoardState & {
  // Void mode: two independent boards and bookkeeping
  voidMode?: boolean;
  // When void mode is active, contains the two independent board states (non-recursive base)
  voidBoards?: [BaseBoardState, BaseBoardState];
  // Per-void-mode metadata: tokens, pending sub-turn, etc.
  voidMeta?: VoidMeta;
};

export type GameRules = 'standard' | 'double-knight' | 'pawn-rotation' | 'xray-bishop' | 'pawn-wall' | 'blink' | 'fog-of-war' | 'meteor-shower' | 'fischer-random' | 'void';
export type GameRulesArray = GameRules[];
