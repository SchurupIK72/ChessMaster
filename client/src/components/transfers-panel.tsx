import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";

export interface TransferEvent {
  moveNumber: number;
  fromBoardId: 0 | 1;
  toBoardId: 0 | 1;
  from: string;
  to: string;
  player: 'white' | 'black';
  piece?: string;
}

interface TransfersPanelProps {
  events: TransferEvent[];
}

export default function TransfersPanel({ events }: TransfersPanelProps) {
  const label = (id: 0 | 1) => (id === 0 ? 'A' : 'B');
  return (
    <Card className="border border-black/10 shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center">
          <ArrowLeftRight className="h-5 w-5 mr-2 text-neutral-900" />
          Transfers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-4 text-neutral-500 text-sm">No transfers yet</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm bg-neutral-100 rounded-2xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-neutral-800">
                    <span className="font-semibold">{label(e.fromBoardId)}</span>
                    <ArrowLeftRight className="h-4 w-4 text-neutral-500" />
                    <span className="font-semibold">{label(e.toBoardId)}</span>
                  </span>
                  <span className="text-neutral-600">
                    {e.from} → {e.to}
                  </span>
                </div>
                <div className="text-neutral-400">
                  {e.piece?.split('-')[1] || ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
