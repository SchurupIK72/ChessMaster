import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JoinGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinGame: (shareId: string) => void;
  isLoading?: boolean;
}

export default function JoinGameModal({ open, onOpenChange, onJoinGame, isLoading = false }: JoinGameModalProps) {
  const [shareId, setShareId] = useState("");
  const { toast } = useToast();

  const handleJoinGame = () => {
    const trimmedId = shareId.trim().toUpperCase();
    
    if (!trimmedId) {
      toast({
        title: "Ошибка",
        description: "Введите код игры",
        variant: "destructive",
      });
      return;
    }

    if (trimmedId.length !== 6) {
      toast({
        title: "Ошибка",
        description: "Код игры должен содержать 6 символов",
        variant: "destructive",
      });
      return;
    }

    onJoinGame(trimmedId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setShareId(value);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleJoinGame();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Присоединиться к игре
          </DialogTitle>
          <DialogDescription>
            Введите 6-значный код игры, полученный от друга
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="shareId">Код игры</Label>
            <Input
              id="shareId"
              placeholder="ABC123"
              value={shareId}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              maxLength={6}
              className="text-center text-xl font-mono tracking-[0.3em] font-bold uppercase"
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              Код состоит из 6 букв и цифр
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleJoinGame}
              disabled={!shareId.trim() || shareId.length !== 6 || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Подключение...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Присоединиться
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Отмена
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              После присоединения игра начнется автоматически
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}