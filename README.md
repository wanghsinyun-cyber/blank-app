# KIDFORUM

**線上版：https://wanghsinyun-cyber.github.io/blank-app/**
（推送到 `main` 後由 GitHub Actions 自動建置並部署；首次需在 repo 的
Settings → Pages → Build and deployment → Source 選擇 **GitHub Actions**。）

整合「會考派題 × KIDMAP 診斷」、「Knowledge Forum 知識建構」與「評量即學習」的 AI 助評研究原型。

三條線接成一個迴圈：

1. **診斷 → 問題**：把 KIDMAP 第二象限（能力足以答對卻答錯）的題目一鍵轉成知識建構視圖的共同問題。
2. **評量即學習**：在作答的當下配置 AI 夥伴——導師／學生／同儕三種角色，加上系統鷹架對照組，
   四條件以班級為單位叢集隨機分派；提問功能跨角色恆定，只有社會框架不同。
3. **歷程證據**：完整事件日誌 → 延宕序列分析、認知網絡分析、情感軌跡、
   共變數分析與中介路徑，最後用「Δθ × 知識建構指數」雙軌檢核討論有沒有真的變成理解。

完整設計說明：[docs/系統設計說明.md](docs/系統設計說明.md)

## 快速開始

建置（把 `src/` 依檔名順序串成單一 HTML）：

```bash
bash build.sh
```

產物 `dist/index.html` 是完全自足的單檔應用，沒有框架、沒有 CDN、沒有建置工具鏈，
直接用瀏覽器開啟就能跑。若要用本機伺服器預覽（Windows，不需 Node）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8765
```

## 先看這幾頁

| 路徑 | 看什麼 |
| --- | --- |
| `#/research` → **對話設計** | 8 個提示模組如何動態組合出「角色 × 歷程」的對話 |
| `#/aal/a-post`（需切換成學生） | 評量即學習事件：題幹逐句標記 × 作答 × AI 夥伴對話 |
| `#/research` → **序列分析／認知網絡／情感軌跡** | LSA 調整殘差、ENA 投影與平均網絡、情緒軌跡 |
| `#/research` → **效果檢定** | ANCOVA（F、p、ηp²、Bonferroni）與平行多重中介（bootstrap CI） |
| `#/assign/a-pre` → **迷思橋接** | 測驗診斷如何變成社群問題 |
| `#/assign/a-pre` → **KIDMAP 診斷** | 個別學生的四象限圖 |
| `#/kb` | Knowledge Forum 式的視圖、支架貼文、延伸與躍升 |
| `#/dash` | 雙軌評量儀表板（Δθ × KB 指數） |
| `#/about` | 系統說明與研究設計（RQ 對應、十二項原則、指標定義、限制） |

右上角可切換身分與班級。四個班級分別被分派到**導師／學生／同儕／對照**四個條件，
換成不同班的學生就會看到不同的夥伴——對照組看到的是同尺寸的「我的筆記」。

## 注意

* 內建的班級、作答、貼文與對話**全部是模擬資料**，由固定亂數種子產生（每次載入結果一致），
  僅供展示與方法討論，不得當成實徵結果引用。題目為仿會考題型的自編題，非官方原題。
  示範資料的四條件差異是**依理論預測寫進生成器的**，用來示範分析管線能不能把差異抓出來。
* 問卷題項是**依構念自撰的示範題**，不是已驗證量表的中譯本。正式施測請改用公開的驗證量表
  （詳見 [docs/系統設計說明.md §6.5](docs/系統設計說明.md)）。
* 條件在班級層次操弄，平台的 ANCOVA 以學生為分析單位，未處理班級內相依；
  嚴謹分析應採多層次模型。中介估計的是觀察變項路徑模型，不是含潛在變項的 SEM。
* 資料存在瀏覽器的 `localStorage`。「系統設定 → 重設為示範資料」可還原。
* AI 助評預設使用**內建規則引擎**（離線、可重現）。要改用外部語言模型，
  在「系統設定」填入 OpenAI 相容端點與 API key——這只有在本機開啟檔案時可用，
  線上發布版受安全政策限制不能連外部網址。

## 部署

`src/` 是唯一的真實來源。推送到 `main` 之後，
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 會在 CI 重新執行 `build.sh`、
驗證產物、把 `dist/` 部署到 GitHub Pages，並一併把設計說明複製到 `/docs/`。

`dist/index.html` 也有進版控，因此可以直接下載單檔在本機或校內網路離線使用——
**外部語言模型只有在本機開啟時才連得出去**，線上版受安全政策限制只能用內建規則引擎
（所有分析功能都不會少）。

repo 裡另有 `streamlit_app.py`：這個 repo 原本是 Streamlit Community Cloud 的範本，
若你已經接上 Streamlit，它會把同一份 `dist/index.html` 嵌進去。
但 Streamlit 是沙箱 iframe，localStorage 通常會被擋，
你新增的貼文與作答不會保存——**正式使用請走 GitHub Pages**。

## 開發

`src/` 內的檔名前綴決定串接順序，`build.sh` 只收 `3*`–`9*`，所以 `zz-debug.js` 不會進正式版。
需要逐階段自我檢測時：

```bash
{ cat dist/index.html; echo '<script>'; cat src/zz-debug.js; echo '</script>'; } > dist/debug.html
```

開啟 `debug.html`，左下角會逐一列出 41 個渲染與計算階段的耗時與錯誤。
