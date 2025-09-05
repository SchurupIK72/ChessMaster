import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertMoveSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { ChessGameState, Game } from "@shared/schema";

// Simple chess logic for server-side checkmate detection
function isKingInCheck(gameState: any, color: 'white' | 'black', gameRules?: string[]): boolean {
  // Find the king
  let kingSquare: string | null = null;
  for (const [square, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).type === 'king' && (piece as any).color === color) {
      kingSquare = square;
      break;
    }
  }

  if (!kingSquare) return false;

  // Check if any opponent piece can attack the king
  const opponentColor = color === 'white' ? 'black' : 'white';
  for (const [square, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).color === opponentColor) {
      // Check attack pattern with game rules consideration
      if (canAttackSquare(gameState, square, kingSquare, piece as any, gameRules)) {
        return true;
      }
    }
  }

  return false;
}

// Helper: check if a square is attacked by opponent pieces
function isSquareUnderAttack(gameState: any, square: string, color: 'white' | 'black', gameRules?: string[]): boolean {
  const opponent = color === 'white' ? 'black' : 'white';
  for (const [from, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).color === opponent) {
      if (canAttackSquare(gameState, from, square, piece as any, gameRules)) {
        return true;
      }
    }
  }
  return false;
}

// Robust castling validator: requires rights, clear path, rook present, and no pass-through check
function isValidCastlingMove(
  gameState: any,
  piece: any,
  fromSquare: string,
  toSquare: string,
  gameRules?: string[]
): boolean {
  if (!piece || piece.type !== 'king') return false;

  const color: 'white' | 'black' = piece.color;
  const backRank = color === 'white' ? '1' : '8';
  // King must start on e-file back rank
  if (fromSquare !== `e${backRank}`) return false;

  const toFile = toSquare[0];
  const toRank = toSquare[1];
  if (toRank !== backRank) return false;

  // Determine side
  const isKingSide = toFile === 'g';
  const isQueenSide = toFile === 'c';
  if (!isKingSide && !isQueenSide) return false;

  // Check rights and rook presence
  const rightsKey = (color === 'white'
    ? (isKingSide ? 'whiteKingside' : 'whiteQueenside')
    : (isKingSide ? 'blackKingside' : 'blackQueenside')) as
    'whiteKingside' | 'whiteQueenside' | 'blackKingside' | 'blackQueenside';
  if (!gameState.castlingRights || !gameState.castlingRights[rightsKey]) return false;

  const rookSquare = (isKingSide ? `h${backRank}` : `a${backRank}`);
  const rook = gameState.board[rookSquare];
  if (!rook || rook.type !== 'rook' || rook.color !== color) return false;

  // Path between king and rook must be empty
  const betweenSquares: string[] = [];
  if (isKingSide) {
    betweenSquares.push(`f${backRank}`, `g${backRank}`);
  } else {
    // For queenside, squares between rook and king must be empty: b, c, d
    betweenSquares.push(`b${backRank}`, `c${backRank}`, `d${backRank}`);
  }
  for (const sq of betweenSquares) {
    if (gameState.board[sq]) return false;
    // Cannot castle through burned squares in meteor-shower mode
    if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
      const burned: string[] = gameState.burnedSquares || [];
      if (burned.includes(sq)) return false;
    }
  }

  // King cannot be in check, pass through check, or end in check
  const passThroughSquares = isKingSide ? [`e${backRank}`, `f${backRank}`, `g${backRank}`]
                                        : [`e${backRank}`, `d${backRank}`, `c${backRank}`];
  for (const sq of passThroughSquares) {
    if (isSquareUnderAttack(gameState, sq, color, gameRules)) return false;
    if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
      const burned: string[] = gameState.burnedSquares || [];
      if (burned.includes(sq)) return false;
    }
  }

  return true;
}

function canAttackSquare(gameState: any, fromSquare: string, toSquare: string, piece: any, gameRules?: string[]): boolean {
  const fromFile = fromSquare[0];
  const fromRank = fromSquare[1];
  const toFile = toSquare[0];
  const toRank = toSquare[1];
  const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
  const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRankNum = parseInt(fromRank);
  const toRankNum = parseInt(toRank);
  
  const dx = toFileIndex - fromFileIndex;
  const dy = toRankNum - fromRankNum;
  
  switch (piece.type) {
    case 'pawn':
      const direction = piece.color === 'white' ? 1 : -1;
      return dy === direction && Math.abs(dx) === 1;
    
    case 'rook':
      if (dx === 0 || dy === 0) {
        // Check if path is clear
        const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
        const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
        let checkX = fromFileIndex + stepX;
        let checkY = fromRankNum + stepY;
        
        while (checkX !== toFileIndex || checkY !== toRankNum) {
          const checkSquare = String.fromCharCode(checkX + 'a'.charCodeAt(0)) + checkY;
          if (gameState.board[checkSquare]) return false;
          checkX += stepX;
          checkY += stepY;
        }
        return true;
      }
      return false;
    
    case 'bishop':
      if (Math.abs(dx) === Math.abs(dy)) {
        // Проверяем диагональный путь
        const stepX = dx / Math.abs(dx);
        const stepY = dy / Math.abs(dy);
        let checkX = fromFileIndex + stepX;
        let checkY = fromRankNum + stepY;
        let piecesEncountered = 0;
        
        while (checkX !== toFileIndex || checkY !== toRankNum) {
          const checkSquare = String.fromCharCode(checkX + 'a'.charCodeAt(0)) + checkY;
          if (gameState.board[checkSquare]) {
            piecesEncountered++;
          }
          checkX += stepX;
          checkY += stepY;
        }
        
        // Стандартный ход или рентген-ход через одну фигуру
        if (piecesEncountered === 0) {
          return true; // Стандартный ход
        } else if (piecesEncountered === 1) {
          // Рентген-ход доступен только при включенном правиле xray-bishop
          return !!(gameRules && gameRules.includes('xray-bishop'));
        }
        return false;
      }
      return false;
    
    case 'queen':
      return (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && 
             canAttackSquare(gameState, fromSquare, toSquare, { ...piece, type: dx === 0 || dy === 0 ? 'rook' : 'bishop' });
    
    case 'knight':
      return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);
    case 'king':
      return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    
    default:
      return false;
  }
}

function hasLegalMoves(gameState: any, color: 'white' | 'black', gameRules?: string[]): boolean {
  // Check each piece of the current player
  for (const [fromSquare, piece] of Object.entries(gameState.board)) {
    if (piece && (piece as any).color === color) {
      // Get possible moves for this piece
      const possibleMoves = getPossibleMoves(gameState, fromSquare, piece as any, gameRules);
      
      // Check if any move is legal (doesn't leave king in check)
      for (const toSquare of possibleMoves) {
        if (isMoveLegal(gameState, fromSquare, toSquare, color, gameRules)) {
          return true;
        }
      }
    }
  }
  return false;
}

function getPossibleMoves(gameState: any, fromSquare: string, piece: any, gameRules?: string[]): string[] {
  const moves: string[] = [];
  const fromFile = fromSquare[0];
  const fromRank = fromSquare[1];
  const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRankNum = parseInt(fromRank);

  switch (piece.type) {
    case 'pawn':
      const direction = piece.color === 'white' ? 1 : -1;
      const startRank = piece.color === 'white' ? 2 : 7;
      
      // One square forward
      const oneForward = `${fromFile}${fromRankNum + direction}`;
      if (fromRankNum + direction >= 1 && fromRankNum + direction <= 8 && !gameState.board[oneForward]) {
        // Meteor-shower: cannot step onto burned squares
        if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
          const burned: string[] = gameState.burnedSquares || [];
          if (burned.includes(oneForward)) {
            // cannot move forward onto burned square
          } else {
            moves.push(oneForward);
          }
        } else {
          moves.push(oneForward);
        }
        
        // Two squares forward from starting position (only if pawn hasn't moved)
        let canDoubleMoveForward = fromRankNum === startRank;
        
        // In pawn-wall mode, pawns on 3rd rank (white) and 6th rank (black) can also double move
        if (gameRules && gameRules.includes('pawn-wall')) {
          const pawnWallStartRank = piece.color === 'white' ? 3 : 6;
          canDoubleMoveForward = canDoubleMoveForward || fromRankNum === pawnWallStartRank;
        }
        
        // In PawnRotation mode, pawns can always make double moves (no restrictions)
        if (gameRules && gameRules.includes('pawn-rotation')) {
          canDoubleMoveForward = true;
        }
        
        if (canDoubleMoveForward) {
          const twoForward = `${fromFile}${fromRankNum + 2 * direction}`;
          if (!gameState.board[twoForward]) {
            // Meteor-shower: intermediate and target must not be burned
            if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
              const burned: string[] = gameState.burnedSquares || [];
              if (!burned.includes(oneForward) && !burned.includes(twoForward)) {
                moves.push(twoForward);
              }
            } else {
              moves.push(twoForward);
            }
          }
        }
      }
      
      // Diagonal captures
      for (const dx of [-1, 1]) {
        const captureFile = String.fromCharCode(fromFileIndex + dx + 'a'.charCodeAt(0));
        if (captureFile >= 'a' && captureFile <= 'h') {
          const captureSquare = `${captureFile}${fromRankNum + direction}`;
          const targetPiece = gameState.board[captureSquare];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(captureSquare);
          }
          // En passant capture
          if (captureSquare === gameState.enPassantTarget) {
            moves.push(captureSquare);
          }
        }
      }
      
      // PawnRotation rule: horizontal moves
      if (gameRules && gameRules.includes('pawn-rotation')) {
        const pawnRotationMoves = gameState.pawnRotationMoves || {};
        
        // In PawnRotation mode, no restrictions on double horizontal moves
        
        // Horizontal moves (left and right)
        for (const dx of [-1, 1]) {
          const newFile = String.fromCharCode(fromFileIndex + dx + 'a'.charCodeAt(0));
          if (newFile >= 'a' && newFile <= 'h') {
            const horizontalSquare = `${newFile}${fromRankNum}`;
            const targetPiece = gameState.board[horizontalSquare];
            
            if (!targetPiece) {
              // Meteor-shower: cannot move onto burned squares
              if (!(Array.isArray(gameRules) && gameRules.includes('meteor-shower') && (gameState.burnedSquares || []).includes(horizontalSquare))) {
                moves.push(horizontalSquare);
              }
              
              // Allow 2-square horizontal move (always available in PawnRotation mode)
              const newFile2 = String.fromCharCode(fromFileIndex + 2 * dx + 'a'.charCodeAt(0));
              if (newFile2 >= 'a' && newFile2 <= 'h') {
                const horizontalSquare2 = `${newFile2}${fromRankNum}`;
                const targetPiece2 = gameState.board[horizontalSquare2];
                if (!targetPiece2) {
                  // Meteor-shower: intermediate and target must not be burned
                  const burned: string[] = (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) ? (gameState.burnedSquares || []) : [];
                  if (!(burned.includes(horizontalSquare) || burned.includes(horizontalSquare2))) {
                    moves.push(horizontalSquare2);
                  }
                }
              }
            }
          }
        }
        
        // Horizontal captures (including en passant)
        for (const dx of [-1, 1]) {
          const captureFile = String.fromCharCode(fromFileIndex + dx + 'a'.charCodeAt(0));
          if (captureFile >= 'a' && captureFile <= 'h') {
            const captureSquare = `${captureFile}${fromRankNum}`;
            const targetPiece = gameState.board[captureSquare];
            if (targetPiece && targetPiece.color !== piece.color) {
              moves.push(captureSquare);
            }
            // Horizontal en passant capture
            if (captureSquare === gameState.enPassantTarget) {
              moves.push(captureSquare);
            }
          }
        }
      }
      break;
      
    case 'rook':
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        for (let i = 1; i < 8; i++) {
          const newFile = fromFileIndex + dx * i;
          const newRank = fromRankNum + dy * i;
          
          if (newFile < 0 || newFile >= 8 || newRank < 1 || newRank > 8) break;
          
          const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
          // Meteor-shower: burned squares are impassable
          if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
            const burned: string[] = gameState.burnedSquares || [];
            if (burned.includes(newSquare)) break;
          }
          const targetPiece = gameState.board[newSquare];
          
          if (!targetPiece) {
            moves.push(newSquare);
          } else {
            if (targetPiece.color !== piece.color) {
              moves.push(newSquare);
            }
            break;
          }
        }
      }
      break;
      
    case 'bishop':
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        let piecesEncountered = 0;
        let passedThroughPiece = false;
        
        for (let i = 1; i < 8; i++) {
          const newFile = fromFileIndex + dx * i;
          const newRank = fromRankNum + dy * i;
          
          if (newFile < 0 || newFile >= 8 || newRank < 1 || newRank > 8) break;
          
          const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
          // Meteor-shower: burned squares are impassable
          if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
            const burned: string[] = gameState.burnedSquares || [];
            if (burned.includes(newSquare)) break;
          }
          const targetPiece = gameState.board[newSquare];
          
          if (!targetPiece) {
            moves.push(newSquare);
          } else {
            piecesEncountered++;
            
            if (piecesEncountered === 1) {
              // Первая фигура - можем захватить если вражеская
              if (targetPiece.color !== piece.color) {
                moves.push(newSquare);
              }
              // При рентген-правиле продолжаем движение
              if (gameRules && gameRules.includes('xray-bishop')) {
                passedThroughPiece = true;
                continue;
              } else {
                break;
              }
            } else if (piecesEncountered === 2 && passedThroughPiece) {
              // Вторая фигура при рентгене - можем захватить если вражеская
              if (targetPiece.color !== piece.color) {
                moves.push(newSquare);
              }
              break;
            } else {
              break;
            }
          }
        }
      }
      break;
      
    case 'queen':
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i < 8; i++) {
          const newFile = fromFileIndex + dx * i;
          const newRank = fromRankNum + dy * i;
          
          if (newFile < 0 || newFile >= 8 || newRank < 1 || newRank > 8) break;
          
          const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
          // Meteor-shower: burned squares are impassable
          if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
            const burned: string[] = gameState.burnedSquares || [];
            if (burned.includes(newSquare)) break;
          }
          const targetPiece = gameState.board[newSquare];
          
          if (!targetPiece) {
            moves.push(newSquare);
          } else {
            if (targetPiece.color !== piece.color) {
              moves.push(newSquare);
            }
            break;
          }
        }
      }
      break;
      
    case 'knight':
      for (const [dx, dy] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        const newFile = fromFileIndex + dx;
        const newRank = fromRankNum + dy;
        
        if (newFile >= 0 && newFile < 8 && newRank >= 1 && newRank <= 8) {
          const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
          const targetPiece = gameState.board[newSquare];
          
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push(newSquare);
          }
        }
      }
      break;
      
    case 'king':
      // Normal king moves
      for (const [dx, dy] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        const newFile = fromFileIndex + dx;
        const newRank = fromRankNum + dy;
        
        if (newFile >= 0 && newFile < 8 && newRank >= 1 && newRank <= 8) {
          const newSquare = `${String.fromCharCode(newFile + 'a'.charCodeAt(0))}${newRank}`;
          const targetPiece = gameState.board[newSquare];
          
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push(newSquare);
          }
        }
      }
      
      // Blink ability - can teleport to any square once per game
      if (gameRules && gameRules.includes('blink')) {
        const blinkUsed = gameState.blinkUsed || { white: false, black: false };
        if (!blinkUsed[piece.color]) {
          // King can blink to any empty square or capture any enemy piece
          for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
            for (let rankIdx = 1; rankIdx <= 8; rankIdx++) {
              const file = String.fromCharCode(fileIdx + 'a'.charCodeAt(0));
              const square = `${file}${rankIdx}`;
              
              // Skip current position
              if (square === fromSquare) continue;
              
              // Skip if already added as standard move
              if (moves.includes(square)) continue;
              
              const targetPiece = gameState.board[square];
              // Can blink only to empty squares
              if (!targetPiece) {
                moves.push(square);
              }
            }
          }
        }
      }
      break;
  }
  // Filter out moves that land on burned squares (meteor-shower)
  let result = moves;
  if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
    const burned: string[] = gameState.burnedSquares || [];
    result = moves.filter((sq) => !burned.includes(sq));
  }
  return result;
}

function isMoveLegal(gameState: any, fromSquare: string, toSquare: string, color: 'white' | 'black', gameRules?: string[]): boolean {
  // Meteor-shower: cannot move to burned squares
  if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
    const burned: string[] = gameState.burnedSquares || [];
    if (burned.includes(toSquare)) return false;
  }
  // Double knight rule: special logic for first move
  if (Array.isArray(gameRules) && gameRules.includes('double-knight')) {
    // Первый ход конём
    if (!gameState.doubleKnightMove) {
      const piece = gameState.board[fromSquare];
      if (piece && piece.type === 'knight' && piece.color === color) {
        // Симулируем первый ход
        const firstStepState = JSON.parse(JSON.stringify(gameState));
        firstStepState.board[toSquare] = piece;
        delete firstStepState.board[fromSquare];
        firstStepState.doubleKnightMove = { knightSquare: toSquare, color };
        // Ищем второй ход
        const knightMoves = getPossibleMoves(firstStepState, toSquare, piece, gameRules);
        for (const secondMove of knightMoves) {
          const secondStepState = JSON.parse(JSON.stringify(firstStepState));
          secondStepState.board[secondMove] = secondStepState.board[toSquare];
          delete secondStepState.board[toSquare];
          secondStepState.doubleKnightMove = null;
          secondStepState.currentTurn = color === 'white' ? 'black' : 'white';
          // Проверяем: король не под шахом
          if (!isKingInCheck(secondStepState, color, gameRules)) {
            return true;
          }
          // Или второй ход уничтожает атакующую фигуру
          // Найти атакующую фигуру
          let kingSquare = '';
          for (const [sq, pcRaw] of Object.entries(secondStepState.board)) {
            const pc = pcRaw as any;
            if (pc && pc.type === 'king' && pc.color === color) {
              kingSquare = sq;
              break;
            }
          }
          if (kingSquare) {
            for (const [sq, pcRaw] of Object.entries(secondStepState.board)) {
              const pc = pcRaw as any;
              if (pc && pc.color !== color && canAttackSquare(secondStepState, sq, kingSquare, pc, gameRules)) {
                // Если атакующая фигура была на втором ходе уничтожена
                if (sq === secondMove) {
                  return true;
                }
              }
            }
          }
        }
        return false;
      }
    } else {
      // Второй ход конём: стандартная проверка
      const piece = gameState.board[fromSquare];
      if (piece && piece.type === 'knight' && piece.color === color && gameState.doubleKnightMove.knightSquare === fromSquare) {
        const tempState = JSON.parse(JSON.stringify(gameState));
        tempState.board[toSquare] = piece;
        delete tempState.board[fromSquare];
        tempState.doubleKnightMove = null;
        tempState.currentTurn = color === 'white' ? 'black' : 'white';
        return !isKingInCheck(tempState, color, gameRules);
      }
    }
  }
  // Additional king-specific validation (castling/blink)
  const movingPiece = gameState.board[fromSquare];
  if (movingPiece && movingPiece.type === 'king') {
    const fromCol = fromSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    const toCol = toSquare.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRow = parseInt(fromSquare[1]);
    const toRow = parseInt(toSquare[1]);
    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);
    const sameRank = fromRow === toRow;
    // If trying to move two squares horizontally, ensure it's a valid castling move
    if (colDiff === 2 && rowDiff === 0) {
      if (!isValidCastlingMove(gameState, movingPiece, fromSquare, toSquare, gameRules)) {
        // Not a valid castle; allow Blink if available and destination empty
        const blinkAllowed = Array.isArray(gameRules) && gameRules.includes('blink');
        const blinkUsedState = gameState.blinkUsed || { white: false, black: false };
        const targetPiece = gameState.board[toSquare];
        if (!(blinkAllowed && !blinkUsedState[movingPiece.color] && !targetPiece)) {
          return false;
        }
      }
    } else if (Math.max(colDiff, rowDiff) > 1) {
      // Non-adjacent king move: only allowed as Blink
      const blinkAllowed = Array.isArray(gameRules) && gameRules.includes('blink');
      const blinkUsedState = gameState.blinkUsed || { white: false, black: false };
      const targetPiece = gameState.board[toSquare];
      if (!(blinkAllowed && !blinkUsedState[movingPiece.color] && !targetPiece)) {
        return false;
      }
    }
  }
  // Обычная проверка
  const tempState = JSON.parse(JSON.stringify(gameState));
  const piece = tempState.board[fromSquare];
  tempState.board[toSquare] = piece;
  delete tempState.board[fromSquare];
  return !isKingInCheck(tempState, color, gameRules);
}

function hasLegalKnightMoves(gameState: any, knightSquare: string, color: 'white' | 'black'): boolean {
  const piece = gameState.board[knightSquare];
  if (!piece || piece.type !== 'knight' || piece.color !== color) {
    return false;
  }
  
  // Get all possible knight moves from this square
  const knightMoves = getPossibleMoves(gameState, knightSquare, piece, ['double-knight']);
  
  // Check if any of these moves is legal (doesn't leave king in check)
  for (const toSquare of knightMoves) {
    if (isMoveLegal(gameState, knightSquare, toSquare, color, ['double-knight'])) {
      return true;
    }
  }
  
  return false;
}

// Centralized function to apply all special rules
function applyAllSpecialRules(gameState: any, rules: string[], fromSquare: string, toSquare: string, piece: any): any {
  let newGameState = { ...gameState };

  if (!Array.isArray(rules)) return newGameState;

  // Apply each rule sequentially
  for (const rule of rules) {
    switch (rule) {
      case 'double-knight':
        newGameState = applyDoubleKnightRule(newGameState, fromSquare, toSquare);
        break;
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
      case 'meteor-shower':
        // After every 5 FULL moves (i.e., on black's move when fullmoveNumber increments)
        if (!newGameState.burnedSquares) newGameState.burnedSquares = [];
        // Keep a UI counter equal to fullmoveNumber for convenience
        newGameState.meteorCounter = newGameState.fullmoveNumber;
  // Trigger when completed full moves is a multiple of 5.
  // Since fullmoveNumber increments after Black's move and denotes the next move number,
  // completed full moves = fullmoveNumber - 1. Condition: (fullmoveNumber - 1) % 5 === 0.
  if (newGameState.fullmoveNumber > 1 && (newGameState.fullmoveNumber - 1) % 5 === 0) {
          // Collect empty, not burned squares
          const candidates: string[] = [];
          for (let r = 1; r <= 8; r++) {
            for (let f = 0; f < 8; f++) {
              const sq = String.fromCharCode('a'.charCodeAt(0) + f) + r;
              if (!newGameState.board[sq] && !newGameState.burnedSquares.includes(sq)) {
                candidates.push(sq);
              }
            }
          }
          if (candidates.length > 0) {
            // Deterministic selection based on fullmoveNumber to keep rebuilds stable
            const idx = (newGameState.fullmoveNumber * 31) % candidates.length;
            const burnedSq = candidates[idx];
            newGameState.burnedSquares.push(burnedSq);
          }
        }
        break;
      case 'standard':
        // Standard rules don't need special handling
        break;
      default:
        console.warn(`Unknown rule: ${rule}`);
        break;
    }
  }

  return newGameState;
}

function applyBlinkRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  if (!piece || piece.type !== 'king') return gameState;

  const newGameState = { ...gameState };
  
  const fromCol = fromSquare.charCodeAt(0) - 'a'.charCodeAt(0);
  const fromRow = parseInt(fromSquare[1]) - 1;
  const toCol = toSquare.charCodeAt(0) - 'a'.charCodeAt(0);
  const toRow = parseInt(toSquare[1]) - 1;
  
  const colDiff = Math.abs(toCol - fromCol);
  const rowDiff = Math.abs(toRow - fromRow);
  
  // Check if this is castling (king moves 2 squares horizontally on the same rank)
  const isCastling = (colDiff === 2 && rowDiff === 0);
  
  // Check if this is a blink move (beyond normal king range, but not castling)
  if ((colDiff > 1 || rowDiff > 1) && !isCastling) {
    // Initialize blink tracking if not present
    if (!newGameState.blinkUsed) {
      newGameState.blinkUsed = { white: false, black: false };
    }
    // Mark blink as used for this color
    newGameState.blinkUsed[piece.color] = true;
  }

  return newGameState;
}

function applyPawnRotationRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  if (!piece || piece.type !== 'pawn') return gameState;

  const newGameState = { ...gameState };
  
  // Initialize pawn rotation tracking if not present
  if (!newGameState.pawnRotationMoves) {
    newGameState.pawnRotationMoves = {};
  }
  
  // Track that this pawn has moved
  const fromFile = fromSquare[0];
  const fromRank = parseInt(fromSquare[1]);
  const standardOriginalRank = piece.color === 'white' ? 2 : 7;
  const standardOriginalSquare = `${fromFile}${standardOriginalRank}`;
  
  // Mark the position it moved from
  newGameState.pawnRotationMoves[standardOriginalSquare] = true;

  return newGameState;
}

function applyXrayBishopRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  // X-ray bishop rule doesn't need special state tracking
  // The logic is handled in move validation
  return gameState;
}

function applyPawnWallRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  // Pawn wall rule affects initial setup, not individual moves
  // No special state tracking needed during gameplay
  return gameState;
}

function applyDoubleKnightRule(gameState: any, fromSquare: string, toSquare: string): any {
  const piece = gameState.board[toSquare]; // Piece is now at the destination square
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
    } else {
      // Invalid move - not the required knight
      // Keep the current state unchanged
    }
  } else {
    // First move with a knight
    if (piece?.type === 'knight') {
      // Set up for required second move
      newGameState.doubleKnightMove = {
        knightSquare: toSquare, // Store where the knight moved to
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper: rebuild game state from initial rules and move list
  async function rebuildGameStateFromMoves(game: Game, movesList: any[]): Promise<ChessGameState> {
    // Re-create initial state the same way storage.createGame does
    // We'll start from a fresh initial position using DatabaseStorage private logic replicated here
    const rulesArray = Array.isArray(game.rules) ? game.rules : game.rules ? [game.rules] : ["standard"]; // fallback

    // Minimal initial position builder (mirrors storage.getInitialGameState)
    const initialBoard: { [square: string]: any } = {};
    const standardSetup: { [key: string]: any } = {
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
    for (let file = 'a'.charCodeAt(0); file <= 'h'.charCodeAt(0); file++) {
      const f = String.fromCharCode(file);
      (standardSetup as any)[`${f}2`] = { type: 'pawn', color: 'white' };
      (standardSetup as any)[`${f}7`] = { type: 'pawn', color: 'black' };
    }
    if (rulesArray.includes('pawn-wall')) {
      for (let file = 'a'.charCodeAt(0); file <= 'h'.charCodeAt(0); file++) {
        const f = String.fromCharCode(file);
        (standardSetup as any)[`${f}3`] = { type: 'pawn', color: 'white' };
        (standardSetup as any)[`${f}6`] = { type: 'pawn', color: 'black' };
      }
    }
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 'a'.charCodeAt(0); file <= 'h'.charCodeAt(0); file++) {
        const f = String.fromCharCode(file);
        const sq = `${f}${rank}`;
        initialBoard[sq] = (standardSetup as any)[sq] || null;
      }
    }
    let state: ChessGameState = {
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
  burnedSquares: [],
  meteorCounter: 0,
      doubleKnightMove: null,
      pawnRotationMoves: {},
      blinkUsed: { white: false, black: false }
    };

    // Replay moves through existing logic in this file
    let currentTurn: 'white' | 'black' = 'white';
    for (const mv of movesList) {
      const piece = state.board[mv.from];
      if (!piece) continue;
      // note: using same server logic parts: en passant, castling, blink, promotion, counters, special rules
      // For correctness, reuse fragments from the move handler above
      const targetPiece = state.board[mv.to];
      // en passant capture check
      const currentEnPassantTarget = state.enPassantTarget;
      if (piece.type === 'pawn' && mv.to === currentEnPassantTarget) {
        const targetFile = mv.to[0];
        const targetRank = parseInt(mv.to[1]);
        const fromFile = mv.from[0];
        const fromRank = parseInt(mv.from[1]);
        if (fromRank !== targetRank) {
          const captureRank = piece.color === 'white' ? '5' : '4';
          const captureSquare = targetFile + captureRank;
          delete (state.board as any)[captureSquare];
        } else {
          const leftSquare = String.fromCharCode(fromFile.charCodeAt(0) - 1) + fromRank;
          const rightSquare = String.fromCharCode(fromFile.charCodeAt(0) + 1) + fromRank;
          if (state.board[leftSquare] && state.board[leftSquare]!.color !== piece.color) {
            delete (state.board as any)[leftSquare];
          } else if (state.board[rightSquare] && state.board[rightSquare]!.color !== piece.color) {
            delete (state.board as any)[rightSquare];
          }
        }
      }
      state.enPassantTarget = null;

      // Castling or blink used detection
      let isCastling = false;
      let isBlinkTeleport = false;
      if (piece.type === 'king') {
        const fromFile = mv.from[0];
        const toFile = mv.to[0];
        const fromRank = mv.from[1];
        const toRank = mv.to[1];
        if (isValidCastlingMove(state, piece, mv.from, mv.to, rulesArray as any)) {
          isCastling = true;
        }
        if (!isCastling && Array.isArray(rulesArray) && rulesArray.includes('blink')) {
          const blinkUsed = state.blinkUsed || { white: false, black: false };
          if (!blinkUsed[piece.color]) {
            const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const fromRankNum = parseInt(fromRank);
            const toRankNum = parseInt(toRank);
            const fileDistance = Math.abs(toFileIndex - fromFileIndex);
            const rankDistance = Math.abs(toRankNum - fromRankNum);
            if (Math.max(fileDistance, rankDistance) > 1) isBlinkTeleport = true;
          }
        }
        if (isCastling) {
          if (toFile === 'g') {
            const rank = mv.to[1];
            const rookFrom = `h${rank}`;
            const rookTo = `f${rank}`;
            state.board[rookTo] = state.board[rookFrom];
            delete (state.board as any)[rookFrom];
          } else if (toFile === 'c') {
            const rank = mv.to[1];
            const rookFrom = `a${rank}`;
            const rookTo = `d${rank}`;
            state.board[rookTo] = state.board[rookFrom];
            delete (state.board as any)[rookFrom];
          }
        } else if (isBlinkTeleport) {
          if (!state.blinkUsed) state.blinkUsed = { white: false, black: false };
          state.blinkUsed[piece.color] = true;
        }
      }

      // move piece
      state.board[mv.to] = piece;
      delete (state.board as any)[mv.from];

      // castling rights update
      if (piece.type === 'king') {
        if (piece.color === 'white') {
          state.castlingRights.whiteKingside = false;
          state.castlingRights.whiteQueenside = false;
        } else {
          state.castlingRights.blackKingside = false;
          state.castlingRights.blackQueenside = false;
        }
      } else if (piece.type === 'rook') {
        if (mv.from === 'a1') state.castlingRights.whiteQueenside = false;
        else if (mv.from === 'h1') state.castlingRights.whiteKingside = false;
        else if (mv.from === 'a8') state.castlingRights.blackQueenside = false;
        else if (mv.from === 'h8') state.castlingRights.blackKingside = false;
      }

      // pawn specifics: en passant target and promotion and pawn-rotation tracking
      if (piece.type === 'pawn') {
        const fromRank = parseInt(mv.from[1]);
        const toRank = parseInt(mv.to[1]);
        const fromFile = mv.from[0];
        const toFile = mv.to[0];
        if (Array.isArray(rulesArray) && rulesArray.includes('pawn-rotation')) {
          if (!state.pawnRotationMoves) state.pawnRotationMoves = {} as any;
          const standardOriginalRank = piece.color === 'white' ? 2 : 7;
          const standardOriginalSquare = `${fromFile}${standardOriginalRank}`;
          if (Array.isArray(rulesArray) && rulesArray.includes('pawn-wall')) {
            const pawnWallStartRank = piece.color === 'white' ? 3 : 6;
            const wallOriginalSquare = `${fromFile}${pawnWallStartRank}`;
            if (fromRank === standardOriginalRank) (state.pawnRotationMoves as any)[standardOriginalSquare] = true;
            else if (fromRank === pawnWallStartRank) (state.pawnRotationMoves as any)[wallOriginalSquare] = true;
          } else {
            (state.pawnRotationMoves as any)[standardOriginalSquare] = true;
          }
        }
        if (Math.abs(toRank - fromRank) === 2) {
          const enPassantRank = piece.color === 'white' ? fromRank + 1 : fromRank - 1;
          state.enPassantTarget = toFile + enPassantRank;
        }
        if (Array.isArray(rulesArray) && rulesArray.includes('pawn-rotation')) {
          const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
          const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
          if (Math.abs(toFileIndex - fromFileIndex) === 2 && fromRank === toRank) {
            const enPassantFileIndex = fromFileIndex + (toFileIndex - fromFileIndex) / 2;
            const enPassantFile = String.fromCharCode(enPassantFileIndex + 'a'.charCodeAt(0));
            state.enPassantTarget = enPassantFile + fromRank;
          }
        }
        const shouldPromote = (piece.color === 'white' && toRank === 8) || (piece.color === 'black' && toRank === 1);
        if (shouldPromote && mv.piece) {
          const [, promotedPieceType] = mv.piece.split('-');
          state.board[mv.to] = { type: promotedPieceType, color: piece.color } as any;
        }
      }

      // counters
      if (piece.type === 'pawn' || mv.captured) state.halfmoveClock = 0; else state.halfmoveClock++;
      if (currentTurn === 'black') state.fullmoveNumber++;

      // special rules application
      state = applyAllSpecialRules(state as any, rulesArray as any, mv.from, mv.to, piece) as any;

      // turn
      if (Array.isArray(rulesArray) && rulesArray.includes('double-knight')) {
        currentTurn = (state.currentTurn as any);
      } else {
        currentTurn = currentTurn === 'white' ? 'black' : 'white';
        state.currentTurn = currentTurn;
      }
    }

    // finalize check state
    const nextTurn = state.currentTurn;
    const check = isKingInCheck(state as any, nextTurn as any, rulesArray as any);
    const hasMoves = hasLegalMoves(state as any, nextTurn as any, rulesArray as any);
    state.isCheck = check;
    state.isCheckmate = check && !hasMoves;
    state.isStalemate = !check && !hasMoves;

    return state;
  }
  // Create a new game
  app.post("/api/games", async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body);
      
      // Create a unique player for this game session
      const playerName = `Player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const player = await storage.createUser({
        username: playerName,
        password: 'temp_password',
        email: `${playerName}@temp.com`,
        phone: '0000000000'
      });
      
      // Add player ID to game data
      const gameWithPlayer = {
        ...gameData,
        whitePlayerId: player.id,
        shareId: Math.random().toString(36).substring(2, 8).toUpperCase()
      };
      
      const game = await storage.createGame(gameWithPlayer);
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

  // Get game by share ID
  app.get("/api/games/share/:shareId", async (req, res) => {
    try {
      const shareId = req.params.shareId;
      const game = await storage.getGameByShareId(shareId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Join game by share ID
  app.post("/api/join-game", async (req, res) => {
    try {
      console.log('Join game request:', req.body);
      const { shareId } = req.body;
      
      if (!shareId) {
        return res.status(400).json({ message: "shareId is required" });
      }
      
      // Create a unique player for this game session
      const playerName = `Player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const player = await storage.createUser({
        username: playerName,
        password: 'temp_password',
        email: `${playerName}@temp.com`,
        phone: '0000000000'
      });
      
      console.log('Created player:', player);
      
      const game = await storage.joinGame(shareId, player.id);
      console.log('Joined game:', game);
      res.json(game);
    } catch (error: any) {
      console.error('Join game error:', error);
      res.status(400).json({ message: error.message });
    }
  });
  app.post("/api/games/join/:shareId", async (req, res) => {
    try {
      const shareId = req.params.shareId;
      // Generate new player ID for joining player (will be black)
      const playerId = Math.floor(Math.random() * 1000) + 2; // Ensure different from creator
      const game = await storage.joinGame(shareId, playerId);
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
      let gameState = game.gameState as any;
      const piece = gameState.board[moveData.from];
      const targetPiece = gameState.board[moveData.to];
      
      // Basic validation: cannot capture own pieces
      if (piece && targetPiece && piece.color === targetPiece.color) {
        return res.status(400).json({ message: "Cannot capture your own pieces" });
      }
      
      // Validate piece exists and belongs to current player
      if (!piece || piece.color !== game.currentTurn) {
        return res.status(400).json({ message: "Invalid piece or wrong turn" });
      }
      
      // Validate move is legal (doesn't leave king in check or is allowed by double knight rule)
      if (!isMoveLegal(gameState, moveData.from, moveData.to, game.currentTurn as 'white' | 'black', game.rules as any)) {
        return res.status(400).json({ message: "Illegal move: would leave king in check or no valid double knight sequence" });
      }
      
      // Special validation for double knight rule: cannot capture king
      if (Array.isArray(game.rules) && game.rules.includes('double-knight') && gameState.doubleKnightMove && 
          targetPiece && targetPiece.type === 'king') {
        return res.status(400).json({ message: "Cannot capture king during double knight move" });
      }
      
      // Check for en passant move (capturing) BEFORE resetting enPassantTarget
      const currentEnPassantTarget = gameState.enPassantTarget;
      console.log('Checking en passant:', {
        from: moveData.from,
        to: moveData.to,
        pieceType: piece?.type,
        currentEnPassantTarget,
        isEnPassant: piece && piece.type === 'pawn' && moveData.to === currentEnPassantTarget
      });
      
      if (piece && piece.type === 'pawn' && moveData.to === currentEnPassantTarget) {
        // This is an en passant capture
        const targetFile = moveData.to[0];
        const targetRank = parseInt(moveData.to[1]);
        const fromFile = moveData.from[0];
        const fromRank = parseInt(moveData.from[1]);
        
        console.log('En passant capture detected:', {
          targetFile, targetRank, fromFile, fromRank,
          isVertical: fromRank !== targetRank
        });
        
        // Determine if this is vertical or horizontal en passant
        if (fromRank !== targetRank) {
          // Vertical en passant (standard)
          const captureRank = piece.color === 'white' ? '5' : '4';
          const captureSquare = targetFile + captureRank;
          console.log('Vertical en passant - removing pawn from:', captureSquare);
          delete gameState.board[captureSquare]; // Remove the captured pawn
        } else {
          // Horizontal en passant (PawnRotation mode)
          // The captured pawn is adjacent to our pawn at the same rank
          // We need to find which adjacent pawn made the double move
          const leftSquare = String.fromCharCode(fromFile.charCodeAt(0) - 1) + fromRank;
          const rightSquare = String.fromCharCode(fromFile.charCodeAt(0) + 1) + fromRank;
          
          console.log('Horizontal en passant - checking adjacent squares:', {
            leftSquare,
            rightSquare,
            leftPawn: gameState.board[leftSquare],
            rightPawn: gameState.board[rightSquare]
          });
          
          // Find the adjacent pawn that made the double move
          let captureSquare = null;
          if (gameState.board[leftSquare] && gameState.board[leftSquare].color !== piece.color) {
            captureSquare = leftSquare;
          } else if (gameState.board[rightSquare] && gameState.board[rightSquare].color !== piece.color) {
            captureSquare = rightSquare;
          }
          
          if (captureSquare) {
            console.log('Horizontal en passant - removing pawn from:', captureSquare);
            delete gameState.board[captureSquare]; // Remove the captured pawn
          } else {
            console.log('Warning: No adjacent pawn found for horizontal en passant');
          }
        }
      }
      
      // Reset en passant target (will be set again if needed)
      gameState.enPassantTarget = null;
      
      // Check for castling before moving the piece
      let isCastling = false;
      let isBlinkTeleport = false;
      
      if (piece && piece.type === 'king') {
        const fromFile = moveData.from[0];
        const toFile = moveData.to[0];
        const fromRank = moveData.from[1];
        const toRank = moveData.to[1];
        
        // Check robust castling validation
        if (isValidCastlingMove(gameState, piece, moveData.from, moveData.to, game.rules as any)) {
          isCastling = true;
        }
        
        // Check if this is a Blink teleport (not adjacent square)
        if (!isCastling && game.rules && Array.isArray(game.rules) && game.rules.includes('blink')) {
          const blinkUsed = gameState.blinkUsed || { white: false, black: false };
          if (!blinkUsed[piece.color]) {
            // Check if this is teleportation (distance > 1) or regular king move
            const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const fromRankNum = parseInt(fromRank);
            const toRankNum = parseInt(toRank);
            
            const fileDistance = Math.abs(toFileIndex - fromFileIndex);
            const rankDistance = Math.abs(toRankNum - fromRankNum);
            const maxDistance = Math.max(fileDistance, rankDistance);
            
            // Only consider it Blink if moving more than 1 square
            if (maxDistance > 1) {
              isBlinkTeleport = true;
            }
          }
        }
        
  if (isCastling) {
          // Move the rook as well
          if (toFile === 'g') {
            // Kingside castling
            const rank = moveData.to[1];
            const rookFrom = `h${rank}`;
            const rookTo = `f${rank}`;
            gameState.board[rookTo] = gameState.board[rookFrom];
            delete gameState.board[rookFrom];
          } else if (toFile === 'c') {
            // Queenside castling
            const rank = moveData.to[1];
            const rookFrom = `a${rank}`;
            const rookTo = `d${rank}`;
            gameState.board[rookTo] = gameState.board[rookFrom];
            delete gameState.board[rookFrom];
          }
        } else if (isBlinkTeleport && !isCastling) {
          // Mark Blink as used for this color (but not for castling)
          if (!gameState.blinkUsed) {
            gameState.blinkUsed = { white: false, black: false };
          }
          gameState.blinkUsed[piece.color] = true;
        }
      }

      // Move the piece
      gameState.board[moveData.to] = piece;
      delete gameState.board[moveData.from];

      // Update castling rights after moving pieces
      if (piece && piece.type === 'king') {
        // King loses castling rights after any move (standard chess rules)
        if (piece.color === 'white') {
          gameState.castlingRights.whiteKingside = false;
          gameState.castlingRights.whiteQueenside = false;
        } else {
          gameState.castlingRights.blackKingside = false;
          gameState.castlingRights.blackQueenside = false;
        }
      } else if (piece && piece.type === 'rook') {
        // Check which rook moved and disable appropriate castling
        if (moveData.from === 'a1') {
          gameState.castlingRights.whiteQueenside = false;
        } else if (moveData.from === 'h1') {
          gameState.castlingRights.whiteKingside = false;
        } else if (moveData.from === 'a8') {
          gameState.castlingRights.blackQueenside = false;
        } else if (moveData.from === 'h8') {
          gameState.castlingRights.blackKingside = false;
        }
      }
      
      // Check for pawn moves (set en passant target and track horizontal moves)
      if (piece && piece.type === 'pawn') {
        const fromRank = parseInt(moveData.from[1]);
        const toRank = parseInt(moveData.to[1]);
        const fromFile = moveData.from[0];
        const toFile = moveData.to[0];
        
        // Track pawn moves for PawnRotation rule (any move, not just horizontal)
        if (Array.isArray(game.rules) && game.rules.includes('pawn-rotation')) {
          if (!gameState.pawnRotationMoves) {
            gameState.pawnRotationMoves = {};
          }
          
          // Mark the original starting square of this pawn as having moved
          const standardOriginalRank = piece.color === 'white' ? 2 : 7;
          const standardOriginalSquare = `${fromFile}${standardOriginalRank}`;
          
          // If pawn-wall is enabled, also check if it moved from wall position
          if (Array.isArray(game.rules) && game.rules.includes('pawn-wall')) {
            const pawnWallStartRank = piece.color === 'white' ? 3 : 6;
            const wallOriginalSquare = `${fromFile}${pawnWallStartRank}`;
            
            // Mark the position it actually moved from
            if (fromRank === standardOriginalRank) {
              gameState.pawnRotationMoves[standardOriginalSquare] = true;
            } else if (fromRank === pawnWallStartRank) {
              gameState.pawnRotationMoves[wallOriginalSquare] = true;
            }
          } else {
            // Standard mode - mark original position
            gameState.pawnRotationMoves[standardOriginalSquare] = true;
          }
        }
        
        if (Math.abs(toRank - fromRank) === 2) {
          // Pawn moved two squares vertically, set en passant target
          // The en passant target is the square the pawn "jumped over"
          const enPassantRank = piece.color === 'white' ? fromRank + 1 : fromRank - 1;
          gameState.enPassantTarget = moveData.to[0] + enPassantRank;
          console.log('Vertical double move - set en passant target:', gameState.enPassantTarget);
        }
        
        // Check for horizontal double move in PawnRotation mode
        if (Array.isArray(game.rules) && game.rules.includes('pawn-rotation')) {
          const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
          const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
          
          if (Math.abs(toFileIndex - fromFileIndex) === 2 && fromRank === toRank) {
            // Pawn moved two squares horizontally, set horizontal en passant target
            // The en passant target is the square the pawn "jumped over"
            const enPassantFileIndex = fromFileIndex + (toFileIndex - fromFileIndex) / 2;
            const enPassantFile = String.fromCharCode(enPassantFileIndex + 'a'.charCodeAt(0));
            gameState.enPassantTarget = enPassantFile + fromRank;
            console.log('Horizontal double move - set en passant target:', gameState.enPassantTarget);
          }
        }
        
        // Check for pawn promotion
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
      
      // Update move counters
      if (piece?.type === 'pawn' || moveData.captured) {
        gameState.halfmoveClock = 0; // Reset on pawn move or capture
      } else {
        gameState.halfmoveClock++;
      }
      
      if (game.currentTurn === 'black') {
        gameState.fullmoveNumber++; // Increment after black's move
      }
      
      // Apply all special rules in a centralized manner
      gameState = applyAllSpecialRules(gameState, game.rules as any, moveData.from, moveData.to, piece);
      
      // Determine next turn (some rules like double-knight may override turn logic)
      let nextTurn: 'white' | 'black';
      if (Array.isArray(game.rules) && game.rules.includes('double-knight')) {
        // Double knight rule manages its own turn logic
        nextTurn = gameState.currentTurn;
      } else {
        // Standard rules - toggle turn normally
        nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
        gameState.currentTurn = nextTurn;
      }
      
      // Check for check, checkmate, and stalemate
      const isCheck = isKingInCheck(gameState, nextTurn, game.rules as any);
      let hasMovesAvailable = hasLegalMoves(gameState, nextTurn, game.rules as any);
      
      // Special check for double knight rule stalemate
      if (Array.isArray(game.rules) && game.rules.includes('double-knight') && gameState.doubleKnightMove) {
        // In double knight mode, if player is waiting for second knight move
        // but all possible knight moves would put king in check, it's stalemate
        hasMovesAvailable = hasLegalKnightMoves(gameState, gameState.doubleKnightMove.knightSquare, nextTurn);
      }
      
      gameState.isCheck = isCheck;
      gameState.isCheckmate = isCheck && !hasMovesAvailable;
      gameState.isStalemate = !isCheck && !hasMovesAvailable;
      
      // Update game state on server (includes the new turn)
      await storage.updateGameState(gameId, gameState);
      
      // Update current turn in database
      await storage.updateGameTurn(gameId, nextTurn);
      
      // Add the move to history
      // DoubleKnight: если это второй ход конём подряд, то оба хода должны быть отдельными объектами
      // Проверяем, не был ли предыдущий ход тем же игроком и конём
      let shouldAddMove = true;
      if (Array.isArray(game.rules) && game.rules.includes('double-knight')) {
        const lastMoves = await storage.getGameMoves(gameId);
        const lastMove = lastMoves.length > 0 ? lastMoves[lastMoves.length - 1] : null;
        if (
          lastMove &&
          lastMove.player === moveData.player &&
          lastMove.piece?.includes('knight') &&
          moveData.piece?.includes('knight') &&
          gameState.doubleKnightMove &&
          lastMove.to === gameState.doubleKnightMove.knightSquare
        ) {
          // Это второй ход DoubleKnight, оба хода должны быть в истории
          shouldAddMove = true;
        }
      }
      if (shouldAddMove) {
        await storage.addMove(moveData);
      }
      // Возвращаем весь массив ходов, чтобы клиент всегда получал актуальную историю
      const allMoves = await storage.getGameMoves(gameId);
      res.json(allMoves[allMoves.length - 1]);
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

  // Undo last move
  app.post("/api/games/:id/undo", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const game = await storage.getGame(gameId);
      if (!game) return res.status(404).json({ message: "Game not found" });

      // delete last move
      const deleted = await storage.deleteLastMove(gameId);
      if (!deleted) return res.status(400).json({ message: "No moves to undo" });

      // fetch remaining moves and rebuild state
      const remainingMoves = await storage.getGameMoves(gameId);
      const rebuilt = await rebuildGameStateFromMoves(game as any, remainingMoves);
      await storage.updateGameState(gameId, rebuilt);

      // Update current turn explicitly from rebuilt
      await storage.updateGameTurn(gameId, rebuilt.currentTurn);

      res.json({ success: true, gameState: rebuilt, currentTurn: rebuilt.currentTurn });
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

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Никнейм уже занят' });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email уже зарегистрирован' });
      }

      // Create user
      const user = await storage.createUser({
        username: validatedData.username,
        password: validatedData.password,
        email: validatedData.email,
        phone: validatedData.phone,
      });

      // Create session
      (req as any).session = { userId: user.id };
      
      res.status(201).json({ 
        message: 'Регистрация успешна',
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Ошибка валидации',
          errors: error.errors
        });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Ошибка регистрации' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Никнейм и пароль обязательны' });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Неверный никнейм или пароль' });
      }

      // In a real app, you would hash the password
      if (user.password !== password) {
        return res.status(401).json({ message: 'Неверный никнейм или пароль' });
      }

      // Create a very simple session
      (req as any).session = { userId: user.id };
      
      res.json({ 
        message: 'Авторизация успешна',
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Ошибка авторизации' });
    }
  });

  app.get('/api/auth/session', async (req, res) => {
    const session = (req as any).session;
    if (!session?.userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }
    
    try {
      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(401).json({ message: 'Пользователь не найден' });
      }
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error) {
      console.error('Session error:', error);
      res.status(500).json({ message: 'Ошибка сессии' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    (req as any).session = null;
    res.json({ message: 'Выход выполнен' });
  });

  // Guest user route for anonymous players - simplified without sessions
  app.post('/api/auth/guest', async (req, res) => {
    try {
      // Get a random guest user from pre-created accounts (IDs 12-61 based on the database)
      const guestId = Math.floor(Math.random() * 50) + 12;
      const guestUser = await storage.getUser(guestId);
      
      if (!guestUser) {
        // Fallback: create a new guest user
        const guestUsername = `guest_${Date.now()}`;
        const newGuestUser = await storage.createUser({
          username: guestUsername,
          password: 'guest123',
          email: `${guestUsername}@temp.com`,
          phone: '0000000000'
        });
        
        return res.json({ 
          message: 'Гостевая сессия создана',
          user: { id: newGuestUser.id, username: newGuestUser.username, email: newGuestUser.email },
          success: true
        });
      }
      
      res.json({ 
        message: 'Гостевая сессия создана',
        user: { id: guestUser.id, username: guestUser.username, email: guestUser.email },
        success: true
      });
    } catch (error) {
      console.error('Guest user creation error:', error);
      res.status(500).json({ message: 'Ошибка создания гостевого пользователя' });
    }
  });

  // Draw offer routes
  app.post('/api/games/:id/offer-draw', async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const { player } = req.body;
      
      if (!player || !['white', 'black'].includes(player)) {
        return res.status(400).json({ message: "Invalid player" });
      }
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      // Check if draw already offered by this player
      if (game.drawOfferedBy === player) {
        return res.status(400).json({ message: "Draw already offered by this player" });
      }
      
      const updatedGame = await storage.offerDraw(gameId, player);
      res.json(updatedGame);
    } catch (error) {
      console.error('Error offering draw:', error);
      res.status(500).json({ message: 'Ошибка предложения ничьей' });
    }
  });

  app.post('/api/games/:id/accept-draw', async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (!game.drawOfferedBy) {
        return res.status(400).json({ message: "No draw offer to accept" });
      }
      
      const updatedGame = await storage.acceptDraw(gameId);
      res.json(updatedGame);
    } catch (error) {
      console.error('Error accepting draw:', error);
      res.status(500).json({ message: 'Ошибка принятия ничьей' });
    }
  });

  app.post('/api/games/:id/decline-draw', async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (!game.drawOfferedBy) {
        return res.status(400).json({ message: "No draw offer to decline" });
      }
      
      const updatedGame = await storage.declineDraw(gameId);
      res.json(updatedGame);
    } catch (error) {
      console.error('Error declining draw:', error);
      res.status(500).json({ message: 'Ошибка отклонения ничьей' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
