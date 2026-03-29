import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GameRules, GameRulesArray } from "@shared/schema";
import { Sword, Plus } from "lucide-react";

interface RuleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRuleSelect: (rules: GameRulesArray) => void;
}

const availableRules = [
  {
    id: 'void' as GameRules,
    name: 'Void (Две доски)',
    description: 'Игра идёт на двух независимых досках. За ход — два под-хода (по доске). Каждые 10 полноходов — токен переноса фигуры между досками.',
    badges: ['Две доски', 'Перенос'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'fischer-random' as GameRules,
    name: 'Шахматы Фишера (Chess960)',
    description: 'Случайная расстановка фигур на 1-й и 8-й горизонталях при сохранении правил (слоны на разном цвете, король между ладьями)',
    badges: ['Старт', 'Случайность'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'double-knight' as GameRules,
    name: 'Двойной Конь',
    description: 'После хода конем нужно сделать второй ход тем же конем',
    badges: ['Тактика', 'Особый'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'pawn-rotation' as GameRules,
    name: 'Поворот Пешек',
    description: 'Пешки могут ходить горизонтально и всегда имеют возможность делать двойные ходы (вперед и в стороны)',
    badges: ['Безграничность', 'Стратегия'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'xray-bishop' as GameRules,
    name: 'Рентген Слон',
    description: 'Слон может проходить сквозь одну фигуру и ходить на клетки за ней',
    badges: ['Проницание', 'Мощный'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'pawn-wall' as GameRules,
    name: 'Стена Пешек',
    description: 'У каждого игрока 2 ряда пешек (2-3 ряды для белых, 6-7 ряды для черных)',
    badges: ['Оборона', 'Массовость'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'blink' as GameRules,
    name: 'Блинк',
    description: 'Король может телепортироваться один раз за игру на любую легальную клетку',
    badges: ['Телепорт', 'Особый'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'fog-of-war' as GameRules,
    name: 'Туман войны',
    description: 'Первые 5 ходов каждый видит только свою половину доски',
    badges: ['Секретность', 'Адаптивность'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
  {
    id: 'meteor-shower' as GameRules,
    name: 'Метеоритный Дождь',
    description: 'Каждые 5 ходов случайная пустая клетка сгорает и блокируется до конца игры',
    badges: ['Хаос', 'Опасность'],
    badgeColors: ['border border-white/10 bg-white/5 text-neutral-200', 'border border-white/10 bg-white/5 text-neutral-200'],
  },
];

export default function RuleSelectionModal({ open, onOpenChange, onRuleSelect }: RuleSelectionModalProps) {
  const [selectedRules, setSelectedRules] = useState<GameRules[]>([]);

  const handleRuleToggle = (ruleId: GameRules) => {
    setSelectedRules(prev => 
      prev.includes(ruleId) 
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const handleSubmit = () => {
    // Если ничего не выбрано, используем стандартные правила
    const finalRules = selectedRules.length === 0 ? ['standard'] : selectedRules;
    onRuleSelect(finalRules as GameRulesArray);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border border-white/10 bg-neutral-950 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl font-semibold tracking-tight text-white">
            <Sword className="mr-3 h-6 w-6 text-white" />
            Выбор Правил Игры
          </DialogTitle>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            Выберите особые правила для шахматной партии. Можно комбинировать несколько правил.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <h3 className="mb-2 text-lg font-semibold text-white">
              Стандартные Шахматы
            </h3>
            <p className="text-sm leading-6 text-neutral-300">
              Если ничего не выбрано, будут использованы классические правила
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center text-lg font-semibold text-white">
              <Plus className="mr-2 h-5 w-5 text-neutral-300" />
              Дополнительные Правила
            </h3>
            
            {availableRules.map((rule) => (
              <div
                key={rule.id}
                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                  selectedRules.includes(rule.id) 
                    ? 'border-white/40 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
                }`}
                onClick={() => handleRuleToggle(rule.id)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <Checkbox 
                      checked={selectedRules.includes(rule.id)}
                      onCheckedChange={() => handleRuleToggle(rule.id)}
                      id={rule.id}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={rule.id} className="cursor-pointer text-lg font-semibold text-white">
                      {rule.name}
                    </Label>
                    <p className="mt-1 leading-6 text-neutral-300">{rule.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rule.badges.map((badge, index) => (
                        <Badge
                          key={badge}
                          variant="secondary"
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${rule.badgeColors[index]}`}
                        >
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {selectedRules.length > 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h4 className="mb-2 font-semibold text-white">Выбранные правила:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedRules.map((ruleId) => {
                  const rule = availableRules.find(r => r.id === ruleId);
                  return rule ? (
                    <Badge key={ruleId} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-neutral-200">
                      {rule.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            className="border border-white bg-white text-black hover:bg-neutral-200"
          >
            Начать Игру
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
