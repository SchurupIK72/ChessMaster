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
import TransfersPanel, { type TransferEvent } from "@/components/transfers-panel";
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
import { getLegalCastlingDestinationFromRookClick } from "@/lib/castling";
import { Sword, Crown, Plus, Settings, Users, Share2, LogOut, SplitSquareVertical } from "lucide-react";

export default function ChessGame() {
  // Звук хода
  const moveAudio = typeof window !== 'undefined' ? new Audio('/move.mp3') : null;
  const [gameId, setGameId] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<{from: string, to: string} | null>(null);
  const [voidLastMoveSquares, setVoidLastMoveSquares] = useState<{ [key: number]: { from: string; to: string } | null }>({});
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
  // Computed later once `game` is available
  const [voidSelected, setVoidSelected] = useState<{ [key: number]: string | null }>({});
  const [voidValidMoves, setVoidValidMoves] = useState<{ [key: number]: string[] }>({});
  const [transferMode, setTransferMode] = useState(false);
  const [transferFrom, setTransferFrom] = useState<{ boardId: 0 | 1; square: string } | null>(null);
  const [pendingTransferPromotion, setPendingTransferPromotion] = useState<
    { fromBoardId: 0 | 1; fromSquare: string; toBoardId: 0 | 1; toSquare: string; color: 'white' | 'black' } | null
  >(null);

  // Helper: compute whether Fog of War is currently active considering Double Knight pairing
  const computeFogActive = (rules: any, movesList: Move[]): boolean => {
    const fogRules = (rules as any) || [];
    const hasFog = Array.isArray(fogRules) && fogRules.includes('fog-of-war');
    if (!hasFog) return false;
    const hasDoubleKnight = Array.isArray(fogRules) && fogRules.includes('double-knight');
    let turns = 0;
    let i = 0;
    while (i < movesList.length) {
      const m1 = movesList[i];
      const currentPlayer = m1.player;
      if (
        hasDoubleKnight &&
        i + 1 < movesList.length &&
        movesList[i + 1].player === currentPlayer &&
        typeof m1.piece === 'string' && m1.piece.endsWith('-knight') &&
        typeof movesList[i + 1].piece === 'string' && movesList[i + 1].piece.endsWith('-knight') &&
        m1.to && movesList[i + 1].from && m1.to === movesList[i + 1].from
      ) {
        turns += 1;
        i += 2;
      } else if (hasDoubleKnight && typeof m1.piece === 'string' && m1.piece.endsWith('-knight')) {
        i += 1; // wait for second step to complete the player's turn
      } else {
        turns += 1;
        i += 1;
      }
    }
  // Fog remains active until 10 effective turns (i.e., through Black's 5th move);
  // after Black's 5th move completes (turns >= 10), fog ends
  return turns < 10;
  };

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

  // Query for current game (no polling; we'll use SSE to refresh)
  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    queryFn: () => fetch(`/api/games/${gameId}`).then(res => res.json()),
    enabled: !!gameId,
  });

  // Query for game moves (no polling; updated via SSE)
  const { data: moves = [] } = useQuery<Move[]>({
    queryKey: ["/api/games", gameId, "moves"],
    queryFn: () => fetch(`/api/games/${gameId}/moves`).then(res => res.json()),
    enabled: !!gameId,
  });

  // Live updates via Server-Sent Events (SSE)
  useEffect(() => {
    if (!gameId) return;
    // Close previous source if any
    let closed = false;
    const src = new EventSource(`/api/games/${gameId}/stream`);

    const invalidate = () => {
      if (!closed) {
        queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
        queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "moves"] });
      }
    };

    src.addEventListener('connected', () => {
      // Initial sync
      invalidate();
    });
    src.addEventListener('move', invalidate);
    src.addEventListener('undo', invalidate);
    src.addEventListener('status', invalidate);
    src.addEventListener('draw', invalidate);
    src.onerror = () => {
      // transient network errors will auto-reconnect; optional local retry handling can be added
    };

    return () => {
      closed = true;
      try { src.close(); } catch {}
    };
  }, [gameId]);

  // Derived flags
  const isVoidMode = Array.isArray((game as any)?.rules) && ((game as any)?.rules as any[]).includes('void');

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
      const fogActiveNow = computeFogActive(game?.rules as any, moves);
      // Подсветка последнего хода
      if (!isVoidMode) {
        const lastMove = moves[moves.length - 1];
        if (lastMove && lastMove.from && lastMove.to) {
          setLastMoveSquares({ from: lastMove.from, to: lastMove.to });
        } else {
          setLastMoveSquares(null);
        }
        setVoidLastMoveSquares({});
      } else {
        // Per-board last action: considers sub-moves and transfers affecting each board separately
        const getLastForBoard = (boardId: 0 | 1): { from: string; to: string } | null => {
          for (let i = moves.length - 1; i >= 0; i--) {
            const m: any = moves[i];
            const special = m?.special as string | undefined;
            if (!special) continue;
            if (special.startsWith('void:board=')) {
              const bid = parseInt(special.split('=')[1], 10) as 0 | 1;
              if (bid === boardId && m.from && m.to) return { from: m.from, to: m.to };
            } else if (special.startsWith('void-transfer')) {
              const mt = special.match(/void-transfer:(\d+)->(\d+)/);
              const fromBid = mt ? (parseInt(mt[1], 10) as 0 | 1) : 0;
              const toBid = mt ? (parseInt(mt[2], 10) as 0 | 1) : 1;
              if (fromBid === boardId && m.from) return { from: m.from, to: m.from };
              if (toBid === boardId && m.to) return { from: m.to, to: m.to };
            }
          }
          return null;
        };
        setVoidLastMoveSquares({ 0: getLastForBoard(0), 1: getLastForBoard(1) });
        setLastMoveSquares(null);
      }

      // If this is not the first time we're checking moves
      if (lastMoveCount > 0 && moves.length > lastMoveCount) {
        const newMove = moves[moves.length - 1];
        const playerId = parseInt(localStorage.getItem('playerId') || '1');
        const isMyMove = (game?.whitePlayerId === playerId && newMove.player === 'white') || 
                        (game?.blackPlayerId === playerId && newMove.player === 'black');
        // Only show notification if it's NOT my move and fog is not active
        if (!isMyMove && !fogActiveNow) {
          toast({
            title: "Ход противника",
            description: `${newMove.from} → ${newMove.to}`,
            duration: 3000,
          });
        }
          // Воспроизвести звук хода при любом новом ходе
          if (moveAudio) {
            try { moveAudio.currentTime = 0; moveAudio.play(); } catch (e) {}
          }
      }
      setLastMoveCount(moves.length);
    } else {
      setLastMoveSquares(null);
      setVoidLastMoveSquares({});
    }
  }, [moves, lastMoveCount, game, toast, isVoidMode]);

  // Make move mutation
  const makeMoveMutation = useMutation({
    mutationFn: async ({ from, to, piece, captured, boardId, voidTransfer, promoted }: { from: string; to: string; piece: string; captured?: string; boardId?: 0|1; voidTransfer?: any; promoted?: 'queen'|'rook'|'bishop'|'knight' }) => {
      if (!game) throw new Error("No active game");
      const payload: any = {
        moveNumber: Math.floor(moves.length / 2) + 1,
        player: game.currentTurn,
        from,
        to,
        piece,
        captured,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // This would be calculated properly
      };
      if (typeof boardId !== 'undefined') payload.boardId = boardId;
      if (voidTransfer) payload.voidTransfer = { ...voidTransfer, promoted };
      const response = await apiRequest("POST", `/api/games/${gameId}/moves`, payload);
      return response.json();
    },
    onSuccess: () => {
      // Play move sound immediately
      if (moveAudio) {
        try { moveAudio.currentTime = 0; moveAudio.play(); } catch (e) {}
      }

      // Instant UI response: clear selection and highlighted moves
      setSelectedSquare(null);
      setValidMoves([]);

      // Fire-and-forget cache updates: rely on SSE to update moves; only invalidate the game
      // (remove await to avoid blocking UI)
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      // SSE 'move' event will trigger both game and moves invalidations via effect; no need to duplicate here
    },
    onError: (error: any) => {
      toast({
        title: "Invalid Move",
        description: error.message || "That move is not allowed",
        variant: "destructive",
      });
    },
  });

  // Void: per-board square click handler
  const handleVoidSquareClick = (boardId: 0 | 1, square: string) => {
    if (!game || !game.gameState || !isVoidMode || !Array.isArray((game.gameState as any).voidBoards)) return;
    const boards = (game.gameState as any).voidBoards as ChessGameState[];
    const active = boards[boardId] as any as ChessGameState;
    const piece = active.board[square];

    const playerColor = getCurrentPlayerColor();
    const myTurn = playerColor === game.currentTurn;

    // Auto-transfer: if a piece is selected on the other board and user clicks an empty square here,
    // and transfer is allowed (have token, it's your turn, and no pending), perform transfer without needing toggle.
    if (myTurn && playerColor) {
      const meta = (game.gameState as any).voidMeta || { tokens: { white: 0, black: 0 }, pending: null };
      const myTokens = meta.tokens?.[playerColor] ?? 0;
      const canAutoTransfer = myTokens > 0 && !meta.pending; // transfer consumes full turn
      const otherBoardId = (boardId === 0 ? 1 : 0) as 0 | 1;
      const otherSel = voidSelected[otherBoardId] || null;
      if (canAutoTransfer && otherSel && !piece) {
        const srcPiece = (boards[otherBoardId] as any as ChessGameState).board[otherSel] as ChessPiece | null;
        if (srcPiece && srcPiece.color === playerColor) {
          // If transferring pawn to last rank, prompt promotion
          const rank = parseInt(square[1]);
          const shouldPromote = srcPiece.type === 'pawn' && ((srcPiece.color === 'white' && rank === 8) || (srcPiece.color === 'black' && rank === 1));
          const basePayload = {
            fromBoardId: otherBoardId,
            fromSquare: otherSel,
            toBoardId: boardId,
            toSquare: square,
          } as const;
          if (shouldPromote) {
            setPendingTransferPromotion({ ...basePayload, color: srcPiece.color });
            setShowPromotionModal(true);
          } else {
            makeMoveMutation.mutate({
              from: otherSel,
              to: square,
              piece: `${srcPiece.color}-${srcPiece.type}`,
              boardId: undefined,
              voidTransfer: basePayload,
            });
          }
          // Clear selections on both boards and exit
          setVoidSelected({ ...voidSelected, [otherBoardId]: null, [boardId]: null });
          setVoidValidMoves({ ...voidValidMoves, [otherBoardId]: [], [boardId]: [] });
          setTransferMode(false);
          setTransferFrom(null);
          return;
        }
      }
    }

    // Transfer selection mode (explicit toggle still supported)
    if (transferMode) {
      if (!transferFrom) {
        // Choose source piece
        if (piece && myTurn && piece.color === playerColor) {
          setTransferFrom({ boardId, square });
        }
        return;
      } else {
        // Choose destination on the other board
        if (boardId === transferFrom.boardId) {
          // Must select destination on the other board
          return;
        }
        const destBoard = boards[boardId] as any as ChessGameState;
        if (destBoard.board[square]) return; // must be empty
        const srcPiece = (boards[transferFrom.boardId] as any as ChessGameState).board[transferFrom.square]! as ChessPiece;
        // If transferring pawn to last rank, prompt promotion
        const rank = parseInt(square[1]);
        const shouldPromote = srcPiece.type === 'pawn' && ((srcPiece.color === 'white' && rank === 8) || (srcPiece.color === 'black' && rank === 1));
        const basePayload = {
          fromBoardId: transferFrom.boardId,
          fromSquare: transferFrom.square,
          toBoardId: boardId,
          toSquare: square,
        };
        if (shouldPromote) {
          setPendingTransferPromotion({ ...basePayload, color: srcPiece.color });
          setShowPromotionModal(true);
        } else {
          makeMoveMutation.mutate({
            from: transferFrom.square,
            to: square,
            piece: `${srcPiece.color}-${srcPiece.type}`,
            boardId: undefined,
            voidTransfer: basePayload,
          });
          setTransferMode(false);
          setTransferFrom(null);
        }
        return;
      }
    }

    // Normal per-board move selection
    const sel = voidSelected[boardId] || null;
    const vm = voidValidMoves[boardId] || [];
    if (sel) {
      if (sel === square) {
        setVoidSelected({ ...voidSelected, [boardId]: null });
        setVoidValidMoves({ ...voidValidMoves, [boardId]: [] });
        return;
      }
      if (vm.includes(square)) {
        const fromPiece = active.board[sel]! as ChessPiece;
        const toPiece = active.board[square] as ChessPiece | null;
        if (toPiece && fromPiece && toPiece.color === fromPiece.color) {
          setVoidSelected({ ...voidSelected, [boardId]: null });
          setVoidValidMoves({ ...voidValidMoves, [boardId]: [] });
          return;
        }
        if (fromPiece) {
          if (!myTurn || fromPiece.color !== playerColor) {
            toast({ title: 'Не ваш ход', description: 'Дождитесь своей очереди', variant: 'destructive', duration: 2000 });
            setVoidSelected({ ...voidSelected, [boardId]: null });
            setVoidValidMoves({ ...voidValidMoves, [boardId]: [] });
            return;
          }
          // Promotion check on this board
          if (fromPiece.type === 'pawn') {
            const toRank = parseInt(square[1]);
            const shouldPromote = (fromPiece.color === 'white' && toRank === 8) || (fromPiece.color === 'black' && toRank === 1);
            if (shouldPromote) {
              setPromotionMove({ from: sel, to: square, piece: fromPiece });
              setShowPromotionModal(true);
              // stash selected board for promotion completion
              (window as any).__voidPromotionBoardId = boardId;
              return;
            }
          }
          // En passant capture detection on this board
          let captured = toPiece ? `${toPiece.color}-${toPiece.type}` : undefined;
          if (fromPiece.type === 'pawn' && square === active.enPassantTarget && !toPiece) {
            const targetFile = square[0];
            const targetRank = parseInt(square[1]);
            const fromFile = sel[0];
            const fromRank = parseInt(sel[1]);
            if (fromRank !== targetRank) {
              const captureRank = fromPiece.color === 'white' ? '5' : '4';
              const captureSquare = targetFile + captureRank;
              const capturedPawn = active.board[captureSquare] as ChessPiece | null;
              if (capturedPawn) captured = `${capturedPawn.color}-${capturedPawn.type}`;
            } else {
              const leftSquare = String.fromCharCode(fromFile.charCodeAt(0) - 1) + fromRank;
              const rightSquare = String.fromCharCode(fromFile.charCodeAt(0) + 1) + fromRank;
              const leftPawn = active.board[leftSquare] as ChessPiece | null;
              const rightPawn = active.board[rightSquare] as ChessPiece | null;
              const capturedPawn = leftPawn && leftPawn.color !== fromPiece.color ? leftPawn : rightPawn && rightPawn.color !== fromPiece.color ? rightPawn : null;
              if (capturedPawn) captured = `${capturedPawn.color}-${capturedPawn.type}`;
            }
          }
          makeMoveMutation.mutate({
            from: sel,
            to: square,
            piece: `${fromPiece.color}-${fromPiece.type}`,
            captured,
            boardId,
          });
        }
      }
      // clear selection if not a valid move
      setVoidSelected({ ...voidSelected, [boardId]: null });
      setVoidValidMoves({ ...voidValidMoves, [boardId]: [] });
    } else {
      // Select piece
      if (piece && myTurn && piece.color === playerColor) {
        setVoidSelected({ ...voidSelected, [boardId]: square });
        const movesList = chessLogic.getValidMoves(active as any, square, game?.rules as any);
        // compute transfer destinations on the other board if token available and no pending
        const meta = (game.gameState as any).voidMeta || { tokens: { white: 0, black: 0 }, pending: null };
        const myTokens = meta.tokens?.[playerColor] ?? 0;
        const canAutoTransfer = myTokens > 0 && !meta.pending;
        const otherId = (boardId === 0 ? 1 : 0) as 0 | 1;
        let otherMoves: string[] = [];
        if (canAutoTransfer) {
          const otherBoard = boards[otherId] as any as ChessGameState;
          // all empty squares on the other board
          const files = ['a','b','c','d','e','f','g','h'];
          for (let r = 1; r <= 8; r++) {
            for (const f of files) {
              const sq = `${f}${r}`;
              if (!otherBoard.board[sq]) otherMoves.push(sq);
            }
          }
        }
        setVoidValidMoves({ ...voidValidMoves, [boardId]: movesList, [otherId]: otherMoves });
      } else {
        setVoidSelected({ ...voidSelected, [boardId]: null });
        setVoidValidMoves({ ...voidValidMoves, [boardId]: [] });
        if (piece && piece.color !== playerColor && playerColor) {
          toast({ title: 'Неверный ход', description: 'Вы можете ходить только своими фигурами', variant: 'destructive', duration: 2000 });
        }
      }
    }
  };

  // Undo last move mutation
  const undoMoveMutation = useMutation({
    mutationFn: async () => {
      if (!gameId) throw new Error("No active game");
      const response = await apiRequest("POST", `/api/games/${gameId}/undo`, {});
      return response.json();
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "moves"] });
      setSelectedSquare(null);
      setValidMoves([]);
      // best-effort: clear last move highlight after undo
      setLastMoveSquares(null);
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось выполнить Undo",
        description: error?.message || "Попробуйте ещё раз",
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
        // Chess960 UX: king → rook click triggers castling to c/g using helper
        const fromPiece = gameState.board[selectedSquare];
        const targetPiece = piece;
        const rulesArray = (game?.rules as any) || [];
        if (fromPiece && fromPiece.type === 'king' && targetPiece && targetPiece.type === 'rook' && targetPiece.color === fromPiece.color) {
          // Ensure it's player's turn
          const playerColor = getCurrentPlayerColor();
          if (playerColor === gameState.currentTurn) {
            const dest = getLegalCastlingDestinationFromRookClick(
              gameState,
              selectedSquare,
              square,
              rulesArray,
              validMoves
            );
            if (dest) {
              makeMoveMutation.mutate({
                from: selectedSquare,
                to: dest,
                piece: `${fromPiece.color}-${fromPiece.type}`,
              });
              setSelectedSquare(null);
              setValidMoves([]);
              return;
            }
          } else {
            toast({ title: "Не ваш ход", description: "Дождитесь своей очереди", variant: "destructive", duration: 2000 });
          }
        }

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
    // Determine the resigning player's color (not necessarily the current turn)
    const playerColor = getCurrentPlayerColor();
    const resigningColor = playerColor ?? game.currentTurn;
    const winner = resigningColor === 'white' ? 'black' : 'white';
    updateStatusMutation.mutate({ status: 'completed', winner });
    setShowGameOverModal(true);
    setShowResignConfirm(false);
    toast({
      title: "Партия завершена",
      description: `${resigningColor === 'white' ? 'Белые' : 'Черные'} сдались. ${winner === 'white' ? 'Белые' : 'Черные'} победили!`,
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
    // Handle pending transfer promotion first
    if (pendingTransferPromotion) {
      const { fromBoardId, fromSquare, toBoardId, toSquare, color } = pendingTransferPromotion;
      makeMoveMutation.mutate({
        from: fromSquare,
        to: toSquare,
        piece: `${color}-pawn`,
        voidTransfer: { fromBoardId, fromSquare, toBoardId, toSquare },
        promoted: pieceType,
      });
      setPendingTransferPromotion(null);
      setTransferMode(false);
      setTransferFrom(null);
      setShowPromotionModal(false);
      setPromotionMove(null);
      return;
    }

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
      
    // If promotion originated from Void board, use stored board id
    const voidBoardId = (window as any).__voidPromotionBoardId as 0 | 1 | undefined;
    makeMoveMutation.mutate({
      from: promotionMove.from,
      to: promotionMove.to,
      piece: `${promotionMove.piece.color}-${pieceType}`,
      captured,
      boardId: typeof voidBoardId !== 'undefined' ? voidBoardId : undefined,
    });
    (window as any).__voidPromotionBoardId = undefined;
    
    setShowPromotionModal(false);
    setPromotionMove(null);
  };

  const getCapturedPieces = () => {
    if (!game || !moves.length) return { white: [], black: [] } as any;
    if (!isVoidMode) {
      const captured = { white: [] as string[], black: [] as string[] };
      moves.forEach((move) => {
        if (move.captured) {
          const [color] = move.captured.split('-');
          if (color === 'white') captured.black.push(move.captured);
          else captured.white.push(move.captured);
        }
      });
      return captured;
    }
    const b0 = { white: [] as string[], black: [] as string[] };
    const b1 = { white: [] as string[], black: [] as string[] };
    moves.forEach((move: any) => {
      if (!move.captured) return;
      const [color] = (move.captured as string).split('-');
      const pushTo = color === 'white' ? (m: any) => m.black.push(move.captured) : (m: any) => m.white.push(move.captured);
      const special = move.special as string | undefined;
      if (special?.startsWith('void:board=')) {
        const bid = parseInt(special.split('=')[1], 10) as 0 | 1;
        if (bid === 0) pushTo(b0); else pushTo(b1);
      }
      // transfers ignored, cannot capture
    });
    return { board0: b0, board1: b1 } as any;
  };

  const formatMoveHistory = () => {
    const makeList = (sourceMoves: any[]) => {
      const formatted: { moveNumber: number; white?: string; black?: string; whiteTransfer?: boolean; blackTransfer?: boolean }[] = [];
      const isDoubleKnight = game?.rules?.includes('double-knight');
      let i = 0;
      let moveNumber = 1;
      while (i < sourceMoves.length) {
        let whiteMoveStr: string | undefined = undefined;
        let blackMoveStr: string | undefined = undefined;
        if (sourceMoves[i] && sourceMoves[i].player === 'white') {
          if (
            isDoubleKnight &&
            sourceMoves[i + 1] &&
            sourceMoves[i + 1].player === 'white' &&
            sourceMoves[i].piece?.includes('knight') &&
            sourceMoves[i + 1].piece?.includes('knight') &&
            sourceMoves[i].to && sourceMoves[i + 1].from && sourceMoves[i].to === sourceMoves[i + 1].from
          ) {
            whiteMoveStr = `${sourceMoves[i].from}-${sourceMoves[i].to}-${sourceMoves[i + 1].to}`;
            i += 2;
          } else {
            whiteMoveStr = `${sourceMoves[i].from}-${sourceMoves[i].to}`;
            i++;
          }
        }
        if (i < sourceMoves.length && sourceMoves[i] && sourceMoves[i].player === 'black') {
          if (
            isDoubleKnight &&
            sourceMoves[i + 1] &&
            sourceMoves[i + 1].player === 'black' &&
            sourceMoves[i].piece?.includes('knight') &&
            sourceMoves[i + 1].piece?.includes('knight') &&
            sourceMoves[i].to && sourceMoves[i + 1].from && sourceMoves[i].to === sourceMoves[i + 1].from
          ) {
            blackMoveStr = `${sourceMoves[i].from}-${sourceMoves[i].to}-${sourceMoves[i + 1].to}`;
            i += 2;
          } else {
            blackMoveStr = `${sourceMoves[i].from}-${sourceMoves[i].to}`;
            i++;
          }
        }
        if (whiteMoveStr || blackMoveStr) {
          formatted.push({ moveNumber, white: whiteMoveStr, black: blackMoveStr });
          moveNumber++;
        }
      }
      return formatted;
    };
    if (!isVoidMode) return makeList(moves as any);
    const all = (moves as any[]) || [];
    const b0 = all.filter(m => (m.special as string | undefined)?.startsWith('void:board=0'));
    const b1 = all.filter(m => (m.special as string | undefined)?.startsWith('void:board=1'));

    // Build base rows per board from their own moves
    const rows0Map = new Map<number, { moveNumber: number; white?: string; black?: string; whiteTransfer?: boolean; blackTransfer?: boolean }>();
    const rows1Map = new Map<number, { moveNumber: number; white?: string; black?: string; whiteTransfer?: boolean; blackTransfer?: boolean }>();

    makeList(b0).forEach(r => rows0Map.set(r.moveNumber, { ...r }));
    makeList(b1).forEach(r => rows1Map.set(r.moveNumber, { ...r }));

    // Overlay transfer badges onto appropriate rows; ensure row exists for that moveNumber
    for (let i = 0; i < all.length; i++) {
      const mv: any = all[i];
      const special = mv?.special as string | undefined;
      if (!special || !special.startsWith('void-transfer')) continue;
      const m = special.match(/void-transfer:(\d+)->(\d+)/);
      const fromBoardId = m ? parseInt(m[1], 10) as 0 | 1 : 0;
      const toBoardId = m ? parseInt(m[2], 10) as 0 | 1 : 1;
      const moveNo: number = (mv.moveNumber as number) || (Math.floor(i / 2) + 1);
      const isWhite = (mv.player as string) === 'white';

      const ensureRow = (map: Map<number, any>) => {
        if (!map.has(moveNo)) map.set(moveNo, { moveNumber: moveNo });
        return map.get(moveNo)!;
      };

      if (fromBoardId === 0 || toBoardId === 0) {
        const row = ensureRow(rows0Map);
        if (isWhite) row.whiteTransfer = true; else row.blackTransfer = true;
      }
      if (fromBoardId === 1 || toBoardId === 1) {
        const row = ensureRow(rows1Map);
        if (isWhite) row.whiteTransfer = true; else row.blackTransfer = true;
      }
    }

    const list0 = Array.from(rows0Map.values()).sort((a, b) => a.moveNumber - b.moveNumber);
    const list1 = Array.from(rows1Map.values()).sort((a, b) => a.moveNumber - b.moveNumber);
    return { board0: list0, board1: list1 } as any;
  };

  // Extract transfer events for Void mode
  const transfers = (() => {
    if (!isVoidMode || !Array.isArray(moves) || moves.length === 0) return [] as TransferEvent[];
    const events: TransferEvent[] = [];
    for (let i = 0; i < (moves as any[]).length; i++) {
      const mv: any = (moves as any[])[i];
      const special = mv?.special as string | undefined;
      if (!special || !special.startsWith('void-transfer')) continue;
      const m = special.match(/void-transfer:(\d+)->(\d+)/);
      const fromBoardId = m ? (parseInt(m[1], 10) as 0 | 1) : 0;
      const toBoardId = m ? (parseInt(m[2], 10) as 0 | 1) : 1;
      events.push({
        moveNumber: i + 1,
        fromBoardId,
        toBoardId,
        from: mv.from,
        to: mv.to,
        player: (mv.player || mv.color) as 'white' | 'black',
        piece: mv.piece,
      });
    }
    return events;
  })();

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

  // Fog of War: use the same helper for consistency across UI
  const fogActive = computeFogActive(game?.rules as any, moves);
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
              moves={moves}
            />
          </div>

          {/* Center Column: Board(s) */}
          <div className="lg:col-span-6 flex flex-col items-center">
            {!isVoidMode && (
              <>
                <ChessBoard
                  gameState={game!.gameState as ChessGameState}
                  selectedSquare={selectedSquare}
                  validMoves={validMoves}
                  onSquareClick={handleSquareClick}
                  currentTurn={game!.currentTurn as 'white' | 'black'}
                  flipped={getCurrentPlayerColor() === 'black'}
                  viewerColor={getCurrentPlayerColor()}
                  rules={(game!.rules as any) || []}
                  fogActiveOverride={fogActive}
                  lastMoveSquares={lastMoveSquares}
                />
              </>
            )}
            {isVoidMode && Array.isArray((game!.gameState as any).voidBoards) && (
              <div className="w-full flex flex-col gap-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <SplitSquareVertical className="h-5 w-5" />
                    <span className="font-semibold">Void Mode</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {(() => {
                      const meta = (game!.gameState as any).voidMeta || { tokens: { white: 0, black: 0 }, pending: null };
                      const color = getCurrentPlayerColor();
                      const myTokens = color ? (meta.tokens[color] || 0) : 0;
                      const canTransfer = color && color === game!.currentTurn && myTokens > 0 && !meta.pending;
                      return (
                        <div className="flex items-center gap-3">
                          <span>Токены переноса: <b>{myTokens}</b></span>
                          <Button size="sm" variant={canTransfer ? "default" : "outline"} disabled={!canTransfer} onClick={() => setTransferMode(v => !v)}>
                            Перенос {transferMode ? 'ON' : 'OFF'}
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {/* Board A */}
                <ChessBoard
                  gameState={(game!.gameState as any).voidBoards[0] as ChessGameState}
                  selectedSquare={voidSelected[0] || null}
                  validMoves={voidValidMoves[0] || []}
                  onSquareClick={(sq) => handleVoidSquareClick(0, sq)}
                  currentTurn={game!.currentTurn as 'white' | 'black'}
                  flipped={getCurrentPlayerColor() === 'black'}
                  viewerColor={getCurrentPlayerColor()}
                  rules={(game!.rules as any) || []}
                  fogActiveOverride={fogActive}
                  lastMoveSquares={(voidLastMoveSquares as any)[0] || null}
                />
                {/* Board B */}
                <ChessBoard
                  gameState={(game!.gameState as any).voidBoards[1] as ChessGameState}
                  selectedSquare={voidSelected[1] || null}
                  validMoves={voidValidMoves[1] || []}
                  onSquareClick={(sq) => handleVoidSquareClick(1, sq)}
                  currentTurn={game!.currentTurn as 'white' | 'black'}
                  flipped={getCurrentPlayerColor() === 'black'}
                  viewerColor={getCurrentPlayerColor()}
                  rules={(game!.rules as any) || []}
                  fogActiveOverride={fogActive}
                  lastMoveSquares={(voidLastMoveSquares as any)[1] || null}
                />
                {transferMode && (
                  <div className="mt-2 text-center text-sm text-blue-700">Выберите фигуру для переноса, затем пустую клетку на другой доске</div>
                )}
              </div>
            )}

            {/* Game Controls */}
            <div className="flex items-center space-x-4 mt-6">
              <Button variant="outline" onClick={() => undoMoveMutation.mutate()} disabled={undoMoveMutation.isPending}>
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
            {!fogActive && (!isVoidMode ? (
              <MoveHistory moves={formatMoveHistory() as any} />
            ) : (
              (() => {
                const mh = formatMoveHistory() as any;
                return (
                  <div className="grid grid-cols-1 gap-4">
                    <MoveHistory title="Board A — History" moves={mh.board0 || []} />
                    <MoveHistory title="Board B — History" moves={mh.board1 || []} />
                    <TransfersPanel events={transfers} />
                  </div>
                );
              })()
            ))}
            {(() => {
              const caps = getCapturedPieces() as any;
              return !isVoidMode ? (
                <CapturedPieces capturedPieces={caps} />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <CapturedPieces title="Board A — Captured" capturedPieces={caps.board0 || { white: [], black: [] }} />
                  <CapturedPieces title="Board B — Captured" capturedPieces={caps.board1 || { white: [], black: [] }} />
                </div>
              );
            })()}
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
