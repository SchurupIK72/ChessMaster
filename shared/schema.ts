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
  matchId: text("match_id").notNull().unique(),
  shareId: text("share_id").unique(), // Unique identifier for sharing games
  whitePlayerId: integer("white_player_id"),
  blackPlayerId: integer("black_player_id"),
  gameState: jsonb("game_state").$type<ChessGameState>().notNull(),
  currentTurn: text("current_turn").notNull().default("white"),
  status: text("status").notNull().default("waiting"), // waiting, active, completed, draw, resigned, timeout
  rules: jsonb("rules").$type<GameRulesArray>().notNull().default(["standard"]),
  timeControlSeconds: integer("time_control_seconds").notNull().default(300),
  clockState: jsonb("clock_state").$type<ClockState>().notNull(),
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
  clockState: jsonb("clock_state").$type<ClockState>(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  phone: true,
}).extend({
  password: z.string().min(6, "РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 6 СЃРёРјРІРѕР»РѕРІ")
    .regex(/^[a-zA-Z0-9]+$/, "РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ С‚РѕР»СЊРєРѕ Р°РЅРіР»РёР№СЃРєРёРµ Р±СѓРєРІС‹ Рё С†РёС„СЂС‹"),
  username: z.string().min(2, "РќРёРєРЅРµР№Рј РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 2 СЃРёРјРІРѕР»Р°")
    .max(50, "РќРёРєРЅРµР№Рј РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РґР»РёРЅРЅРµРµ 50 СЃРёРјРІРѕР»РѕРІ"),
  email: z.string().email("РќРµРїСЂР°РІРёР»СЊРЅС‹Р№ С„РѕСЂРјР°С‚ email"),
  phone: z.string().min(10, "РќРѕРјРµСЂ С‚РµР»РµС„РѕРЅР° РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 10 С†РёС„СЂ")
    .max(20, "РќРѕРјРµСЂ С‚РµР»РµС„РѕРЅР° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РґР»РёРЅРЅРµРµ 20 СЃРёРјРІРѕР»РѕРІ"),
});

export const insertGameSchema = createInsertSchema(games).pick({
  shareId: true,
  whitePlayerId: true,
  blackPlayerId: true,
  rules: true,
}).extend({
  matchId: z.string().optional(),
  timeControlSeconds: z.number().int().positive().optional().default(300),
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
  clockState: true,
});

const publicGameRuleValues = [
  "standard",
  "double-knight",
  "pawn-rotation",
  "xray-bishop",
  "pawn-wall",
  "blink",
  "fog-of-war",
  "meteor-shower",
  "fischer-random",
  "void",
] as const;

const boardSquareSchema = z.string().regex(/^[a-h][1-8]$/i);

export const registerRequestSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).regex(/^[a-zA-Z0-9]+$/),
  email: z.string().email(),
  phone: z.string().min(10).max(20),
}).strict();

export const loginRequestSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(1),
}).strict();

export const createGameRequestSchema = z.object({
  rules: z.array(z.enum(publicGameRuleValues)).min(1).default(["standard"]),
  timeControlSeconds: z.number().int().positive().optional().default(300),
}).strict();

export const joinGameRequestSchema = z.object({
  shareId: z.string().min(1).max(64),
}).strict();

const promotionPieceSchema = z.enum(["queen", "rook", "bishop", "knight"]);

export const moveRequestSchema = z.object({
  from: boardSquareSchema,
  to: boardSquareSchema,
  promotion: promotionPieceSchema.optional(),
  boardId: z.union([z.literal(0), z.literal(1)]).optional(),
  voidTransfer: z.object({
    fromBoardId: z.union([z.literal(0), z.literal(1)]),
    fromSquare: boardSquareSchema,
    toBoardId: z.union([z.literal(0), z.literal(1)]),
    toSquare: boardSquareSchema,
    promoted: promotionPieceSchema.optional(),
  }).optional(),
}).strict();

export const offerDrawRequestSchema = z.object({
  player: z.enum(["white", "black"]),
}).strict();

export const gameStatusRequestSchema = z.object({
  status: z.enum(["completed", "draw"]),
  winner: z.enum(["white", "black", "draw"]).optional(),
}).strict();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;
export type InsertMove = z.infer<typeof insertMoveSchema>;
export type Move = typeof moves.$inferSelect;

export type ClockActiveColor = 'white' | 'black' | null;

export type ClockState = {
  whiteRemainingMs: number;
  blackRemainingMs: number;
  activeColor: ClockActiveColor;
  lastUpdatedAt: string | null;
  isPaused: boolean;
};

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
  // Meteor shower rule вЂ” list of permanently burned squares (cannot be occupied or crossed)
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
