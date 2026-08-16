# 发布到 itch.io（玩家包）

## 一键打包

在仓库根目录执行：

```bash
npm run pack:itch
```

会生成：

- `release/vivondo-itch/` — 可检查内容的解压目录  
- `release/vivondo-itch.zip` — **上传到 itch 的文件**

包内含：静态网页、`EULA.md`、字体 OFL 副本、`PLAY.txt`、商店文案草稿 `ITCH_PAGE.md`。

## itch.io 上传步骤

1. 创建 itch 页面，标题/描述粘贴自 [ITCH_PAGE.md](./ITCH_PAGE.md)。  
2. **Upload** → 选择 `release/vivondo-itch.zip`。  
3. Kind of project：勾选 **HTML** / *This file will be played in the browser*。  
4. 确保 ZIP **根目录能直接看到 `index.html`**（本脚本打的包符合这一点）。  
5. 填价格或「随心付」，保存并公开。

玩家点 **Run game** 即可玩，**不需要安装 Node.js**。

**存档（必须写进商店页）：** 网页版只用浏览器 localStorage——本设备本浏览器、非云、不跨设备；清数据会丢。完整中英文案见 [ITCH_PAGE.md](./ITCH_PAGE.md)「重要 · 存档」与包内 `PLAY.txt`。

若把 ZIP 当作「下载后离线玩」：解压后看 `PLAY.txt`，Windows 可双击包内 **`play.bat`**（需已安装 Node.js）。不要直接双击 `index.html`。

开发用的根目录 `game.bat` **不会**打进玩家 ZIP（那是给源码仓库用的）。

## 本地预览发布包

不要直接双击 `index.html`。在 `release/vivondo-itch/` 下：

```bash
npx --yes serve -p 4173
```

浏览器打开 `http://localhost:4173/`。

开发调试仍用根目录 `game.bat` / `npm start`（含局域网 IP、磁盘存档 API）。

## 请勿上传

- 完整源码仓库、`.git`、`node_modules`、未构建的 `src/`  
- 仅把 **`vivondo-itch.zip`**（或该目录内容）作为玩家构建分发

## 许可

玩家构建受 [EULA.md](./EULA.md) 约束；字体见包内 `licenses/fonts/`。
