/** R-031 casino racetrack: 21 cells (0 = start/finish). */

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
      return "赛马";
    case "gun":
      return "老虎机";
  }
}

/**
 * R-031: any move that reaches or passes start/finish exits.
 * Forward: pos + delta >= TRACK_LEN. Backward: land exactly on 0.
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
  if (next === 0) return { pos: 0, exited: true };
  return { pos: next, exited: false };
}

/** Roll D = d1 − d2 for money / foot / gun. */
export function rollTrackDelta(): { d1: number; d2: number; d: number } {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return { d1, d2, d: d1 - d2 };
}

/**
 * Geometry mirrored from assets/render_board_v7.py (play area 1400×1400).
 * Seats are midpoints of the 21 stadium cells.
 */
const PLAY = 1400;
const BOARD_IMG_H = 1484;

function buildTrackSeats(): { x: number; y: number }[] {
  const margin = 40;
  const inner = margin + 4;
  const outer = PLAY - margin - 4;
  const cell = (outer - inner) / 12;
  const c1x0 = inner + 1 * cell;
  const c1y0 = inner + 1 * cell;
  const c2x1 = inner + 11 * cell;
  const c2y1 = inner + 11 * cell;
  const cx0 = c1x0 + 6;
  const cy0 = c1y0 + 6;
  const cx1 = c2x1 - 6;
  const cy1 = c2y1 - 6;
  const cw = cx1 - cx0;
  const ch = cy1 - cy0;

  const nSt = 6;
  const nRight = 5;
  const nLeft = 4;
  const hudBandH = ch * 0.47;
  const trackTop = cy0 + hudBandH;
  const trackBot = cy1 - 8;
  const trackH = trackBot - trackTop;

  const rMidOverS = (nRight + nLeft) / 2 / Math.PI;
  const rOutOverS = rMidOverS + 0.5;
  const twOverS = nSt + 2 * rOutOverS;
  const thOverS = 2 * rOutOverS;
  const S = Math.min((cw * 0.92) / twOverS, (trackH * 0.94) / thOverS);
  const lane = S;
  const rOut = rOutOverS * S;
  const rIn = rOut - lane;
  const rMid = (rOut + rIn) / 2;
  const straight = nSt * S;
  const tw = straight + 2 * rOut;
  const th = 2 * rOut;
  const ox0 = (cx0 + cx1) / 2 - tw / 2;
  const oy0 = trackTop + (trackH - th) / 2;
  const cxL = ox0 + rOut;
  const cxR = ox0 + rOut + straight;
  const cy = oy0 + rOut;

  const boundaries: [string, number, number][] = [];
  for (let i = 0; i < nSt; i++) boundaries.push(["top", i / nSt, (i + 1) / nSt]);
  for (let i = 0; i < nRight; i++)
    boundaries.push(["right", i / nRight, (i + 1) / nRight]);
  for (let i = 0; i < nSt; i++)
    boundaries.push(["bottom", i / nSt, (i + 1) / nSt]);
  for (let i = 0; i < nLeft; i++)
    boundaries.push(["left", i / nLeft, (i + 1) / nLeft]);

  const cellMid = (kind: string, u0: number, u1: number): [number, number] => {
    const u = (u0 + u1) / 2;
    if (kind === "top") return [cxL + u * straight, cy - rMid];
    if (kind === "bottom") return [cxR - u * straight, cy + rMid];
    if (kind === "right") {
      const ang = -Math.PI / 2 + u * Math.PI;
      return [cxR + rMid * Math.cos(ang), cy + rMid * Math.sin(ang)];
    }
    const ang = Math.PI / 2 + u * Math.PI;
    return [cxL + rMid * Math.cos(ang), cy + rMid * Math.sin(ang)];
  };

  return boundaries.map(([kind, u0, u1]) => {
    const [x, y] = cellMid(kind, u0, u1);
    return { x: (x / PLAY) * 100, y: (y / PLAY) * 100 };
  });
}

const TRACK_SEATS = buildTrackSeats();

/** Token seat on board play area (%), aligned to painted track cells. */
export function racetrackSeatPercent(index: number): { x: number; y: number } {
  const i = ((index % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
  return TRACK_SEATS[i]!;
}

/**
 * Upper plaza HUD band (% of play area 1400×1400).
 * Keep short so racetrack / plaza art stay visible.
 */
export const PLAZA_HUD_PERCENT = (() => {
  const margin = 40;
  const inner = margin + 4;
  const outer = PLAY - margin - 4;
  const cell = (outer - inner) / 12;
  const cx0 = inner + 1 * cell + 6;
  const cy0 = inner + 1 * cell + 6;
  const cx1 = inner + 11 * cell - 6;
  const cy1 = inner + 11 * cell - 6;
  const ch = cy1 - cy0;
  const left = cx0 + 12;
  const top = cy0 + 10;
  const right = cx1 - 12;
  // Leave a clear gap above the painted racetrack
  const bottom = cy0 + ch * 0.44;
  return {
    left: (left / PLAY) * 100,
    top: (top / PLAY) * 100,
    width: ((right - left) / PLAY) * 100,
    height: ((bottom - top) / PLAY) * 100,
  };
})();
/** Top wood-frame strip for brand + status overlay (% of full board image). */
export const BOARD_TOP_STRIP = {
  left: (40 / PLAY) * 100,
  top: 0.15,
  width: ((PLAY - 80) / PLAY) * 100,
  height: (46 / BOARD_IMG_H) * 100,
};