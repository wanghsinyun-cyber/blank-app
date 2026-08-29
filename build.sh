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
{ emit_body; echo '</script>'; } > "$out"
echo "built $out ($(wc -c < "$out") bytes)"

dbg=dist/debug.html
{ emit_body
  echo "/* ===== src/zz-debug.js（僅 debug.html） ===== */"
  cat src/zz-debug.js
  echo
  echo '</script>'
} > "$dbg"
echo "built $dbg ($(wc -c < "$dbg") bytes)"
