import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GameRules } from "@shared/schema";
import { Sword } from "lucide-react";

interface RuleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRuleSelect: (rules: GameRules) => void;
}

const gameRules = [
  {
    id: 'standard' as GameRules,
    name: 'Standard Sword',
    description: 'Classic chess rules with traditional gameplay',
    badges: ['Default', 'Beginner Friendly'],
    badgeColors: ['bg-green-100 text-green-800', 'bg-blue-100 text-blue-800'],
  },
  {
    id: 'koth' as GameRules,
    name: 'King of the Hill',
    description: 'Win by moving your king to the center four squares (d4, d5, e4, e5)',
    badges: ['Aggressive', 'Fast Paced'],
    badgeColors: ['bg-orange-100 text-orange-800', 'bg-purple-100 text-purple-800'],
  },
  {
    id: 'atomic' as GameRules,
    name: 'Atomic Sword',
    description: 'Captures cause explosions that destroy surrounding pieces',
    badges: ['Explosive', 'Chaotic'],
    badgeColors: ['bg-red-100 text-red-800', 'bg-yellow-100 text-yellow-800'],
  },
  {
    id: 'threetime' as GameRules,
    name: 'Three-Check',
    description: 'Win by putting your opponent in check three times',
    badges: ['Tactical', 'Strategic'],
    badgeColors: ['bg-indigo-100 text-indigo-800', 'bg-green-100 text-green-800'],
  },
  {
    id: 'fischer' as GameRules,
    name: 'Fischer Random (Chess960)',
    description: 'Randomized starting position for back-rank pieces',
    badges: ['Creative', 'Unpredictable'],
    badgeColors: ['bg-teal-100 text-teal-800', 'bg-pink-100 text-pink-800'],
  },
];

export default function RuleSelectionModal({ open, onOpenChange, onRuleSelect }: RuleSelectionModalProps) {
  const [selectedRule, setSelectedRule] = useState<GameRules>('standard');

  const handleSubmit = () => {
    onRuleSelect(selectedRule);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-800 flex items-center">
            <Sword className="h-6 w-6 mr-3 text-blue-600" />
            Select Game Rules
          </DialogTitle>
          <p className="text-slate-600 mt-2">Choose special rules for your chess game</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={selectedRule}
            onValueChange={(value) => setSelectedRule(value as GameRules)}
            className="space-y-4"
          >
            {gameRules.map((rule) => (
              <div
                key={rule.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => setSelectedRule(rule.id)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <RadioGroupItem value={rule.id} id={rule.id} />
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
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-600 hover:text-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Start Game
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
