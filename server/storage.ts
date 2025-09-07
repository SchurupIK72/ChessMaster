import { users, games, moves, type User, type InsertUser, type Game, type InsertGame, type Move, type InsertMove, type ChessGameState, type ChessPiece, type GameRules, type GameRulesArray } from "@shared/schema";
import { generateFischerBackRankFromSeed } from "./chess960";
import { db } from "./db";
import { eq, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game methods
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  getGameByShareId(shareId: string): Promise<Game | undefined>;
  updateGameState(id: number, gameState: ChessGameState): Promise<Game>;
  updateGameStatus(id: number, status: string, winner?: string): Promise<Game>;
  joinGame(shareId: string, playerId: number): Promise<Game>;
  getGamesByPlayer(playerId: number): Promise<Game[]>;
  
  // Move methods
  addMove(move: InsertMove): Promise<Move>;
  getGameMoves(gameId: number): Promise<Move[]>;
  deleteLastMove(gameId: number): Promise<Move | undefined>;
  
  // Chess-specific methods
  updateGameTurn(id: number, turn: 'white' | 'black'): Promise<Game>;
  updateCapturedPieces(id: number, capturedPieces: { white: string[], black: string[] }): Promise<Game>;
  
  // Draw methods
  offerDraw(id: number, player: 'white' | 'black'): Promise<Game>;
  acceptDraw(id: number): Promise<Game>;
  declineDraw(id: number): Promise<Game>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const rulesArray = Array.isArray(insertGame.rules) ? insertGame.rules : 
                      insertGame.rules ? [insertGame.rules] : ['standard'];
    
  const initialGameState: ChessGameState = this.getInitialGameState(rulesArray as GameRulesArray, insertGame.shareId || undefined);
    
    const [game] = await db
      .insert(games)
      .values({
        shareId: insertGame.shareId || null,
        whitePlayerId: insertGame.whitePlayerId || null,
        blackPlayerId: insertGame.blackPlayerId || null,
        gameState: initialGameState,
        rules: rulesArray as GameRulesArray,
        gameStartTime: new Date(),
        status: 'waiting'
      })
      .returning();
    
    return game;
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game || undefined;
  }

  async getGameByShareId(shareId: string): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.shareId, shareId));
    return game || undefined;
  }

  async joinGame(shareId: string, playerId: number): Promise<Game> {
    const game = await this.getGameByShareId(shareId);
    if (!game) {
      throw new Error("Game not found");
    }

    let updateData: Partial<Game> = {};
    
    if (game.whitePlayerId === null) {
      updateData.whitePlayerId = playerId;
    } else if (game.blackPlayerId === null) {
      updateData.blackPlayerId = playerId;
      updateData.status = 'active';
    } else {
      throw new Error("Game is already full");
    }

    const [updatedGame] = await db
      .update(games)
      .set(updateData)
      .where(eq(games.shareId, shareId))
      .returning();
    
    return updatedGame;
  }

  async updateGameState(id: number, gameState: ChessGameState): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({ gameState })
      .where(eq(games.id, id))
      .returning();
    
    return game;
  }

  async updateGameStatus(id: number, status: string, winner?: string): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({ 
        status,
        winner: winner || null,
        gameEndTime: new Date()
      })
      .where(eq(games.id, id))
      .returning();
    
    return game;
  }

  async getGamesByPlayer(playerId: number): Promise<Game[]> {
    const gamesList = await db
      .select()
      .from(games)
      .where(
        or(
          eq(games.whitePlayerId, playerId),
          eq(games.blackPlayerId, playerId)
        )
      );
    
    return gamesList;
  }

  async addMove(insertMove: InsertMove): Promise<Move> {
    const [move] = await db
      .insert(moves)
      .values(insertMove)
      .returning();
    
    return move;
  }

  async getGameMoves(gameId: number): Promise<Move[]> {
    // Сортируем по уникальному id, чтобы порядок всегда был корректным
    const movesList = await db
      .select()
      .from(moves)
      .where(eq(moves.gameId, gameId))
      .orderBy(moves.id);
    return movesList;
  }

  async deleteLastMove(gameId: number): Promise<Move | undefined> {
    const all = await this.getGameMoves(gameId);
    const last = all[all.length - 1];
    if (!last) return undefined;
    await db.delete(moves).where(eq(moves.id, last.id));
    return last;
  }

  async updateGameTurn(id: number, turn: 'white' | 'black'): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({ currentTurn: turn })
      .where(eq(games.id, id))
      .returning();
    
    return game;
  }

  async updateCapturedPieces(id: number, capturedPieces: { white: string[], black: string[] }): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({ capturedPieces })
      .where(eq(games.id, id))
      .returning();
    
    return game;
  }

  private getInitialGameState(rules: GameRulesArray, seed?: string): ChessGameState {
    const initialBoard: { [square: string]: ChessPiece | null } = {};

    const files: string[] = ['a','b','c','d','e','f','g','h'];

    // Helper: generate Fischer Random (Chess960) back rank order
  const useFischer = rules.includes('fischer-random');

    // Build pieces for rank 1 and 8
    let backRankTypes: ChessPiece['type'][];
    if (useFischer) {
      const seedKey = seed || "default-seed";
      backRankTypes = generateFischerBackRankFromSeed(seedKey) as ChessPiece['type'][];
    } else {
      backRankTypes = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
    }

  // Place back ranks
    files.forEach((file, idx) => {
      const t = backRankTypes[idx];
      initialBoard[`${file}1`] = { type: t, color: 'white' };
      initialBoard[`${file}8`] = { type: t, color: 'black' };
    });

    // Pawns
    files.forEach(file => {
      initialBoard[`${file}2`] = { type: 'pawn', color: 'white' };
      initialBoard[`${file}7`] = { type: 'pawn', color: 'black' };
    });

    // Pawn wall extra rows
    if (rules.includes('pawn-wall')) {
      files.forEach(file => {
        initialBoard[`${file}3`] = { type: 'pawn', color: 'white' };
        initialBoard[`${file}6`] = { type: 'pawn', color: 'black' };
      });
    }

    // Compute castling rook mapping for Chess960
    let castlingRooks: ChessGameState['castlingRooks'] | undefined = undefined;
    let rights = { whiteKingside: true, whiteQueenside: true, blackKingside: true, blackQueenside: true } as ChessGameState['castlingRights'];
    if (useFischer) {
      const whiteKingIdx = backRankTypes.findIndex(t => t === 'king');
      const whiteLeftRookIdx = [...backRankTypes].slice(0, whiteKingIdx).lastIndexOf('rook');
      const whiteRightRookIdx = [...backRankTypes].slice(whiteKingIdx + 1).indexOf('rook');
      const wQueenRook = whiteLeftRookIdx >= 0 ? `${files[whiteLeftRookIdx]}1` : null;
      const wKingRook = whiteRightRookIdx >= 0 ? `${files[whiteKingIdx + 1 + whiteRightRookIdx]}1` : null;

      const blackKingIdx = backRankTypes.findIndex(t => t === 'king');
      const blackLeftRookIdx = [...backRankTypes].slice(0, blackKingIdx).lastIndexOf('rook');
      const blackRightRookIdx = [...backRankTypes].slice(blackKingIdx + 1).indexOf('rook');
      const bQueenRook = blackLeftRookIdx >= 0 ? `${files[blackLeftRookIdx]}8` : null;
      const bKingRook = blackRightRookIdx >= 0 ? `${files[blackKingIdx + 1 + blackRightRookIdx]}8` : null;

      castlingRooks = {
        white: { kingSide: wKingRook, queenSide: wQueenRook },
        black: { kingSide: bKingRook, queenSide: bQueenRook },
      };
      rights = {
        whiteKingside: !!wKingRook,
        whiteQueenside: !!wQueenRook,
        blackKingside: !!bKingRook,
        blackQueenside: !!bQueenRook,
      };
    }

    // Return complete initial state
    const state: ChessGameState = {
      board: initialBoard,
      currentTurn: 'white',
      castlingRights: useFischer ? rights : { whiteKingside: true, whiteQueenside: true, blackKingside: true, blackQueenside: true },
      castlingRooks,
      enPassantTarget: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      burnedSquares: [],
      meteorCounter: 0,
      doubleKnightMove: null,
      pawnRotationMoves: {},
      blinkUsed: {
        white: false,
        black: false,
      },
    } as any;

    // If meteor rule not active, fields are harmless; keep defaults
    return state;
  }

  async offerDraw(id: number, player: 'white' | 'black'): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({ drawOfferedBy: player })
      .where(eq(games.id, id))
      .returning();
    
    return game;
  }

  async acceptDraw(id: number): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({ 
        status: 'draw',
        winner: 'draw',
        drawOfferedBy: null,
        gameEndTime: new Date()
      })
      .where(eq(games.id, id))
      .returning();
    
    return game;
  }

  async declineDraw(id: number): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({ drawOfferedBy: null })
      .where(eq(games.id, id))
      .returning();
    
    return game;
  }
}

export const storage = new DatabaseStorage();