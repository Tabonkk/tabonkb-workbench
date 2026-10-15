/* jsonlite — 极小 JSON 解析/发射（dslogic-core 胶水专用，非官方代码）。
 * 仅支持：object/array/string/number/bool/null；UTF-8 原样透传；\uXXXX 转义。
 * 解析失败返回 NULL；所有分配一次 arena 释放。
 */
#ifndef DSLCORE_JSONLITE_H
#define DSLCORE_JSONLITE_H

#include <stdint.h>
#include <stddef.h>

typedef enum { JL_NULL, JL_BOOL, JL_NUM, JL_STR, JL_ARR, JL_OBJ } jl_type;

typedef struct jl_val jl_val;
typedef struct jl_pair jl_pair;
struct jl_pair { char *key; jl_val *v; jl_pair *next; };
struct jl_val {
    jl_type t;
    double num;            /* NUM */
    int boolean;           /* BOOL */
    char *str;             /* STR */
    jl_val **items; size_t nitems; /* ARR */
    jl_pair *pairs;        /* OBJ (linked, insertion order) */
};

jl_val  *jl_parse(const char *s, size_t len);   /* NULL on error */
jl_val  *jl_obj_get(const jl_val *o, const char *key);
const char *jl_str(const jl_val *o, const char *key, const char *def);
double   jl_num(const jl_val *o, const char *key, double def);
int      jl_int(const jl_val *o, const char *key, int def);
int      jl_bool(const jl_val *o, const char *key, int def);
void     jl_free(jl_val *v);

/* ---- emitter ---- */
typedef struct { char *buf; size_t len, cap; } jl_buf;
void   jb_init(jl_buf *b);
void   jb_free(jl_buf *b);
void   jb_raw(jl_buf *b, const char *s);
void   jb_raw_js(jl_buf *b, const char *s);      /* 原样嵌入但压缩串外空白 */
void   jb_rawn(jl_buf *b, const char *s, size_t n);
void   jb_chr(jl_buf *b, char c);
void   jb_str(jl_buf *b, const char *s);          /* quoted+escaped */
void   jb_num(jl_buf *b, double v);
void   jb_u64(jl_buf *b, uint64_t v);
void   jb_i64(jl_buf *b, int64_t v);
void   jb_key(jl_buf *b, const char *k);          /* "k": */
char  *jb_take(jl_buf *b);                        /* NUL-terminated, caller frees */

#endif
