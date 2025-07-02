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
  console.log("GameTypeModal render:", { open });
  
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Выберите тип игры</h2>
        
        <div className="grid gap-4">
          <div className="cursor-pointer hover:bg-gray-50 p-4 rounded border" onClick={onSinglePlayer}>
            <h3 className="text-lg font-semibold">🎯 Одиночная игра</h3>
            <p className="text-gray-600 mb-3">
              Играйте против самого себя или тренируйтесь с различными правилами
            </p>
            <Button className="w-full" onClick={onSinglePlayer}>
              Начать одиночную игру
            </Button>
          </div>

          <div className="cursor-pointer hover:bg-gray-50 p-4 rounded border" onClick={onMultiplayer}>
            <h3 className="text-lg font-semibold">👥 Игра с другом</h3>
            <p className="text-gray-600 mb-3">
              Создайте приглашение и поделитесь ссылкой с другом для игры вдвоём
            </p>
            <Button className="w-full" variant="outline" onClick={onMultiplayer}>
              Создать приглашение
            </Button>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full mt-4"
          onClick={() => onOpenChange(false)}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}