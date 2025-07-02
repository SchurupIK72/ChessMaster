import { users, games, moves, type User, type InsertUser, type Game, type InsertGame, type Move, type InsertMove, type ChessGameState, type GameRules, type GameRulesArray } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game methods
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  updateGameState(id: number, gameState: ChessGameState): Promise<Game>;
  updateGameStatus(id: number, status: string, winner?: string): Promise<Game>;
  getGamesByPlayer(playerId: number): Promise<Game[]>;
  
  // Move methods
  addMove(move: InsertMove): Promise<Move>;
  getGameMoves(gameId: number): Promise<Move[]>;
  
  // Chess-specific methods
  updateGameTurn(id: number, turn: 'white' | 'black'): Promise<Game>;
  updateCapturedPieces(id: number, capturedPieces: { white: string[], black: string[] }): Promise<Game>;
  
  // Multiplayer methods
  getGameByInviteCode(code: string): Promise<Game | undefined>;
  joinGame(gameId: number, playerId: number): Promise<Game>;
  generateInviteCode(): string;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private games: Map<number, Game>;
  private moves: Map<number, Move>;
  private currentUserId: number;
  private currentGameId: number;
  private currentMoveId: number;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.moves = new Map();
    this.currentUserId = 1;
    this.currentGameId = 1;
    this.currentMoveId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = this.currentGameId++;
    const rulesArray = Array.isArray(insertGame.rules) ? insertGame.rules : (insertGame.rules ? [insertGame.rules] : ["standard"]);
    const initialGameState: ChessGameState = this.getInitialGameState(rulesArray);
    
    const game: Game = {
      id,
      whitePlayerId: insertGame.whitePlayerId || null,
      blackPlayerId: insertGame.blackPlayerId || null,
      gameState: initialGameState as any,
      currentTurn: "white",
      status: insertGame.gameType === "multiplayer" ? "waiting" : "active",
      rules: rulesArray,
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      gameStartTime: new Date(),
      gameEndTime: null,
      winner: null,
      inviteCode: insertGame.gameType === "multiplayer" ? this.generateInviteCode() : null,
      gameType: insertGame.gameType || "single",
      creatorId: insertGame.creatorId || null,
    };
    
    this.games.set(id, game);
    return game;
  }

  async getGame(id: number): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async updateGameState(id: number, gameState: ChessGameState): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { ...game, gameState: gameState as any };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  async updateGameStatus(id: number, status: string, winner?: string): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { 
      ...game, 
      status, 
      winner: winner || null,
      gameEndTime: status === "completed" ? new Date() : null
    };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  async getGamesByPlayer(playerId: number): Promise<Game[]> {
    return Array.from(this.games.values()).filter(
      (game) => game.whitePlayerId === playerId || game.blackPlayerId === playerId
    );
  }

  async addMove(insertMove: InsertMove): Promise<Move> {
    const id = this.currentMoveId++;
    const move: Move = {
      id,
      ...insertMove,
      captured: insertMove.captured || null,
      special: insertMove.special || null,
      timestamp: new Date(),
    };
    this.moves.set(id, move);
    return move;
  }

  async getGameMoves(gameId: number): Promise<Move[]> {
    return Array.from(this.moves.values())
      .filter((move) => move.gameId === gameId)
      .sort((a, b) => a.moveNumber - b.moveNumber);
  }

  async updateGameTurn(id: number, turn: 'white' | 'black'): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { ...game, currentTurn: turn };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  async updateCapturedPieces(id: number, capturedPieces: { white: string[], black: string[] }): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { ...game, capturedPieces: capturedPieces as any };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  private getInitialGameState(rules: GameRulesArray): ChessGameState {
    const standardBoard = {
      'a8': { type: 'rook' as const, color: 'black' as const },
      'b8': { type: 'knight' as const, color: 'black' as const },
      'c8': { type: 'bishop' as const, color: 'black' as const },
      'd8': { type: 'queen' as const, color: 'black' as const },
      'e8': { type: 'king' as const, color: 'black' as const },
      'f8': { type: 'bishop' as const, color: 'black' as const },
      'g8': { type: 'knight' as const, color: 'black' as const },
      'h8': { type: 'rook' as const, color: 'black' as const },
      'a7': { type: 'pawn' as const, color: 'black' as const },
      'b7': { type: 'pawn' as const, color: 'black' as const },
      'c7': { type: 'pawn' as const, color: 'black' as const },
      'd7': { type: 'pawn' as const, color: 'black' as const },
      'e7': { type: 'pawn' as const, color: 'black' as const },
      'f7': { type: 'pawn' as const, color: 'black' as const },
      'g7': { type: 'pawn' as const, color: 'black' as const },
      'h7': { type: 'pawn' as const, color: 'black' as const },
      'a2': { type: 'pawn' as const, color: 'white' as const },
      'b2': { type: 'pawn' as const, color: 'white' as const },
      'c2': { type: 'pawn' as const, color: 'white' as const },
      'd2': { type: 'pawn' as const, color: 'white' as const },
      'e2': { type: 'pawn' as const, color: 'white' as const },
      'f2': { type: 'pawn' as const, color: 'white' as const },
      'g2': { type: 'pawn' as const, color: 'white' as const },
      'h2': { type: 'pawn' as const, color: 'white' as const },
      'a1': { type: 'rook' as const, color: 'white' as const },
      'b1': { type: 'knight' as const, color: 'white' as const },
      'c1': { type: 'bishop' as const, color: 'white' as const },
      'd1': { type: 'queen' as const, color: 'white' as const },
      'e1': { type: 'king' as const, color: 'white' as const },
      'f1': { type: 'bishop' as const, color: 'white' as const },
      'g1': { type: 'knight' as const, color: 'white' as const },
      'h1': { type: 'rook' as const, color: 'white' as const },
    };

    // Add pawn wall modification
    if (rules.includes('pawn-wall')) {
      // Add second row of pawns for white (3rd rank)
      (standardBoard as any)['a3'] = { type: 'pawn' as const, color: 'white' as const };
      (standardBoard as any)['b3'] = { type: 'pawn' as const, color: 'white' as const };
      (standardBoard as any)['c3'] = { type: 'pawn' as const, color: 'white' as const };
      (standardBoard as any)['d3'] = { type: 'pawn' as const, color: 'white' as const };
      (standardBoard as any)['e3'] = { type: 'pawn' as const, color: 'white' as const };
      (standardBoard as any)['f3'] = { type: 'pawn' as const, color: 'white' as const };
      (standardBoard as any)['g3'] = { type: 'pawn' as const, color: 'white' as const };
      (standardBoard as any)['h3'] = { type: 'pawn' as const, color: 'white' as const };

      // Add second row of pawns for black (6th rank)
      (standardBoard as any)['a6'] = { type: 'pawn' as const, color: 'black' as const };
      (standardBoard as any)['b6'] = { type: 'pawn' as const, color: 'black' as const };
      (standardBoard as any)['c6'] = { type: 'pawn' as const, color: 'black' as const };
      (standardBoard as any)['d6'] = { type: 'pawn' as const, color: 'black' as const };
      (standardBoard as any)['e6'] = { type: 'pawn' as const, color: 'black' as const };
      (standardBoard as any)['f6'] = { type: 'pawn' as const, color: 'black' as const };
      (standardBoard as any)['g6'] = { type: 'pawn' as const, color: 'black' as const };
      (standardBoard as any)['h6'] = { type: 'pawn' as const, color: 'black' as const };
    }

    // Fill empty squares
    const board: { [square: string]: any } = {};
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 'a'; file <= 'h'; file = String.fromCharCode(file.charCodeAt(0) + 1)) {
        const square = `${file}${rank}`;
        board[square] = (standardBoard as any)[square] || null;
      }
    }

    return {
      board,
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
      pawnRotationMoves: rules.includes('pawn-rotation') ? {} : undefined,
    };
  }

  // Multiplayer methods
  async getGameByInviteCode(code: string): Promise<Game | undefined> {
    return Array.from(this.games.values()).find(game => game.inviteCode === code);
  }

  async joinGame(gameId: number, playerId: number): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    
    if (game.status !== "waiting") {
      throw new Error("Game is not available for joining");
    }

    // Assign player to empty slot
    let updatedGame: Game;
    if (!game.whitePlayerId) {
      updatedGame = { ...game, whitePlayerId: playerId };
    } else if (!game.blackPlayerId) {
      updatedGame = { ...game, blackPlayerId: playerId };
    } else {
      throw new Error("Game is already full");
    }

    // Start game when both players joined
    if (updatedGame.whitePlayerId && updatedGame.blackPlayerId) {
      updatedGame.status = "active";
    }

    this.games.set(gameId, updatedGame);
    return updatedGame;
  }

  generateInviteCode(): string {
    // Generate a random 6-character code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const storage = new MemStorage();
