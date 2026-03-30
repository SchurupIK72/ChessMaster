import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Trophy, Handshake } from "lucide-react";

interface GameOverModalProps {
  open: boolean;
  result: "checkmate" | "stalemate" | "draw" | "resignation" | "timeout";
  winner?: "white" | "black" | null;
  onNewGame: () => void;
  onClose: () => void;
}

export default function GameOverModal({ open, result, winner, onNewGame, onClose }: GameOverModalProps) {
  const getTitle = () => {
    switch (result) {
      case "checkmate":
      case "resignation":
        return winner === "white" ? "White wins!" : "Black wins!";
      case "timeout":
        return winner === "white" ? "White wins on time!" : "Black wins on time!";
      case "stalemate":
        return "Stalemate";
      case "draw":
        return "Draw";
      default:
        return "Game over";
    }
  };

  const getDescription = () => {
    switch (result) {
      case "checkmate":
        return `Checkmate. ${winner === "white" ? "White" : "Black"} finished the game.`;
      case "stalemate":
        return "No legal moves remain, but the king is not in check.";
      case "draw":
        return "The game ended in a draw.";
      case "resignation":
        return `${winner === "white" ? "Black" : "White"} resigned.`;
      case "timeout":
        return `${winner === "white" ? "White" : "Black"} won because the opponent's clock reached 00:00.`;
      default:
        return "The game has ended.";
    }
  };

  const getIcon = () => {
    if (result === "checkmate" || result === "resignation" || result === "timeout") {
      return <Trophy className="h-16 w-16 text-yellow-500" />;
    }
    if (result === "draw" || result === "stalemate") {
      return <Handshake className="h-16 w-16 text-blue-500" />;
    }
    return <Crown className="h-16 w-16 text-neutral-900" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <div className="mb-4 flex justify-center">{getIcon()}</div>
          <DialogTitle className="text-2xl font-bold text-slate-800">{getTitle()}</DialogTitle>
          <p className="mt-2 text-slate-600">{getDescription()}</p>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={onNewGame} className="bg-black text-white hover:bg-neutral-800" size="lg">
            New game
          </Button>
          <Button onClick={onClose} variant="outline" size="lg">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
