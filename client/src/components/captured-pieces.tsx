import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sword } from "lucide-react";

interface CapturedPiecesProps {
  capturedPieces: {
    white: string[];
    black: string[];
  };
  title?: string;
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

export default function CapturedPieces({ capturedPieces, title }: CapturedPiecesProps) {
  return (
    <Card className="border border-black/10 shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center">
          <Sword className="h-5 w-5 mr-2 text-neutral-900" />
          {title || 'Captured Pieces'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-neutral-600 mb-2">White Captured:</p>
          <div className="flex flex-wrap gap-1 min-h-[2rem]">
            {capturedPieces.white.length > 0 ? (
              capturedPieces.white.map((piece, index) => (
                <span key={index} className="text-2xl">
                  {pieceSymbols[piece] || '?'}
                </span>
              ))
            ) : (
              <span className="text-neutral-400 text-sm">None</span>
            )}
          </div>
        </div>
        
        <div>
          <p className="text-sm font-medium text-neutral-600 mb-2">Black Captured:</p>
          <div className="flex flex-wrap gap-1 min-h-[2rem]">
            {capturedPieces.black.length > 0 ? (
              capturedPieces.black.map((piece, index) => (
                <span key={index} className="text-2xl">
                  {pieceSymbols[piece] || '?'}
                </span>
              ))
            ) : (
              <span className="text-neutral-400 text-sm">None</span>
            )}
          </div>
        </div>

        {capturedPieces.white.length === 0 && capturedPieces.black.length === 0 && (
          <div className="text-center py-4 text-neutral-500">
            <p className="text-sm">No pieces captured yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
