/* capture.c — 官方 libsigrok4DSL 加载 .dsl：
 *   ds_lib_init → ds_set_datafeed_callback → ds_device_from_file
 *   → ds_active_device_by_index(-1) → ds_get_actived_device_info
 *   → ds_start_collect（内部 dev_open→读 header→线程回放 datafeed）
 *   → 事件 DS_EV_COLLECT_TASK_END* / ds_is_collecting() 等待结束
 *   → ds_get_actived_device_config(SR_CONF_SAMPLERATE)
 * 数据回调收 SR_DF_LOGIC(LA_CROSS_DATA) 交叉字节流：
 *   granule g=p>>3 → 第 g%ncol 列通道的第 (g/ncol)*8+(p&7) 字节（8 字节=64 采样/granule）。
 * 列→通道映射复刻 session_driver.c::read_archive 的 channel_dir_map：
 *   按 L-<d>/0 是否存在，把列号依序映射到通道目录号 d（= probe index = 槽下标）。
 * 元数据（version/driver/probe 名/启用态/session/decoders）直接从 zip 成员读，
 * 与官方 parse_header/read_archive 取同一信息源。
 */
#include <windows.h>
#include "capture.h"
#include "libsigrok.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include <zlib.h>
#include "minizip/unzip.h"

typedef struct {
    cap_file *cf;
    int ncol;
    int col2ch[256];
    uint64_t cross_pos;
    int saw_end;
} cap_ctx;

static cap_ctx *g_ctx;
static volatile int g_collect_done;
static volatile int g_collect_err;

static void on_event(int event)
{
    if (event == DS_EV_COLLECT_TASK_END ||
        event == DS_EV_COLLECT_TASK_END_BY_DETACHED)
        g_collect_done = 1;
    else if (event == DS_EV_COLLECT_TASK_END_BY_ERROR) {
        g_collect_done = 1;
        g_collect_err = 1;
    }
}

static void on_datafeed(const struct sr_dev_inst *sdi,
                        const struct sr_datafeed_packet *packet)
{
    cap_ctx *cx = g_ctx;
    (void)sdi;
    if (!cx || !packet) return;

    if (packet->type == SR_DF_LOGIC) {
        const struct sr_datafeed_logic *l = packet->payload;
        if (!l || l->format != LA_CROSS_DATA || !cx->ncol) return;
        /* 交织粒度为 8 字节 granule（session_driver.c:620-634 按 uint64 轮转通道；
           logicsnapshot.cpp:313-325 chans_read_addr[i]=src+i, read_ptr+=channel_num 确认）。
           字节偏移 p → granule g=p>>3 → 列 g%ncol → 通道内字节 (g/ncol)*8 + (p&7)。 */
        const uint8_t *d = l->data;
        for (uint64_t i = 0; i < l->length; i++) {
            uint64_t pos = cx->cross_pos + i;
            uint64_t g = pos >> 3;
            int chi = cx->col2ch[(int)(g % (uint64_t)cx->ncol)];
            if (chi >= 0)
                cx->cf->chs[chi].bits[(g / (uint64_t)cx->ncol) * 8 + (pos & 7)] = d[i];
        }
        cx->cross_pos += l->length;
    }
    else if (packet->type == SR_DF_END) {
        cx->saw_end = 1;
    }
}

/* 读 zip 成员全文（供 header/session/decoders） */
char *cap_zip_member(unzFile uz, const char *name, int *out_len)
{
    if (unzLocateFile(uz, name, 2) != UNZ_OK) return NULL;
    if (unzOpenCurrentFile(uz) != UNZ_OK) return NULL;
    unz_file_info64 fi;
    unzGetCurrentFileInfo64(uz, &fi, NULL, 0, NULL, 0, NULL, 0);
    uint64_t sz = fi.uncompressed_size;
    char *buf = malloc((size_t)sz + 1);
    int n = unzReadCurrentFile(uz, buf, (unsigned)sz);
    unzCloseCurrentFile(uz);
    if (n <= 0) { free(buf); return NULL; }
    buf[n] = 0;
    if (out_len) *out_len = n;
    return buf;
}

/* INI 风格 header：取 [section] 下 key 的值；支持 "key = value" */
static int ini_get(const char *text, const char *section, const char *key,
                   char *out, int outlen)
{
    char want_sec[64], line_key[128];
    snprintf(want_sec, sizeof want_sec, "[%s]", section);
    int in_sec = 0;
    const char *p = text;
    while (p && *p) {
        const char *eol = strchr(p, '\n');
        size_t len = eol ? (size_t)(eol - p) : strlen(p);
        char line[512];
        if (len >= sizeof line) len = sizeof line - 1;
        memcpy(line, p, len); line[len] = 0;
        char *s = line;
        while (*s == ' ' || *s == '\t' || *s == '\r') s++;
        size_t sl = strlen(s);
        while (sl && (s[sl - 1] == ' ' || s[sl - 1] == '\r')) s[--sl] = 0;
        if (*s == '[') {
            in_sec = !strncmp(s, want_sec, strlen(want_sec));
        }
        else if (in_sec && *s && *s != ';' && *s != '#') {
            char *eq = strchr(s, '=');
            if (eq) {
                *eq = 0;
                char *v = eq + 1;
                size_t kl = strlen(s);
                while (kl && (s[kl - 1] == ' ' || s[kl - 1] == '\t')) s[--kl] = 0;
                while (*v == ' ' || *v == '\t') v++;
                snprintf(line_key, sizeof line_key, "%s", s);
                if (!strcmp(line_key, key)) {
                    snprintf(out, outlen, "%s", v);
                    return 0;
                }
            }
        }
        p = eol ? eol + 1 : NULL;
    }
    return -1;
}

static void read_meta(cap_file *cf, unzFile uz)
{
    int len = 0;
    char *hdr = cap_zip_member(uz, "header", &len);
    if (!hdr) return;
    char v[256];
    cf->session_json = cap_zip_member(uz, "session", NULL);
    cf->decoders_json = cap_zip_member(uz, "decoders", NULL);

    if (ini_get(hdr, "version", "version", v, sizeof v) == 0)
        cf->version = atoi(v);
    if (ini_get(hdr, "header", "driver", v, sizeof v) == 0)
        snprintf(cf->driver, sizeof cf->driver, "%s", v);
    if (ini_get(hdr, "header", "total samples", v, sizeof v) == 0)
        cf->total_samples = _strtoui64(v, NULL, 10);
    if (ini_get(hdr, "header", "total probes", v, sizeof v) == 0)
        cf->nprobes = atoi(v);
    if (ini_get(hdr, "header", "total blocks", v, sizeof v) == 0)
        cf->nblocks = atoi(v);
    if (ini_get(hdr, "header", "trigger time", v, sizeof v) == 0)
        cf->trigger_time_ms = (int64_t)_strtoui64(v, NULL, 10);
    if (ini_get(hdr, "header", "trigger pos", v, sizeof v) == 0)
        cf->trigger_pos = _strtoui64(v, NULL, 10);
    if (ini_get(hdr, "header", "device mode", v, sizeof v) == 0)
        cf->device_mode = atoi(v);
    if (ini_get(hdr, "header", "samplerate", v, sizeof v) == 0) {
        double num = atof(v);
        if (strstr(v, "GHz")) num *= 1e9;
        else if (strstr(v, "MHz")) num *= 1e6;
        else if (strstr(v, "kHz") || strstr(v, "KHz")) num *= 1e3;
        cf->hdr_samplerate = num;
    }
    for (int i = 0; i < cf->nprobes && i < 256; i++) {
        char k[32];
        snprintf(k, sizeof k, "probe%d", i);
        if (ini_get(hdr, "header", k, v, sizeof v) == 0)
            snprintf(cf->probe_names[i], sizeof cf->probe_names[i], "%s", v);
        snprintf(k, sizeof k, "enable%d", i);
        if (ini_get(hdr, "header", k, v, sizeof v) == 0)
            cf->probe_enabled[i] = !strcmp(v, "true") || !strcmp(v, "1");
        else
            cf->probe_enabled[i] = 1;
    }
    free(hdr);

    time_t sec = (time_t)(cf->trigger_time_ms / 1000);
    struct tm tmv;
    gmtime_s(&tmv, &sec);
    snprintf(cf->trigger_time, sizeof cf->trigger_time,
             "%04d-%02d-%02d %02d:%02d:%02d",
             tmv.tm_year + 1900, tmv.tm_mon + 1, tmv.tm_mday,
             tmv.tm_hour, tmv.tm_min, tmv.tm_sec);
}

int cap_load(cap_file *cf, const char *path)
{
    memset(cf, 0, sizeof *cf);
    cf->path = _strdup(path);

    unzFile uz = unzOpen64(path);
    if (!uz) { snprintf(cf->err, sizeof cf->err, "无法打开文件: %s", path); return -1; }
    read_meta(cf, uz);
    if (cf->version != 3) {
        snprintf(cf->err, sizeof cf->err, "不支持的 .dsl 版本: %d（仅支持 v3）", cf->version);
        unzClose(uz); return -1;
    }

    /* 列→通道映射（先于回放建立）：col → 第 col 个存在的 L-<d>/0 */
    int ncol = 0;
    static cap_ctx ctx;
    memset(&ctx, 0, sizeof ctx);
    ctx.cf = cf;
    for (int c = 0; c < 256; c++) ctx.col2ch[c] = -1;
    for (int d = 0; d < 256 && ncol < 256; d++) {
        char entry[64];
        snprintf(entry, sizeof entry, "L-%d/0", d);
        if (unzLocateFile(uz, entry, 0) == UNZ_OK)
            ctx.col2ch[ncol++] = d;
    }
    unzClose(uz);
    ctx.ncol = ncol;
    cf->cross_cols = ncol;

    if (!cf->nprobes) cf->nprobes = ncol;
    if (!cf->nprobes) { snprintf(cf->err, sizeof cf->err, "文件内无通道数据"); return -1; }
    if (!cf->total_samples) { snprintf(cf->err, sizeof cf->err, "header 缺 total samples"); return -1; }

    /* 槽下标 = probe index；仅 present（有 L-i/0）通道分配位流 */
    cf->nchs = cf->nprobes;
    cf->chs = calloc((size_t)cf->nchs, sizeof(cap_channel));
    uint64_t bytes_per = cf->total_samples / 8 + 16;
    for (int i = 0; i < cf->nchs; i++) {
        cf->chs[i].index = i;
        cf->chs[i].enabled = cf->probe_enabled[i];
        cf->chs[i].name = _strdup(cf->probe_names[i][0] ? cf->probe_names[i] : "");
        cf->chs[i].present = 0;
    }
    for (int col = 0; col < ncol; col++) {
        int idx = ctx.col2ch[col];
        if (idx < cf->nchs) {
            cf->chs[idx].present = 1;
            cf->chs[idx].bits = calloc((size_t)bytes_per, 1);
        }
    }
    g_ctx = &ctx;
    g_collect_done = 0; g_collect_err = 0;

    if (ds_lib_init() != SR_OK) {
        snprintf(cf->err, sizeof cf->err, "ds_lib_init 失败"); return -1;
    }
    ds_set_datafeed_callback(on_datafeed);
    ds_set_event_callback(on_event);

    if (ds_device_from_file(path) != SR_OK) {
        snprintf(cf->err, sizeof cf->err, "ds_device_from_file 失败: %s", path); return -1;
    }
    ds_active_device_by_index(-1);

    if (ds_start_collect() != SR_OK) {
        snprintf(cf->err, sizeof cf->err, "ds_start_collect 失败（无启用通道或设备打开失败）");
        return -1;
    }
    for (int t = 0; t < 600000 && !g_collect_done && ds_is_collecting(); t++)
        Sleep(1);
    ds_stop_collect();

    /* 尾部修正：datafeed 回放按 8 字节 granule 对齐，末段不足一 granule 时
       通道尾部字节补零/缺失，会引入幻边沿；以 zip 成员真实字节覆写位流
       （成员内容与 datafeed 逐字节一致已由 R65 oracle 验证，仅修正尾部）。 */
    {
        unzFile uz2 = unzOpen64(path);
        if (uz2) {
            for (int i = 0; i < cf->nchs; i++) {
                if (!cf->chs[i].present || !cf->chs[i].bits) continue;
                uint64_t wpos = 0;
                int nblk = cf->nblocks > 0 ? cf->nblocks : 1;
                for (int blk = 0; blk < nblk; blk++) {
                    char entry[64];
                    snprintf(entry, sizeof entry, "L-%d/%d", i, blk);
                    if (unzLocateFile(uz2, entry, 0) != UNZ_OK) break;
                    if (unzOpenCurrentFile(uz2) != UNZ_OK) break;
                    unz_file_info64 fi;
                    unzGetCurrentFileInfo64(uz2, &fi, NULL, 0, NULL, 0, NULL, 0);
                    uint64_t sz = fi.uncompressed_size;
                    if (wpos + sz > bytes_per) sz = bytes_per > wpos ? bytes_per - wpos : 0;
                    int n = sz ? unzReadCurrentFile(uz2, cf->chs[i].bits + wpos, (unsigned)sz) : 0;
                    unzCloseCurrentFile(uz2);
                    if (n <= 0) break;
                    wpos += (uint64_t)n;
                }
            }
            unzClose(uz2);
        }
    }

    GVariant *gv = NULL;
    if (ds_get_actived_device_config(NULL, NULL, SR_CONF_SAMPLERATE, &gv) == SR_OK && gv) {
        cf->samplerate = (double)g_variant_get_uint64(gv);
        g_variant_unref(gv);
    }
    if (!cf->samplerate) cf->samplerate = cf->hdr_samplerate;

    if (!cf->total_samples && ctx.cross_pos && ncol)
        cf->total_samples = ctx.cross_pos * 8 / ncol;

    ds_release_actived_device();
    return g_collect_err ? -2 : 0;
}

int cap_find_ch(cap_file *cf, int index)
{
    return index >= 0 && index < cf->nchs ? index : -1;
}

void cap_free(cap_file *cf)
{
    if (!cf) return;
    free(cf->path);
    free(cf->session_json);
    free(cf->decoders_json);
    for (int i = 0; i < cf->nchs; i++) {
        free(cf->chs[i].name);
        free(cf->chs[i].bits);
    }
    free(cf->chs);
    memset(cf, 0, sizeof *cf);
}
