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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
          <ArrowLeftRight className="h-5 w-5 mr-2 text-blue-600" />
          Transfers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">No transfers yet</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm bg-slate-50 rounded-md px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-slate-700">
                    <span className="font-semibold">{label(e.fromBoardId)}</span>
                    <ArrowLeftRight className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold">{label(e.toBoardId)}</span>
                  </span>
                  <span className="text-slate-600">
                    {e.from} → {e.to}
                  </span>
                </div>
                <div className="text-slate-400">
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
