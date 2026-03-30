import type { ClockState } from "@shared/schema";

export type LiveClockState = {
  whiteMs: number;
  blackMs: number;
  activeColor: ClockState["activeColor"];
  isPaused: boolean;
  expiredColor: "white" | "black" | null;
};

function clampMs(value: number | undefined) {
  return Math.max(0, value ?? 0);
}

export function getLiveClockState(clockState: ClockState | null | undefined, nowMs = Date.now()): LiveClockState | null {
  if (!clockState) return null;

  const whiteMs = clampMs(clockState.whiteRemainingMs);
  const blackMs = clampMs(clockState.blackRemainingMs);
  if (clockState.isPaused || !clockState.activeColor || !clockState.lastUpdatedAt) {
    return {
      whiteMs,
      blackMs,
      activeColor: null,
      isPaused: true,
      expiredColor: null,
    };
  }

  const elapsedMs = Math.max(0, nowMs - new Date(clockState.lastUpdatedAt).getTime());
  const nextWhiteMs = clockState.activeColor === "white" ? Math.max(whiteMs - elapsedMs, 0) : whiteMs;
  const nextBlackMs = clockState.activeColor === "black" ? Math.max(blackMs - elapsedMs, 0) : blackMs;
  const expiredColor =
    clockState.activeColor === "white"
      ? nextWhiteMs <= 0
        ? "white"
        : null
      : nextBlackMs <= 0
        ? "black"
        : null;

  return {
    whiteMs: nextWhiteMs,
    blackMs: nextBlackMs,
    activeColor: clockState.activeColor,
    isPaused: false,
    expiredColor,
  };
}

export function formatClockMs(ms: number) {
  const totalSeconds = ms <= 0 ? 0 : Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatTimeControl(seconds: number) {
  if (seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }

  return formatClockMs(seconds * 1000);
}

export function isLowTime(ms: number) {
  return ms > 0 && ms <= 30_000;
}
