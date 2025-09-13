import { ChessGameState, GameRules, GameRulesArray } from "@shared/schema";

export class ChessRules {
  static applySpecialRules(gameState: ChessGameState, rules: GameRulesArray, fromSquare: string, toSquare: string): ChessGameState {
    let newGameState = gameState;
    
    // Apply each rule sequentially
    for (const rule of rules) {
      if (rule === 'double-knight') {
        newGameState = this.applyDoubleKnightRule(newGameState, fromSquare, toSquare);
      } else if (rule === 'blink') {
        newGameState = this.applyBlinkRule(newGameState, fromSquare, toSquare);
      }
      // xray-bishop rule doesn't need special handling in applySpecialRules
      // as it's handled in the move validation logic
    }
    
    return newGameState;
  }

  private static applyBlinkRule(gameState: ChessGameState, fromSquare: string, toSquare: string): ChessGameState {
    const piece = gameState.board[fromSquare];
    const newGameState = { ...gameState };
    
    // Initialize blink tracking if not present
    if (!newGameState.blinkUsed) {
      newGameState.blinkUsed = { white: false, black: false };
    }
    
    // Check if this is a king move that uses blink ability
    if (piece?.type === 'king') {
      // Detect castling, including Chess960: king moves on its back rank to file c or g
      const backRank = piece.color === 'white' ? '1' : '8';
      const isSameRank = fromSquare[1] === toSquare[1];
      const toFile = toSquare[0];
      const isCastling = isSameRank && toSquare[1] === backRank && (toFile === 'c' || toFile === 'g');

      // Blink is any king move beyond one square in any direction that is NOT castling
      const isBlinkMove = this.isBlinkMove(fromSquare, toSquare) && !isCastling;
      if (isBlinkMove) {
        // Mark blink as used for this color
        newGameState.blinkUsed[piece.color] = true;
      }
    }
    
    return newGameState;
  }

  private static isBlinkMove(fromSquare: string, toSquare: string): boolean {
    const fromCol = fromSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRow = parseInt(fromSquare[1]) - 1;
    const toCol = toSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    const toRow = parseInt(toSquare[1]) - 1;
    
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);
    
    // Normal king move is maximum 1 square in any direction
    // Blink move is anything beyond that
    return colDiff > 1 || rowDiff > 1;
  }

  private static applyDoubleKnightRule(gameState: ChessGameState, fromSquare: string, toSquare: string): ChessGameState {
    const piece = gameState.board[fromSquare];
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
      }
    } else {
      // First move with a knight
      if (piece?.type === 'knight') {
        // Set up for required second move
        newGameState.doubleKnightMove = {
          knightSquare: toSquare,
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



  static getInitialPosition(rules: GameRulesArray): { [square: string]: any } {
    const position: { [square: string]: any } = {};
    const files = ['a','b','c','d','e','f','g','h'];

    const useFischer = rules.includes('fischer-random');
    const generateFischerBackRank = (): Array<'rook'|'knight'|'bishop'|'queen'|'king'> => {
      const even = [0,2,4,6];
      const odd = [1,3,5,7];
      const pick = (arr: number[]) => arr.splice(Math.floor(Math.random()*arr.length),1)[0];
      const pos: any[] = new Array(8).fill(null);
      const remaining = [0,1,2,3,4,5,6,7];
      const b1 = pick(even);
      remaining.splice(remaining.indexOf(b1),1);
      pos[b1] = 'bishop';
      const b2 = pick(odd);
      remaining.splice(remaining.indexOf(b2),1);
      pos[b2] = 'bishop';
      const q = pick(remaining);
      pos[q] = 'queen';
      const n1 = pick(remaining);
      pos[n1] = 'knight';
      const n2 = pick(remaining);
      pos[n2] = 'knight';
      remaining.sort((a,b)=>a-b);
      const [rL,k,rR] = remaining;
      pos[rL] = 'rook'; pos[k] = 'king'; pos[rR] = 'rook';
      return pos as any;
    };

    const backRank = useFischer
      ? generateFischerBackRank()
      : ['rook','knight','bishop','queen','king','bishop','knight','rook'];

    files.forEach((f,i)=>{
      position[`${f}1`] = { type: backRank[i], color: 'white' };
      position[`${f}8`] = { type: backRank[i], color: 'black' };
      position[`${f}2`] = { type: 'pawn', color: 'white' };
      position[`${f}7`] = { type: 'pawn', color: 'black' };
    });

    // Add pawn wall modification
    if (rules.includes('pawn-wall')) {
      // Add second row of pawns for white (3rd rank)
      position['a3'] = { type: 'pawn', color: 'white' };
      position['b3'] = { type: 'pawn', color: 'white' };
      position['c3'] = { type: 'pawn', color: 'white' };
      position['d3'] = { type: 'pawn', color: 'white' };
      position['e3'] = { type: 'pawn', color: 'white' };
      position['f3'] = { type: 'pawn', color: 'white' };
      position['g3'] = { type: 'pawn', color: 'white' };
      position['h3'] = { type: 'pawn', color: 'white' };

      // Add second row of pawns for black (6th rank)
      position['a6'] = { type: 'pawn', color: 'black' };
      position['b6'] = { type: 'pawn', color: 'black' };
      position['c6'] = { type: 'pawn', color: 'black' };
      position['d6'] = { type: 'pawn', color: 'black' };
      position['e6'] = { type: 'pawn', color: 'black' };
      position['f6'] = { type: 'pawn', color: 'black' };
      position['g6'] = { type: 'pawn', color: 'black' };
      position['h6'] = { type: 'pawn', color: 'black' };
    }

  return position;
  }
}
