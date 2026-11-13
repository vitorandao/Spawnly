#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d cubiomes/.git ]; then
  git clone --depth 1 https://github.com/xpple/cubiomes.git cubiomes
fi
cmake -S cubiomes -B cubiomes/build -DCMAKE_BUILD_TYPE=Release
cmake --build cubiomes/build --config Release --target cubiomes_static
output=gerar_mapa
if [ "${OS:-}" = Windows_NT ]; then output=gerar_mapa.exe; fi
gcc -O3 -Wall -Wextra -fwrapv -I cubiomes gerar_mapa.c -L cubiomes/build -lcubiomes_static -lm -o "$output"
echo "Gerador compilado: $output"
