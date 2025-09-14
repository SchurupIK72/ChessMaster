import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertMoveSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { ChessGameState, Game, ChessPiece } from "@shared/schema";
import { generateFischerBackRankFromSeed } from "./chess960";

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

// Robust castling validator (Standard + Chess960): requires rights, clear path, rook present, and no pass-through check
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
  const isFischer = Array.isArray(gameRules) && gameRules.includes('fischer-random');
  // King must start on back rank (any file in Chess960, e-file in standard)
  if (!isFischer) {
    if (fromSquare !== `e${backRank}`) return false;
  } else {
    if (fromSquare[1] !== backRank) return false;
  }

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
  // Determine rook square (Chess960-aware)
  let rookSquare = (isKingSide ? `h${backRank}` : `a${backRank}`);
  if (isFischer && gameState.castlingRooks) {
    const side = isKingSide ? 'kingSide' : 'queenSide';
    const mapped = gameState.castlingRooks[color]?.[side];
    if (!mapped) return false;
    rookSquare = mapped;
  }
  const rook = gameState.board[rookSquare];
  if (!rook || rook.type !== 'rook' || rook.color !== color) return false;

  // Helper to iterate squares horizontally from A to B (exclusive of from, inclusive of to)
  const fileIdx = (f: string) => f.charCodeAt(0) - 'a'.charCodeAt(0);
  const chFromFile = fromSquare[0];
  const chToFile = toSquare[0];
  const step = fileIdx(chToFile) > fileIdx(chFromFile) ? 1 : -1;
  const kingPath: string[] = [];
  for (let x = fileIdx(chFromFile) + step; x !== fileIdx(chToFile) + step; x += step) {
    const f = String.fromCharCode('a'.charCodeAt(0) + x);
    const sq = `${f}${backRank}`;
    kingPath.push(sq);
    if (f === chToFile) break;
  }
  // Squares the king passes through include its final square and intermediates; starting square handled in attack check below
  // King path must be empty, except it may pass the rook square in Chess960
  for (const sq of kingPath) {
    if (sq !== rookSquare && gameState.board[sq]) return false;
    if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
      const burned: string[] = gameState.burnedSquares || [];
      if (burned.includes(sq)) return false;
    }
  }

  // Rook path emptiness (from rookSquare to its final square: f-file for kingside, d-file for queenside)
  const rookTargetFile = isKingSide ? 'f' : 'd';
  const rookStep = fileIdx(rookTargetFile) > fileIdx(rookSquare[0]) ? 1 : -1;
  const rookPath: string[] = [];
  for (let x = fileIdx(rookSquare[0]) + rookStep; x !== fileIdx(rookTargetFile) + rookStep; x += rookStep) {
    const f = String.fromCharCode('a'.charCodeAt(0) + x);
    const sq = `${f}${backRank}`;
    rookPath.push(sq);
    if (f === rookTargetFile) break;
  }
  for (const sq of rookPath) {
    // Allow king's starting square to be on rook path; allow rook's own square (already excluded as we start after it)
    if (sq !== fromSquare && gameState.board[sq]) return false;
    if (Array.isArray(gameRules) && gameRules.includes('meteor-shower')) {
      const burned: string[] = gameState.burnedSquares || [];
      if (burned.includes(sq)) return false;
    }
  }

  // King cannot be in check, pass through check, or end in check
  // Build pass-through squares dynamically from king start to target (including start and final)
  const passThroughSquares: string[] = [];
  const startFIdx = fileIdx(chFromFile);
  const endFIdx = fileIdx(chToFile);
  const kStep = endFIdx > startFIdx ? 1 : -1;
  for (let x = startFIdx; x !== endFIdx + kStep; x += kStep) {
    const f = String.fromCharCode('a'.charCodeAt(0) + x);
    passThroughSquares.push(`${f}${backRank}`);
    if (f === chToFile) break;
  }
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
  // In meteor-shower mode, burned squares block line-of-sight for attacks
  const burned: string[] = (Array.isArray(gameRules) && gameRules.includes('meteor-shower'))
    ? (gameState.burnedSquares || [])
    : [];
  
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
          // Burned squares block attacks in meteor-shower mode
          if (burned.length && burned.includes(checkSquare)) return false;
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
          // Burned squares block attacks completely
          if (burned.length && burned.includes(checkSquare)) return false;
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
             canAttackSquare(gameState, fromSquare, toSquare, { ...piece, type: dx === 0 || dy === 0 ? 'rook' : 'bishop' }, gameRules);
    
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
  // Meteor-shower is applied at end-of-turn after fullmoveNumber increments.
  // Here we only ensure fields exist; the actual strike happens later.
  if (!newGameState.burnedSquares) newGameState.burnedSquares = [];
  newGameState.meteorCounter = newGameState.fullmoveNumber;
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

// Trigger a meteor strike at the end of a full move if due
function maybeTriggerMeteor(gameState: any, rules?: string[]) {
  if (!Array.isArray(rules) || !rules.includes('meteor-shower')) return;
  if (!gameState.burnedSquares) gameState.burnedSquares = [];
  // Update counter to reflect current fullmoveNumber
  gameState.meteorCounter = gameState.fullmoveNumber;
  // Strike after every 5 full moves (i.e., after Black's move when fullmoveNumber just incremented)
  if (gameState.fullmoveNumber > 1 && (gameState.fullmoveNumber - 1) % 5 === 0) {
    const candidates: string[] = [];
    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = String.fromCharCode('a'.charCodeAt(0) + f) + r;
        if (!gameState.board[sq] && !gameState.burnedSquares.includes(sq)) {
          candidates.push(sq);
        }
      }
    }
    if (candidates.length > 0) {
      const idx = (gameState.fullmoveNumber * 31) % candidates.length;
      const burnedSq = candidates[idx];
      gameState.burnedSquares.push(burnedSq);
    }
  }
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
  
  // Check if this is castling.
  // In standard chess, king moves 2 squares on same rank.
  // In Chess960, king ends on file 'c' or 'g' of its back rank (same rank move).
  const backRank = piece.color === 'white' ? '1' : '8';
  const sameRank = fromSquare[1] === toSquare[1];
  const toFile = toSquare[0];
  const isCastling = (colDiff === 2 && rowDiff === 0) || (sameRank && toSquare[1] === backRank && (toFile === 'c' || toFile === 'g'));
  
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
  // --- Simple SSE hub per game ---
  const sseClients: Map<number, Set<Response>> = new Map();

  function addSseClient(gameId: number, res: Response) {
    if (!sseClients.has(gameId)) sseClients.set(gameId, new Set());
    sseClients.get(gameId)!.add(res);
  }

  function removeSseClient(gameId: number, res: Response) {
    const set = sseClients.get(gameId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) sseClients.delete(gameId);
  }

  function broadcast(gameId: number, event: string, payload: any) {
    const set = sseClients.get(gameId);
    if (!set || set.size === 0) return;
    const data = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
    set.forEach((res) => {
      try { res.write(data); } catch {}
    });
  }

  // SSE stream for game updates
  app.get("/api/games/:id/stream", async (req, res) => {
    const gameId = parseInt(req.params.id);
    if (!Number.isFinite(gameId)) {
      res.status(400).end();
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Register client
    addSseClient(gameId, res);

    // Initial hello
    res.write(`event: connected\n` + `data: {"ok":true}\n\n`);

    // Keep-alive ping
    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch {}
    }, 30000);

    req.on("close", () => {
      clearInterval(ping);
      removeSseClient(gameId, res);
      try { res.end(); } catch {}
    });
  });

  // Helper: rebuild game state from initial rules and move list
  async function rebuildGameStateFromMoves(game: Game, movesList: any[]): Promise<ChessGameState> {
    // Re-create initial state the same way storage.createGame does
    // We'll start from a fresh initial position using DatabaseStorage private logic replicated here
    const rulesArray = Array.isArray(game.rules) ? game.rules : game.rules ? [game.rules] : ["standard"]; // fallback
    const isVoid = rulesArray.includes('void');

    // Helper to build a base board (single-board initial state)
    const buildBaseState = (effectiveRules: string[], seedSuffix?: string) => {
      const files = ['a','b','c','d','e','f','g','h'];
      const useFischer = effectiveRules.includes('fischer-random');
      const initialBoard: { [square: string]: ChessPiece | null } = {};
      let backRankTypes: ChessPiece['type'][];
      if (useFischer) {
        const seedKey = (game.shareId || 'default-seed') + (seedSuffix || '');
        backRankTypes = generateFischerBackRankFromSeed(seedKey) as ChessPiece['type'][];
      } else {
        backRankTypes = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
      }
      files.forEach((file, idx) => {
        const t = backRankTypes[idx];
        initialBoard[`${file}1`] = { type: t, color: 'white' } as any;
        initialBoard[`${file}8`] = { type: t, color: 'black' } as any;
      });
      files.forEach((f)=>{
        initialBoard[`${f}2`] = { type: 'pawn', color: 'white' } as any;
        initialBoard[`${f}7`] = { type: 'pawn', color: 'black' } as any;
      });
      if (effectiveRules.includes('pawn-wall')) {
        files.forEach((f)=>{
          initialBoard[`${f}3`] = { type: 'pawn', color: 'white' } as any;
          initialBoard[`${f}6`] = { type: 'pawn', color: 'black' } as any;
        });
      }
      // Castling rook map and rights
      let castlingRooks: ChessGameState['castlingRooks'] | undefined = undefined;
      let rights = { whiteKingside: true, whiteQueenside: true, blackKingside: true, blackQueenside: true } as ChessGameState['castlingRights'];
      if (useFischer) {
        const whiteKingIdx = backRankTypes.findIndex(t => t === 'king');
        const whiteLeftRookIdx = [...backRankTypes].slice(0, whiteKingIdx).lastIndexOf('rook');
        const whiteRightRookRel = [...backRankTypes].slice(whiteKingIdx + 1).indexOf('rook');
        const wQueenRook = whiteLeftRookIdx >= 0 ? `${files[whiteLeftRookIdx]}1` : null;
        const wKingRook = whiteRightRookRel >= 0 ? `${files[whiteKingIdx + 1 + whiteRightRookRel]}1` : null;

        const blackKingIdx = backRankTypes.findIndex(t => t === 'king');
        const blackLeftRookIdx = [...backRankTypes].slice(0, blackKingIdx).lastIndexOf('rook');
        const blackRightRookRel = [...backRankTypes].slice(blackKingIdx + 1).indexOf('rook');
        const bQueenRook = blackLeftRookIdx >= 0 ? `${files[blackLeftRookIdx]}8` : null;
        const bKingRook = blackRightRookRel >= 0 ? `${files[blackKingIdx + 1 + blackRightRookRel]}8` : null;

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
      const base: ChessGameState = {
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
        blinkUsed: { white: false, black: false },
      } as any;
      return base;
    };

    if (isVoid) {
      // Initialize two independent boards and meta container
      const baseRules = rulesArray.filter(r => r !== 'void');
      const board0 = buildBaseState(baseRules, ':0');
      const board1 = buildBaseState(baseRules, ':1');
      const state: ChessGameState = {
        board: {},
        currentTurn: 'white',
        castlingRights: { whiteKingside: true, whiteQueenside: true, blackKingside: true, blackQueenside: true },
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
        blinkUsed: { white: false, black: false },
        voidMode: true,
        voidBoards: [board0, board1],
        voidMeta: {
          pending: null,
          tokens: { white: 0, black: 0 },
          playerTurnCount: { white: 0, black: 0 },
          boardDone: [ { isCheck:false,isCheckmate:false,isStalemate:false }, { isCheck:false,isCheckmate:false,isStalemate:false } ],
        },
      } as any;

      const finalizeVoidTurn = (color: 'white'|'black') => {
        const nextTurn: 'white'|'black' = color === 'white' ? 'black' : 'white';
        state.voidMeta!.playerTurnCount[color] = (state.voidMeta!.playerTurnCount[color] || 0) + 1;
        if (state.voidMeta!.playerTurnCount[color] % 10 === 0) {
          state.voidMeta!.tokens[color] = (state.voidMeta!.tokens[color] || 0) + 1;
        }
        for (let idx = 0; idx < state.voidBoards!.length; idx++) {
          const b = state.voidBoards![idx] as any;
          if (color === 'black') {
            b.fullmoveNumber = (b.fullmoveNumber || 1) + 1;
            maybeTriggerMeteor(b, rulesArray as any);
          } else {
            if (Array.isArray(rulesArray) && (rulesArray as any).includes('meteor-shower')) {
              b.meteorCounter = b.fullmoveNumber;
            }
          }
          b.currentTurn = nextTurn;
          const isChk = isKingInCheck(b, nextTurn, rulesArray as any);
          const hasMoves = hasLegalMoves(b, nextTurn, rulesArray as any);
          b.isCheck = isChk; b.isCheckmate = isChk && !hasMoves; b.isStalemate = !isChk && !hasMoves;
          state.voidMeta!.boardDone![idx] = { isCheck: b.isCheck, isCheckmate: b.isCheckmate, isStalemate: b.isStalemate };
        }
        state.currentTurn = nextTurn;
      };

      for (const mv of movesList) {
        // Distinguish transfer vs per-board sub-move
        const special: string | undefined = (mv as any).special || undefined;
        const color = mv.player as 'white'|'black';
        if (special && special.startsWith('void-transfer')) {
          // Parse boards
          const m = special.match(/void-transfer:(\d+)->(\d+)/);
          const fromBoardId = m ? (parseInt(m[1], 10) as 0|1) : 0;
          const toBoardId = m ? (parseInt(m[2], 10) as 0|1) : 1;
          const fromBoard = state.voidBoards![fromBoardId] as any;
          const toBoard = state.voidBoards![toBoardId] as any;
          const piece = fromBoard.board[mv.from];
          if (piece) {
            delete fromBoard.board[mv.from];
            // final piece type is encoded in mv.piece (color-type)
            const [, finalType] = (mv.piece as string).split('-');
            toBoard.board[mv.to] = { type: finalType as any, color };
          }
          // spend token and clear pending
          state.voidMeta!.tokens[color] = Math.max(0, (state.voidMeta!.tokens[color] || 0) - 1);
          state.voidMeta!.pending = null;
          // finalize full turn
          finalizeVoidTurn(color);
          continue;
        }

        // Regular sub-move on specific board: special contains 'void:board=N'
        let boardId: 0|1 = 0;
        const m2 = special ? special.match(/void:board=(\d+)/) : null;
        if (m2) boardId = parseInt(m2[1], 10) as 0|1;
        const active = state.voidBoards![boardId] as any;

        const piece = active.board[mv.from];
        const targetPiece = active.board[mv.to];
        // En passant capture check
        const currentEnPassantTarget = active.enPassantTarget;
        if (piece && piece.type === 'pawn' && mv.to === currentEnPassantTarget) {
          const targetFile = mv.to[0];
          const targetRank = parseInt(mv.to[1]);
          const fromFile = mv.from[0];
          const fromRank = parseInt(mv.from[1]);
          if (fromRank !== targetRank) {
            const captureRank = piece.color === 'white' ? '5' : '4';
            const captureSquare = targetFile + captureRank;
            delete active.board[captureSquare];
          } else {
            const leftSquare = String.fromCharCode(fromFile.charCodeAt(0) - 1) + fromRank;
            const rightSquare = String.fromCharCode(fromFile.charCodeAt(0) + 1) + fromRank;
            if (active.board[leftSquare] && active.board[leftSquare]!.color !== piece.color) {
              delete active.board[leftSquare];
            } else if (active.board[rightSquare] && active.board[rightSquare]!.color !== piece.color) {
              delete active.board[rightSquare];
            }
          }
        }
        active.enPassantTarget = null;

        // Castling/Blink
        let isCastling = false;
        let isBlinkTeleport = false;
        let pendingCastlingRookFrom: string | null = null;
        let pendingCastlingRookTo: string | null = null;
        if (piece && piece.type === 'king') {
          const fromFile = mv.from[0];
          const toFile = mv.to[0];
          const fromRank = mv.from[1];
          const toRank = mv.to[1];
          if (isValidCastlingMove(active, piece, mv.from, mv.to, rulesArray as any)) {
            isCastling = true;
          }
          if (!isCastling && Array.isArray(rulesArray) && rulesArray.includes('blink')) {
            const blinkUsed = active.blinkUsed || { white: false, black: false };
            if (!blinkUsed[piece.color]) {
              const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
              const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
              const fromRankNum = parseInt(fromRank);
              const toRankNum = parseInt(toRank);
              const fileDistance = Math.abs(toFileIndex - fromFileIndex);
              const rankDistance = Math.abs(toRankNum - fromRankNum);
              const maxDistance = Math.max(fileDistance, rankDistance);
              if (maxDistance > 1) isBlinkTeleport = true;
            }
          }
          if (isCastling) {
            const rank = mv.to[1];
            const isKingSide = toFile === 'g';
            pendingCastlingRookTo = `${isKingSide ? 'f' : 'd'}${rank}`;
            let rookFrom = `${isKingSide ? 'h' : 'a'}${rank}`;
            const isFischer = Array.isArray(rulesArray) && (rulesArray as any).includes('fischer-random');
            if (isFischer && active.castlingRooks) {
              const side = isKingSide ? 'kingSide' : 'queenSide';
              const mapped = active.castlingRooks[piece.color]?.[side];
              if (mapped) rookFrom = mapped;
            }
            pendingCastlingRookFrom = rookFrom;
          } else if (isBlinkTeleport && !isCastling) {
            if (!active.blinkUsed) active.blinkUsed = { white: false, black: false };
            active.blinkUsed[piece.color] = true;
          }
        }

        // Move piece (standard and captures)
        if (!(isCastling && mv.from === mv.to)) {
          active.board[mv.to] = piece;
          delete active.board[mv.from];
        }
        if (isCastling && pendingCastlingRookFrom && pendingCastlingRookTo) {
          active.board[pendingCastlingRookTo] = active.board[pendingCastlingRookFrom];
          delete (active.board as any)[pendingCastlingRookFrom];
        }

        // Castling rights update
        if (piece && piece.type === 'king') {
          if (piece.color === 'white') { active.castlingRights.whiteKingside = false; active.castlingRights.whiteQueenside = false; }
          else { active.castlingRights.blackKingside = false; active.castlingRights.blackQueenside = false; }
        } else if (piece && piece.type === 'rook') {
          const cr = active.castlingRooks;
          if (cr) {
            if (mv.from === cr.white?.queenSide) active.castlingRights.whiteQueenside = false;
            if (mv.from === cr.white?.kingSide) active.castlingRights.whiteKingside = false;
            if (mv.from === cr.black?.queenSide) active.castlingRights.blackQueenside = false;
            if (mv.from === cr.black?.kingSide) active.castlingRights.blackKingside = false;
          } else {
            if (mv.from === 'a1') active.castlingRights.whiteQueenside = false;
            else if (mv.from === 'h1') active.castlingRights.whiteKingside = false;
            else if (mv.from === 'a8') active.castlingRights.blackQueenside = false;
            else if (mv.from === 'h8') active.castlingRights.blackKingside = false;
          }
        } else if (targetPiece && targetPiece.type === 'rook') {
          const capturedColor: 'white' | 'black' = targetPiece.color;
          const cr = active.castlingRooks;
          if (cr) {
            if (mv.to === cr[capturedColor]?.queenSide) { if (capturedColor === 'white') active.castlingRights.whiteQueenside = false; else active.castlingRights.blackQueenside = false; }
            if (mv.to === cr[capturedColor]?.kingSide) { if (capturedColor === 'white') active.castlingRights.whiteKingside = false; else active.castlingRights.blackKingside = false; }
          } else {
            if (capturedColor === 'white') {
              if (mv.to === 'a1') active.castlingRights.whiteQueenside = false;
              if (mv.to === 'h1') active.castlingRights.whiteKingside = false;
            } else {
              if (mv.to === 'a8') active.castlingRights.blackQueenside = false;
              if (mv.to === 'h8') active.castlingRights.blackKingside = false;
            }
          }
        }

        // Pawn specifics
        if (piece && piece.type === 'pawn') {
          const fromRank = parseInt(mv.from[1]);
          const toRank = parseInt(mv.to[1]);
          const fromFile = mv.from[0];
          const toFile = mv.to[0];
          if (Array.isArray(rulesArray) && rulesArray.includes('pawn-rotation')) {
            if (!active.pawnRotationMoves) active.pawnRotationMoves = {} as any;
            const standardOriginalRank = piece.color === 'white' ? 2 : 7;
            const standardOriginalSquare = `${fromFile}${standardOriginalRank}`;
            if (Array.isArray(rulesArray) && rulesArray.includes('pawn-wall')) {
              const pawnWallStartRank = piece.color === 'white' ? 3 : 6;
              const wallOriginalSquare = `${fromFile}${pawnWallStartRank}`;
              if (fromRank === standardOriginalRank) (active.pawnRotationMoves as any)[standardOriginalSquare] = true;
              else if (fromRank === pawnWallStartRank) (active.pawnRotationMoves as any)[wallOriginalSquare] = true;
            } else {
              (active.pawnRotationMoves as any)[standardOriginalSquare] = true;
            }
          }
          if (Math.abs(toRank - fromRank) === 2) {
            const enPassantRank = piece.color === 'white' ? fromRank + 1 : fromRank - 1;
            active.enPassantTarget = toFile + enPassantRank;
          }
          if (Array.isArray(rulesArray) && rulesArray.includes('pawn-rotation')) {
            const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
            if (Math.abs(toFileIndex - fromFileIndex) === 2 && fromRank === toRank) {
              const enPassantFileIndex = fromFileIndex + (toFileIndex - fromFileIndex) / 2;
              const enPassantFile = String.fromCharCode(enPassantFileIndex + 'a'.charCodeAt(0));
              active.enPassantTarget = enPassantFile + fromRank;
            }
          }
          const shouldPromote = (piece.color === 'white' && toRank === 8) || (piece.color === 'black' && toRank === 1);
          if (shouldPromote && mv.piece) {
            const [, promotedPieceType] = (mv.piece as string).split('-');
            active.board[mv.to] = { type: promotedPieceType as any, color: piece.color } as any;
          }
        }

        // Halfmove clock
        if (piece?.type === 'pawn' || targetPiece) active.halfmoveClock = 0; else active.halfmoveClock++;

  // Capture DK state before rule application to detect legitimate same-board second steps
  const dkBefore = (active as any).doubleKnightMove as undefined | { knightSquare: string; color: 'white'|'black' };
  // Apply special rules on that board
  const updated = applyAllSpecialRules(active as any, rulesArray as any, mv.from, mv.to, piece as any) as any;
        state.voidBoards![boardId] = updated;

        // Pending and finalize (DK-aware)
        const dkAfterRebuild = (state.voidBoards![boardId] as any).doubleKnightMove as undefined | { knightSquare: string; color: 'white'|'black' };
        if (!state.voidMeta!.pending) {
          const otherId = (boardId === 0 ? 1 : 0) as 0|1;
          const other = state.voidBoards![otherId] as any;
          const otherHasMoves = hasLegalMoves(other, color, rulesArray as any);
          if (dkAfterRebuild && dkAfterRebuild.color === color) {
            // DK started on the first sub-move of the full turn
            state.voidMeta!.pending = { color, movedBoards: [boardId], dkStartedAsSecond: false } as any;
          } else if (!otherHasMoves) {
            state.voidMeta!.pending = null;
            finalizeVoidTurn(color);
          } else {
            state.voidMeta!.pending = { color, movedBoards: [boardId] } as any;
          }
        } else if (state.voidMeta!.pending.color === color && !state.voidMeta!.pending.movedBoards.includes(boardId)) {
          // Other-board attempt: block if origin requires DK completion
          const originBoardId = state.voidMeta!.pending.movedBoards[0] as 0|1;
          const origin = state.voidBoards![originBoardId] as any;
          if (origin.doubleKnightMove && origin.doubleKnightMove.color === color) {
            // Keep pending as-is (replay side-effect)
          } else {
            // If this move started a Double Knight on the other board, keep pending on this board to allow the second hop
            const dkOther = (state.voidBoards![boardId] as any).doubleKnightMove as undefined | { knightSquare: string; color: 'white'|'black' };
            if (Array.isArray(rulesArray) && (rulesArray as any).includes('double-knight') && dkOther && dkOther.color === color) {
              // DK started on the second sub-move of the full turn
              state.voidMeta!.pending = { color, movedBoards: [boardId], dkStartedAsSecond: true } as any;
            } else {
              state.voidMeta!.pending = null;
              finalizeVoidTurn(color);
            }
          }
        } else if (state.voidMeta!.pending.color === color && state.voidMeta!.pending.movedBoards.includes(boardId)) {
          // Same-board second: allow only if DK second hop
          const allowSameBoardDueToDK = !!(
            Array.isArray(rulesArray) && (rulesArray as any).includes('double-knight') &&
            dkBefore && dkBefore.color === color && piece && piece.type === 'knight' && mv.from === dkBefore.knightSquare
          );
          if (allowSameBoardDueToDK) {
            // Clear DK requirement on this board after the second hop
            (state.voidBoards![boardId] as any).doubleKnightMove = null;
            const startedAsSecond = ((state.voidMeta!.pending as any)?.dkStartedAsSecond === true);
            if (startedAsSecond) {
              // DK started on the second sub-move; completing DK ends the full turn
              state.voidMeta!.pending = null;
              finalizeVoidTurn(color);
            } else {
              // DK started on first sub-move; require other board if it has moves
              const otherId = (boardId === 0 ? 1 : 0) as 0|1;
              const other = state.voidBoards![otherId] as any;
              const otherHasMoves = hasLegalMoves(other, color, rulesArray as any);
              if (otherHasMoves) {
                state.voidMeta!.pending = { color, movedBoards: [boardId] } as any;
              } else {
                state.voidMeta!.pending = null;
                finalizeVoidTurn(color);
              }
            }
          }
        }
      }

      // finalize boardDone flags for current turn
      const nextTurn = state.currentTurn as 'white'|'black';
      for (let idx = 0; idx < state.voidBoards!.length; idx++) {
        const b = state.voidBoards![idx] as any;
        const isChk = isKingInCheck(b, nextTurn, rulesArray as any);
        const hasMoves = hasLegalMoves(b, nextTurn, rulesArray as any);
        b.isCheck = isChk; b.isCheckmate = isChk && !hasMoves; b.isStalemate = !isChk && !hasMoves;
        state.voidMeta!.boardDone![idx] = { isCheck: b.isCheck, isCheckmate: b.isCheckmate, isStalemate: b.isStalemate };
      }
      return state;
    }

    // Non-void rebuild path (original)
    const files = ['a','b','c','d','e','f','g','h'];
    const useFischer = rulesArray.includes('fischer-random');
    const initialBoard: { [square: string]: ChessPiece | null } = {};
    let backRankTypes: ChessPiece['type'][];
    if (useFischer) {
      const seedKey = game.shareId || 'default-seed';
      backRankTypes = generateFischerBackRankFromSeed(seedKey) as ChessPiece['type'][];
    } else {
      backRankTypes = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
    }
    files.forEach((file, idx) => {
      const t = backRankTypes[idx];
      initialBoard[`${file}1`] = { type: t, color: 'white' } as any;
      initialBoard[`${file}8`] = { type: t, color: 'black' } as any;
    });
    files.forEach((f)=>{
      initialBoard[`${f}2`] = { type: 'pawn', color: 'white' } as any;
      initialBoard[`${f}7`] = { type: 'pawn', color: 'black' } as any;
    });
    if (rulesArray.includes('pawn-wall')) {
      files.forEach((f)=>{
        initialBoard[`${f}3`] = { type: 'pawn', color: 'white' } as any;
        initialBoard[`${f}6`] = { type: 'pawn', color: 'black' } as any;
      });
    }
    let castlingRooks: ChessGameState['castlingRooks'] | undefined = undefined;
    let rights = { whiteKingside: true, whiteQueenside: true, blackKingside: true, blackQueenside: true } as ChessGameState['castlingRights'];
    if (useFischer) {
      const whiteKingIdx = backRankTypes.findIndex(t => t === 'king');
      const whiteLeftRookIdx = [...backRankTypes].slice(0, whiteKingIdx).lastIndexOf('rook');
      const whiteRightRookRel = [...backRankTypes].slice(whiteKingIdx + 1).indexOf('rook');
      const wQueenRook = whiteLeftRookIdx >= 0 ? `${files[whiteLeftRookIdx]}1` : null;
      const wKingRook = whiteRightRookRel >= 0 ? `${files[whiteKingIdx + 1 + whiteRightRookRel]}1` : null;

      const blackKingIdx = backRankTypes.findIndex(t => t === 'king');
      const blackLeftRookIdx = [...backRankTypes].slice(0, blackKingIdx).lastIndexOf('rook');
      const blackRightRookRel = [...backRankTypes].slice(blackKingIdx + 1).indexOf('rook');
      const bQueenRook = blackLeftRookIdx >= 0 ? `${files[blackLeftRookIdx]}8` : null;
      const bKingRook = blackRightRookRel >= 0 ? `${files[blackKingIdx + 1 + blackRightRookRel]}8` : null;

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
    let state: ChessGameState = {
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
      blinkUsed: { white: false, black: false }
    };

    // Replay moves through existing logic in this file
    // We'll track prev/next turns explicitly to mirror the live path logic
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
      // For castling, stage rook move and perform after moving the king to avoid overwriting/deleting
      let pendingCastlingRookFrom: string | null = null;
      let pendingCastlingRookTo: string | null = null;
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
          const rank = mv.to[1];
          const isKingSide = toFile === 'g';
          const rookTo = `${isKingSide ? 'f' : 'd'}${rank}`;
          let rookFrom = `${isKingSide ? 'h' : 'a'}${rank}`;
          const isFischer = Array.isArray(rulesArray) && (rulesArray as any).includes('fischer-random');
          if (isFischer && state.castlingRooks) {
            const side = isKingSide ? 'kingSide' : 'queenSide';
            const mapped = state.castlingRooks[piece.color]?.[side];
            if (mapped) rookFrom = mapped;
          }
          state.board[rookTo] = state.board[rookFrom];
          delete (state.board as any)[rookFrom];
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
        const cr = state.castlingRooks;
        if (cr) {
          if (mv.from === cr.white?.queenSide) state.castlingRights.whiteQueenside = false;
          if (mv.from === cr.white?.kingSide) state.castlingRights.whiteKingside = false;
          if (mv.from === cr.black?.queenSide) state.castlingRights.blackQueenside = false;
          if (mv.from === cr.black?.kingSide) state.castlingRights.blackKingside = false;
        } else {
          if (mv.from === 'a1') state.castlingRights.whiteQueenside = false;
          else if (mv.from === 'h1') state.castlingRights.whiteKingside = false;
          else if (mv.from === 'a8') state.castlingRights.blackQueenside = false;
          else if (mv.from === 'h8') state.castlingRights.blackKingside = false;
        }
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

      // Determine previous turn BEFORE rules adjust it (important for double-knight)
      const prevTurn = state.currentTurn as 'white' | 'black';

      // special rules application (no meteor strike here)
      state = applyAllSpecialRules(state as any, rulesArray as any, mv.from, mv.to, piece) as any;

      // Determine next turn just like the live move route does
      let nextTurn: 'white' | 'black';
      if (Array.isArray(rulesArray) && rulesArray.includes('double-knight')) {
        // applyAllSpecialRules already adjusted currentTurn for double-knight
        nextTurn = state.currentTurn as 'white' | 'black';
      } else {
        // Standard toggle
        nextTurn = prevTurn === 'white' ? 'black' : 'white';
        state.currentTurn = nextTurn;
      }
      currentTurn = nextTurn;

      // End-of-turn bookkeeping similar to live path:
      // increment only when previous player was black and turn handed to white
      if (prevTurn === 'black' && nextTurn === 'white') {
        state.fullmoveNumber++;
        maybeTriggerMeteor(state, rulesArray as any);
      } else {
        if (Array.isArray(rulesArray) && (rulesArray as any).includes('meteor-shower')) {
          state.meteorCounter = state.fullmoveNumber;
        }
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
      const isVoid = Array.isArray(game.rules) && (game.rules as any).includes('void');
      if (isVoid) {
        // Void mode: handle transfer or sub-move on a specific board, then return
        if (!gameState.voidMode || !gameState.voidBoards) {
          return res.status(400).json({ message: 'Void mode not initialized' });
        }

        const color = game.currentTurn as 'white' | 'black';
        const body: any = (req as any).body || {};
        const broadcastAndReturn = async (saved: any) => {
          broadcast(gameId, 'move', { type: 'move', gameId, move: saved });
          return res.json(saved);
        };

        // Helper: finalize player's full turn
        const finalizeVoidTurn = async () => {
          if (!gameState.voidMeta) gameState.voidMeta = { pending: null, tokens: { white: 0, black: 0 }, playerTurnCount: { white: 0, black: 0 } };
          gameState.voidMeta.playerTurnCount[color] = (gameState.voidMeta.playerTurnCount[color] || 0) + 1;
          if (gameState.voidMeta.playerTurnCount[color] % 10 === 0) {
            gameState.voidMeta.tokens[color] = (gameState.voidMeta.tokens[color] || 0) + 1;
          }
          const nextTurn: 'white' | 'black' = color === 'white' ? 'black' : 'white';
          // Per-board end-of-turn updates
          for (let idx = 0; idx < gameState.voidBoards.length; idx++) {
            const b = gameState.voidBoards[idx];
            // Increment fullmoveNumber when black finishes
            if (color === 'black') {
              b.fullmoveNumber = (b.fullmoveNumber || 1) + 1;
              maybeTriggerMeteor(b, game.rules as any);
            } else {
              // keep meteor counter in sync if rule active
              if (Array.isArray(game.rules) && (game.rules as any).includes('meteor-shower')) {
                b.meteorCounter = b.fullmoveNumber;
              }
            }
            // Switch board turn to next player
            b.currentTurn = nextTurn;
            // Recompute quick flags for next player
            const isChk = isKingInCheck(b, nextTurn, game.rules as any);
            const hasMoves = hasLegalMoves(b, nextTurn, game.rules as any);
            b.isCheck = isChk; b.isCheckmate = isChk && !hasMoves; b.isStalemate = !isChk && !hasMoves;
            if (!gameState.voidMeta.boardDone) gameState.voidMeta.boardDone = [ { isCheck:false,isCheckmate:false,isStalemate:false }, { isCheck:false,isCheckmate:false,isStalemate:false } ];
            gameState.voidMeta.boardDone[idx] = { isCheck: b.isCheck, isCheckmate: b.isCheckmate, isStalemate: b.isStalemate };
          }
          gameState.currentTurn = nextTurn;
          await storage.updateGameTurn(gameId, nextTurn);
        };

        // Transfer token usage
        if (body.voidTransfer) {
          const { fromBoardId, fromSquare, toBoardId, toSquare, promoted } = body.voidTransfer as { fromBoardId: 0|1; fromSquare: string; toBoardId: 0|1; toSquare: string; promoted?: 'queen'|'rook'|'bishop'|'knight' };
          if (fromBoardId === toBoardId) return res.status(400).json({ message: 'Transfer must be between different boards' });
          if (!gameState.voidMeta) gameState.voidMeta = { pending: null, tokens: { white: 0, black: 0 }, playerTurnCount: { white: 0, black: 0 } };
          const tokens = gameState.voidMeta.tokens?.[color] ?? 0;
          if (tokens <= 0) return res.status(400).json({ message: 'No transfer tokens available' });

          const fromBoard = gameState.voidBoards[fromBoardId];
          const toBoard = gameState.voidBoards[toBoardId];
          const piece = fromBoard.board[fromSquare];
          if (!piece || piece.color !== color) return res.status(400).json({ message: 'Invalid piece for transfer' });
          if (piece.type === 'king') return res.status(400).json({ message: 'King cannot be transferred between boards' });
          if (toBoard.board[toSquare]) return res.status(400).json({ message: 'Target square is not empty' });

          // Validate king safety on source board
          const srcClone = JSON.parse(JSON.stringify(fromBoard));
          delete srcClone.board[fromSquare];
          if (isKingInCheck(srcClone, color, game.rules as any)) {
            return res.status(400).json({ message: 'Transfer would leave your king in check on source board' });
          }

          // Apply transfer
          delete fromBoard.board[fromSquare];
          toBoard.board[toSquare] = piece;
          // Promotion if pawn lands on last rank
          let finalType: any = piece.type;
          if (piece.type === 'pawn') {
            const rank = parseInt(toSquare[1]);
            const shouldPromote = (piece.color === 'white' && rank === 8) || (piece.color === 'black' && rank === 1);
            if (shouldPromote) {
              const newType = promoted || 'queen';
              toBoard.board[toSquare] = { type: newType, color: piece.color } as any;
              finalType = newType;
            }
          }

          // Spend token and clear pending
          gameState.voidMeta.tokens[color] = (gameState.voidMeta.tokens[color] || 0) - 1;
          gameState.voidMeta.pending = null;

          // Update quick status flags per board
          const updateFlags = (b: any, idx: number) => {
            const nextT = b.currentTurn;
            const isChk = isKingInCheck(b, nextT, game.rules as any);
            const hasMoves = hasLegalMoves(b, nextT, game.rules as any);
            b.isCheck = isChk; b.isCheckmate = isChk && !hasMoves; b.isStalemate = !isChk && !hasMoves;
            if (!gameState.voidMeta.boardDone) gameState.voidMeta.boardDone = [ { isCheck:false,isCheckmate:false,isStalemate:false }, { isCheck:false,isCheckmate:false,isStalemate:false } ];
            gameState.voidMeta.boardDone[idx] = { isCheck: b.isCheck, isCheckmate: b.isCheckmate, isStalemate: b.isStalemate };
          };
          updateFlags(fromBoard, fromBoardId);
          updateFlags(toBoard, toBoardId);

          // Important: finalize full turn first so per-board currentTurn and flags are updated,
          // then persist the full updated gameState (so isCheck/isCheckmate/isStalemate are saved correctly)
          await finalizeVoidTurn();
          await storage.updateGameState(gameId, gameState);

          const saved = await storage.addMove({
            gameId,
            moveNumber: moveData.moveNumber,
            player: color,
            from: fromSquare,
            to: toSquare,
            piece: `${piece.color}-${finalType}`,
            captured: undefined,
            special: `void-transfer:${fromBoardId}->${toBoardId}`,
            fen: moveData.fen,
          } as any);
          return broadcastAndReturn(saved);
        }

        // Sub-move on a board
        const boardId = body.boardId as 0|1;
        if (boardId !== 0 && boardId !== 1) return res.status(400).json({ message: 'boardId is required in Void mode' });
        const active = gameState.voidBoards[boardId];
        // If a second sub-move is attempted on the same board, normally reject; but allow when Double-Knight requires a second move with the same knight on this board.
        const movingPieceForCheck = active.board[moveData.from];
        const isDoubleKnightRule = Array.isArray(game.rules) && (game.rules as any).includes('double-knight');
        const dk = (active as any).doubleKnightMove as undefined | { knightSquare: string; color: 'white'|'black' };
        const allowSameBoardDueToDK = !!(
          isDoubleKnightRule &&
          dk &&
          dk.color === color &&
          movingPieceForCheck &&
          movingPieceForCheck.type === 'knight' &&
          moveData.from === dk.knightSquare
        );
        if (gameState.voidMeta?.pending && gameState.voidMeta.pending.color === color && gameState.voidMeta.pending.movedBoards.includes(boardId) && !allowSameBoardDueToDK) {
          return res.status(400).json({ message: 'Second sub-move must be on the other board' });
        }
        const piece = movingPieceForCheck;
        const targetPiece = active.board[moveData.to];
        let serverCaptured: string | undefined = undefined;
        if (!piece || piece.color !== color) return res.status(400).json({ message: 'Invalid piece or wrong turn' });
        // Validate move legality on this board
        if (!isMoveLegal(active, moveData.from, moveData.to, color, game.rules as any)) {
          return res.status(400).json({ message: 'Illegal move for this board' });
        }
        if (Array.isArray(game.rules) && game.rules.includes('double-knight') && active.doubleKnightMove && targetPiece && targetPiece.type === 'king') {
          return res.status(400).json({ message: 'Cannot capture king during double knight sequence' });
        }
        if (piece && targetPiece && piece.color === targetPiece.color) return res.status(400).json({ message: 'Cannot capture your own pieces' });

        // En passant logic on active board
        const currentEnPassantTarget = active.enPassantTarget;
        if (piece && piece.type === 'pawn' && moveData.to === currentEnPassantTarget) {
          const targetFile = moveData.to[0];
          const targetRank = parseInt(moveData.to[1]);
          const fromFile = moveData.from[0];
          const fromRank = parseInt(moveData.from[1]);
          if (fromRank !== targetRank) {
            const captureRank = piece.color === 'white' ? '5' : '4';
            const captureSquare = targetFile + captureRank;
            const cap = active.board[captureSquare];
            if (cap) serverCaptured = `${cap.color}-${cap.type}`;
            delete active.board[captureSquare];
          } else {
            const leftSquare = String.fromCharCode(fromFile.charCodeAt(0) - 1) + fromRank;
            const rightSquare = String.fromCharCode(fromFile.charCodeAt(0) + 1) + fromRank;
            let captureSquare: string | null = null;
            if (active.board[leftSquare] && active.board[leftSquare]!.color !== piece.color) captureSquare = leftSquare;
            else if (active.board[rightSquare] && active.board[rightSquare]!.color !== piece.color) captureSquare = rightSquare;
            if (captureSquare) {
              const cap = active.board[captureSquare];
              if (cap) serverCaptured = `${cap.color}-${cap.type}`;
              delete active.board[captureSquare];
            }
          }
        }
        active.enPassantTarget = null;

        // Castling + Blink checks on active
        let isCastling = false;
        let isBlinkTeleport = false;
        let pendingCastlingRookFrom: string | null = null;
        let pendingCastlingRookTo: string | null = null;
        if (piece && piece.type === 'king') {
          const fromFile = moveData.from[0];
          const toFile = moveData.to[0];
          const fromRank = moveData.from[1];
          const toRank = moveData.to[1];
          if (isValidCastlingMove(active, piece, moveData.from, moveData.to, game.rules as any)) {
            isCastling = true;
          }
          if (!isCastling && game.rules && Array.isArray(game.rules) && game.rules.includes('blink')) {
            const blinkUsed = active.blinkUsed || { white: false, black: false };
            if (!blinkUsed[piece.color]) {
              const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
              const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
              const fromRankNum = parseInt(fromRank);
              const toRankNum = parseInt(toRank);
              const fileDistance = Math.abs(toFileIndex - fromFileIndex);
              const rankDistance = Math.abs(toRankNum - fromRankNum);
              const maxDistance = Math.max(fileDistance, rankDistance);
              if (maxDistance > 1) isBlinkTeleport = true;
            }
          }
          if (isCastling) {
            const rank = moveData.to[1];
            const isKingSide = toFile === 'g';
            pendingCastlingRookTo = `${isKingSide ? 'f' : 'd'}${rank}`;
            let rookFrom = `${isKingSide ? 'h' : 'a'}${rank}`;
            const isFischer = Array.isArray(game.rules) && (game.rules as any).includes('fischer-random');
            if (isFischer && active.castlingRooks) {
              const side = isKingSide ? 'kingSide' : 'queenSide';
              const mapped = active.castlingRooks[piece.color]?.[side];
              if (mapped) rookFrom = mapped;
            }
            pendingCastlingRookFrom = rookFrom;
            serverCaptured = undefined;
          } else if (isBlinkTeleport && !isCastling) {
            if (!active.blinkUsed) active.blinkUsed = { white: false, black: false };
            active.blinkUsed[piece.color] = true;
          }
        }

        if (!serverCaptured && targetPiece && targetPiece.color !== piece.color) {
          serverCaptured = `${targetPiece.color}-${targetPiece.type}`;
        }
        if (!(isCastling && moveData.from === moveData.to)) {
          active.board[moveData.to] = piece;
          delete active.board[moveData.from];
        }
        if (isCastling && pendingCastlingRookFrom && pendingCastlingRookTo) {
          active.board[pendingCastlingRookTo] = active.board[pendingCastlingRookFrom];
          delete (active.board as any)[pendingCastlingRookFrom];
        }

        if (piece && piece.type === 'king') {
          if (piece.color === 'white') { active.castlingRights.whiteKingside = false; active.castlingRights.whiteQueenside = false; }
          else { active.castlingRights.blackKingside = false; active.castlingRights.blackQueenside = false; }
        } else if (piece && piece.type === 'rook') {
          const cr = active.castlingRooks;
          if (cr) {
            if (moveData.from === cr.white?.queenSide) active.castlingRights.whiteQueenside = false;
            if (moveData.from === cr.white?.kingSide) active.castlingRights.whiteKingside = false;
            if (moveData.from === cr.black?.queenSide) active.castlingRights.blackQueenside = false;
            if (moveData.from === cr.black?.kingSide) active.castlingRights.blackKingside = false;
          } else {
            if (moveData.from === 'a1') active.castlingRights.whiteQueenside = false;
            else if (moveData.from === 'h1') active.castlingRights.whiteKingside = false;
            else if (moveData.from === 'a8') active.castlingRights.blackQueenside = false;
            else if (moveData.from === 'h8') active.castlingRights.blackKingside = false;
          }
        } else if (targetPiece && targetPiece.type === 'rook') {
          const capturedColor: 'white' | 'black' = targetPiece.color;
          const cr = active.castlingRooks;
          if (cr) {
            if (moveData.to === cr[capturedColor]?.queenSide) { if (capturedColor === 'white') active.castlingRights.whiteQueenside = false; else active.castlingRights.blackQueenside = false; }
            if (moveData.to === cr[capturedColor]?.kingSide) { if (capturedColor === 'white') active.castlingRights.whiteKingside = false; else active.castlingRights.blackKingside = false; }
          } else {
            if (capturedColor === 'white') {
              if (moveData.to === 'a1') active.castlingRights.whiteQueenside = false;
              if (moveData.to === 'h1') active.castlingRights.whiteKingside = false;
            } else {
              if (moveData.to === 'a8') active.castlingRights.blackQueenside = false;
              if (moveData.to === 'h8') active.castlingRights.blackKingside = false;
            }
          }
        }

        if (piece && piece.type === 'pawn') {
          const fromRank = parseInt(moveData.from[1]);
          const toRank = parseInt(moveData.to[1]);
          const fromFile = moveData.from[0];
          const toFile = moveData.to[0];
          if (Array.isArray(game.rules) && game.rules.includes('pawn-rotation')) {
            if (!active.pawnRotationMoves) active.pawnRotationMoves = {};
            const standardOriginalRank = piece.color === 'white' ? 2 : 7;
            const standardOriginalSquare = `${fromFile}${standardOriginalRank}`;
            if (Array.isArray(game.rules) && game.rules.includes('pawn-wall')) {
              const pawnWallStartRank = piece.color === 'white' ? 3 : 6;
              const wallOriginalSquare = `${fromFile}${pawnWallStartRank}`;
              if (fromRank === standardOriginalRank) active.pawnRotationMoves[standardOriginalSquare] = true;
              else if (fromRank === pawnWallStartRank) active.pawnRotationMoves[wallOriginalSquare] = true;
            } else {
              active.pawnRotationMoves[standardOriginalSquare] = true;
            }
          }
          if (Math.abs(toRank - fromRank) === 2) {
            const enPassantRank = piece.color === 'white' ? fromRank + 1 : fromRank - 1;
            active.enPassantTarget = moveData.to[0] + enPassantRank;
          }
          if (Array.isArray(game.rules) && game.rules.includes('pawn-rotation')) {
            const fromFileIndex = fromFile.charCodeAt(0) - 'a'.charCodeAt(0);
            const toFileIndex = toFile.charCodeAt(0) - 'a'.charCodeAt(0);
            if (Math.abs(toFileIndex - fromFileIndex) === 2 && fromRank === toRank) {
              const enPassantFileIndex = fromFileIndex + (toFileIndex - fromFileIndex) / 2;
              const enPassantFile = String.fromCharCode(enPassantFileIndex + 'a'.charCodeAt(0));
              active.enPassantTarget = enPassantFile + fromRank;
            }
          }
          const shouldPromote = (piece.color === 'white' && toRank === 8) || (piece.color === 'black' && toRank === 1);
          if (shouldPromote) {
            const [_, promotedPieceType] = moveData.piece.split('-');
            active.board[moveData.to] = { type: promotedPieceType as any, color: piece.color };
          }
        }

        if (piece?.type === 'pawn' || serverCaptured) active.halfmoveClock = 0; else active.halfmoveClock++;

        // Rule applications per board
        const updatedBoard = applyAllSpecialRules(active, game.rules as any, moveData.from, moveData.to, piece);
        gameState.voidBoards[boardId] = updatedBoard;

        // Pending management with Double-Knight awareness
        if (!gameState.voidMeta) gameState.voidMeta = { pending: null, tokens: { white: 0, black: 0 }, playerTurnCount: { white: 0, black: 0 } };
        const dkAfter = (gameState.voidBoards[boardId] as any).doubleKnightMove as undefined | { knightSquare: string; color: 'white'|'black' };
        if (!gameState.voidMeta.pending) {
          // First sub-move just made on boardId
          const otherId = (boardId === 0 ? 1 : 0) as 0|1;
          const other = gameState.voidBoards[otherId];
          const otherHasMoves = hasLegalMoves(other, color, game.rules as any);
          if (dkAfter && dkAfter.color === color) {
            // Double-Knight requires immediate second hop on the same board; do NOT auto-pass
            gameState.voidMeta.pending = { color, movedBoards: [boardId], dkStartedAsSecond: false } as any;
          } else if (!otherHasMoves) {
            // No moves on the other board: auto-finish turn
            gameState.voidMeta.pending = null;
            await finalizeVoidTurn();
          } else {
            gameState.voidMeta.pending = { color, movedBoards: [boardId] };
          }
        } else if (gameState.voidMeta.pending.color === color && !gameState.voidMeta.pending.movedBoards.includes(boardId)) {
          // Attempting to play on the other board as the second sub-move
          // If the original board still has an active DK requirement, force completing it first
          const originBoardId = gameState.voidMeta.pending.movedBoards[0] as 0|1;
          const originBoard = gameState.voidBoards[originBoardId] as any;
          if (originBoard.doubleKnightMove && originBoard.doubleKnightMove.color === color) {
            return res.status(400).json({ message: `Must complete Double Knight on board ${originBoardId}` });
          }
          // Otherwise, this is a valid second sub-move on the other board.
          // If this move started Double Knight on this board, we must allow its second hop (do not finalize yet).
          const dkStartedHere = !!(isDoubleKnightRule && dk && dk.color === color);
          if (dkStartedHere) {
            gameState.voidMeta.pending = { color, movedBoards: [boardId], dkStartedAsSecond: true } as any;
          } else {
            // Finish the full turn
            gameState.voidMeta.pending = null;
            await finalizeVoidTurn();
          }
        } else if (gameState.voidMeta.pending.color === color && gameState.voidMeta.pending.movedBoards.includes(boardId)) {
          // Same-board second sub-move: permitted ONLY if this is the DK second hop; do not finalize yet—require the other board
          const originBoardId = boardId;
          const otherId = (boardId === 0 ? 1 : 0) as 0|1;
          const other = gameState.voidBoards[otherId];
          const otherHasMoves = hasLegalMoves(other, color, game.rules as any);
          const wasDKSecond = isDoubleKnightRule && dk && dk.color === color;
          if (wasDKSecond) {
            // Ensure DK marker is cleared on origin board to allow other-board sub-move
            (gameState.voidBoards[originBoardId] as any).doubleKnightMove = null;
            const startedAsSecond = ((gameState.voidMeta.pending as any)?.dkStartedAsSecond === true);
            if (startedAsSecond) {
              // DK started on second sub-move; DK completion ends the full turn immediately
              gameState.voidMeta.pending = null;
              await finalizeVoidTurn();
            } else {
              if (otherHasMoves) {
                // Keep pending and require a move on the other board to complete the full turn
                gameState.voidMeta.pending = { color, movedBoards: [originBoardId] };
              } else {
                // Other board has no moves; after finishing DK sequence, finalize
                gameState.voidMeta.pending = null;
                await finalizeVoidTurn();
              }
            }
          } else {
            return res.status(400).json({ message: 'Second sub-move must be on the other board' });
          }
        }

        await storage.updateGameState(gameId, gameState);
        const saved = await storage.addMove({ ...moveData, captured: serverCaptured, special: `void:board=${boardId}` } as any);
        return broadcastAndReturn(saved);
      }
  const piece = gameState.board[moveData.from];
  const targetPiece = gameState.board[moveData.to];
  let serverCaptured: string | undefined = undefined; // authoritative captured field computed on server
      
      // Basic validation: cannot capture own pieces, except for Chess960 castling where king may not move (from==to)
      if (piece && targetPiece && piece.color === targetPiece.color) {
        const allowNoopCastling = (
          piece.type === 'king' &&
          moveData.from === moveData.to &&
          isValidCastlingMove(gameState, piece, moveData.from, moveData.to, game.rules as any)
        );
        if (!allowNoopCastling) {
          return res.status(400).json({ message: "Cannot capture your own pieces" });
        }
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
          const cap = gameState.board[captureSquare];
          if (cap) serverCaptured = `${cap.color}-${cap.type}`;
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
          let captureSquare: string | null = null;
          if (gameState.board[leftSquare] && gameState.board[leftSquare].color !== piece.color) {
            captureSquare = leftSquare;
          } else if (gameState.board[rightSquare] && gameState.board[rightSquare].color !== piece.color) {
            captureSquare = rightSquare;
          }
          
          if (captureSquare) {
            console.log('Horizontal en passant - removing pawn from:', captureSquare);
            const cap = gameState.board[captureSquare];
            if (cap) serverCaptured = `${cap.color}-${cap.type}`;
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
  let pendingCastlingRookFrom: string | null = null;
  let pendingCastlingRookTo: string | null = null;
      
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
          // Stage rook relocation (execute after king moves to avoid overwriting king's starting square)
          const rank = moveData.to[1];
          const isKingSide = toFile === 'g';
          pendingCastlingRookTo = `${isKingSide ? 'f' : 'd'}${rank}`;
          let rookFrom = `${isKingSide ? 'h' : 'a'}${rank}`;
          const isFischer = Array.isArray(game.rules) && (game.rules as any).includes('fischer-random');
          if (isFischer && gameState.castlingRooks) {
            const side = isKingSide ? 'kingSide' : 'queenSide';
            const mapped = gameState.castlingRooks[piece.color]?.[side];
            if (mapped) rookFrom = mapped;
          }
          pendingCastlingRookFrom = rookFrom;
          serverCaptured = undefined;
        } else if (isBlinkTeleport && !isCastling) {
          // Mark Blink as used for this color (but not for castling)
          if (!gameState.blinkUsed) {
            gameState.blinkUsed = { white: false, black: false };
          }
          gameState.blinkUsed[piece.color] = true;
        }
      }

      // Move the piece
      // If this is a standard capture (non-en-passant, non-castling), record it
      if (!serverCaptured && targetPiece && targetPiece.color !== piece.color) {
        serverCaptured = `${targetPiece.color}-${targetPiece.type}`;
      }
      // In Chess960, castling can have from==to when king starts on c/g; keep king in place
      if (!(isCastling && moveData.from === moveData.to)) {
        gameState.board[moveData.to] = piece;
        delete gameState.board[moveData.from];
      }

      // After moving the king, perform staged rook move for castling
      if (isCastling && pendingCastlingRookFrom && pendingCastlingRookTo) {
        gameState.board[pendingCastlingRookTo] = gameState.board[pendingCastlingRookFrom];
        delete (gameState.board as any)[pendingCastlingRookFrom];
      }

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
        // Disable appropriate castling rights based on which rook moved (Chess960-aware)
        const cr = gameState.castlingRooks;
        if (cr) {
          const sideWhiteK = cr.white?.kingSide;
          const sideWhiteQ = cr.white?.queenSide;
          const sideBlackK = cr.black?.kingSide;
          const sideBlackQ = cr.black?.queenSide;
          if (moveData.from === sideWhiteQ) gameState.castlingRights.whiteQueenside = false;
          if (moveData.from === sideWhiteK) gameState.castlingRights.whiteKingside = false;
          if (moveData.from === sideBlackQ) gameState.castlingRights.blackQueenside = false;
          if (moveData.from === sideBlackK) gameState.castlingRights.blackKingside = false;
        } else {
          // Fallback to standard squares
          if (moveData.from === 'a1') gameState.castlingRights.whiteQueenside = false;
          else if (moveData.from === 'h1') gameState.castlingRights.whiteKingside = false;
          else if (moveData.from === 'a8') gameState.castlingRights.blackQueenside = false;
          else if (moveData.from === 'h8') gameState.castlingRights.blackKingside = false;
        }
      } else if (targetPiece && targetPiece.type === 'rook') {
        // If a rook was captured on its original castling square, disable that side's rights (Chess960-aware)
        const capturedColor: 'white' | 'black' = targetPiece.color;
        const cr = gameState.castlingRooks;
        if (cr) {
          if (moveData.to === cr[capturedColor]?.queenSide) {
            if (capturedColor === 'white') gameState.castlingRights.whiteQueenside = false; else gameState.castlingRights.blackQueenside = false;
          }
          if (moveData.to === cr[capturedColor]?.kingSide) {
            if (capturedColor === 'white') gameState.castlingRights.whiteKingside = false; else gameState.castlingRights.blackKingside = false;
          }
        } else {
          if (capturedColor === 'white') {
            if (moveData.to === 'a1') gameState.castlingRights.whiteQueenside = false;
            if (moveData.to === 'h1') gameState.castlingRights.whiteKingside = false;
          } else {
            if (moveData.to === 'a8') gameState.castlingRights.blackQueenside = false;
            if (moveData.to === 'h8') gameState.castlingRights.blackKingside = false;
          }
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
      
      // Apply all special rules (without meteor strike here; we trigger meteors at end-of-turn below)
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

  // End-of-turn bookkeeping: increment only when previous player was black AND turn handed to white
  if (game.currentTurn === 'black' && nextTurn === 'white') {
        gameState.fullmoveNumber++;
        // Trigger meteor strike (if due) after a full move completes
        maybeTriggerMeteor(gameState, game.rules as any);
      } else {
        // Keep meteorCounter in sync even mid-move
        if (Array.isArray(game.rules) && (game.rules as any).includes('meteor-shower')) {
          gameState.meteorCounter = gameState.fullmoveNumber;
        }
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
        const moveToSave = { ...moveData, captured: serverCaptured };
        await storage.addMove(moveToSave as any);
      }
  // Возвращаем весь массив ходов, чтобы клиент всегда получал актуальную историю
      const allMoves = await storage.getGameMoves(gameId);
  // Notify subscribers
  broadcast(gameId, 'move', { type: 'move', gameId, move: allMoves[allMoves.length - 1] });
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

  // Notify subscribers
  broadcast(gameId, 'undo', { type: 'undo', gameId });
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
  broadcast(gameId, 'status', { type: 'status', gameId, status: game.status, winner: game.winner });
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
      const sess: any = (req as any).session;
      if (sess) {
        sess.userId = user.id;
      }
      
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

      // Persist session
      const sess: any = (req as any).session;
      if (sess) {
        sess.userId = user.id;
      }
      
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
    const sess: any = (req as any).session;
    if (!sess?.userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }
    
    try {
      const user = await storage.getUser(sess.userId);
      if (!user) {
        return res.status(401).json({ message: 'Пользователь не найден' });
      }
      
  res.json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (error) {
      console.error('Session error:', error);
      res.status(500).json({ message: 'Ошибка сессии' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const sess: any = (req as any).session;
    if (sess && typeof sess.destroy === 'function') {
      sess.destroy(() => res.json({ message: 'Выход выполнен' }));
    } else {
      res.json({ message: 'Выход выполнен' });
    }
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
  broadcast(gameId, 'draw', { type: 'draw-offer', gameId, by: player });
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
  broadcast(gameId, 'draw', { type: 'draw-accept', gameId });
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
  broadcast(gameId, 'draw', { type: 'draw-decline', gameId });
      res.json(updatedGame);
    } catch (error) {
      console.error('Error declining draw:', error);
      res.status(500).json({ message: 'Ошибка отклонения ничьей' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
