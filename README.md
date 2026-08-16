# 花花世界 / Vivondo

私有项目。掷骰环游、国家地产类桌游（网页单机先行）。

## 许可

**专有软件（All Rights Reserved）** — 见 [LICENSE](./LICENSE)。  
不采用 MIT / Apache 等开源许可证；第三方字体见 `assets/fonts/`（SIL OFL）。

## 文档

- [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)
- [docs/RULES.md](./docs/RULES.md)
- [docs/TODO.md](./docs/TODO.md)

## 开发

**日常游玩（推荐）**：双击项目根目录的 `game.bat`  
会自动安装依赖（如需要）、启动服务、用局域网 IP 打开默认浏览器，并打印同网可访问的地址。

```bash
# 或命令行
npm install   # 仅首次
npm start     # 等同 npm run dev；会开浏览器并监听局域网
```

同 Wi‑Fi 的手机 / 其他电脑：用启动窗口或浏览器地址栏里的 `http://局域网IP:端口/` 打开即可（启动时会自动用局域网 IP 打开浏览器，而不是 localhost）。  
说明：当前是单机页，各设备各自开一局，不是联机同桌；存档写在运行 `game.bat` 的那台电脑上。

若手机打不开，检查 Windows 防火墙是否允许 Node.js 入站。

技术栈：Vite + React + TypeScript。规则引擎与 UI / 会话层解耦；GM 由程序托管。
