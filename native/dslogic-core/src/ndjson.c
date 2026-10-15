#include "ndjson.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void emit_id(jl_buf *b, jl_val *id)
{
    if (!id || id->t == JL_NULL) { jb_raw(b, "null"); return; }
    if (id->t == JL_NUM) jb_num(b, id->num);
    else if (id->t == JL_STR) jb_str(b, id->str);
    else if (id->t == JL_BOOL) jb_raw(b, id->boolean ? "true" : "false");
    else jb_raw(b, "null");
}

char *rpc_read_line(void)
{
    size_t cap = 1 << 16, n = 0;
    char *buf = malloc(cap);
    int c;
    while ((c = getchar()) != EOF) {
        if (c == '\n') break;
        if (n + 2 >= cap) { cap *= 2; buf = realloc(buf, cap); }
        buf[n++] = (char)c;
    }
    if (c == EOF && n == 0) { free(buf); return NULL; }
    buf[n] = 0;
    return buf;
}

void rpc_begin(jl_buf *b, jl_val *id)
{
    jb_init(b);
    jb_raw(b, "{\"id\":");
    emit_id(b, id);
    jb_chr(b, ',');
}

void rpc_flush(jl_buf *b)
{
    char *s = jb_take(b);
    fputs(s, stdout);
    fputc('\n', stdout);
    fflush(stdout);
    /* s 即 b->buf，无需单独 free（jb_take 已移交） */
    free(s);
    b->buf = NULL; b->len = b->cap = 0;
}

void rpc_respond_raw(jl_val *id, const char *data_json_raw)
{
    jl_buf b; rpc_begin(&b, id);
    jb_raw(&b, "\"ok\":true,\"data\":");
    jb_raw(&b, data_json_raw ? data_json_raw : "null");
    jb_chr(&b, '}');
    rpc_flush(&b);
}

void rpc_respond_err(jl_val *id, const char *msg)
{
    jl_buf b; rpc_begin(&b, id);
    jb_raw(&b, "\"ok\":false,\"error\":");
    jb_str(&b, msg ? msg : "未知错误");
    jb_chr(&b, '}');
    rpc_flush(&b);
}

void rpc_hello_ok(const char *data_json_raw)
{
    jl_buf b; jb_init(&b);
    jb_raw(&b, "{\"id\":0,\"ok\":true,\"data\":");
    jb_raw(&b, data_json_raw ? data_json_raw : "null");
    jb_chr(&b, '}');
    rpc_flush(&b);
}

void rpc_hello_err(const char *msg)
{
    jl_buf b; jb_init(&b);
    jb_raw(&b, "{\"id\":0,\"ok\":false,\"error\":");
    jb_str(&b, msg ? msg : "未知错误");
    jb_chr(&b, '}');
    rpc_flush(&b);
}
