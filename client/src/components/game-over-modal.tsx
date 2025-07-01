import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Trophy, Handshake } from "lucide-react";

interface GameOverModalProps {
  open: boolean;
  result: 'checkmate' | 'stalemate' | 'draw' | 'resignation';
  winner?: 'white' | 'black' | null;
  onNewGame: () => void;
  onClose: () => void;
}

export default function GameOverModal({ open, result, winner, onNewGame, onClose }: GameOverModalProps) {
  const getTitle = () => {
    switch (result) {
      case 'checkmate':
        return winner === 'white' ? 'Белые победили!' : 'Черные победили!';
      case 'stalemate':
        return 'Пат!';
      case 'draw':
        return 'Ничья!';
      case 'resignation':
        return winner === 'white' ? 'Белые победили!' : 'Черные победили!';
      default:
        return 'Игра завершена';
    }
  };

  const getDescription = () => {
    switch (result) {
      case 'checkmate':
        return `Мат! ${winner === 'white' ? 'Белые' : 'Черные'} выиграли партию.`;
      case 'stalemate':
        return 'Король не находится под шахом, но не может сделать ход. Ничья.';
      case 'draw':
        return 'Игроки договорились о ничьей.';
      case 'resignation':
        return `${winner === 'white' ? 'Черные' : 'Белые'} сдались. ${winner === 'white' ? 'Белые' : 'Черные'} победили!`;
      default:
        return 'Игра завершена.';
    }
  };

  const getIcon = () => {
    if (result === 'checkmate' || result === 'resignation') {
      return <Trophy className="h-16 w-16 text-yellow-500" />;
    } else if (result === 'draw' || result === 'stalemate') {
      return <Handshake className="h-16 w-16 text-blue-500" />;
    }
    return <Crown className="h-16 w-16 text-purple-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>
          <DialogTitle className="text-2xl font-bold text-slate-800">
            {getTitle()}
          </DialogTitle>
          <p className="text-slate-600 mt-2">{getDescription()}</p>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-6">
          <Button 
            onClick={onNewGame}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            Новая игра
          </Button>
          <Button 
            onClick={onClose}
            variant="outline"
            size="lg"
          >
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}