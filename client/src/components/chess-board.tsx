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
  'black-pawn': '♟︎',
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
          "aspect-square flex items-center justify-center text-4xl cursor-pointer transition-all relative",
          // Классическая шахматная раскраска
          isLight ? "bg-green-100" : "bg-green-700",
          "hover:bg-opacity-80",
          isSelected && "bg-blue-400 bg-opacity-60 ring-2 ring-blue-600",
          isValidMove && "bg-yellow-300 bg-opacity-70",
          !piece && isValidMove && "hover:bg-yellow-400 hover:bg-opacity-80",
          piece && !isSelected && isLight ? "hover:bg-green-200" : "hover:bg-green-600"
        )}
        onClick={() => onSquareClick(square)}
      >
        {piece && (
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
        {isValidMove && !piece && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 bg-yellow-400 rounded-full opacity-80 shadow-lg border-2 border-yellow-600" />
          </div>
        )}
        {isValidMove && piece && (
          <div className="absolute inset-0 border-4 border-yellow-400 opacity-80 pointer-events-none rounded-lg shadow-lg" />
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
        {/* Left numbers */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between z-10 pointer-events-none select-none">
          {ranks.map((rank) => (
            <div key={rank} className="h-1/8 flex items-center" style={{height: '12.5%'}}>
              <span className="text-white text-xs font-bold ml-1 drop-shadow">{rank}</span>
            </div>
          ))}
        </div>
        {/* Bottom letters */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between z-10 pointer-events-none select-none">
          {files.map((file) => (
            <div key={file} className="w-1/8 flex justify-center" style={{width: '12.5%'}}>
              <span className="text-white text-xs font-bold mb-1 drop-shadow">{file}</span>
            </div>
          ))}
        </div>
        {/* Board grid */}
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
