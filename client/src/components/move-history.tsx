import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Download, ChevronRight, Play } from "lucide-react";
import { useRef, useEffect } from "react";

interface MoveHistoryProps {
  moves: { moveNumber: number; white?: string; black?: string }[];
  title?: string;
}

export default function MoveHistory({ moves, title }: MoveHistoryProps) {
  const handleExport = () => {
    // TODO: Implement PGN export
    console.log("Exporting game as PGN...");
  };

  // Ссылка на viewport ScrollArea
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaViewportRef.current) {
      scrollAreaViewportRef.current.scrollTop = scrollAreaViewportRef.current.scrollHeight;
    }
  }, [moves]);

  return (
    <Card className="border border-black/10 shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center">
          <History className="h-5 w-5 mr-2 text-neutral-900" />
          {title || 'Move History'}
        </CardTitle>
      </CardHeader>
      <CardContent>
  <ScrollArea className="h-64 w-full" viewportRef={scrollAreaViewportRef}>
          <div className="space-y-2">
            {moves.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <p>No moves yet</p>
                <p className="text-sm">Start playing to see move history</p>
              </div>
            ) : (
              <>
                {moves.map((move, index) => {
                  const isCurrentMove = index === moves.length - 1 && !move.black;
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded-2xl hover:bg-neutral-100 ${
                        isCurrentMove ? 'bg-neutral-950 text-white border border-black' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`text-sm font-medium w-6 ${
                          isCurrentMove ? 'text-white/70' : 'text-neutral-500'
                        }`}>
                          {move.moveNumber}.
                        </span>
                        <span className={`font-medium ${
                          isCurrentMove ? 'text-white' : 'text-neutral-900'
                        }`}>
                          {move.white || '...'}
                        </span>
                        <span className={`font-medium ${
                          isCurrentMove ? 'text-white' : move.black ? 'text-neutral-900' : 'text-neutral-400'
                        }`}>
                          {move.black || '...'}
                        </span>
                      </div>
                      {isCurrentMove ? (
                        <Play className="h-4 w-4 text-white" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                      )}
                    </div>
                  );
                })}
              
              </>
            )}
          </div>
        </ScrollArea>
        {moves.length > 0 && (
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={handleExport}
              className="w-full text-sm text-neutral-900 hover:bg-neutral-100 hover:text-black"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Game (PGN)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
