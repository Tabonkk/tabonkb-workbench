/* decode — 用官方 libsigrokdecode4DSL 执行协议解码（胶水）。
 * 喂数方式逐行对照 DSView/pv/data/decoderstack.cpp::decode_data/execute_decode_stack。
 */
#ifndef DSLCORE_DECODE_H
#define DSLCORE_DECODE_H

#include "capture.h"
#include "jsonlite.h"

struct srd_decoder;

/* 启动自检：srd_init(decoders_dir) + 检查必需解码器存在。
 * 返回 0 成功；失败写 err。必须在使用任何 srd API 前调用一次。 */
int  decode_boot(const char *decoders_dir, const char *py_home_dir, char *err, int errlen);

/* 执行 spec={id,pins:{role:idx},options:{},stacked:[{id,options}]}
 * 结果 JSON append 到 b（"annotations":[...] 或错误置 err）。返回 0/-1。 */
int  decode_run(jl_buf *b, cap_file *cf, jl_val *spec, char *err, int errlen);

/* 解码器元数据：describe 单个 / decoders 全量列表（JSON append 到 b） */
void emit_describe(jl_buf *b, const struct srd_decoder *dec);
void emit_decoders(jl_buf *b);

/* 启动自检要求的解码器 id 列表（任务书：i2c/spi/uart/ufcs/usb-pd） */
extern const char *DSLCORE_REQUIRED_DECODERS[];

#endif
