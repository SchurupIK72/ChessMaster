import { ChessGameState, ChessPiece, GameRulesArray } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ChessBoardProps {
  gameState: ChessGameState;
  selectedSquare: string | null;
  validMoves: string[];
  onSquareClick: (square: string) => void;
  currentTurn: 'white' | 'black';
  flipped?: boolean;
  lastMoveSquares?: { from: string, to: string } | null;
  rules?: GameRulesArray | string[];
  viewerColor?: 'white' | 'black' | null;
  fogActiveOverride?: boolean;
  fogCutoff?: number;
}

const pieceSymbols: Record<string, string> = {
  'white-king': '♔',
  'white-queen': '♕',
  'white-rook': '♖',
  'white-bishop': '♗',
  'white-knight': '♘',
  'white-pawn': '♙',
  'black-king': '♚',
  'black-queen': '♛',
  'black-rook': '♜',
  'black-bishop': '♝',
  'black-knight': '♞',
  'black-pawn': '♟︎',
};

export default function ChessBoard({ gameState, selectedSquare, validMoves, onSquareClick, currentTurn, flipped = false, lastMoveSquares, rules = [], viewerColor, fogActiveOverride, fogCutoff }: ChessBoardProps) {
  const files = flipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];

  // Rule: Fog of War — active early-game masking; can be overridden by parent (e.g., with double-knight adjustments)
  const effectiveCutoff = typeof fogCutoff === 'number' ? fogCutoff : 5;
  const isFogActive = fogActiveOverride ?? (Array.isArray(rules) && rules.includes('fog-of-war' as any) && (gameState.fullmoveNumber ?? 1) <= effectiveCutoff);
  const isSquareMasked = (rank: number): boolean => {
    if (!isFogActive || !viewerColor) return false;
    // White sees ranks 1-4; Black sees ranks 5-8
    if (viewerColor === 'white') return rank >= 5; // mask opponent half
    if (viewerColor === 'black') return rank <= 4; // mask opponent half
    return false;
  };

  // Классическая шахматная раскраска: светлая, если сумма индексов четная
  const isLightSquare = (file: string, rank: number) => {
    const fileIndex = files.indexOf(file);
    const rankIndex = ranks.indexOf(rank);
    return (fileIndex + rankIndex) % 2 === 0;
  };

  const renderSquare = (file: string, rank: number) => {
    const square = `${file}${rank}`;
    const piece = gameState.board[square] as ChessPiece | null;
    const isSelected = selectedSquare === square;
    const isValidMove = validMoves.includes(square);
    const isLight = isLightSquare(file, rank);
    const isMasked = isSquareMasked(rank);
    const isLastMoveFrom = !isMasked && lastMoveSquares?.from === square;
    const isLastMoveTo = !isMasked && lastMoveSquares?.to === square;

    return (
      <div
        key={square}
        className={cn(
          "aspect-square flex items-center justify-center text-4xl cursor-pointer transition-all relative",
          // Классическая шахматная раскраска
          isLight ? "bg-green-100" : "bg-green-700",
          "hover:bg-opacity-80",
          isSelected && "bg-blue-400 bg-opacity-60 ring-2 ring-blue-600",
          isValidMove && !isMasked && "bg-yellow-300 bg-opacity-70",
          !piece && isValidMove && !isMasked && "hover:bg-yellow-400 hover:bg-opacity-80",
          piece && !isSelected && isLight ? "hover:bg-green-200" : "hover:bg-green-600",
          isLastMoveFrom && "ring-4 ring-yellow-500 ring-opacity-80",
          isLastMoveTo && "ring-4 ring-orange-500 ring-opacity-80"
        )}
        onClick={() => {
          // In fog, prevent selecting hidden squares unless it's a valid destination from an already selected piece
          if (isMasked) {
            if (selectedSquare && isValidMove) {
              onSquareClick(square);
            }
            return;
          }
          onSquareClick(square);
        }}
      >
        {/* Fog overlay */}
        {isMasked && (
          <div className="absolute inset-0 bg-slate-900/40 pointer-events-none" />
        )}

        {/* Pieces: hidden under fog */}
        {piece && !isMasked && (
          <span 
            className={cn(
              "select-none font-bold",
              piece.color === 'white' ? "text-white" : "text-black"
            )} 
            style={{ 
              filter: piece.color === 'white' 
                ? 'drop-shadow(2px 2px 4px rgba(0,0,0,0.9))' 
                : 'drop-shadow(2px 2px 4px rgba(255,255,255,0.9))',
              fontSize: '2.5rem',
              textShadow: piece.color === 'white' 
                ? '2px 2px 4px rgba(0,0,0,0.8)' 
                : '2px 2px 4px rgba(255,255,255,0.8)'
            }}
          >
            {pieceSymbols[`${piece.color}-${piece.type}`]}
          </span>
        )}
        {isValidMove && !piece && !isMasked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 bg-yellow-400 rounded-full opacity-80 shadow-lg border-2 border-yellow-600" />
          </div>
        )}
        {isValidMove && piece && !isMasked && (
          <div className="absolute inset-0 border-4 border-yellow-400 opacity-80 pointer-events-none rounded-lg shadow-lg" />
        )}
        {/* Neutral marker in fog for valid moves without revealing captures */}
        {isMasked && isValidMove && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 bg-yellow-300/80 rounded-full shadow" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-full max-w-2xl">
      {/* Black Player Info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-slate-800 rounded-full" />
          <span className="font-medium text-slate-800">Black Player</span>
        </div>
        <div className="text-sm text-slate-500">
          <span>♛</span>
        </div>
      </div>

      {/* Chess Board with coordinates */}
      <div className="aspect-square w-full p-2 rounded-lg relative overflow-hidden bg-slate-800">
        {/* Board grid */}
        <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full relative">
          {/* Squares */}
          {ranks.map(rank =>
            files.map(file => renderSquare(file, rank))
          )}
          {/* Left numbers */}
          {ranks.map((rank, i) => (
            <span
              key={rank}
              className="absolute text-white text-xs font-bold drop-shadow pointer-events-none select-none"
              style={{
                left: 2,
                top: `calc(${(i) * 12.5}% + 8px)`,
                zIndex: 20
              }}
            >
              {rank}
            </span>
          ))}
          {/* Bottom letters */}
          {files.map((file, i) => (
            <span
              key={file}
              className="absolute text-white text-xs font-bold drop-shadow pointer-events-none select-none"
              style={{
                left: `calc(${i * 12.5}% + 18px)`,
                bottom: 2,
                zIndex: 20
              }}
            >
              {file}
            </span>
          ))}
        </div>
      </div>

      {/* White Player Info */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-white border-2 border-slate-800 rounded-full" />
          <span className="font-medium text-slate-800">White Player</span>
        </div>
        <div className="text-sm text-slate-500">
          <span>♔</span>
        </div>
      </div>

      {/* Current Turn Indicator */}
      {gameState.isCheck && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-center">
          <span className="text-red-800 font-medium">Check!</span>
        </div>
      )}
      
      {gameState.isCheckmate && (
        <div className="mt-4 p-3 bg-red-600 text-white rounded-lg text-center">
          <span className="font-bold">Checkmate! {currentTurn === 'white' ? 'Black' : 'White'} wins!</span>
        </div>
      )}

      {gameState.isStalemate && (
        <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
          <span className="text-yellow-800 font-medium">Stalemate! Draw game.</span>
        </div>
      )}
    </div>
  );
}
