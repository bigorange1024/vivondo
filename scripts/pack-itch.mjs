/**
 * Build a static itch.io upload folder + zip.
 * Usage: node scripts/pack-itch.mjs
 * (runs vite build first)
 */
import { execSync } from "node:child_process";
import {
  cp,
  mkdir,
  rm,
  rename,
  writeFile,
  access,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const outDir = path.join(root, "release", "vivondo-itch");
const staging = path.join(root, "release", "vivondo-itch-staging");
const zipPath = path.join(root, "release", "vivondo-itch.zip");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function rmSafe(p) {
  try {
    await rm(p, { recursive: true, force: true });
    return true;
  } catch (e) {
    console.warn(`  (skip remove ${path.basename(p)}: ${e.message})`);
    return false;
  }
}

console.log("→ npm run build");
execSync("npm run build", { cwd: root, stdio: "inherit" });

if (!(await exists(path.join(dist, "index.html")))) {
  console.error("dist/index.html missing after build");
  process.exit(1);
}

await mkdir(path.join(root, "release"), { recursive: true });
await rmSafe(staging);
await mkdir(staging, { recursive: true });
await cp(dist, staging, { recursive: true });

await cp(path.join(root, "docs", "EULA.md"), path.join(staging, "EULA.md"));
await cp(
  path.join(root, "docs", "ITCH_PAGE.md"),
  path.join(staging, "ITCH_PAGE.md"),
);

const licDir = path.join(staging, "licenses", "fonts");
await mkdir(licDir, { recursive: true });
for (const f of [
  "OFL-NotoSansSC.txt",
  "OFL-Cinzel.txt",
  "OFL-Playfair.txt",
  "README.md",
]) {
  await cp(path.join(root, "assets", "fonts", f), path.join(licDir, f));
}

await writeFile(
  path.join(staging, "PLAY.txt"),
  [
    "花花世界 / Vivondo — 玩家包说明",
    "================================",
    "",
    "【方式 A】itch.io 网页游玩（推荐，不用装 Node）",
    "  作者把本 ZIP 上传到 itch，并勾选「在浏览器中游玩」。",
    "  你只要在商店页点 Run game / 运行游戏即可。",
    "  这时不需要下载 ZIP，也不需要 game.bat / Node.js。",
    "",
    "【方式 B】下载 ZIP 后在本机玩（Windows）",
    "  1. 解压整个文件夹",
    "  2. 安装 Node.js：https://nodejs.org/",
    "  3. 双击 play.bat",
    "  不要直接双击 index.html（打不开或会报错）。",
    "",
    "【方式 B · 命令行】",
    "  cd 到本文件夹后执行：",
    "  npx --yes serve -p 4173 .",
    "  浏览器打开 http://127.0.0.1:4173/",
    "",
    "【重要 · 存档】",
    "  存档只在「当前设备 + 当前浏览器」本地（localStorage），共 9 槽，需手动保存。",
    "  不是云存档，不能跨设备/跨浏览器同步。",
    "  换浏览器、换设备、清站点数据、关无痕窗口 → 存档可能全部丢失。",
    "  重要进度请自行截图或记录。",
    "",
    "许可：EULA.md · 字体 licenses/fonts/",
    "",
    "注意：这不是开发仓库，没有 game.bat 开发脚本。",
    "局域网多人联机同桌尚未支持；多设备打开是各自一局。",
    "",
    "Copyright (c) 2026 bigorange1024. All Rights Reserved.",
    "",
    "--- English ---",
    "",
    "A) itch.io “Run game” in browser — no Node, no ZIP needed for players.",
    "B) Downloaded ZIP on Windows: unzip → install Node.js → double-click play.bat.",
    "   Do not open index.html directly.",
    "",
    "IMPORTANT · SAVES",
    "  Saves stay only on THIS device + THIS browser (localStorage).",
    "  9 slots, manual save only — NOT cloud, NOT synced across devices/browsers.",
    "  Clearing site data / other browser / other device / closing incognito can wipe saves.",
    "  Screenshot or note progress if it matters.",
    "",
  ].join("\n"),
  "utf8",
);

await cp(
  path.join(root, "scripts", "itch-play.bat"),
  path.join(staging, "play.bat"),
);

await rmSafe(zipPath);
if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: "inherit" },
  );
} else {
  execSync(
    `cd "${path.join(root, "release")}" && zip -r vivondo-itch.zip vivondo-itch-staging`,
    { stdio: "inherit" },
  );
}

if (await rmSafe(outDir)) {
  await rename(staging, outDir);
} else {
  console.warn(
    "  release/vivondo-itch is locked (close Explorer / play.bat). Zip is still updated.",
  );
  console.warn(`  Fresh folder left at: ${staging}`);
}

console.log("");
console.log("Done.");
console.log(`  Folder: ${outDir}`);
console.log(`  Zip:    ${zipPath}`);
console.log("Upload the zip to itch.io (HTML5 / play in browser).");
