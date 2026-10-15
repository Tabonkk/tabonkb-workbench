/* main.c — dslogic-core NDJSON 服务入口（胶水）。
 * 启动即执行 srd 自检（srd_init + load_all + 必需解码器核查），
 * 失败 → hello {ok:false} 退出（显式失败，不静默降级）。
 * 方法：info / edges / decode / decoders / ping
 */
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#include "jsonlite.h"
#include "ndjson.h"
#include "capture.h"
#include "edge_index.h"
#include "decode.h"
#include "libsigrokdecode.h"

static char g_decoders_dir[1024];
static char g_py_home[1024];

static void module_dir(char *out, size_t n)
{
    char path[1024];
    DWORD m = GetModuleFileNameA(NULL, path, sizeof path);
    if (!m) { snprintf(out, n, "."); return; }
    path[m] = 0;
    for (char *p = path + strlen(path); p > path; p--)
        if (*p == '\\' || *p == '/') { *p = 0; break; }
    snprintf(out, n, "%s", path);
}

static void join(char *out, size_t n, const char *a, const char *b)
{
    snprintf(out, n, "%s\\%s", a, b);
}

static uint64_t file_size(const char *path)
{
    struct _stat64 st;
    return _stat64(path, &st) == 0 ? (uint64_t)st.st_size : 0;
}

static const char *base_name(const char *p)
{
    const char *s = p + strlen(p);
    while (s > p && s[-1] != '\\' && s[-1] != '/') s--;
    return s;
}

/* info 数据体（worker 契约对齐 dsl_reader.info） */
static void emit_info(jl_buf *b, cap_file *cf, const char *path)
{
    jb_chr(b, '{');
    jb_key(b, "file"); jb_str(b, base_name(path)); jb_chr(b, ',');
    jb_key(b, "path"); jb_str(b, path); jb_chr(b, ',');
    jb_key(b, "size"); jb_u64(b, file_size(path)); jb_chr(b, ',');
    jb_key(b, "version"); jb_i64(b, cf->version); jb_chr(b, ',');
    jb_key(b, "driver"); jb_str(b, cf->driver); jb_chr(b, ',');
    jb_key(b, "samplerate"); jb_num(b, cf->samplerate); jb_chr(b, ',');
    jb_key(b, "total_samples"); jb_u64(b, cf->total_samples); jb_chr(b, ',');
    jb_key(b, "duration_s");
    if (cf->samplerate > 0) jb_num(b, cf->total_samples / cf->samplerate);
    else jb_raw(b, "null");
    jb_chr(b, ',');
    jb_key(b, "blocks"); jb_i64(b, cf->nblocks ? cf->nblocks : 1); jb_chr(b, ',');
    jb_key(b, "trigger_time_ms"); jb_i64(b, cf->trigger_time_ms); jb_chr(b, ',');
    jb_key(b, "trigger_time"); jb_str(b, cf->trigger_time); jb_chr(b, ',');
    jb_key(b, "trigger_pos"); jb_u64(b, cf->trigger_pos); jb_chr(b, ',');

    jb_key(b, "session");
    jb_raw_js(b, cf->session_json ? cf->session_json : "{}");
    jb_chr(b, ',');
    jb_key(b, "decoders");
    jb_raw_js(b, cf->decoders_json ? cf->decoders_json : "[]");
    jb_chr(b, ',');

    jb_key(b, "channels"); jb_chr(b, '[');
    for (int i = 0; i < cf->nchs; i++) {
        if (i) jb_chr(b, ',');
        jb_chr(b, '{');
        jb_key(b, "index"); jb_i64(b, cf->chs[i].index); jb_chr(b, ',');
        jb_key(b, "name"); jb_str(b, cf->chs[i].name); jb_chr(b, ',');
        jb_key(b, "enabled"); jb_raw(b, cf->chs[i].enabled && cf->chs[i].present ? "true" : "false"); jb_chr(b, ',');
        jb_key(b, "present"); jb_raw(b, cf->chs[i].present ? "true" : "false");
        jb_chr(b, '}');
    }
    jb_raw(b, "]}");
}

/* 载入文件；失败已通过 resp 报错时返回 0 */
static int load_or_reply(jl_val *id, cap_file *cf, jl_val *params)
{
    const char *file = jl_str(params, "file", NULL);
    if (!file) { rpc_respond_err(id, "缺少参数 file"); return 0; }
    int rc = cap_load(cf, file);
    if (rc != 0) {
        rpc_respond_err(id, cf->err[0] ? cf->err : "文件加载失败");
        cap_free(cf);
        return 0;
    }
    return 1;
}

static void m_info(jl_val *id, jl_val *params)
{
    cap_file cf;
    if (!load_or_reply(id, &cf, params)) return;
    jl_buf b; rpc_begin(&b, id);
    jb_raw(&b, "\"ok\":true,\"data\":");
    emit_info(&b, &cf, jl_str(params, "file", ""));
    jb_chr(&b, '}');
    rpc_flush(&b);
    cap_free(&cf);
}

static void m_edges(jl_val *id, jl_val *params)
{
    cap_file cf;
    if (!load_or_reply(id, &cf, params)) return;
    jl_buf b; rpc_begin(&b, id);
    jb_raw(&b, "\"ok\":true,\"data\":{");
    edges_to_json(&b, &cf, params);
    jb_raw(&b, "}}");
    rpc_flush(&b);
    cap_free(&cf);
}

static void m_decode(jl_val *id, jl_val *params)
{
    cap_file cf;
    if (!load_or_reply(id, &cf, params)) return;
    jl_val *spec = jl_obj_get(params, "spec");
    if (!spec) spec = params;   /* 扁平 {id,pins,options,stacked} */
    jl_buf b; rpc_begin(&b, id);
    char err[512] = {0};
    jl_buf body; jb_init(&body);
    jb_chr(&body, '{');
    int rc = decode_run(&body, &cf, spec, err, sizeof err);
    jb_chr(&body, '}');
    char *raw = jb_take(&body);
    if (rc == 0) {
        jb_raw(&b, "\"ok\":true,\"data\":");
        jb_raw(&b, raw);
    } else {
        jb_raw(&b, "\"ok\":false,\"error\":");
        jb_str(&b, err[0] ? err : "解码失败");
    }
    jb_chr(&b, '}');
    rpc_flush(&b);
    free(raw);
    cap_free(&cf);
}

static void m_describe(jl_val *id, jl_val *params)
{
    const char *dec_id = jl_str(params, "id", NULL);
    if (!dec_id || !*dec_id) { rpc_respond_err(id, "缺少参数 id"); return; }
    struct srd_decoder *dec = srd_decoder_get_by_id(dec_id);
    if (!dec) { rpc_respond_err(id, "解码器不存在"); return; }
    jl_buf b; rpc_begin(&b, id);
    jb_raw(&b, "\"ok\":true,\"data\":");
    emit_describe(&b, dec);
    jb_chr(&b, '}');
    rpc_flush(&b);
}

static void m_decoders(jl_val *id, jl_val *params)
{
    (void)params;
    jl_buf b; rpc_begin(&b, id);
    jb_raw(&b, "\"ok\":true,\"data\":");
    emit_decoders(&b);
    jb_chr(&b, '}');
    rpc_flush(&b);
}

int main(void)
{
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stdin, NULL, _IONBF, 0);
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);

    char mod[1024];
    module_dir(mod, sizeof mod);
    const char *env_d = getenv("DSLCORE_DECODERS");
    const char *env_p = getenv("DSLCORE_PYTHON_HOME");
    join(g_decoders_dir, sizeof g_decoders_dir, mod, "decoders");
    join(g_py_home, sizeof g_py_home, mod, "python");
    if (env_d && *env_d) snprintf(g_decoders_dir, sizeof g_decoders_dir, "%s", env_d);
    if (env_p && *env_p) snprintf(g_py_home, sizeof g_py_home, "%s", env_p);

    /* 启动自检 */
    char berr[512] = {0};
    if (decode_boot(g_decoders_dir, g_py_home, berr, sizeof berr) != 0) {
        rpc_hello_err(berr);
        return 1;
    }

    /* hello */
    {
        jl_buf b; jb_init(&b);
        jb_chr(&b, '{');
        jb_key(&b, "ready"); jb_raw(&b, "true"); jb_chr(&b, ',');
        jb_key(&b, "pid"); jb_i64(&b, GetCurrentProcessId()); jb_chr(&b, ',');
        jb_key(&b, "engine"); jb_str(&b, "dslogic-core (libsigrok4DSL + libsigrokdecode4DSL)"); jb_chr(&b, ',');
        jb_key(&b, "decoders_dir"); jb_str(&b, g_decoders_dir); jb_chr(&b, ',');
        jb_key(&b, "python_home"); jb_str(&b, g_py_home);
        jb_chr(&b, '}');
        char *raw = jb_take(&b);
        rpc_hello_ok(raw);
        free(raw);
    }

    /* 主循环 */
    for (;;) {
        char *line = rpc_read_line();
        if (!line) break;
        jl_val *req = jl_parse(line, strlen(line));
        free(line);
        if (!req) { rpc_respond_err(NULL, "请求不是合法 JSON"); continue; }
        jl_val *id = jl_obj_get(req, "id");
        const char *method = jl_str(req, "method", "");
        jl_val *params = jl_obj_get(req, "params");

        if (!strcmp(method, "info"))        m_info(id, params);
        else if (!strcmp(method, "edges"))  m_edges(id, params);
        else if (!strcmp(method, "decode")) m_decode(id, params);
        else if (!strcmp(method, "describe")) m_describe(id, params);
        else if (!strcmp(method, "decoders")) m_decoders(id, params);
        else if (!strcmp(method, "ping"))   rpc_respond_raw(id, "{\"pong\":true}");
        else {
            char msg[128];
            snprintf(msg, sizeof msg, "未知方法: %s", method);
            rpc_respond_err(id, msg);
        }
        jl_free(req);
    }
    return 0;
}
