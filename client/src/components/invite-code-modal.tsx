import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface InviteCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteCode: string;
  gameId: number;
}

export default function InviteCodeModal({ 
  open, 
  onOpenChange, 
  inviteCode, 
  gameId 
}: InviteCodeModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const inviteLink = `${window.location.origin}/game/${gameId}?invite=${inviteCode}`;
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "Ссылка скопирована!",
        description: "Отправьте эту ссылку другу для присоединения к игре",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Ошибка копирования",
        description: "Не удалось скопировать ссылку",
        variant: "destructive",
      });
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Приглашение на игру в шахматы",
          text: "Присоединяйтесь к моей игре в шахматы!",
          url: inviteLink,
        });
      } catch (err) {
        // User cancelled sharing or error occurred
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Пригласить друга</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Поделитесь этой ссылкой с другом, чтобы он мог присоединиться к игре
            </p>
            
            <div className="bg-muted p-4 rounded-lg mb-4">
              <div className="font-mono text-2xl font-bold tracking-widest">
                {inviteCode}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Код приглашения
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-link">Ссылка для приглашения</Label>
            <div className="flex space-x-2">
              <Input
                id="invite-link"
                value={inviteLink}
                readOnly
                className="flex-1"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={copyToClipboard}
                className={copied ? "bg-green-50 border-green-300" : ""}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={shareLink} className="flex-1">
              <Share className="h-4 w-4 mr-2" />
              Поделиться
            </Button>
            <Button variant="outline" onClick={copyToClipboard} className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "Скопировано!" : "Копировать"}
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Как это работает:</strong><br />
              Ваш друг должен открыть ссылку или ввести код приглашения. 
              Игра начнётся автоматически, когда присоединятся оба игрока.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}