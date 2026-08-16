# Fonts (SIL OFL — free for commercial use / embedding)

All in-game text (board PNG + web UI) uses **only** these bundled open fonts.  
Do **not** rely on Microsoft YaHei, Segoe UI, Georgia, Times New Roman, etc.

| File | Family | License | Use |
|------|--------|---------|-----|
| `NotoSansSC-Bold.otf` | [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC) | **SIL OFL 1.1** | Chinese + Latin UI / board |
| `NotoSansSC-Regular.otf` | same | **SIL OFL 1.1** | UI body text |
| `Cinzel-Bold.ttf` | [Cinzel](https://fonts.google.com/specimen/Cinzel) | **SIL OFL 1.1** | Board Latin title **Vivondo** |
| `PlayfairDisplay-Bold.ttf` | [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) | **SIL OFL 1.1** | Board Latin fallback |

License texts (keep with the fonts): `OFL-NotoSansSC.txt`, `OFL-Cinzel.txt`, `OFL-Playfair.txt`.

### Notes

- **SIL OFL** (not MIT) is the usual license for open CJK fonts. It allows free commercial use and embedding in games/apps; keep the license notices; do not sell the font files alone as a product.
- Web UI loads Noto Sans SC via `@font-face` in `src/styles.css`.
- Board art is baked by `assets/render_board_v7.py` using the same folder.
