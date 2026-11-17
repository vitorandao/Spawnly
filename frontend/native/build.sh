#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PIN="8c37ab26f2b47740839eb0045b34efc5141eb065"
if [ ! -d cubiomes/.git ]; then
  mkdir -p cubiomes
  git -C cubiomes init -q
  git -C cubiomes remote add origin https://github.com/xpple/cubiomes.git
fi
git -C cubiomes fetch --quiet --depth 1 origin "$PIN"
git -C cubiomes checkout --force --quiet FETCH_HEAD
mapfile -t sources < <(awk '
 /^set\(SOURCES/ { inside=1; next }
 inside && /^\)/ { exit }
 inside {
   gsub(/^[[:space:]]+|[[:space:]]+$/, "")
   if ($0 ~ /\.c$/) print "cubiomes/" $0
 }' cubiomes/CMakeLists.txt)
test "${#sources[@]}" -gt 5
gcc -O2 -fwrapv -I cubiomes gerar_mapa.c "${sources[@]}" -lm -o gerar_mapa
chmod 755 gerar_mapa
./gerar_mapa 12345 1.21.11 0 0 | node -e "
let s='';
process.stdin.on('data',c=>s+=c);
process.stdin.on('end',()=>{
const d=JSON.parse(s);
if(d.largura!==96 || d.altura!==96 || d.biomas.length!==9216 || d.paleta.length!==256)
 process.exit(1);
console.log('Cubiomes smoke test: OK')
})"
