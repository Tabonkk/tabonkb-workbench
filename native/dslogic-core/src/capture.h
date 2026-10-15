/* capture — 用官方 libsigrok4DSL 加载 .dsl，解交叉为逐通道打包位流（胶水）。 */
#ifndef DSLCORE_CAPTURE_H
#define DSLCORE_CAPTURE_H

#include <stdint.h>
#include <stddef.h>

typedef struct {
    char *name;
    int index;        /* probe index（= header probe<N> 编号 = 槽下标） */
    int enabled;
    int present;      /* 有 L-<index>/0 数据文件 */
    uint8_t *bits;    /* 每 8 采样 1 字节，bit0=先采样（与官方 inbuf 一致）；NULL=无数据 */
} cap_channel;

typedef struct {
    char *path;
    double samplerate;
    double hdr_samplerate;
    uint64_t total_samples;
    uint64_t trigger_pos;
    int64_t trigger_time_ms;
    char trigger_time[64];
    int version;
    int device_mode;
    int nprobes;
    int nblocks;
    char driver[128];
    char probe_names[256][64];
    int  probe_enabled[256];
    char *session_json;    /* zip 'session' 成员原文（JSON） */
    char *decoders_json;   /* zip 'decoders' 成员原文（JSON） */
    cap_channel *chs;
    int nchs;
    int cross_cols;
    char err[512];
} cap_file;

/* 通过官方 ds_device_from_file + datafeed 回调加载；返回 0 成功 */
int  cap_load(cap_file *cf, const char *path);
void cap_free(cap_file *cf);

/* probe index → 槽下标（当前实现 index==槽下标，越界 -1） */
int  cap_find_ch(cap_file *cf, int index);

#endif
