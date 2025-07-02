import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface JoinGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinGame: (inviteCode: string) => void;
  isLoading?: boolean;
}

export default function JoinGameModal({ 
  open, 
  onOpenChange, 
  onJoinGame,
  isLoading = false
}: JoinGameModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      onJoinGame(inviteCode.trim().toUpperCase());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Присоединиться к игре</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Код приглашения</Label>
            <Input
              id="invite-code"
              placeholder="Введите код (например: ABC123)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center font-mono text-lg tracking-widest"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Введите 6-значный код, который получили от друга
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!inviteCode.trim() || isLoading}
            >
              {isLoading ? "Подключение..." : "Присоединиться"}
            </Button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              💡 <strong>Совет:</strong> Попросите друга поделиться ссылкой или 
              кодом приглашения. Когда вы присоединитесь, игра начнётся автоматически.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}