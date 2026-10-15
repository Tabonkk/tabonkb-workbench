/* edge_index — 从逐通道打包位流计算初始电平与边沿位置（供波形显示）。 */
#ifndef DSLCORE_EDGE_INDEX_H
#define DSLCORE_EDGE_INDEX_H

#include "capture.h"
#include "jsonlite.h"

/* 对 chs[ch] 计算边沿：init = bit0；每处电平变化记录样本号。
 * out_edges 由调用方 free；返回边沿数（<0 失败）。 */
int64_t edge_build(const uint8_t *bits, uint64_t nbits,
                   uint64_t **out_edges, int *init_level);

/* edges 方法：channels=JSON 数组（probe index），chunk=每次最多返回边沿数 */
void edges_to_json(jl_buf *b, cap_file *cf, jl_val *params);

#endif
