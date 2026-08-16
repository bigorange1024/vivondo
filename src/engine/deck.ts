/** R-030 event deck: 24 cards (4 holdable + 20 instant). */

export type HoldKind = "discharge" | "vip";

export type InstantId =
  | "E01"
  | "E02"
  | "E03"
  | "E04"
  | "E05"
  | "E06"
  | "E07"
  | "E08"
  | "E09"
  | "E10"
  | "E11"
  | "E12"
  | "E13"
  | "E14"
  | "E15"
  | "E16"
  | "E17"
  | "E18"
  | "E19"
  | "E20";

export type EventCardId =
  | InstantId
  | "H1"
  | "H2"
  | "H3"
  | "H4";

export interface EventDeckState {
  drawPile: EventCardId[];
  discardPile: EventCardId[];
}

export const CARD_ZH: Record<EventCardId, string> = {
  H1: "出院卡",
  H2: "出院卡",
  H3: "赌场VIP卡",
  H4: "赌场VIP卡",
  E01: "前进到银行（起点）",
  E02: "进医院",
  E03: "银行错误",
  E04: "选美获奖",
  E05: "股票分红",
  E06: "所得税",
  E07: "医疗费",
  E08: "修路费",
  E09: "生日",
  E10: "董事长",
  E11: "随机后退",
  E12: "加速前进",
  E13: "机场贵宾",
  E14: "港口贵宾",
  E15: "油价波动",
  E16: "矿难抚恤",
  E17: "证券招待",
  E18: "强制拍卖",
  E19: "位置互换",
  E20: "一次免租",
};

export function holdKindOf(id: EventCardId): HoldKind | null {
  if (id === "H1" || id === "H2") return "discharge";
  if (id === "H3" || id === "H4") return "vip";
  return null;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

export function createEventDeck(): EventDeckState {
  const drawPile: EventCardId[] = [
    "H1",
    "H2",
    "H3",
    "H4",
    "E01",
    "E02",
    "E03",
    "E04",
    "E05",
    "E06",
    "E07",
    "E08",
    "E09",
    "E10",
    "E11",
    "E12",
    "E13",
    "E14",
    "E15",
    "E16",
    "E17",
    "E18",
    "E19",
    "E20",
  ];
  shuffleInPlace(drawPile);
  return { drawPile, discardPile: [] };
}

function reshuffleRemaining(deck: EventDeckState): EventDeckState {
  const drawPile = [...deck.drawPile];
  shuffleInPlace(drawPile);
  return { ...deck, drawPile };
}

/** Re-randomize draw pile order (e.g. after load). Discard pile unchanged. */
export function reshuffleDrawPile(deck: EventDeckState): EventDeckState {
  return reshuffleRemaining(deck);
}

/** Draw top card; reshuffle discard into draw if empty; then shuffle remaining draw pile. */
export function drawEventCard(deck: EventDeckState): {
  card: EventCardId;
  deck: EventDeckState;
} {
  let drawPile = [...deck.drawPile];
  let discardPile = [...deck.discardPile];

  if (drawPile.length === 0) {
    drawPile = discardPile;
    discardPile = [];
    shuffleInPlace(drawPile);
  }
  if (drawPile.length === 0) {
    throw new Error("Event deck empty");
  }

  const card = drawPile.shift()!;
  let next: EventDeckState = { drawPile, discardPile };
  next = reshuffleRemaining(next);
  return { card, deck: next };
}

/** Instant cards go to discard after resolve. Holdables discarded when used. */
export function discardEventCard(
  deck: EventDeckState,
  card: EventCardId,
): EventDeckState {
  return {
    ...deck,
    discardPile: [...deck.discardPile, card],
  };
}

/** Duplicate holdable returns to draw pile immediately, then reshuffle remaining. */
export function returnCardToDraw(
  deck: EventDeckState,
  card: EventCardId,
): EventDeckState {
  const drawPile = [...deck.drawPile, card];
  shuffleInPlace(drawPile);
  return { ...deck, drawPile };
}
