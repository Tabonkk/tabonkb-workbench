#include "jsonlite.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>

typedef struct { const char *p, *end; } P;

static void *xcalloc(size_t n, size_t s) { void *p = calloc(n, s); if (!p) exit(2); return p; }
static char *xstrndup(const char *s, size_t n) { char *d = xcalloc(n + 1, 1); memcpy(d, s, n); return d; }

static void ws(P *p) { while (p->p < p->end && (*p->p == ' ' || *p->p == '\t' || *p->p == '\r' || *p->p == '\n')) p->p++; }
static int eat(P *p, char c) { ws(p); if (p->p < p->end && *p->p == c) { p->p++; return 1; } return 0; }

static jl_val *newv(jl_type t) { jl_val *v = xcalloc(1, sizeof(*v)); v->t = t; return v; }

static int hex4(const char *s) { int v = 0; for (int i = 0; i < 4; i++) { char c = s[i]; v <<= 4; v += c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : c >= 'A' && c <= 'F' ? c - 'A' + 10 : -999; } return v; }

static void utf8put(char **w, unsigned cp) {
    if (cp < 0x80) *(*w)++ = (char)cp;
    else if (cp < 0x800) { *(*w)++ = (char)(0xC0 | (cp >> 6)); *(*w)++ = (char)(0x80 | (cp & 63)); }
    else { *(*w)++ = (char)(0xE0 | (cp >> 12)); *(*w)++ = (char)(0x80 | ((cp >> 6) & 63)); *(*w)++ = (char)(0x80 | (cp & 63)); }
}

static jl_val *parse_v(P *p);

static char *parse_string(P *p) {
    if (!eat(p, '"')) return NULL;
    const char *s = p->p;
    size_t cap = 32, n = 0;
    char *out = xcalloc(cap, 1);
    while (p->p < p->end) {
        char c = *p->p++;
        if (c == '"') { out[n] = 0; return out; }
        if (c == '\\' && p->p < p->end) {
            char e = *p->p++;
            const char *lit = NULL;
            switch (e) {
            case '"': lit = "\""; break; case '\\': lit = "\\"; break; case '/': lit = "/"; break;
            case 'b': lit = "\b"; break; case 'f': lit = "\f"; break;
            case 'n': lit = "\n"; break; case 'r': lit = "\r"; break; case 't': lit = "\t"; break;
            case 'u':
                if (p->end - p->p >= 4) {
                    int cp = hex4(p->p); p->p += 4;
                    if (cp < 0) { free(out); return NULL; }
                    /* surrogate pair */
                    if (cp >= 0xD800 && cp <= 0xDBFF && p->end - p->p >= 6 &&
                        p->p[0] == '\\' && p->p[1] == 'u') {
                        int lo = hex4(p->p + 2);
                        if (lo >= 0xDC00 && lo <= 0xDFFF) { cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00); p->p += 6; }
                    }
                    if (n + 4 > cap) { cap *= 2; out = realloc(out, cap); }
                    char *w = out + n; utf8put(&w, (unsigned)cp); n = w - out;
                    continue;
                }
                free(out); return NULL;
            default: free(out); return NULL;
            }
            if (n + 2 > cap) { cap *= 2; out = realloc(out, cap); }
            out[n++] = *lit;
            continue;
        }
        if (n + 2 > cap) { cap *= 2; out = realloc(out, cap); }
        out[n++] = c;
    }
    free(out);
    (void)s;
    return NULL;
}

static jl_val *parse_v(P *p) {
    ws(p);
    if (p->p >= p->end) return NULL;
    char c = *p->p;
    if (c == '{') {
        p->p++;
        jl_val *o = newv(JL_OBJ);
        jl_pair **tail = &o->pairs;
        if (eat(p, '}')) return o;
        for (;;) {
            ws(p);
            char *k = parse_string(p);
            if (!k || !eat(p, ':')) { free(k); return NULL; }
            jl_val *v = parse_v(p);
            if (!v) { free(k); return NULL; }
            jl_pair *pr = xcalloc(1, sizeof(*pr));
            pr->key = k; pr->v = v; *tail = pr; tail = &pr->next;
            if (eat(p, '}')) break;
            if (!eat(p, ',')) return NULL;
        }
        return o;
    }
    if (c == '[') {
        p->p++;
        jl_val *a = newv(JL_ARR);
        size_t cap = 8;
        a->items = xcalloc(cap, sizeof(jl_val *));
        if (eat(p, ']')) return a;
        for (;;) {
            jl_val *v = parse_v(p);
            if (!v) return NULL;
            if (a->nitems == cap) { cap *= 2; a->items = realloc(a->items, cap * sizeof(jl_val *)); }
            a->items[a->nitems++] = v;
            if (eat(p, ']')) break;
            if (!eat(p, ',')) return NULL;
        }
        return a;
    }
    if (c == '"') { jl_val *v = newv(JL_STR); v->str = parse_string(p); return v->str ? v : NULL; }
    if (c == 't' && p->end - p->p >= 4 && !memcmp(p->p, "true", 4)) { p->p += 4; jl_val *v = newv(JL_BOOL); v->boolean = 1; return v; }
    if (c == 'f' && p->end - p->p >= 5 && !memcmp(p->p, "false", 5)) { p->p += 5; jl_val *v = newv(JL_BOOL); return v; }
    if (c == 'n' && p->end - p->p >= 4 && !memcmp(p->p, "null", 4)) { p->p += 4; return newv(JL_NULL); }
    /* number */
    const char *s = p->p;
    while (p->p < p->end && strchr("-+0123456789.eE", *p->p)) p->p++;
    if (p->p == s) return NULL;
    jl_val *v = newv(JL_NUM);
    v->num = strtod(s, NULL);
    return v;
}

jl_val *jl_parse(const char *s, size_t len) {
    P p = { s, s + len };
    jl_val *v = parse_v(&p);
    ws(&p);
    if (p.p != p.end) { jl_free(v); return NULL; }
    return v;
}

jl_val *jl_obj_get(const jl_val *o, const char *key) {
    if (!o || o->t != JL_OBJ) return NULL;
    for (jl_pair *pr = o->pairs; pr; pr = pr->next)
        if (!strcmp(pr->key, key)) return pr->v;
    return NULL;
}
const char *jl_str(const jl_val *o, const char *key, const char *def) {
    jl_val *v = jl_obj_get(o, key);
    return v && v->t == JL_STR ? v->str : def;
}
double jl_num(const jl_val *o, const char *key, double def) {
    jl_val *v = jl_obj_get(o, key);
    return v && v->t == JL_NUM ? v->num : def;
}
int jl_int(const jl_val *o, const char *key, int def) {
    jl_val *v = jl_obj_get(o, key);
    return v && v->t == JL_NUM ? (int)v->num : def;
}
int jl_bool(const jl_val *o, const char *key, int def) {
    jl_val *v = jl_obj_get(o, key);
    return v ? (v->t == JL_BOOL ? v->boolean : v->t == JL_NUM ? v->num != 0 : def) : def;
}

void jl_free(jl_val *v) {
    if (!v) return;
    if (v->t == JL_STR) free(v->str);
    if (v->t == JL_ARR) { for (size_t i = 0; i < v->nitems; i++) jl_free(v->items[i]); free(v->items); }
    if (v->t == JL_OBJ) { jl_pair *p = v->pairs; while (p) { jl_pair *n = p->next; free(p->key); jl_free(p->v); free(p); p = n; } }
    free(v);
}

/* ---- emitter ---- */
void jb_init(jl_buf *b) { b->cap = 1 << 16; b->len = 0; b->buf = xcalloc(b->cap, 1); }
void jb_free(jl_buf *b) { free(b->buf); b->buf = NULL; }
static void jb_need(jl_buf *b, size_t n) { if (b->len + n + 1 > b->cap) { while (b->len + n + 1 > b->cap) b->cap *= 2; b->buf = realloc(b->buf, b->cap); } }
void jb_rawn(jl_buf *b, const char *s, size_t n) { jb_need(b, n); memcpy(b->buf + b->len, s, n); b->len += n; }
void jb_raw(jl_buf *b, const char *s) { jb_rawn(b, s, strlen(s)); }
void jb_raw_js(jl_buf *b, const char *s)
{
    /* 嵌入外部 JSON 原文时去掉串外 ASCII 空白（含换行），保持 NDJSON 一行一报文 */
    int in_str = 0, esc = 0;
    for (const unsigned char *p = (const unsigned char *)s; p && *p; p++) {
        unsigned char c = *p;
        if (in_str) {
            jb_chr(b, (char)c);
            if (esc) esc = 0;
            else if (c == 0x5c) esc = 1;
            else if (c == '"') in_str = 0;
            continue;
        }
        if (c == '"') { in_str = 1; jb_chr(b, '"'); continue; }
        if (c <= ' ') continue;
        jb_chr(b, (char)c);
    }
}
void jb_chr(jl_buf *b, char c) { jb_need(b, 1); b->buf[b->len++] = c; }
void jb_str(jl_buf *b, const char *s) {
    jb_chr(b, '"');
    for (const unsigned char *p = (const unsigned char *)s; p && *p; p++) {
        unsigned char c = *p;
        switch (c) {
        case '"': jb_raw(b, "\\\""); break;
        case '\\': jb_raw(b, "\\\\"); break;
        case '\n': jb_raw(b, "\\n"); break;
        case '\r': jb_raw(b, "\\r"); break;
        case '\t': jb_raw(b, "\\t"); break;
        case '\b': jb_raw(b, "\\b"); break;
        case '\f': jb_raw(b, "\\f"); break;
        default:
            if (c < 0x20) { char tmp[8]; snprintf(tmp, sizeof tmp, "\\u%04x", c); jb_raw(b, tmp); }
            else jb_chr(b, (char)c);
        }
    }
    jb_chr(b, '"');
}
void jb_num(jl_buf *b, double v) { char tmp[40]; snprintf(tmp, sizeof tmp, "%.17g", v); jb_raw(b, tmp); }
void jb_u64(jl_buf *b, uint64_t v) { char tmp[24]; snprintf(tmp, sizeof tmp, "%llu", (unsigned long long)v); jb_raw(b, tmp); }
void jb_i64(jl_buf *b, int64_t v) { char tmp[24]; snprintf(tmp, sizeof tmp, "%lld", (long long)v); jb_raw(b, tmp); }
void jb_key(jl_buf *b, const char *k) { jb_str(b, k); jb_chr(b, ':'); }
char *jb_take(jl_buf *b) { jb_need(b, 1); b->buf[b->len] = 0; return b->buf; }
