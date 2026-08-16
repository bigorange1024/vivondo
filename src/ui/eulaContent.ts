/** Short in-game EULA (mirrors docs/EULA.md; Chinese prevails on conflict). */
export type EulaLang = "zh" | "en";

export const EULA_TITLE = {
  zh: "最终用户许可协议",
  en: "End User License Agreement",
} as const;

export const EULA_SECTIONS: {
  heading: { zh: string; en: string };
  body: { zh: string[]; en: string[] };
}[] = [
  {
    heading: { zh: "许可授予", en: "License grant" },
    body: {
      zh: [
        "Copyright © 2026 bigorange1024. All Rights Reserved.",
        "购买或合法取得本游戏后，您仅获得个人、非独占、不可转让的游玩许可；不获得源代码、资源源文件或再分发权，也不获得游戏所有权。",
      ],
      en: [
        "Copyright © 2026 bigorange1024. All Rights Reserved.",
        "You get a personal, non-exclusive, non-transferable license to play. You do not get source code, asset sources, redistribution rights, or ownership of the game.",
      ],
    },
  },
  {
    heading: { zh: "限制", en: "Restrictions" },
    body: {
      zh: [
        "未经书面许可，不得再分发、转售、破解、篡改、反向工程，或将本游戏用于向第三方提供商业托管服务。",
      ],
      en: [
        "Without written permission: no redistribution, resale, cracking, modification, reverse engineering, or offering the game as a commercial hosted service.",
      ],
    },
  },
  {
    heading: { zh: "第三方与 AI", en: "Third parties & AI" },
    body: {
      zh: [
        "字体（Noto Sans SC、Cinzel、Playfair Display 等）为 SIL OFL 1.1，详见发行包 licenses/fonts/；不得单独出售字体文件。",
        "部分文案或素材可能经 AI 辅助，不改变本游戏版权归属。",
      ],
      en: [
        "Fonts (Noto Sans SC, Cinzel, Playfair Display, etc.) are SIL OFL 1.1 — see licenses/fonts/. Do not sell font files alone.",
        "Some text or assets may be AI-assisted; that does not change ownership of the game.",
      ],
    },
  },
  {
    heading: { zh: "存档与数据", en: "Saves" },
    body: {
      zh: [
        "网页版（含 itch「在浏览器中游玩」）存档只保存在当前设备 + 当前浏览器的本地存储，最多 9 个手动槽；无云存档、无跨设备同步。",
        "换浏览器/设备、清站点数据、关无痕窗口可能导致存档全部丢失。请自行备份重要进度；存档丢失相关责任见完整 EULA。",
      ],
      en: [
        "Web builds (including itch “play in browser”) store saves only on this device + this browser: up to 9 manual slots; no cloud, no cross-device sync.",
        "Changing browsers/devices, clearing site data, or closing an incognito window may wipe saves. Back up important progress yourself; see full EULA for liability.",
      ],
    },
  },
  {
    heading: { zh: "免责与退款", en: "Disclaimer & refunds" },
    body: {
      zh: [
        "本游戏按「现状」提供。在法律允许范围内，版权方不对间接损失负责；直接赔偿以您实际支付金额为上限。",
        "退款依 itch.io 等购买平台政策执行。完整条款见发行包或仓库中的 docs/EULA.md。",
      ],
      en: [
        "Provided “as is”. Liability is limited as far as the law allows; direct damages capped at what you paid.",
        "Refunds follow the storefront (e.g. itch.io). Full text: docs/EULA.md in the package or repository.",
      ],
    },
  },
];
