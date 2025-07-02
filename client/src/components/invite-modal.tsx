import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareId: string;
  gameUrl: string;
}

export default function InviteModal({ open, onOpenChange, shareId, gameUrl }: InviteModalProps) {
  const { toast } = useToast();

  const copyShareId = async () => {
    try {
      await navigator.clipboard.writeText(shareId);
      toast({
        title: "Скопировано!",
        description: "Код игры скопирован в буфер обмена",
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать код",
        variant: "destructive",
      });
    }
  };

  const copyGameUrl = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      toast({
        title: "Скопировано!",
        description: "Ссылка на игру скопирована в буфер обмена",
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ссылку",
        variant: "destructive",
      });
    }
  };

  const shareGame = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Игра в шахматы',
          text: `Присоединяйтесь к моей игре в шахматы! Код: ${shareId}`,
          url: gameUrl,
        });
      } catch (err) {
        // User cancelled sharing
      }
    } else {
      // Fallback to copying URL
      copyGameUrl();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Пригласить друга
          </DialogTitle>
          <DialogDescription>
            Поделитесь кодом игры или ссылкой с другом для начала партии
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Share ID Section */}
          <div className="space-y-3">
            <Label htmlFor="share-id">Код игры</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="share-id"
                value={shareId}
                readOnly
                className="text-center text-lg font-mono tracking-wider font-bold"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={copyShareId}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ваш друг может ввести этот код в поле "Присоединиться к игре"
            </p>
          </div>

          {/* Game URL Section */}
          <div className="space-y-3">
            <Label htmlFor="game-url">Прямая ссылка</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="game-url"
                value={gameUrl}
                readOnly
                className="text-sm"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={copyGameUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Или отправьте эту ссылку напрямую
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={shareGame}
              className="flex-1"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Поделиться
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Готово
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Игра начнется автоматически, когда ваш друг присоединится
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}