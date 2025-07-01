import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PawnPromotionModalProps {
  open: boolean;
  onSelectPiece: (pieceType: 'queen' | 'rook' | 'bishop' | 'knight') => void;
  color: 'white' | 'black';
}

const pieceSymbols = {
  white: {
    queen: '♕',
    rook: '♖', 
    bishop: '♗',
    knight: '♘'
  },
  black: {
    queen: '♛',
    rook: '♜',
    bishop: '♝', 
    knight: '♞'
  }
};

export default function PawnPromotionModal({ open, onSelectPiece, color }: PawnPromotionModalProps) {
  const pieces = ['queen', 'rook', 'bishop', 'knight'] as const;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Превращение пешки
          </DialogTitle>
          <p className="text-center text-slate-600">Выберите фигуру для превращения:</p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 p-4">
          {pieces.map((piece) => (
            <Button
              key={piece}
              variant="outline"
              size="lg"
              className="h-20 flex flex-col items-center justify-center hover:bg-blue-50"
              onClick={() => onSelectPiece(piece)}
            >
              <span className="text-4xl mb-2">
                {pieceSymbols[color][piece]}
              </span>
              <span className="text-sm capitalize">
                {piece === 'queen' && 'Ферзь'}
                {piece === 'rook' && 'Ладья'}
                {piece === 'bishop' && 'Слон'}
                {piece === 'knight' && 'Конь'}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}