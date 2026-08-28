"""KAIROS｜契機 — Streamlit 包裝層

本專案的本體是 dist/index.html：一個完全自足的單檔網頁應用，
沒有框架、沒有 CDN、沒有建置工具鏈，直接用瀏覽器開啟就能跑。

這個檔案的存在只有一個理由：這個 repo 原本是 Streamlit Community Cloud 的
範本，若你已經把它接上 Streamlit，這裡讓那個部署顯示真正的平台，
而不是範本的 "My new app"。

**建議的正式部署是 GitHub Pages**（.github/workflows/pages.yml 已設定好），
因為 Streamlit 是把網頁塞進沙箱 iframe 裡：
localStorage 在沙箱中通常會被擋，平台會退回「只存在記憶體」的模式——
重新整理後你新增的貼文與作答就會消失（示範資料仍會由固定種子重建）。
"""

from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="KAIROS｜契機 · 評量即學習平台",
    page_icon="🧩",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# 讓 iframe 盡量佔滿版面
st.markdown(
    """
    <style>
      .block-container {padding: 0 !important; max-width: 100% !important;}
      header[data-testid="stHeader"] {height: 0; visibility: hidden;}
      footer {visibility: hidden;}
    </style>
    """,
    unsafe_allow_html=True,
)

APP = Path(__file__).parent / "dist" / "index.html"

if not APP.exists():
    st.error("找不到 dist/index.html。請先在專案根目錄執行 `bash build.sh` 產生單檔應用。")
    st.stop()

components.html(APP.read_text(encoding="utf-8"), height=1600, scrolling=True)
