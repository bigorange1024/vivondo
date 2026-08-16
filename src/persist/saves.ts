import type { GameConfig, GameState } from "../engine/game";

export const MAX_SAVE_SLOTS = 9;

export interface SaveMeta {
  savedAt: string;
  humans: number;
  ais: number;
  turn: number;
  phase: string;
  summary: string;
}

export interface SaveFile {
  version: 1;
  meta: SaveMeta;
  config: GameConfig;
  state: GameState;
}

export interface SaveSlotInfo {
  slot: number;
  exists: boolean;
  meta: SaveMeta | null;
}

const LS_PREFIX = "vivondo-save-slot-";

function isSaveMeta(v: unknown): v is SaveMeta {
  if (!v || typeof v !== "object") return false;
  const m = v as SaveMeta;
  return (
    typeof m.savedAt === "string" &&
    typeof m.humans === "number" &&
    typeof m.ais === "number" &&
    typeof m.turn === "number" &&
    typeof m.phase === "string" &&
    typeof m.summary === "string"
  );
}

export function buildSaveFile(
  state: GameState,
  config: GameConfig,
): SaveFile {
  const humans = state.players.filter((p) => p.kind === "human").length;
  const ais = state.players.filter((p) => p.kind === "ai").length;
  return {
    version: 1,
    meta: {
      savedAt: new Date().toISOString(),
      humans,
      ais,
      turn: state.turn,
      phase: state.phase,
      summary: `回合${state.turn} · ${humans}人+${ais}AI`,
    },
    config: {
      humans: config.humans,
      ais: config.ais,
      startingCash: config.startingCash ?? 5000,
    },
    state,
  };
}

function parseSaveFile(raw: string): SaveFile {
  const data = JSON.parse(raw) as SaveFile;
  if (data?.version !== 1 || !data.state || !isSaveMeta(data.meta)) {
    throw new Error("存档格式无效");
  }
  return data;
}

async function listFromApi(): Promise<SaveSlotInfo[] | null> {
  try {
    const res = await fetch("/api/saves");
    if (!res.ok) return null;
    const data = (await res.json()) as {
      slots: { slot: number; exists: boolean; meta: unknown }[];
    };
    return data.slots.map((s) => ({
      slot: s.slot,
      exists: s.exists,
      meta: isSaveMeta(s.meta) ? s.meta : null,
    }));
  } catch {
    return null;
  }
}

async function writeToApi(slot: number, file: SaveFile): Promise<boolean> {
  try {
    const res = await fetch(`/api/saves/${slot}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(file),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteFromApi(slot: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/saves/${slot}`, { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

function listFromLocalStorage(): SaveSlotInfo[] {
  const slots: SaveSlotInfo[] = [];
  for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
    const raw = localStorage.getItem(LS_PREFIX + slot);
    if (!raw) {
      slots.push({ slot, exists: false, meta: null });
      continue;
    }
    try {
      const file = parseSaveFile(raw);
      slots.push({ slot, exists: true, meta: file.meta });
    } catch {
      slots.push({ slot, exists: true, meta: null });
    }
  }
  return slots;
}

function readFromLocalStorage(slot: number): SaveFile | null {
  const raw = localStorage.getItem(LS_PREFIX + slot);
  if (!raw) return null;
  return parseSaveFile(raw);
}

function writeToLocalStorage(slot: number, file: SaveFile): void {
  localStorage.setItem(LS_PREFIX + slot, JSON.stringify(file));
}

function deleteFromLocalStorage(slot: number): void {
  localStorage.removeItem(LS_PREFIX + slot);
}

function assertSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SAVE_SLOTS) {
    throw new Error(`存档位须为 1～${MAX_SAVE_SLOTS}`);
  }
}

/** Prefer disk `save/` via Vite API; fall back to localStorage. */
export async function listSaveSlots(): Promise<SaveSlotInfo[]> {
  const api = await listFromApi();
  if (api) return api;
  return listFromLocalStorage();
}

export async function readSaveSlot(slot: number): Promise<SaveFile | null> {
  assertSlot(slot);
  try {
    const res = await fetch(`/api/saves/${slot}`);
    if (res.ok) return parseSaveFile(await res.text());
    if (res.status === 404) return null;
  } catch {
    /* fall through to localStorage */
  }
  return readFromLocalStorage(slot);
}

export async function writeSaveSlot(
  slot: number,
  file: SaveFile,
): Promise<"disk" | "local"> {
  assertSlot(slot);
  if (await writeToApi(slot, file)) return "disk";
  writeToLocalStorage(slot, file);
  return "local";
}

export async function deleteSaveSlot(slot: number): Promise<void> {
  assertSlot(slot);
  await deleteFromApi(slot);
  deleteFromLocalStorage(slot);
}

export function formatSaveMeta(meta: SaveMeta | null): string {
  if (!meta) return "空存档";
  const t = new Date(meta.savedAt);
  const stamp = Number.isNaN(t.getTime())
    ? meta.savedAt
    : t.toLocaleString("zh-CN", { hour12: false });
  return `${meta.summary} · ${stamp}`;
}
