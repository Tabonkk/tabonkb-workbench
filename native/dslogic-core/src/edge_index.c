#include "edge_index.h"
#include <stdlib.h>
#include <string.h>

int64_t edge_build(const uint8_t *bits, uint64_t nbits,
                   uint64_t **out_edges, int *init_level)
{
    *out_edges = NULL;
    *init_level = 0;
    if (!bits || nbits < 8) return 0;   /* 无数据通道：0 边沿、init=0 */
    uint64_t cap = 1 << 16, n = 0;
    uint64_t *edges = malloc(cap * sizeof(uint64_t));
    if (!edges) return -1;

    int prev = bits[0] & 1;
    *init_level = prev;
    for (uint64_t byte = 0; byte < nbits / 8; byte++) {
        uint8_t v = bits[byte];
        /* diff bit b = v[b]^v[b-1]（b>0）；bit0 = v[0]^prev_byte_bit7 */
        uint8_t shifted = (uint8_t)((v << 1) | (uint8_t)prev);
        uint8_t diff = (uint8_t)(v ^ shifted);
        while (diff) {
            int b = __builtin_ctz(diff);
            diff &= (uint8_t)(diff - 1);
            if (n == cap) { cap *= 2; edges = realloc(edges, cap * sizeof(uint64_t)); }
            edges[n++] = byte * 8 + b;
        }
        prev = (v >> 7) & 1;
    }
    *out_edges = edges;
    return (int64_t)n;
}

void edges_to_json(jl_buf *b, cap_file *cf, jl_val *params)
{
    jl_val *chs = jl_obj_get(params, "channels");
    int64_t offset = (int64_t)jl_num(params, "offset", 0);
    int64_t chunk = (int64_t)jl_num(params, "chunk", 1 << 20);
    if (chunk <= 0) chunk = 1 << 20;
    if (chunk > (1 << 24)) chunk = 1 << 24;

    jb_key(b, "samplerate"); jb_num(b, cf->samplerate); jb_chr(b, ',');
    jb_key(b, "total_samples"); jb_u64(b, cf->total_samples); jb_chr(b, ',');
    jb_key(b, "channels"); jb_chr(b, '[');

    int first = 1;
    for (size_t i = 0; i < (chs && chs->t == JL_ARR ? chs->nitems : 0); i++) {
        jl_val *it = chs->items[i];
        if (it->t != JL_NUM) continue;
        int chi = cap_find_ch(cf, (int)it->num);
        if (chi < 0) continue;
        uint64_t *edges = NULL;
        int init = 0;
        int64_t ne = edge_build(cf->chs[chi].bits, cf->total_samples, &edges, &init);
        if (ne < 0) continue;
        if (!first) jb_chr(b, ',');
        first = 0;
        jb_chr(b, '{');
        jb_key(b, "ch"); jb_i64(b, cf->chs[chi].index); jb_chr(b, ',');
        jb_key(b, "init"); jb_i64(b, init); jb_chr(b, ',');
        jb_key(b, "total"); jb_i64(b, ne); jb_chr(b, ',');
        jb_key(b, "edges"); jb_chr(b, '[');
        int64_t j = offset < ne ? offset : ne;
        int64_t end = j + chunk < ne ? j + chunk : ne;
        for (int64_t k = j; k < end; k++) {
            if (k > j) jb_chr(b, ',');
            jb_u64(b, edges[k]);
        }
        jb_raw(b, "],");
        jb_key(b, "has_more"); jb_raw(b, end < ne ? "true" : "false");
        jb_chr(b, '}');
        free(edges);
    }
    jb_chr(b, ']');
}
