export function normalizeShareId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}

export function extractInvitePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = parseInviteLikePath(trimmed);
  if (!parsed) return null;

  if (parsed.type === "match") {
    return `/match${parsed.value}`;
  }

  return `/join/${parsed.value}`;
}

function parseInviteLikePath(value: string): { type: "match" | "join"; value: string } | null {
  const directMatch = value.match(/^\/?match([A-Za-z0-9]+)$/i);
  if (directMatch) {
    return { type: "match", value: directMatch[1] };
  }

  const directJoin = value.match(/^\/?join\/([A-Za-z0-9]{6})$/i);
  if (directJoin) {
    return { type: "join", value: directJoin[1].toUpperCase() };
  }

  try {
    const url = new URL(value);
    const path = url.pathname;

    const matchFromUrl = path.match(/^\/match([A-Za-z0-9]+)$/i);
    if (matchFromUrl) {
      return { type: "match", value: matchFromUrl[1] };
    }

    const joinFromUrl = path.match(/^\/join\/([A-Za-z0-9]{6})$/i);
    if (joinFromUrl) {
      return { type: "join", value: joinFromUrl[1].toUpperCase() };
    }
  } catch {
    return null;
  }

  return null;
}
