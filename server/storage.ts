import { users, games, moves, type User, type InsertUser, type Game, type InsertGame, type Move, type InsertMove, type ChessGameState, type ChessPiece, type GameRules, type GameRulesArray } from "@shared/schema";
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
    
    const initialGameState: ChessGameState = this.getInitialGameState(rulesArray as GameRulesArray);
    
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

  private getInitialGameState(rules: GameRulesArray): ChessGameState {
    const initialBoard: { [square: string]: ChessPiece | null } = {};
    
    // Standard initial position
    const standardSetup: { [key: string]: ChessPiece } = {
      'a1': { type: 'rook', color: 'white' },
      'b1': { type: 'knight', color: 'white' },
      'c1': { type: 'bishop', color: 'white' },
      'd1': { type: 'queen', color: 'white' },
      'e1': { type: 'king', color: 'white' },
      'f1': { type: 'bishop', color: 'white' },
      'g1': { type: 'knight', color: 'white' },
      'h1': { type: 'rook', color: 'white' },
      'a8': { type: 'rook', color: 'black' },
      'b8': { type: 'knight', color: 'black' },
      'c8': { type: 'bishop', color: 'black' },
      'd8': { type: 'queen', color: 'black' },
      'e8': { type: 'king', color: 'black' },
      'f8': { type: 'bishop', color: 'black' },
      'g8': { type: 'knight', color: 'black' },
      'h8': { type: 'rook', color: 'black' },
    };

    // Add pawns
    for (let file = 'a'; file <= 'h'; file = String.fromCharCode(file.charCodeAt(0) + 1)) {
      standardSetup[`${file}2`] = { type: 'pawn', color: 'white' };
      standardSetup[`${file}7`] = { type: 'pawn', color: 'black' };
    }

    // Apply pawn wall rule if enabled
    if (rules.includes('pawn-wall')) {
      for (let file = 'a'; file <= 'h'; file = String.fromCharCode(file.charCodeAt(0) + 1)) {
        standardSetup[`${file}3`] = { type: 'pawn', color: 'white' };
        standardSetup[`${file}6`] = { type: 'pawn', color: 'black' };
      }
    }

    // Initialize all squares
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 'a'; file <= 'h'; file = String.fromCharCode(file.charCodeAt(0) + 1)) {
        const square = `${file}${rank}`;
        initialBoard[square] = standardSetup[square] || null;
      }
    }

    return {
      board: initialBoard,
      currentTurn: 'white',
      castlingRights: {
        whiteKingside: true,
        whiteQueenside: true,
        blackKingside: true,
        blackQueenside: true,
      },
      enPassantTarget: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      doubleKnightMove: null,
      pawnRotationMoves: {},
      blinkUsed: {
        white: false,
        black: false,
      },
    };
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