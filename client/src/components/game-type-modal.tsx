import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Play, Link2 } from "lucide-react";

interface GameTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGame: () => void;
  onJoinGame: () => void;
}

export default function GameTypeModal({ open, onOpenChange, onCreateGame, onJoinGame }: GameTypeModalProps) {
  const handleCreateGame = () => {
    onCreateGame();
    onOpenChange(false);
  };

  const handleOpenJoin = () => {
    onJoinGame();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Choose Match Flow</DialogTitle>
          <DialogDescription className="text-center">
            Create a new ChessMaster match or open the join screen for a match link or legacy game code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Create a new match</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Start a fresh game with custom rules and get a canonical match link to share with players and spectators.
            </p>
            <Button onClick={handleCreateGame} className="w-full" size="lg">
              <Users className="mr-2 h-4 w-4" />
              Create Match
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Join by link or code</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste a canonical `/match...` link, an old `/join/...` link, or a 6-character legacy game code.
            </p>
            <Button onClick={handleOpenJoin} variant="outline" className="w-full" size="lg">
              Open Join Screen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
