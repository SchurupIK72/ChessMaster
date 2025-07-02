import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Copy, Users, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GameTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGame: () => void;
  onJoinGame: (shareId: string) => void;
}

export default function GameTypeModal({ open, onOpenChange, onCreateGame, onJoinGame }: GameTypeModalProps) {
  const [shareId, setShareId] = useState("");
  const { toast } = useToast();

  const handleJoinGame = () => {
    if (!shareId.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите код игры",
        variant: "destructive",
      });
      return;
    }
    onJoinGame(shareId.trim().toUpperCase());
  };

  const handleCreateGame = () => {
    onCreateGame();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Выберите тип игры</DialogTitle>
          <DialogDescription className="text-center">
            Создайте новую игру или присоединитесь к существующей
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Create New Game Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Создать новую игру</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Создайте игру с выбранными правилами и получите ссылку для друга
            </p>
            <Button 
              onClick={handleCreateGame}
              className="w-full"
              size="lg"
            >
              <Users className="mr-2 h-4 w-4" />
              Создать игру с другом
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">или</span>
            </div>
          </div>

          {/* Join Existing Game Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Присоединиться к игре</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Введите код игры, полученный от друга
            </p>
            <div className="space-y-2">
              <Label htmlFor="shareId">Код игры</Label>
              <Input
                id="shareId"
                placeholder="Например: ABC123"
                value={shareId}
                onChange={(e) => setShareId(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-lg font-mono tracking-wider"
              />
            </div>
            <Button 
              onClick={handleJoinGame}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Присоединиться к игре
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}