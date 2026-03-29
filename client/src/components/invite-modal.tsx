import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareId: string;
  gameUrl: string;
}

export default function InviteModal({ open, onOpenChange, shareId, gameUrl }: InviteModalProps) {
  const { toast } = useToast();

  const copyShareId = async () => {
    try {
      await navigator.clipboard.writeText(shareId);
      toast({
        title: "Copied",
        description: "Legacy game code copied to clipboard",
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not copy the legacy code",
        variant: "destructive",
      });
    }
  };

  const copyGameUrl = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      toast({
        title: "Copied",
        description: "Match link copied to clipboard",
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not copy the match link",
        variant: "destructive",
      });
    }
  };

  const shareGame = async () => {
    if (!navigator.share) {
      await copyGameUrl();
      return;
    }

    try {
      await navigator.share({
        title: "ChessMaster Match",
        text: `Join my ChessMaster match with this link. Legacy code: ${shareId}`,
        url: gameUrl,
      });
    } catch {
      // User cancelled native share
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invite To Match
          </DialogTitle>
          <DialogDescription>
            Share the canonical ChessMaster match link. Legacy game code remains available as a temporary fallback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="game-url">Primary match link</Label>
            <div className="flex items-center space-x-2">
              <Input id="game-url" value={gameUrl} readOnly className="text-sm" />
              <Button type="button" variant="outline" size="icon" onClick={copyGameUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link is the main invite flow. Players reconnect to their role, everyone else opens the match as a spectator.
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="share-id">Legacy game code</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="share-id"
                value={shareId}
                readOnly
                className="text-center text-lg font-mono tracking-wider font-bold"
              />
              <Button type="button" variant="outline" size="icon" onClick={copyShareId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Temporary compatibility: the code still works in the join screen and old `/join/{shareId}` links redirect into the canonical match route.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={shareGame} className="flex-1">
              <Share2 className="mr-2 h-4 w-4" />
              Share Match
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Close
            </Button>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              The game starts as soon as the second player joins. Spectators can open the same link at any time.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
