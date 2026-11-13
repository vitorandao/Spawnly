/* Spawnly biome map CLI. Links against xpple/cubiomes (MIT). */
#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "generator.h"
#include "util.h"
#define SIDE 96
#define SCALE 16
static int parse_int(const char *s, int *out) {
    char *end;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (errno || !*s || *end || v < -1000000 || v > 1000000) return 0;
    *out = (int)v;
    return 1;
}
static int floor_div(int a, int b) {
    int q = a / b;
    if (a % b < 0) q--;
    return q;
}
static int version_from_text(const char *s) {
    if (!strcmp(s, "1.20.6")) return MC_1_20_6;
    if (!strcmp(s, "1.21.1")) return MC_1_21_1;
    if (!strcmp(s, "1.21.4")) return MC_1_21_4;
    if (!strcmp(s, "1.21.11")) return MC_1_21_11;
    return MC_UNDEF;
}
int main(int argc, char **argv) {
    if (argc != 5) {
        fprintf(stderr, "usage: gerar_mapa <seed> <version> <center_x> <center_z>\n");
        return 2;
    }
    char *end;
    errno = 0;
    intmax_t signed_seed = strtoimax(argv[1], &end, 10);
    if (errno || !*argv[1] || *end || signed_seed < INT64_MIN || signed_seed > INT64_MAX) {
        fprintf(stderr, "invalid seed\n"); return 2;
    }
    int mc = version_from_text(argv[2]), cx, cz;
    if (mc == MC_UNDEF || !parse_int(argv[3], &cx) || !parse_int(argv[4], &cz)) {
        fprintf(stderr, "invalid version or coordinates\n"); return 2;
    }
    Generator g;
    setupGenerator(&g, mc, 0);
    applySeed(&g, DIM_OVERWORLD, (uint64_t)(int64_t)signed_seed);
    Range r = {0};
    r.scale = SCALE;
    r.x = floor_div(cx, SCALE) - SIDE / 2;
    r.z = floor_div(cz, SCALE) - SIDE / 2;
    r.sx = SIDE;
    r.sz = SIDE;
    r.y = 15; /* approximate Y=60 biome plane */
    r.sy = 1;
    int *ids = allocCache(&g, r);
    if (!ids) { fprintf(stderr, "allocation failed\n"); return 1; }
    if (genBiomes(&g, ids, r)) {
        free(ids); fprintf(stderr, "biome generation failed\n"); return 1;
    }
    unsigned char colors[256][3];
    initBiomeColors(colors);
    printf("{\"seed\":\"%" PRId64 "\",\"versao\":\"%s\",\"largura\":%d,\"altura\":%d,"
           "\"escala\":%d,\"origem\":{\"x\":%d,\"z\":%d},\"paleta\":[",
           (int64_t)signed_seed, argv[2], SIDE, SIDE, SCALE, r.x * SCALE, r.z * SCALE);
    for (int i = 0; i < 256; i++)
        printf("%s[%u,%u,%u]", i ? "," : "", colors[i][0], colors[i][1], colors[i][2]);
    printf("],\"biomas\":[");
    for (int i = 0; i < SIDE * SIDE; i++)
        printf("%s%d", i ? "," : "", ids[i]);
    printf("]}\n");
    free(ids);
    return 0;
}
