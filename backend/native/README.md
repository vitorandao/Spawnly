# Gerador Cubiomes do Spawnly

MVP de visualização de biomas do Minecraft **Java Edition** com [xpple/cubiomes](https://github.com/xpple/cubiomes), biblioteca C sob licença MIT. A dependência é clonada durante o build, não commitada no Spawnly. Consulte o arquivo LICENSE na biblioteca clonada.

## Instalação

Requer Git, GCC, CMake e Bash. No Windows, use MSYS2 UCRT64/MinGW (MSVC não é suportado pelo fork).

1. Abra Bash na pasta backend/native: `bash build.sh`
2. Teste o executável: `./gerar_mapa 12345 1.21.11 0 0` (Windows: `./gerar_mapa.exe 12345 1.21.11 0 0`)
3. Na pasta backend: `npm install` e `npm start`
4. Acesse http://localhost:3000/mapa/mapa.html

API: `GET /api/mapa?seed=12345&versao=1.21.11&x=0&z=0`.

## Limites

Somente Java Overworld nas versões 1.20.6, 1.21.1, 1.21.4 e 1.21.11. A grade de 96 × 96 células amostra biomas a cada 16 blocos e na altura aproximada Y=60, não a superfície. Sem Bedrock, terreno por blocos ou marcadores de estruturas. As coordenadas são limitadas e a execução tem timeout. Antes de produção, fixe uma revisão do Cubiomes, acrescente cache e limitação de requisições.
