import { Settings, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GameSettingsPlaceholderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const placeholderSections = [
  "Настройки партии",
  "Интерфейс доски",
  "Игровые уведомления",
];

export default function GameSettingsPlaceholder({
  open,
  onOpenChange,
}: GameSettingsPlaceholderProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/10 bg-neutral-950 p-0 text-white shadow-[0_32px_120px_rgba(0,0,0,0.55)] sm:max-w-xl">
        <div className="overflow-hidden rounded-[28px]">
          <div className="border-b border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent px-6 py-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-3xl font-bold text-white">
                Настройки
              </DialogTitle>
              <DialogDescription className="max-w-md text-sm leading-6 text-white/65">
                Экран уже подключен к кнопке в шапке. Логику и сохранение
                настроек добавим следующим этапом.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-6">
            {placeholderSections.map((section) => (
              <div
                key={section}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-white">{section}</p>
                  <p className="mt-1 text-sm text-white/55">
                    Будет доступно в следующей итерации.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30">
                  <SlidersHorizontal className="h-4 w-4 text-white/70" />
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-white text-black hover:bg-neutral-200"
              >
                Вернуться к партии
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
