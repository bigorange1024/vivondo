import type { BoardTile } from "../engine/board";
import type { ComponentType } from "react";
import {
  IconAirport,
  IconBank,
  IconCasino,
  IconChips,
  IconEvent,
  IconHospital,
  IconMine,
  IconOil,
  IconPoker,
  IconPort,
  IconProperty,
  IconTrack,
} from "./icons";

type IconComp = ComponentType<{ className?: string; title?: string }>;

const PROPERTY: Record<string, { code: string; iso2: string }> = {
  日本: { code: "JPN", iso2: "jp" },
  中国: { code: "CHN", iso2: "cn" },
  印度: { code: "IND", iso2: "in" },
  伊朗: { code: "IRN", iso2: "ir" },
  沙特: { code: "SAU", iso2: "sa" },
  俄罗斯: { code: "RUS", iso2: "ru" },
  德国: { code: "DEU", iso2: "de" },
  英国: { code: "GBR", iso2: "gb" },
  法国: { code: "FRA", iso2: "fr" },
  意大利: { code: "ITA", iso2: "it" },
  埃及: { code: "EGY", iso2: "eg" },
  摩洛哥: { code: "MAR", iso2: "ma" },
  尼日利亚: { code: "NGA", iso2: "ng" },
  南非: { code: "ZAF", iso2: "za" },
  阿根廷: { code: "ARG", iso2: "ar" },
  智利: { code: "CHL", iso2: "cl" },
  巴西: { code: "BRA", iso2: "br" },
  古巴: { code: "CUB", iso2: "cu" },
  巴拿马: { code: "PAN", iso2: "pa" },
  哥斯达黎加: { code: "CRI", iso2: "cr" },
  墨西哥: { code: "MEX", iso2: "mx" },
  加拿大: { code: "CAN", iso2: "ca" },
  美国: { code: "USA", iso2: "us" },
  新西兰: { code: "NZL", iso2: "nz" },
  澳大利亚: { code: "AUS", iso2: "au" },
  斐济: { code: "FJI", iso2: "fj" },
};

export interface LocationView {
  zh: string;
  code: string;
  en: string;
  /** ISO 3166-1 alpha-2 for flag image (Windows cannot render emoji flags). */
  iso2?: string;
  Icon: IconComp;
}

export function locationView(
  tile: BoardTile | undefined,
  racetrackPos: number | null,
): LocationView {
  if (racetrackPos != null) {
    return {
      zh: "跑马场",
      code: "TRK",
      en: "Track",
      Icon: IconTrack,
    };
  }
  if (!tile) {
    return { zh: "—", code: "—", en: "—", Icon: IconProperty };
  }

  if (tile.kind === "property") {
    const meta = PROPERTY[tile.zh];
    return {
      zh: tile.zh,
      code: meta?.code ?? tile.en.slice(0, 3).toUpperCase(),
      en: tile.en,
      iso2: meta?.iso2,
      Icon: IconProperty,
    };
  }

  if (tile.kind === "corner") {
    if (tile.zh.includes("银行")) {
      return { zh: "银行", code: "BNK", en: "Bank", Icon: IconBank };
    }
    if (tile.zh.includes("机场")) {
      return { zh: "机场", code: "APT", en: "Airport", Icon: IconAirport };
    }
    if (tile.zh.includes("医院")) {
      return { zh: "医院", code: "HSP", en: "Hospital", Icon: IconHospital };
    }
    if (tile.zh.includes("证券") || tile.zh.includes("赌场")) {
      return {
        zh: "证券交易所",
        code: "STX",
        en: "Stock Exchange",
        Icon: IconCasino,
      };
    }
  }

  if (tile.kind === "event") {
    return { zh: "事件", code: "EVT", en: "Event", Icon: IconEvent };
  }
  if (tile.kind === "mafia") {
    if (tile.zh.includes("蒙特卡洛") || tile.en.includes("Monte")) {
      return {
        zh: "蒙特卡洛赌城",
        code: "MTC",
        en: "Monte Carlo",
        Icon: IconPoker,
      };
    }
    if (tile.zh.includes("拉斯维加斯") || tile.en.includes("Vegas")) {
      return {
        zh: "拉斯维加斯赌城",
        code: "LAS",
        en: "Las Vegas",
        Icon: IconChips,
      };
    }
    return { zh: tile.zh, code: "VIP", en: tile.en, Icon: IconPoker };
  }
    if (tile.kind === "port") {
    return {
      zh: tile.zh,
      code: tile.zh.includes("利物浦") ? "LPL" : "HFX",
      en: tile.en,
      Icon: IconPort,
    };
  }
  if (tile.kind === "facility") {
    if (tile.zh === "油田" || tile.zh === "石油") {
      return { zh: "油田", code: "OIL", en: "Oil Field", Icon: IconOil };
    }
    return { zh: "矿山", code: "MIN", en: "Mine", Icon: IconMine };
  }

  return {
    zh: tile.zh,
    code: tile.en.slice(0, 3).toUpperCase(),
    en: tile.en,
    Icon: IconProperty,
  };
}
