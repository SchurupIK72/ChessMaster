import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Download, ChevronRight, Play } from "lucide-react";
import { useRef, useEffect } from "react";

interface MoveHistoryProps {
  moves: { moveNumber: number; white?: string; black?: string }[];
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
          <History className="h-5 w-5 mr-2 text-blue-600" />
          Move History
        </CardTitle>
      </CardHeader>
      <CardContent>
  <ScrollArea className="h-64 w-full" viewportRef={scrollAreaViewportRef}>
          <div className="space-y-2">
            {moves.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
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
                      className={`flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 ${
                        isCurrentMove ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`text-sm font-medium w-6 ${
                          isCurrentMove ? 'text-blue-600' : 'text-slate-500'
                        }`}>
                          {move.moveNumber}.
                        </span>
                        <span className={`font-medium ${
                          isCurrentMove ? 'text-blue-800' : 'text-slate-800'
                        }`}>
                          {move.white || '...'}
                        </span>
                        <span className={`font-medium ${
                          isCurrentMove ? 'text-blue-800' : move.black ? 'text-slate-800' : 'text-slate-400'
                        }`}>
                          {move.black || '...'}
                        </span>
                      </div>
                      {isCurrentMove ? (
                        <Play className="h-4 w-4 text-blue-600" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
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
              className="w-full text-sm text-blue-600 hover:text-blue-800"
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
