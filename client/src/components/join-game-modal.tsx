import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { extractInvitePath, normalizeShareId } from "@/lib/match-links";

interface JoinGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinGame: (inviteValue: string) => void;
  isLoading?: boolean;
}

export default function JoinGameModal({ open, onOpenChange, onJoinGame, isLoading = false }: JoinGameModalProps) {
  const [inviteValue, setInviteValue] = useState("");
  const { toast } = useToast();

  const isValidInvite = Boolean(extractInvitePath(inviteValue) || normalizeShareId(inviteValue));

  const handleJoinGame = () => {
    if (!isValidInvite) {
      toast({
        title: "Error",
        description: "Paste a ChessMaster match link or enter a 6-character legacy game code",
        variant: "destructive",
      });
      return;
    }

    onJoinGame(inviteValue.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleJoinGame();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Join Match
          </DialogTitle>
          <DialogDescription>
            Paste a canonical ChessMaster match link. Legacy game codes and old `/join/...` links are still supported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="inviteValue">Match link or game code</Label>
            <Input
              id="inviteValue"
              placeholder="https://chessmasterx.onrender.com/matchABC123 or ABC123"
              value={inviteValue}
              onChange={(e) => setInviteValue(e.target.value)}
              onKeyDown={handleKeyPress}
              className="text-sm"
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              Supported: `/match...`, `/join/...`, full ChessMaster URLs, or the old 6-character code.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleJoinGame} disabled={!isValidInvite || isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Open Match
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Match links are now the primary invite format. Legacy codes remain available for temporary backward compatibility.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
