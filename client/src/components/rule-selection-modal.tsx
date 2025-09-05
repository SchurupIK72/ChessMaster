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
    id: 'double-knight' as GameRules,
    name: 'Двойной Конь',
    description: 'После хода конем нужно сделать второй ход тем же конем',
    badges: ['Тактика', 'Особый'],
    badgeColors: ['bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800'],
  },
  {
    id: 'pawn-rotation' as GameRules,
    name: 'Поворот Пешек',
    description: 'Пешки могут ходить горизонтально и всегда имеют возможность делать двойные ходы (вперед и в стороны)',
    badges: ['Безграничность', 'Стратегия'],
    badgeColors: ['bg-yellow-100 text-yellow-800', 'bg-red-100 text-red-800'],
  },
  {
    id: 'xray-bishop' as GameRules,
    name: 'Рентген Слон',
    description: 'Слон может проходить сквозь одну фигуру и ходить на клетки за ней',
    badges: ['Проницание', 'Мощный'],
    badgeColors: ['bg-cyan-100 text-cyan-800', 'bg-indigo-100 text-indigo-800'],
  },
  {
    id: 'pawn-wall' as GameRules,
    name: 'Стена Пешек',
    description: 'У каждого игрока 2 ряда пешек (2-3 ряды для белых, 6-7 ряды для черных)',
    badges: ['Оборона', 'Массовость'],
    badgeColors: ['bg-gray-100 text-gray-800', 'bg-blue-100 text-blue-800'],
  },
  {
    id: 'blink' as GameRules,
    name: 'Блинк',
    description: 'Король может телепортироваться один раз за игру на любую легальную клетку',
    badges: ['Телепорт', 'Особый'],
    badgeColors: ['bg-violet-100 text-violet-800', 'bg-pink-100 text-pink-800'],
  },
  {
    id: 'fog-of-war' as GameRules,
    name: 'Туман войны',
    description: 'Первые 5 ходов каждый видит только свою половину доски',
    badges: ['Секретность', 'Адаптивность'],
    badgeColors: ['bg-slate-100 text-slate-800', 'bg-amber-100 text-amber-800'],
  },
  {
    id: 'meteor-shower' as GameRules,
    name: 'Метеоритный Дождь',
    description: 'Каждые 5 ходов случайная пустая клетка сгорает и блокируется до конца игры',
    badges: ['Хаос', 'Опасность'],
    badgeColors: ['bg-orange-100 text-orange-800', 'bg-red-100 text-red-800'],
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-800 flex items-center">
            <Sword className="h-6 w-6 mr-3 text-blue-600" />
            Выбор Правил Игры
          </DialogTitle>
          <p className="text-slate-600 mt-2">
            Выберите особые правила для шахматной партии. Можно комбинировать несколько правил.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Стандартные Шахматы
            </h3>
            <p className="text-slate-600 text-sm">
              Если ничего не выбрано, будут использованы классические правила
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
              <Plus className="h-5 w-5 mr-2 text-green-600" />
              Дополнительные Правила
            </h3>
            
            {availableRules.map((rule) => (
              <div
                key={rule.id}
                className={`border rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer ${
                  selectedRules.includes(rule.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200'
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
                    <Label htmlFor={rule.id} className="text-lg font-semibold text-slate-800 cursor-pointer">
                      {rule.name}
                    </Label>
                    <p className="text-slate-600 mt-1">{rule.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rule.badges.map((badge, index) => (
                        <Badge
                          key={badge}
                          variant="secondary"
                          className={`text-xs ${rule.badgeColors[index]}`}
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
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">Выбранные правила:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedRules.map((ruleId) => {
                  const rule = availableRules.find(r => r.id === ruleId);
                  return rule ? (
                    <Badge key={ruleId} className="bg-green-100 text-green-800">
                      {rule.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-600 hover:text-slate-800"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Начать Игру
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
