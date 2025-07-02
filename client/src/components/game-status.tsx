import { Game } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Scroll, Edit } from "lucide-react";

interface GameStatusProps {
  game: Game;
  elapsedTime: string;
  onChangeRules: () => void;
}

const ruleDescriptions: Record<string, { name: string; description: string; status: 'active' | 'inactive' }> = {
  standard: { name: 'Стандартные шахматы', description: 'Классические правила', status: 'active' },
  'double-knight': { name: 'Двойной конь', description: 'Нужно ходить конем дважды подряд', status: 'active' },
  'pawn-rotation': { name: 'Поворот пешек', description: 'Пешки могут ходить горизонтально и делать неограниченные двойные ходы', status: 'active' },
  'xray-bishop': { name: 'Рентген слон', description: 'Слон проходит сквозь фигуры', status: 'active' },
};

export default function GameStatus({ game, elapsedTime, onChangeRules }: GameStatusProps) {
  const activeRules = Array.isArray(game.rules) ? game.rules : [game.rules];
  const isStandardOnly = activeRules.length === 1 && activeRules[0] === 'standard';
  const gameState = game.gameState as any;

  // Count remaining pieces
  const countPieces = () => {
    let white = 0, black = 0;
    Object.values(gameState.board || {}).forEach((piece: any) => {
      if (piece) {
        if (piece.color === 'white') white++;
        else black++;
      }
    });
    return { white, black };
  };

  const pieceCounts = countPieces();

  return (
    <div className="space-y-6">
      {/* Active Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
            <Scroll className="h-5 w-5 mr-2 text-blue-600" />
            Active Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isStandardOnly ? (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-800">{ruleDescriptions.standard.name}</p>
                  <p className="text-sm text-green-600">{ruleDescriptions.standard.description}</p>
                </div>
                <div className="w-3 h-3 bg-green-600 rounded-full" />
              </div>
            </div>
          ) : (
            <>
              {activeRules.filter(rule => rule !== 'standard').map(ruleKey => {
                const rule = ruleDescriptions[ruleKey];
                return rule ? (
                  <div key={ruleKey} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-green-800">{rule.name}</p>
                        <p className="text-sm text-green-600">{rule.description}</p>
                      </div>
                      <div className="w-3 h-3 bg-green-600 rounded-full" />
                    </div>
                  </div>
                ) : null;
              })}
            </>
          )}
          
          {/* Show inactive rules */}
          {Object.entries(ruleDescriptions).map(([key, rule]) => {
            if (key === 'standard' || activeRules.includes(key as any)) return null;
            return (
              <div key={key} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">{rule.name}</p>
                    <p className="text-sm text-slate-500">{rule.description}</p>
                  </div>
                  <div className="w-3 h-3 bg-slate-400 rounded-full" />
                </div>
              </div>
            );
          })}

          <Button onClick={onChangeRules} className="w-full bg-blue-600 hover:bg-blue-700">
            <Edit className="h-4 w-4 mr-2" />
            Change Rules
          </Button>
        </CardContent>
      </Card>

      {/* Game Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
            <Info className="h-5 w-5 mr-2 text-blue-600" />
            Game Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Double Knight Special Status */}
          {game.rules === 'double-knight' && gameState.doubleKnightMove && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                <div>
                  <p className="font-medium text-yellow-800">Second Knight Move Required</p>
                  <p className="text-sm text-yellow-600">
                    Must move the {gameState.doubleKnightMove.color} knight on {gameState.doubleKnightMove.knightSquare}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Current Turn:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                game.currentTurn === 'white' 
                  ? 'bg-white border-2 border-slate-800' 
                  : 'bg-slate-800'
              }`} />
              <span className="font-medium text-slate-800 capitalize">{game.currentTurn}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">Game Time:</span>
            <span className="font-medium text-slate-800">{elapsedTime}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">Status:</span>
            <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
              {game.status}
            </Badge>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">White Pieces:</span>
              <span className="font-medium">{pieceCounts.white}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-600">Black Pieces:</span>
              <span className="font-medium">{pieceCounts.black}</span>
            </div>
          </div>

          {gameState.isCheck && (
            <div className="pt-3 border-t border-slate-200">
              <Badge variant="destructive" className="w-full justify-center">
                Check!
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
