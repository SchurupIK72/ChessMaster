import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import ChessBoard from "@/components/chess-board";
import RuleSelectionModal from "@/components/rule-selection-modal";
import PawnPromotionModal from "@/components/pawn-promotion-modal";
import GameOverModal from "@/components/game-over-modal";
import GameTypeModal from "@/components/game-type-modal";
import InviteModal from "@/components/invite-modal";
import JoinGameModal from "@/components/join-game-modal";
import GameStatus from "@/components/game-status";
import MoveHistory from "@/components/move-history";
import CapturedPieces from "@/components/captured-pieces";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ChessPiece, ChessGameState, GameRules, GameRulesArray, Game, Move } from "@shared/schema";
import { ChessLogic } from "@/lib/chess-logic";
import { Sword, Crown, Plus, Settings, Users, Share2, LogOut } from "lucide-react";

export default function ChessGame() {
  const [gameId, setGameId] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [showGameTypeModal, setShowGameTypeModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showDrawConfirm, setShowDrawConfirm] = useState(false);
  const [showDrawOffer, setShowDrawOffer] = useState(false);
  const [gameOverShown, setGameOverShown] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{from: string, to: string, piece: any} | null>(null);
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [lastMoveCount, setLastMoveCount] = useState(0);
  const { toast } = useToast();

  const chessLogic = new ChessLogic();

  // Get current player's color
  const getCurrentPlayerColor = (): 'white' | 'black' | null => {
    if (!game) return null;
    
    // Simple player identification system for demo
    // In a real app this would use proper user authentication
    let playerId = parseInt(localStorage.getItem('playerId') || '1');
    
    // If no playerId stored, generate one
    if (!playerId) {
      playerId = Math.floor(Math.random() * 1000) + 1;
      localStorage.setItem('playerId', playerId.toString());
    }
    
    if (game.whitePlayerId === playerId) return 'white';
    if (game.blackPlayerId === playerId) return 'black';
    return null;
  };

  // Query for current game with automatic refresh
  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    queryFn: () => fetch(`/api/games/${gameId}`).then(res => res.json()),
    enabled: !!gameId,
    refetchInterval: 500, // Refresh every 0.5 seconds
    refetchIntervalInBackground: true, // Continue refreshing when window is not focused
  });

  // Query for game moves with automatic refresh
  const { data: moves = [] } = useQuery<Move[]>({
    queryKey: ["/api/games", gameId, "moves"],
    queryFn: () => fetch(`/api/games/${gameId}/moves`).then(res => res.json()),
    enabled: !!gameId,
    refetchInterval: 500, // Refresh every 0.5 seconds
    refetchIntervalInBackground: true, // Continue refreshing when window is not focused
  });

  // Create new game mutation
  const createGameMutation = useMutation({
    mutationFn: async (rules: GameRulesArray) => {
      const response = await apiRequest("POST", "/api/games", {
        rules,
      });
      return response.json();
    },
    onSuccess: (newGame: Game) => {
      // Store player ID for creator (will be white)
      localStorage.setItem('playerId', newGame.whitePlayerId?.toString() || '1');
      setGameId(newGame.id);
      setGameStartTime(new Date(newGame.gameStartTime!));
      setGameOverShown(false); // Reset flag for new game
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      if (newGame.shareId) {
        setShowInviteModal(true);
      }
      toast({
        title: "Игра создана",
        description: "Вы играете белыми фигурами! Поделитесь ссылкой с другом.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать игру",
        variant: "destructive",
      });
    },
  });

  // Join game mutation
  const joinGameMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const response = await apiRequest("POST", `/api/games/join/${shareId}`, {});
      return response.json();
    },
    onSuccess: (joinedGame: Game) => {
      // Store player ID for joining player (will be black)
      localStorage.setItem('playerId', joinedGame.blackPlayerId?.toString() || '2');
      setGameId(joinedGame.id);
      setGameStartTime(new Date(joinedGame.gameStartTime!));
      setGameOverShown(false);
      setShowJoinModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({
        title: "Присоединились к игре",
        description: "Вы играете черными фигурами!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось присоединиться к игре",
        variant: "destructive",
      });
    },
  });

  // Check for invitation link on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('join');
    if (shareId) {
      // Automatically join the game
      joinGameMutation.mutate(shareId);
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Monitor for new moves and show notifications
  useEffect(() => {
    if (moves.length > 0) {
      // If this is not the first time we're checking moves
      if (lastMoveCount > 0 && moves.length > lastMoveCount) {
        const newMove = moves[moves.length - 1];
        const playerId = parseInt(localStorage.getItem('playerId') || '1');
        const isMyMove = (game?.whitePlayerId === playerId && newMove.player === 'white') || 
                        (game?.blackPlayerId === playerId && newMove.player === 'black');
        
        // Only show notification if it's NOT my move (opponent's move)
        if (!isMyMove) {
          toast({
            title: "Ход противника",
            description: `${newMove.from} → ${newMove.to}`,
            duration: 3000,
          });
        }
      }
      setLastMoveCount(moves.length);
    }
  }, [moves, lastMoveCount, game, toast]);

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

  // Draw offer mutations
  const offerDrawMutation = useMutation({
    mutationFn: async (player: 'white' | 'black') => {
      const response = await apiRequest("POST", `/api/games/${gameId}/offer-draw`, { player });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      toast({
        title: "Предложение ничьей отправлено",
        description: "Ожидаем ответа противника",
      });
    },
  });

  const acceptDrawMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/games/${gameId}/accept-draw`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      setShowGameOverModal(true);
      toast({
        title: "Ничья принята",
        description: "Игра завершена вничью",
      });
    },
  });

  const declineDrawMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/games/${gameId}/decline-draw`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      toast({
        title: "Предложение ничьей отклонено",
        description: "Игра продолжается",
      });
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

  // Game over detection effect
  useEffect(() => {
    if (!game || !game.gameState || gameOverShown) return;
    
    const gameState = game.gameState as ChessGameState;
    
    // Check for checkmate
    if (gameState.isCheckmate) {
      const winner = gameState.currentTurn === 'white' ? 'black' : 'white';
      setShowGameOverModal(true);
      setGameOverShown(true);
      updateStatusMutation.mutate({ status: 'completed', winner });
      return;
    }
    
    // Check for stalemate
    if (gameState.isStalemate) {
      setShowGameOverModal(true);
      setGameOverShown(true);
      updateStatusMutation.mutate({ status: 'draw' });
      return;
    }
    
    // Check if game is already completed
    if (game.status === 'completed' || game.status === 'draw') {
      setShowGameOverModal(true);
    }
  }, [game]);

  // Draw offer detection effect
  useEffect(() => {
    if (!game || !game.drawOfferedBy) return;
    
    const playerColor = getCurrentPlayerColor();
    const drawOfferedByOpponent = game.drawOfferedBy !== playerColor;
    
    if (drawOfferedByOpponent && !showDrawOffer) {
      setShowDrawOffer(true);
    }
  }, [game, showDrawOffer]);

  const handleSquareClick = (square: string) => {
    if (!game || !game.gameState) return;

    const gameState = game.gameState as ChessGameState;
    const piece = gameState.board[square];

    if (selectedSquare) {
      // If clicking on the same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }
      
      // Trying to make a move
      if (validMoves.includes(square)) {
        const fromPiece = gameState.board[selectedSquare];
        const toPiece = gameState.board[square];
        
        // Additional safety check: prevent capturing own pieces
        if (toPiece && fromPiece && toPiece.color === fromPiece.color) {
          console.error("Attempted to capture own piece!", { fromPiece, toPiece, from: selectedSquare, to: square });
          setSelectedSquare(null);
          setValidMoves([]);
          return;
        }
        
        if (fromPiece) {
          const playerColor = getCurrentPlayerColor();
          
          // Check if it's the player's turn
          if (playerColor !== gameState.currentTurn) {
            toast({
              title: "Не ваш ход",
              description: "Дождитесь своей очереди",
              variant: "destructive",
              duration: 2000,
            });
            setSelectedSquare(null);
            setValidMoves([]);
            return;
          }
          
          // Check if this is a pawn promotion
          if (fromPiece.type === 'pawn') {
            const toRank = parseInt(square[1]);
            const shouldPromote = (fromPiece.color === 'white' && toRank === 8) || 
                                 (fromPiece.color === 'black' && toRank === 1);
            
            if (shouldPromote) {
              // Show promotion modal
              setPromotionMove({
                from: selectedSquare,
                to: square,
                piece: fromPiece
              });
              setShowPromotionModal(true);
              return;
            }
          }
          
          // Check for en passant capture
          let captured = piece ? `${piece.color}-${piece.type}` : undefined;
          
          // console.log('Move attempt:', {
          //   from: selectedSquare,
          //   to: square,
          //   fromPiece,
          //   toPiece: piece,
          //   enPassantTarget: gameState.enPassantTarget,
          //   isEnPassant: fromPiece.type === 'pawn' && square === gameState.enPassantTarget && !piece
          // });
          
          // Special case for en passant: if pawn moves to enPassantTarget, capture the pawn that was "jumped over"
          if (fromPiece.type === 'pawn' && square === gameState.enPassantTarget && !piece) {
            console.log('En passant detected, entering capture logic');
            const targetFile = square[0];
            const targetRank = parseInt(square[1]);
            const fromFile = selectedSquare[0];
            const fromRank = parseInt(selectedSquare[1]);
            
            console.log('En passant details:', { targetFile, targetRank, fromFile, fromRank });
            
            // Determine if this is vertical or horizontal en passant
            if (fromRank !== targetRank) {
              console.log('Vertical en passant detected');
              // Vertical en passant (standard)
              const captureRank = fromPiece.color === 'white' ? '5' : '4';
              const captureSquare = targetFile + captureRank;
              const capturedPawn = gameState.board[captureSquare];
              if (capturedPawn) {
                captured = `${capturedPawn.color}-${capturedPawn.type}`;
              }
            } else {
              // Horizontal en passant (PawnRotation mode)
              console.log(`Horizontal en passant: from=${selectedSquare}, to=${square}, enPassantTarget=${gameState.enPassantTarget}`);
              
              // For horizontal en passant, the captured pawn is adjacent to our pawn at the same rank (fromRank)
              // We need to find which adjacent pawn made the double move
              let capturedPawn = null;
              const leftSquare = String.fromCharCode(fromFile.charCodeAt(0) - 1) + fromRank;
              const rightSquare = String.fromCharCode(fromFile.charCodeAt(0) + 1) + fromRank;
              
              console.log(`Checking adjacent squares for captured pawn: left=${leftSquare}, right=${rightSquare}`);
              console.log(`Left pawn:`, gameState.board[leftSquare]);
              console.log(`Right pawn:`, gameState.board[rightSquare]);
              
              if (gameState.board[leftSquare] && gameState.board[leftSquare].color !== fromPiece.color) {
                capturedPawn = gameState.board[leftSquare];
                console.log(`Found captured pawn on left: ${leftSquare}`);
              } else if (gameState.board[rightSquare] && gameState.board[rightSquare].color !== fromPiece.color) {
                capturedPawn = gameState.board[rightSquare];
                console.log(`Found captured pawn on right: ${rightSquare}`);
              }
              
              if (capturedPawn) {
                captured = `${capturedPawn.color}-${capturedPawn.type}`;
                console.log(`Captured pawn: ${captured}`);
              } else {
                console.log(`Warning: No adjacent pawn found for horizontal en passant`);
              }
            }
          }
          
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
      const playerColor = getCurrentPlayerColor();
      
      if (piece && piece.color === gameState.currentTurn && piece.color === playerColor) {
        setSelectedSquare(square);
        console.log(`Game rules being passed:`, game?.rules);
        const moves = chessLogic.getValidMoves(gameState, square, game?.rules);
        console.log(`UI: Found ${moves.length} valid moves for ${piece.type} at ${square}:`, moves);
        setValidMoves(moves);
      } else {
        // Clear selection if clicking on wrong color or empty square
        setSelectedSquare(null);
        setValidMoves([]);
        
        // Show message if trying to move opponent's piece
        if (piece && piece.color !== playerColor && playerColor) {
          toast({
            title: "Неверный ход",
            description: "Вы можете ходить только своими фигурами",
            variant: "destructive",
            duration: 2000,
          });
        }
      }
    }
  };

  const handleNewGame = () => {
    console.log("handleNewGame called");
    console.log("Modal states:", {
      showGameTypeModal,
      showRuleModal,
      showJoinModal,
      showInviteModal,
      showPromotionModal,
      showGameOverModal
    });
    setShowGameTypeModal(true);
  };

  const handleCreateNewGame = () => {
    setShowGameTypeModal(false);
    setShowRuleModal(true);
  };

  const handleJoinGameClick = () => {
    console.log("Join Game button clicked");
    console.log("Modal states:", {
      showGameTypeModal,
      showRuleModal,
      showJoinModal,
      showInviteModal,
      showPromotionModal,
      showGameOverModal
    });
    setShowJoinModal(true);
  };

  const handleRuleSelection = (rules: GameRulesArray) => {
    createGameMutation.mutate(rules);
    setShowRuleModal(false);
  };

  const handleJoinGame = (shareId: string) => {
    joinGameMutation.mutate(shareId);
  };

  const handleShareGame = () => {
    if (game?.shareId) {
      setShowInviteModal(true);
    }
  };

  const handleLogout = () => {
    // Clear localStorage data
    localStorage.removeItem('guestUser');
    localStorage.removeItem('playerId');
    
    // Reset game state
    setGameId(null);
    setSelectedSquare(null);
    setValidMoves([]);
    setGameStartTime(null);
    setElapsedTime("00:00");
    
    toast({
      title: "Выход выполнен",
      description: "Вы вышли из аккаунта",
    });
    
    // Reload page to return to login screen
    window.location.reload();
  };

  const handleResign = () => {
    setShowResignConfirm(true);
  };

  const confirmResign = () => {
    if (!game) return;
    const winner = game.currentTurn === 'white' ? 'black' : 'white';
    updateStatusMutation.mutate({ status: 'completed', winner });
    setShowGameOverModal(true);
    setShowResignConfirm(false);
    toast({
      title: "Партия завершена",
      description: `${game.currentTurn === 'white' ? 'Белые' : 'Черные'} сдались. ${winner === 'white' ? 'Белые' : 'Черные'} победили!`,
    });
  };

  const handleOfferDraw = () => {
    setShowDrawConfirm(true);
  };

  const confirmOfferDraw = () => {
    if (!game) return;
    const playerColor = getCurrentPlayerColor();
    if (playerColor) {
      offerDrawMutation.mutate(playerColor);
    }
    setShowDrawConfirm(false);
  };

  const handleAcceptDraw = () => {
    acceptDrawMutation.mutate();
    setShowDrawOffer(false);
  };

  const handleDeclineDraw = () => {
    declineDrawMutation.mutate();
    setShowDrawOffer(false);
  };

  const handleGameOverClose = () => {
    setShowGameOverModal(false);
    setGameOverShown(false); // Allow modal to show again for future games
  };

  const handleNewGameFromModal = () => {
    setShowGameOverModal(false);
    setShowRuleModal(true);
    setGameId(null);
    setSelectedSquare(null);
    setValidMoves([]);
    setGameStartTime(null);
  };

  const getGameResult = () => {
    if (!game) return null;
    
    const gameState = game.gameState as ChessGameState;
    
    if (gameState.isCheckmate) {
      return {
        result: 'checkmate' as const,
        winner: gameState.currentTurn === 'white' ? 'black' as const : 'white' as const
      };
    }
    
    if (gameState.isStalemate) {
      return {
        result: 'stalemate' as const,
        winner: null
      };
    }
    
    if (game.status === 'draw') {
      return {
        result: 'draw' as const,
        winner: null
      };
    }
    
    if (game.status === 'completed' && game.winner) {
      return {
        result: 'resignation' as const,
        winner: game.winner as 'white' | 'black'
      };
    }
    
    return null;
  };

  const handlePawnPromotion = (pieceType: 'queen' | 'rook' | 'bishop' | 'knight') => {
    if (!promotionMove || !game) return;
    
    const currentGameState = game.gameState as ChessGameState;
    const targetPiece = currentGameState?.board?.[promotionMove.to];
    
    // Check for en passant capture in promotion move
    let captured = targetPiece ? `${targetPiece.color}-${targetPiece.type}` : undefined;
    
    // Special case for en passant: if pawn moves to enPassantTarget, capture the pawn that was "jumped over"
    if (promotionMove.to === currentGameState.enPassantTarget && !targetPiece) {
      // This is an en passant capture - the captured pawn is not on the target square
      const captureRank = promotionMove.piece.color === 'white' ? '5' : '4';
      const captureSquare = promotionMove.to[0] + captureRank;
      const capturedPawn = currentGameState.board[captureSquare];
      if (capturedPawn) {
        captured = `${capturedPawn.color}-${capturedPawn.type}`;
      }
    }
      
    makeMoveMutation.mutate({
      from: promotionMove.from,
      to: promotionMove.to,
      piece: `${promotionMove.piece.color}-${pieceType}`, // Use selected piece type
      captured,
    });
    
    setShowPromotionModal(false);
    setPromotionMove(null);
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
                <Button 
                  onClick={handleLogout} 
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-50"
                  title="Выйти из аккаунта"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Выйти
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
              <Sword className="h-24 w-24 text-slate-400 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Добро пожаловать в Шахматы Мастер</h2>
              <p className="text-lg text-slate-600 mb-8">Начните новую игру или присоединитесь к игре друга</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={handleNewGame} size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-5 w-5 mr-2" />
                  Начать игру
                </Button>
                <Button onClick={handleJoinGameClick} size="lg" variant="outline">
                  <Users className="h-5 w-5 mr-2" />
                  Присоединиться
                </Button>
              </div>
            </div>
          </div>
        </main>

        <GameTypeModal
          open={showGameTypeModal}
          onOpenChange={setShowGameTypeModal}
          onCreateGame={handleCreateNewGame}
          onJoinGame={handleJoinGameClick}
        />

        <RuleSelectionModal
          open={showRuleModal}
          onOpenChange={setShowRuleModal}
          onRuleSelect={handleRuleSelection}
        />

        <JoinGameModal
          open={showJoinModal}
          onOpenChange={setShowJoinModal}
          onJoinGame={handleJoinGame}
          isLoading={joinGameMutation.isPending}
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
              {game?.shareId && (
                <Button 
                  onClick={handleShareGame} 
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Поделиться
                </Button>
              )}
              <Button onClick={handleNewGame} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Новая игра
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
              <Button 
                onClick={handleLogout} 
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
                title="Выйти из аккаунта"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
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
                flipped={getCurrentPlayerColor() === 'black'}
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
                Сдаться
              </Button>
              <Button variant="outline" className="bg-yellow-600 text-white hover:bg-yellow-700" onClick={handleOfferDraw}>
                Ничья
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
      
      {promotionMove && (
        <PawnPromotionModal
          open={showPromotionModal}
          onSelectPiece={handlePawnPromotion}
          color={promotionMove.piece.color}
        />
      )}

      {(() => {
        const gameResult = getGameResult();
        return gameResult && (
          <GameOverModal
            open={showGameOverModal}
            result={gameResult.result}
            winner={gameResult.winner}
            onNewGame={handleNewGameFromModal}
            onClose={handleGameOverClose}
          />
        );
      })()}

      <GameTypeModal
        open={showGameTypeModal}
        onOpenChange={setShowGameTypeModal}
        onCreateGame={handleCreateNewGame}
        onJoinGame={handleJoinGameClick}
      />

      <JoinGameModal
        open={showJoinModal}
        onOpenChange={setShowJoinModal}
        onJoinGame={handleJoinGame}
        isLoading={joinGameMutation.isPending}
      />

      {game?.shareId && (
        <InviteModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          shareId={game.shareId}
          gameUrl={`${window.location.origin}/?join=${game.shareId}`}
        />
      )}

      <AlertDialog open={showResignConfirm} onOpenChange={setShowResignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердить сдачу</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите сдаться? Эта игра будет завершена, и ваш противник победит.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отменить</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResign} className="bg-red-600 hover:bg-red-700">
              Да, сдаться
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDrawConfirm} onOpenChange={setShowDrawConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Предложить ничью</AlertDialogTitle>
            <AlertDialogDescription>
              Вы хотите предложить ничью вашему противнику? Он сможет принять или отклонить предложение.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отменить</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOfferDraw} className="bg-yellow-600 hover:bg-yellow-700">
              Да, предложить ничью
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDrawOffer} onOpenChange={setShowDrawOffer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Предложение ничьей</AlertDialogTitle>
            <AlertDialogDescription>
              Ваш противник предлагает ничью. Хотите ли вы принять это предложение и завершить игру вничью?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeclineDraw}>Отклонить</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptDraw} className="bg-green-600 hover:bg-green-700">
              Принять ничью
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
