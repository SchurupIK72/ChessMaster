import { Game, Move } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Scroll } from "lucide-react";
import { formatTimeControl } from "@/lib/clock";

interface GameStatusProps {
  game: Game;
  moves?: Move[]; // used to compute meteor timing similar to Fog of War
}

const ruleDescriptions: Record<string, { name: string; description: string; status: 'active' | 'inactive' }> = {
  standard: { name: 'РЎС‚Р°РЅРґР°СЂС‚РЅС‹Рµ С€Р°С…РјР°С‚С‹', description: 'РљР»Р°СЃСЃРёС‡РµСЃРєРёРµ РїСЂР°РІРёР»Р°', status: 'active' },
  'double-knight': { name: 'Р”РІРѕР№РЅРѕР№ РєРѕРЅСЊ', description: 'РќСѓР¶РЅРѕ С…РѕРґРёС‚СЊ РєРѕРЅРµРј РґРІР°Р¶РґС‹ РїРѕРґСЂСЏРґ', status: 'active' },
  'pawn-rotation': { name: 'РџРѕРІРѕСЂРѕС‚ РїРµС€РµРє', description: 'РџРµС€РєРё РјРѕРіСѓС‚ С…РѕРґРёС‚СЊ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅРѕ Рё РґРµР»Р°С‚СЊ РЅРµРѕРіСЂР°РЅРёС‡РµРЅРЅС‹Рµ РґРІРѕР№РЅС‹Рµ С…РѕРґС‹', status: 'active' },
  'xray-bishop': { name: 'Р РµРЅС‚РіРµРЅ СЃР»РѕРЅ', description: 'РЎР»РѕРЅ РїСЂРѕС…РѕРґРёС‚ СЃРєРІРѕР·СЊ С„РёРіСѓСЂС‹', status: 'active' },
  'pawn-wall': { name: 'РЎС‚РµРЅР° РїРµС€РµРє', description: 'Р”РІРѕР№РЅС‹Рµ СЂСЏРґС‹ РїРµС€РµРє РЅР° 2-3 Рё 6-7 Р»РёРЅРёСЏС…', status: 'active' },
  'blink': { name: 'Р‘Р»РёРЅРє', description: 'РљРѕСЂРѕР»СЊ РјРѕР¶РµС‚ С‚РµР»РµРїРѕСЂС‚РёСЂРѕРІР°С‚СЊСЃСЏ СЂР°Р· Р·Р° РёРіСЂСѓ РЅР° Р»СЋР±СѓСЋ РїСѓСЃС‚СѓСЋ РєР»РµС‚РєСѓ', status: 'active' },
  'fog-of-war': { name: 'РўСѓРјР°РЅ РІРѕР№РЅС‹', description: 'РџРµСЂРІС‹Рµ 5 С…РѕРґРѕРІ РІРёРґРЅР° С‚РѕР»СЊРєРѕ СЃРІРѕСЏ РїРѕР»РѕРІРёРЅР° РґРѕСЃРєРё; РёСЃС‚РѕСЂРёСЏ С…РѕРґРѕРІ СЃРєСЂС‹С‚Р°', status: 'active' },
  'meteor-shower': { name: 'РњРµС‚РµРѕСЂРёС‚РЅС‹Р№ РґРѕР¶РґСЊ', description: 'РљР°Р¶РґС‹Рµ 5 С…РѕРґРѕРІ СЃР»СѓС‡Р°Р№РЅР°СЏ РїСѓСЃС‚Р°СЏ РєР»РµС‚РєР° СЃРіРѕСЂР°РµС‚ Рё СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РЅРµРґРѕСЃС‚СѓРїРЅРѕР№', status: 'active' },
  'fischer-random': { name: 'РЁР°С…РјР°С‚С‹ Р¤РёС€РµСЂР° (Chess960)', description: 'РЎР»СѓС‡Р°Р№РЅР°СЏ СЂР°СЃСЃС‚Р°РЅРѕРІРєР° РЅР° 1-Р№ Рё 8-Р№ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЏС… (СЂР°Р·РЅРѕС†РІРµС‚РЅС‹Рµ СЃР»РѕРЅС‹, РєРѕСЂРѕР»СЊ РјРµР¶РґСѓ Р»Р°РґСЊСЏРјРё)', status: 'active' },
  'void': { name: 'Void Mode', description: 'Р”РІРµ РЅРµР·Р°РІРёСЃРёРјС‹Рµ РґРѕСЃРєРё; РѕРґРёРЅ С…РѕРґ = РґРІР° РїРѕРґ-С…РѕРґР° РЅР° СЂР°Р·РЅС‹С… РґРѕСЃРєР°С…; РїРµСЂРµРЅРѕСЃ С„РёРіСѓСЂ РјРµР¶РґСѓ РґРѕСЃРєР°РјРё Р·Р° С‚РѕРєРµРЅС‹ (РєРѕСЂРѕР»СЏ РїРµСЂРµРЅРѕСЃРёС‚СЊ РЅРµР»СЊР·СЏ)', status: 'active' },
};

export default function GameStatus({ game, moves = [] }: GameStatusProps) {
  const activeRules = Array.isArray(game.rules) ? game.rules : [game.rules];
  const isStandardOnly = activeRules.length === 1 && activeRules[0] === 'standard';
  const gameState = game.gameState as any;

  // Compute completed full moves from move history, pairing Double-Knight two-step as one turn
  const computeCompletedFullMoves = (rules: any, movesList: Move[]): number => {
    const rulesArr = (rules as any) || [];
    const hasDoubleKnight = Array.isArray(rulesArr) && rulesArr.includes('double-knight');
    let playerTurns = 0; // count of player turns (white move = 1, black move = 1)
    let i = 0;
    while (i < movesList.length) {
      const m1 = movesList[i];
      let consume = 1;
      if (
        hasDoubleKnight &&
        i + 1 < movesList.length &&
        movesList[i + 1].player === m1.player &&
        typeof m1.piece === 'string' && m1.piece.endsWith('-knight') &&
        typeof movesList[i + 1].piece === 'string' && movesList[i + 1].piece.endsWith('-knight') &&
        m1.to && movesList[i + 1].from && m1.to === movesList[i + 1].from
      ) {
        // Two-step knight move counts as a single player turn
        consume = 2;
      }
      playerTurns += 1;
      i += consume;
    }
    return Math.floor(playerTurns / 2); // convert to full moves
  };

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
      <Card className="border border-black/10 shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center">
            <Scroll className="h-5 w-5 mr-2 text-neutral-900" />
            Active Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isStandardOnly ? (
            <div className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">{ruleDescriptions.standard.name}</p>
                  <p className="text-sm text-neutral-600">{ruleDescriptions.standard.description}</p>
                </div>
                <div className="w-3 h-3 bg-black rounded-full" />
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
                    <div key={ruleKey} className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-neutral-900">{rule.name}</p>
                          <p className="text-sm text-neutral-600">{rule.description}</p>
                          <div className="mt-2 flex space-x-3">
                            <span className={`text-xs px-2 py-1 rounded ${blinkUsed.white ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700 border border-black/10'}`}>
                              Р‘РµР»С‹Рµ: {blinkUsed.white ? 'РСЃРїРѕР»СЊР·РѕРІР°РЅ' : 'Р”РѕСЃС‚СѓРїРµРЅ'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${blinkUsed.black ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700 border border-black/10'}`}>
                              Р§РµСЂРЅС‹Рµ: {blinkUsed.black ? 'РСЃРїРѕР»СЊР·РѕРІР°РЅ' : 'Р”РѕСЃС‚СѓРїРµРЅ'}
                            </span>
                          </div>
                        </div>
                        <div className="w-3 h-3 bg-black rounded-full" />
                      </div>
                    </div>
                  );
                }
                // Special handling for Meteor Shower to show burned squares and next strike
                if (ruleKey === 'meteor-shower' && rule) {
                  const isVoid = Array.isArray(activeRules) && activeRules.includes('void');
                  if (isVoid && Array.isArray((gameState as any)?.voidBoards) && (gameState as any).voidBoards.length === 2) {
                    const vb = (gameState as any).voidBoards as any[];
                    const burnedA: string[] = vb[0]?.burnedSquares || [];
                    const burnedB: string[] = vb[1]?.burnedSquares || [];
                    const completedA = Math.max(0, (vb[0]?.fullmoveNumber ?? 1) - 1);
                    const completedB = Math.max(0, (vb[1]?.fullmoveNumber ?? 1) - 1);
                    const remainA = ((5 - (completedA % 5)) % 5) || 5;
                    const remainB = ((5 - (completedB % 5)) % 5) || 5;
                    return (
                      <div key={ruleKey} className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-neutral-900">{rule.name}</p>
                            <p className="text-sm text-neutral-600">{rule.description}</p>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РЎРіРѕСЂРµРІС€РёРµ РєР»РµС‚РєРё A: {burnedA.length}</span>
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РЎРіРѕСЂРµРІС€РёРµ РєР»РµС‚РєРё B: {burnedB.length}</span>
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">Р”Рѕ СЃР»РµРґСѓСЋС‰РµРіРѕ РјРµС‚РµРѕСЂР° A (РїРѕР»РЅС‹С… С…РѕРґРѕРІ): <span className="font-semibold">{remainA}</span></span>
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">Р”Рѕ СЃР»РµРґСѓСЋС‰РµРіРѕ РјРµС‚РµРѕСЂР° B (РїРѕР»РЅС‹С… С…РѕРґРѕРІ): <span className="font-semibold">{remainB}</span></span>
                            </div>
                          </div>
                          <div className="w-3 h-3 bg-black rounded-full" />
                        </div>
                      </div>
                    );
                  } else {
                    const burned = gameState?.burnedSquares || [];
                    const completed = computeCompletedFullMoves(activeRules, moves);
                    const mod = completed % 5;
                    const movesUntilNext = (5 - mod) % 5 || 5;
                    return (
                      <div key={ruleKey} className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-neutral-900">{rule.name}</p>
                            <p className="text-sm text-neutral-600">{rule.description}</p>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РЎРіРѕСЂРµРІС€РёРµ РєР»РµС‚РєРё: {burned.length}</span>
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">Р”Рѕ СЃР»РµРґСѓСЋС‰РµРіРѕ РјРµС‚РµРѕСЂР° (РїРѕР»РЅС‹С… С…РѕРґРѕРІ): <span className="font-semibold">{movesUntilNext}</span></span>
                            </div>
                          </div>
                          <div className="w-3 h-3 bg-black rounded-full" />
                        </div>
                      </div>
                    );
                  }
                }
                // Special handling for Fog of War to show per-board progress (Void) or single-board progress
                if (ruleKey === 'fog-of-war' && rule) {
                  const isVoid = Array.isArray(activeRules) && activeRules.includes('void');
                  if (isVoid && Array.isArray((gameState as any)?.voidBoards) && (gameState as any).voidBoards.length === 2) {
                    const vb = (gameState as any).voidBoards as any[];
                    const completedA = Math.max(0, (vb[0]?.fullmoveNumber ?? 1) - 1);
                    const completedB = Math.max(0, (vb[1]?.fullmoveNumber ?? 1) - 1);
                    return (
                      <div key={ruleKey} className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-neutral-900">{rule.name}</p>
                            <p className="text-sm text-neutral-600">{rule.description}</p>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РџСЂРѕРіСЂРµСЃСЃ: A: <span className="font-semibold">{Math.min(completedA, 5)}</span>/5, B: <span className="font-semibold">{Math.min(completedB, 5)}</span>/5</span>
                            </div>
                          </div>
                          <div className="w-3 h-3 bg-black rounded-full" />
                        </div>
                      </div>
                    );
                  } else {
                    const completed = Math.max(0, computeCompletedFullMoves(activeRules, moves));
                    return (
                      <div key={ruleKey} className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-neutral-900">{rule.name}</p>
                            <p className="text-sm text-neutral-600">{rule.description}</p>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РџСЂРѕРіСЂРµСЃСЃ: <span className="font-semibold">{Math.min(completed, 5)}</span>/5</span>
                            </div>
                          </div>
                          <div className="w-3 h-3 bg-black rounded-full" />
                        </div>
                      </div>
                    );
                  }
                }
                // Special handling for Void mode to show tokens and sub-move status
                if (ruleKey === 'void' && rule) {
                  const voidMeta = (gameState?.voidMeta) || null;
                  const tokens = voidMeta?.tokens || { white: 0, black: 0 };
                  const pending = voidMeta?.pending || null;
                  const movedBoards: number[] = pending?.movedBoards || [];
                  const boardLabel = (n: number) => (n === 0 ? 'A' : 'B');
                  const progress = pending ? `${movedBoards.length}/2` : '0/2';
                  const moved = movedBoards.map(boardLabel).join(', ');
                  return (
                    <div key={ruleKey} className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-neutral-900">{rule.name}</p>
                          <p className="text-sm text-neutral-600">{rule.description}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РўРѕРєРµРЅС‹: Р±РµР»С‹Рµ {tokens.white ?? 0}, С‡РµСЂРЅС‹Рµ {tokens.black ?? 0}</span>
                            {pending ? (
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РџРѕРґ-С…РѕРґС‹ РІС‹РїРѕР»РЅРµРЅС‹: <span className="font-semibold">{progress}</span>{moved ? ` (РґРѕСЃРєРё: ${moved})` : ''}</span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-white text-neutral-700 border border-black/10">РџРѕРґ-С…РѕРґС‹ РІС‹РїРѕР»РЅРµРЅС‹: <span className="font-semibold">0/2</span></span>
                            )}
                          </div>
                        </div>
                        <div className="w-3 h-3 bg-black rounded-full" />
                      </div>
                    </div>
                  );
                }
                
                return rule ? (
                  <div key={ruleKey} className="p-3 bg-neutral-100 rounded-2xl border border-black/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">{rule.name}</p>
                        <p className="text-sm text-neutral-600">{rule.description}</p>
                      </div>
                      <div className="w-3 h-3 bg-black rounded-full" />
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
                    <p className="text-sm text-neutral-500">{rule.description}</p>
                  </div>
                  <div className="w-3 h-3 bg-slate-400 rounded-full" />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Game Status */}
      <Card className="border border-black/10 shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center">
            <Info className="h-5 w-5 mr-2 text-neutral-900" />
            Game Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Double Knight Special Status */}
          {game.rules.includes('double-knight') && gameState.doubleKnightMove && (
            <div className="p-3 bg-neutral-950 text-white rounded-2xl border border-black">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <div>
                  <p className="font-medium text-white">Second Knight Move Required</p>
                  <p className="text-sm text-white/70">
                    Must move the {gameState.doubleKnightMove.color} knight on {gameState.doubleKnightMove.knightSquare}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Current Turn:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                game.currentTurn === 'white' 
                  ? 'bg-white border-2 border-black' 
                  : 'bg-black'
              }`} />
              <span className="font-medium text-neutral-900 capitalize">{game.currentTurn}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Time Control:</span>
            <span className="font-medium text-neutral-900">{formatTimeControl(game.timeControlSeconds)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Status:</span>
            <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
              {game.status}
            </Badge>
          </div>

          <div className="pt-3 border-t border-black/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">White Pieces:</span>
              <span className="font-medium">{pieceCounts.white}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-neutral-600">Black Pieces:</span>
              <span className="font-medium">{pieceCounts.black}</span>
            </div>
          </div>

          {gameState.isCheck && (
            <div className="pt-3 border-t border-black/10">
              <Badge className="w-full justify-center bg-black text-white hover:bg-black">
                Check!
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



