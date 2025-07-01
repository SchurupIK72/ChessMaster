import { ChessGameState, ChessPiece } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ChessBoardProps {
  gameState: ChessGameState;
  selectedSquare: string | null;
  validMoves: string[];
  onSquareClick: (square: string) => void;
  currentTurn: 'white' | 'black';
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
  'black-pawn': '♟',
};

export default function ChessBoard({ gameState, selectedSquare, validMoves, onSquareClick, currentTurn }: ChessBoardProps) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  const isLightSquare = (file: string, rank: number) => {
    const fileIndex = files.indexOf(file);
    return (fileIndex + rank) % 2 === 0;
  };

  const renderSquare = (file: string, rank: number) => {
    const square = `${file}${rank}`;
    const piece = gameState.board[square] as ChessPiece | null;
    const isSelected = selectedSquare === square;
    const isValidMove = validMoves.includes(square);
    const isLight = isLightSquare(file, rank);

    return (
      <div
        key={square}
        className={cn(
          "aspect-square flex items-center justify-center text-4xl cursor-pointer transition-colors relative",
          isLight ? "bg-amber-100" : "bg-amber-800",
          isSelected && "ring-4 ring-blue-400 ring-opacity-75",
          isValidMove && "bg-green-200 dark:bg-green-800",
          !piece && isValidMove && "hover:bg-green-300 dark:hover:bg-green-700",
          piece && !isSelected && "hover:bg-blue-200 dark:hover:bg-blue-800"
        )}
        onClick={() => onSquareClick(square)}
      >
        {piece && (
          <span className="select-none">
            {pieceSymbols[`${piece.color}-${piece.type}`]}
          </span>
        )}
        {isValidMove && !piece && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-green-600 rounded-full opacity-60" />
          </div>
        )}
        {isValidMove && piece && (
          <div className="absolute inset-0 border-4 border-green-600 opacity-60 pointer-events-none" />
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

      {/* Chess Board */}
      <div className="aspect-square w-full bg-slate-800 p-2 rounded-lg">
        <div className="grid grid-cols-8 gap-0 w-full h-full">
          {ranks.map(rank =>
            files.map(file => renderSquare(file, rank))
          )}
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
