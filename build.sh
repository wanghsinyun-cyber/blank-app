#!/usr/bin/env bash
# 把 src/ 依檔名順序串成單檔 dist/index.html（無需 node、無外部相依）
# 同時產生 dist/debug.html＝index.html ＋ src/zz-debug.js。
#
# 兩支一定要一起產。debug.html 原本是手動拼的，build.sh 不碰它：
# 每次改完 src 只跑 build.sh，debug.html 就停在舊版，
# 而 assertStudentInvariants()／diffConditionCopy() 只存在於 debug.html——
# 於是「測試全數通過」測的是上一版的程式。這種假通過比測試失敗更危險。
set -e
cd "$(dirname "$0")"
mkdir -p dist

# 建置前先擋掉「單引號字串跨行」。這一類錯誤發生過兩次：用指令碼把多行中文
# 塞進 JS 字串時換行留在引號裡，整份 dist 變成 SyntaxError，而瀏覽器只說
# 「Invalid or unexpected token」、不指行號，全站函式一起消失——
# 表面症狀是「所有測試都在報 xxx is not defined」，很容易被誤判成別的問題。
perl tools/lint-strings.pl src/*.js

emit_body(){
  cat src/00-head.html
  echo '<style>'; cat src/10-style.css; echo '</style>'
  cat src/20-markup.html
  echo '<script>'
  for f in src/3*.js src/4*.js src/5*.js src/6*.js src/7*.js src/8*.js src/9*.js; do
    echo "/* ===== ${f} ===== */"
    cat "$f"
    echo
  done
}

out=dist/index.html
{ emit_body; echo '</script>'; echo '</html>'; } > "$out"
echo "built $out ($(wc -c < "$out") bytes)"

dbg=dist/debug.html
{ emit_body
  echo "/* ===== src/zz-debug.js（僅 debug.html） ===== */"
  cat src/zz-debug.js
  echo
  echo '</script>'
  echo '</html>'
} > "$dbg"
echo "built $dbg ($(wc -c < "$dbg") bytes)"

# dist/artifact.html＝給 claude.ai Artifact 的同一份頁面。
# Artifact 檢視器會自己包一層 <!doctype html><head>…</head><body>，
# 我們的 doctype 與根元素會落在 body 裡；根元素被吞掉的話 lang 也跟著消失，
# 報讀器又會用英語唸中文題幹（就是 00-head.html 那段註解在講的事）。
# 所以這裡把 doctype 與 </html> 拿掉，並改用一行指令碼補回 lang，
# 讓 Pages 與 Artifact 兩個上線版本從同一份 src 產出、內容逐字相同。
art=dist/artifact.html
perl -0777 -pe '
  s/\A<!doctype html>\n//;
  s|^<html lang="zh-Hant">$|<script>document.documentElement.lang="zh-Hant";</script>|m;
  s|</html>\n\z||;
' "$out" > "$art"
echo "built $art ($(wc -c < "$art") bytes)"
