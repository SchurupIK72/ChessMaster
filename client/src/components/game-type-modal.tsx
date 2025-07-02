import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GameTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSinglePlayer: () => void;
  onMultiplayer: () => void;
}

export default function GameTypeModal({ 
  open, 
  onOpenChange, 
  onSinglePlayer, 
  onMultiplayer 
}: GameTypeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выберите тип игры</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4">
          <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={onSinglePlayer}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">🎯 Одиночная игра</CardTitle>
              <CardDescription>
                Играйте против самого себя или тренируйтесь с различными правилами
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full" onClick={onSinglePlayer}>
                Начать одиночную игру
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={onMultiplayer}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">👥 Игра с другом</CardTitle>
              <CardDescription>
                Создайте приглашение и поделитесь ссылкой с другом для игры вдвоём
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full" variant="outline" onClick={onMultiplayer}>
                Создать приглашение
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}