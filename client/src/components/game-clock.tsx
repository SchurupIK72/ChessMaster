import { cn } from "@/lib/utils";
import { formatClockMs, isLowTime } from "@/lib/clock";

interface GameClockProps {
  label: string;
  remainingMs: number;
  active: boolean;
  shared?: boolean;
}

export default function GameClock({ label, remainingMs, active, shared = false }: GameClockProps) {
  const lowTime = isLowTime(remainingMs);

  return (
    <div
      className={cn(
        "w-full rounded-3xl border px-5 py-4 transition-colors",
        active
          ? "border-black bg-white text-black shadow-[0_18px_40px_rgba(255,255,255,0.18)]"
          : "border-white/15 bg-white/8 text-white",
        lowTime && "border-red-400 bg-red-500/10 text-red-100",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] opacity-70">{label}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{formatClockMs(remainingMs)}</div>
        </div>
        <div className="text-right text-xs uppercase tracking-[0.18em] opacity-80">
          <div>{active ? "Active" : "Waiting"}</div>
          <div className="mt-1">{shared ? "Shared clock" : "Board clock"}</div>
        </div>
      </div>
    </div>
  );
}
