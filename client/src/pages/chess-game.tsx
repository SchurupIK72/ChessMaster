import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import ChessBoard from "@/components/chess-board";
import RuleSelectionModal from "@/components/rule-selection-modal";
import GameStatus from "@/components/game-status";
import MoveHistory from "@/components/move-history";
import CapturedPieces from "@/components/captured-pieces";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChessPiece, ChessGameState, GameRules, Game, Move } from "@shared/schema";
import { ChessLogic } from "@/lib/chess-logic";
import { Sword, Crown, Plus, Settings } from "lucide-react";

export default function ChessGame() {
  const [gameId, setGameId] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const { toast } = useToast();

  const chessLogic = new ChessLogic();

  // Query for current game
  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    queryFn: () => fetch(`/api/games/${gameId}`).then(res => res.json()),
    enabled: !!gameId,
  });

  // Query for game moves
  const { data: moves = [] } = useQuery<Move[]>({
    queryKey: ["/api/games", gameId, "moves"],
    queryFn: () => fetch(`/api/games/${gameId}/moves`).then(res => res.json()),
    enabled: !!gameId,
  });

  // Create new game mutation
  const createGameMutation = useMutation({
    mutationFn: async (rules: GameRules) => {
      const response = await apiRequest("POST", "/api/games", {
        whitePlayerId: null,
        blackPlayerId: null,
        rules,
      });
      return response.json();
    },
    onSuccess: (newGame: Game) => {
      setGameId(newGame.id);
      setGameStartTime(new Date(newGame.gameStartTime!));
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({
        title: "Game Started",
        description: "New chess game created successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create game",
        variant: "destructive",
      });
    },
  });

  // Make move mutation
  const makeMoveMutation = useMutation({
    mutationFn: async ({ from, to, piece, captured }: { from: string; to: string; piece: string; captured?: string }) => {
      if (!game) throw new Error("No active game");
      
      const response = await apiRequest("POST", `/api/games/${gameId}/moves`, {
        moveNumber: Math.floor(moves.length / 2) + 1,
        player: game.currentTurn,
        from,
        to,
        piece,
        captured,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // This would be calculated properly
      });
      return response.json();
    },
    onSuccess: async () => {
      // Immediately refetch the game state to get the updated turn
      await queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "moves"] });
      setSelectedSquare(null);
      setValidMoves([]);
    },
    onError: (error: any) => {
      toast({
        title: "Invalid Move",
        description: error.message || "That move is not allowed",
        variant: "destructive",
      });
    },
  });

  // Update game status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, winner }: { status: string; winner?: string }) => {
      const response = await apiRequest("PATCH", `/api/games/${gameId}/status`, { status, winner });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
    },
  });

  // Timer effect
  useEffect(() => {
    if (!gameStartTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - gameStartTime.getTime()) / 1000);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStartTime]);

  const handleSquareClick = (square: string) => {
    if (!game || !game.gameState) return;

    const gameState = game.gameState as ChessGameState;
    const piece = gameState.board[square];

    if (selectedSquare) {
      // Trying to make a move
      if (validMoves.includes(square)) {
        const fromPiece = gameState.board[selectedSquare];
        if (fromPiece) {
          const captured = piece ? `${piece.color}-${piece.type}` : undefined;
          makeMoveMutation.mutate({
            from: selectedSquare,
            to: square,
            piece: `${fromPiece.color}-${fromPiece.type}`,
            captured,
          });
        }
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else {
      // Selecting a piece
      if (piece && piece.color === gameState.currentTurn) {
        setSelectedSquare(square);
        const moves = chessLogic.getValidMoves(gameState, square);
        setValidMoves(moves);
      } else {
        // Clear selection if clicking on wrong color or empty square
        setSelectedSquare(null);
        setValidMoves([]);
      }
    }
  };

  const handleNewGame = () => {
    setShowRuleModal(true);
  };

  const handleRuleSelection = (rules: GameRules) => {
    createGameMutation.mutate(rules);
    setShowRuleModal(false);
  };

  const handleResign = () => {
    if (!game) return;
    const winner = game.currentTurn === 'white' ? 'black' : 'white';
    updateStatusMutation.mutate({ status: 'completed', winner });
    toast({
      title: "Game Resigned",
      description: `${game.currentTurn} player resigned. ${winner} wins!`,
    });
  };

  const handleOfferDraw = () => {
    updateStatusMutation.mutate({ status: 'draw' });
    toast({
      title: "Draw Offered",
      description: "Game ended in a draw.",
    });
  };

  const getCapturedPieces = () => {
    if (!game || !moves.length) return { white: [], black: [] };
    
    const captured = { white: [] as string[], black: [] as string[] };
    moves.forEach((move) => {
      if (move.captured) {
        const [color] = move.captured.split('-');
        if (color === 'white') {
          captured.black.push(move.captured);
        } else {
          captured.white.push(move.captured);
        }
      }
    });
    
    return captured;
  };

  const formatMoveHistory = () => {
    const formatted: { moveNumber: number; white?: string; black?: string }[] = [];
    
    for (let i = 0; i < moves.length; i += 2) {
      const whiteMove = moves[i];
      const blackMove = moves[i + 1];
      
      formatted.push({
        moveNumber: whiteMove.moveNumber,
        white: `${whiteMove.from}-${whiteMove.to}`,
        black: blackMove ? `${blackMove.from}-${blackMove.to}` : undefined,
      });
    }
    
    return formatted;
  };

  if (!gameId) {
    return (
      <div className="min-h-screen bg-slate-50 font-inter">
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center space-x-3">
                <Crown className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-slate-800">Sword Master</h1>
                <span className="text-sm text-slate-500 hidden sm:block">Special Rules Edition</span>
              </div>
              <div className="flex items-center space-x-4">
                <Button onClick={handleNewGame} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Game
                </Button>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
              <Sword className="h-24 w-24 text-slate-400 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Welcome to Sword Master</h2>
              <p className="text-lg text-slate-600 mb-8">Start a new game to begin playing chess with special rules</p>
              <Button onClick={handleNewGame} size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-5 w-5 mr-2" />
                Start New Game
              </Button>
            </div>
          </div>
        </main>

        <RuleSelectionModal
          open={showRuleModal}
          onOpenChange={setShowRuleModal}
          onRuleSelect={handleRuleSelection}
        />
      </div>
    );
  }

  if (gameLoading || (gameId && !game)) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Crown className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-800">Sword Master</h1>
              <span className="text-sm text-slate-500 hidden sm:block">Special Rules Edition</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={handleNewGame} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                New Game
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <GameStatus
              game={game!}
              elapsedTime={elapsedTime}
              onChangeRules={() => setShowRuleModal(true)}
            />
          </div>

          {/* Sword Board */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <ChessBoard
              gameState={game!.gameState as ChessGameState}
              selectedSquare={selectedSquare}
              validMoves={validMoves}
              onSquareClick={handleSquareClick}
              currentTurn={game!.currentTurn as 'white' | 'black'}
            />

            {/* Game Controls */}
            <div className="flex items-center space-x-4 mt-6">
              <Button variant="outline" disabled>
                Undo
              </Button>
              <Button variant="outline" disabled>
                Redo
              </Button>
              <Button variant="destructive" onClick={handleResign}>
                Resign
              </Button>
              <Button variant="outline" className="bg-yellow-600 text-white hover:bg-yellow-700" onClick={handleOfferDraw}>
                Draw
              </Button>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <MoveHistory moves={formatMoveHistory()} />
            <CapturedPieces capturedPieces={getCapturedPieces()} />
          </div>
        </div>
      </main>

      <RuleSelectionModal
        open={showRuleModal}
        onOpenChange={setShowRuleModal}
        onRuleSelect={handleRuleSelection}
      />
    </div>
  );
}
