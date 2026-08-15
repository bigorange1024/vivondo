/** R-031 mafia racetrack: 21 cells (0 = start/finish). */

export const TRACK_LEN = 21;

export type TrackCellKind = "start" | "money" | "foot" | "gun";

/** Cells 1..20: (money → foot → money → gun) × 5 */
export function trackCellKind(index: number): TrackCellKind {
  if (index <= 0 || index >= TRACK_LEN) return "start";
  const slot = (index - 1) % 4;
  if (slot === 0 || slot === 2) return "money";
  if (slot === 1) return "foot";
  return "gun";
}

export function trackCellZh(kind: TrackCellKind): string {
  switch (kind) {
    case "start":
      return "起终点";
    case "money":
      return "钞票";
    case "foot":
      return "脚印";
    case "gun":
      return "手枪";
  }
}

/**
 * Forward exit if pos + delta >= TRACK_LEN.
 * Backward wraps; never exits.
 */
export function moveOnTrack(
  pos: number,
  delta: number,
): { pos: number; exited: boolean } {
  if (delta === 0) return { pos, exited: false };
  if (delta > 0) {
    const next = pos + delta;
    if (next >= TRACK_LEN) return { pos: 0, exited: true };
    return { pos: next, exited: false };
  }
  const next = ((pos + delta) % TRACK_LEN + TRACK_LEN) % TRACK_LEN;
  return { pos: next, exited: false };
}

/** Roll D = d1 − d2 for money / foot / gun. */
export function rollTrackDelta(): { d1: number; d2: number; d: number } {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return { d1, d2, d: d1 - d2 };
}

/**
 * Approximate token seats on board PNG (play area %),
 * horizontal oval in lower plaza / infield.
 */
export function racetrackSeatPercent(index: number): { x: number; y: number } {
  const i = ((index % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
  const t = (i / TRACK_LEN) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + 16.5 * Math.cos(t),
    y: 66 + 6.2 * Math.sin(t),
  };
}
