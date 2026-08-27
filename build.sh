#!/usr/bin/env bash
# 把 src/ 依檔名順序串成單檔 dist/index.html（無需 node、無外部相依）
set -e
cd "$(dirname "$0")"
mkdir -p dist
out=dist/index.html
{
  cat src/00-head.html
  echo '<style>'; cat src/10-style.css; echo '</style>'
  cat src/20-markup.html
  echo '<script>'
  for f in src/3*.js src/4*.js src/5*.js src/6*.js src/7*.js src/8*.js src/9*.js; do
    echo "/* ===== ${f} ===== */"
    cat "$f"
    echo
  done
  echo '</script>'
} > "$out"
echo "built $out ($(wc -c < "$out") bytes)"
