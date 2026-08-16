# 花花世界 / Vivondo

掷骰环游的国家地产桌游（网页单机）。

---

## 中文 · 怎么开始玩

### 本机启动

1. 先安装 [Node.js](https://nodejs.org/)（若尚未安装）。
2. 双击项目根目录的 **`game.bat`**。
3. 等待窗口启动；浏览器会自动打开游戏（地址一般是局域网 IP，例如 `http://192.168.x.x:5173/`）。
4. **关掉黑色窗口 = 关掉游戏服务。**

命令行等价操作：

```bash
npm install   # 仅第一次需要
npm start
```

### 局域网其他设备一起打开

1. 电脑与手机 / 其他电脑连 **同一 Wi‑Fi**（或同一局域网）。
2. 在跑着 `game.bat` 的电脑上，看黑色窗口里打印的地址，形如：  
   `http://192.168.1.68:5173/`  
   （端口也可能是 5174 等，以窗口和浏览器地址栏为准。）
3. 在手机或其他电脑的浏览器里输入 **同一个地址** 打开即可。

**说明：**

- 这是「各设备各自开一局」，**不是**多人联机同一桌。
- 若手机打不开：检查防火墙是否允许 Node.js；确认没开「访客网络」隔离；地址用 `http://` 而不是 `https://`。

### 存档（务必看清）

- **开发模式**（`game.bat` / `npm start`）：优先写入本机 `save/slot-N.json`；服务不可用时退回浏览器本地存储。
- **itch / 静态网页**：仅保存在**当前设备 + 当前浏览器**（localStorage）。**不是云存档**，不能跨设备同步；清站点数据 / 换浏览器 / 无痕窗口关闭后可能全部丢失。共 9 槽，需手动保存。
- 游戏内存档对话框会用中英双语再次提示。

游戏内可点 **规则**、**许可协议** 查看说明与 EULA。

---

## English · How to play

### Start on this PC

1. Install [Node.js](https://nodejs.org/) if needed.
2. Double-click **`game.bat`** in the project root.
3. Wait for the console; your browser opens the game (usually a LAN URL like `http://192.168.x.x:5173/`).
4. **Closing the console window stops the game server.**

Or from a terminal:

```bash
npm install   # first time only
npm start
```

### Open from other devices on the same network

1. Put the PC and phone / other PC on the **same Wi‑Fi** (same LAN).
2. On the PC running `game.bat`, copy the printed URL, e.g.  
   `http://192.168.1.68:5173/`  
   (Port may be 5174+, match the console / address bar.)
3. On the other device, open that **same URL** in a browser.

**Notes:**

- Each device runs its **own** game — not one shared online table.
- If the phone cannot connect: allow Node.js in the firewall; avoid guest-Wi‑Fi client isolation; use `http://`, not `https://`.

### Saves (read carefully)

- **Dev mode** (`game.bat` / `npm start`): prefers project folder `save/slot-N.json`; falls back to browser storage if the API is unavailable.
- **itch / static web**: saves stay only on **this device + this browser** (localStorage). **Not cloud.** No cross-device sync. Clearing site data / another browser / closing incognito can wipe them. 9 slots, manual save only.
- The in-game save dialog repeats this in Chinese and English.

In-game: **Rules** and **EULA** buttons.

---

## More / 更多

| | |
|--|--|
| License | [LICENSE](./LICENSE) · [docs/EULA.md](./docs/EULA.md) |
| Fonts | [assets/fonts/](./assets/fonts/) (SIL OFL) |
| itch upload | [docs/RELEASE.md](./docs/RELEASE.md) · `npm run pack:itch` |
| Store copy | [docs/ITCH_PAGE.md](./docs/ITCH_PAGE.md) |
| Design docs | [docs/RULES.md](./docs/RULES.md) |

Copyright © 2026 bigorange1024. All Rights Reserved.
