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
  'pawn-wall': { name: 'Стена пешек', description: 'Двойные ряды пешек на 2-3 и 6-7 линиях', status: 'active' },
  'blink': { name: 'Блинк', description: 'Король может телепортироваться раз за игру на любую пустую клетку', status: 'active' },
  'fog-of-war': { name: 'Туман войны', description: 'Первые 5 ходов видна только своя половина доски; история ходов скрыта', status: 'active' },
  'meteor-shower': { name: 'Метеоритный дождь', description: 'Каждые 5 ходов случайная пустая клетка сгорает и становится недоступной', status: 'active' },
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
                
                // Special handling for Blink mode to show usage status
                if (ruleKey === 'blink' && rule) {
                  const blinkUsed = gameState?.blinkUsed || { white: false, black: false };
                  return (
                    <div key={ruleKey} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-green-800">{rule.name}</p>
                          <p className="text-sm text-green-600">{rule.description}</p>
                          <div className="mt-2 flex space-x-3">
                            <span className={`text-xs px-2 py-1 rounded ${blinkUsed.white ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                              Белые: {blinkUsed.white ? 'Использован' : 'Доступен'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${blinkUsed.black ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                              Черные: {blinkUsed.black ? 'Использован' : 'Доступен'}
                            </span>
                          </div>
                        </div>
                        <div className="w-3 h-3 bg-green-600 rounded-full" />
                      </div>
                    </div>
                  );
                }
                // Special handling for Meteor Shower to show burned squares and next strike
                if (ruleKey === 'meteor-shower' && rule) {
                  const burned = gameState?.burnedSquares || [];
                  const meteorCounter = gameState?.meteorCounter ?? 1; // mirrors fullmoveNumber
                  // Strikes after 5 full moves: when (fullmoveNumber - 1) % 5 === 0
                  const completed = Math.max(0, meteorCounter - 1);
                  const mod = completed % 5;
                  const movesUntilNext = (5 - mod) % 5 || 5;
                  return (
                    <div key={ruleKey} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-orange-800">{rule.name}</p>
                          <p className="text-sm text-orange-700">{rule.description}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            <span className="px-2 py-1 rounded bg-orange-100 text-orange-800">Сгоревшие клетки: {burned.length}</span>
                              <span className="px-2 py-1 rounded bg-orange-100 text-orange-800">До следующего метеора (полных ходов): <span className="font-semibold">{movesUntilNext}</span></span>
                          </div>
                        </div>
                        <div className="w-3 h-3 bg-orange-600 rounded-full" />
                      </div>
                    </div>
                  );
                }
                
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
          {game.rules.includes('double-knight') && gameState.doubleKnightMove && (
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
