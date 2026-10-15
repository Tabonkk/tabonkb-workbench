/* decode.c — 逐行对照 DSView/pv/data/decoderstack.cpp：
 *
 *  execute_decode_stack() (decoderstack.cpp:693-768):
 *    srd_session_new → 逐个 create_decoder_inst(srd_inst_new+srd_inst_channel_set_all)
 *    → srd_inst_stack 链 → srd_session_metadata_set(SRD_CONF_SAMPLERATE)
 *    → srd_pd_output_callback_add(SRD_OUTPUT_ANN) → srd_session_start
 *    → decode_data → srd_session_end → srd_session_destroy
 *
 *  decode_data() (decoderstack.cpp:505-665):
 *    logic_di = di_list 中首个有通道的实例
 *    while i<=end_index:
 *      inbuf[j]  = bits + (i>>3)   （floor 对齐，见 logicsnapshot get_samples）
 *      const[j]  = bit(i)          （起始样本电平）
 *      chunk_end = min(end_index+1, i+MaxChunkSize=16384)
 *      srd_session_send(sess, i, chunk_end, inbuf, const, chunk_end-i)
 *      i = chunk_end
 *    正常结束 → srd_session_end
 *
 *  annotation_callback() (decoderstack.cpp:784-842) + Row 映射 (decoderstack.cpp:165-205):
 *    dec=inst 的 decoder->id；class→row 由 annotation_rows/ann_classes 查表，
 *    未命中回退 decoder 级行（row="",row_desc=decoder->name）。
 */
#include <windows.h>
#include <Python.h>
#include "decode.h"
#include "libsigrokdecode.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#define MAX_CHUNK 16384   /* decoderstack.h:78 MaxChunkSize = 1024*16 */

const char *DSLCORE_REQUIRED_DECODERS[] = {
    "0:i2c", "0:spi", "0:uart", "ufcs", "usb_power_delivery", NULL
};

/* ---------- 注解回调：收集为 JSON ---------- */
typedef struct {
    jl_buf *b;
    int first;
    uint64_t count;
} ann_ctx;

static void emit_annotation(ann_ctx *cx, struct srd_proto_data *pdata)
{
    const struct srd_proto_data_annotation *a = pdata->data;
    const struct srd_decoder_inst *di = pdata->pdo->di;
    const struct srd_decoder *dec = di->decoder;

    /* class→row 映射（decoderstack.cpp:182-205） */
    const char *row_id = "", *row_desc = dec->name ? dec->name : "";
    if (dec->annotation_rows) {
        for (const GSList *l = dec->annotation_rows; l; l = l->next) {
            const struct srd_decoder_annotation_row *r = l->data;
            int hit = 0;
            for (const GSList *ll = r->ann_classes; ll; ll = ll->next)
                if (GPOINTER_TO_INT(ll->data) == a->ann_class) { hit = 1; break; }
            if (hit) {
                row_id = r->id ? r->id : "";
                row_desc = r->desc ? r->desc : "";
                break;
            }
        }
    }

    /* ann_id / ann_desc：annotations 是 prepend 逆序表（decoder.c:456），
       python 下标 ann_class → slist 位置 size-1-ann_class */
    const char *ann_id = "", *ann_desc = "";
    if (dec->annotations) {
        guint n = g_slist_length((GSList *)dec->annotations);
        if (a->ann_class >= 0 && a->ann_class < (int)n) {
            const GSList *l = g_slist_nth((GSList *)dec->annotations, n - 1 - a->ann_class);
            if (l && l->data) {
                char **pair = l->data;
                int len = 0;
                while (pair[len]) len++;
                if (len >= 2) { ann_id = pair[len - 2]; ann_desc = pair[len - 1]; }
            }
        }
    }
    (void)ann_desc;

    if (!cx->first) jb_chr(cx->b, ',');
    cx->first = 0;
    cx->count++;
    jl_buf *b = cx->b;
    jb_chr(b, '{');
    jb_key(b, "ss"); jb_u64(b, pdata->start_sample); jb_chr(b, ',');
    jb_key(b, "es"); jb_u64(b, pdata->end_sample); jb_chr(b, ',');
    jb_key(b, "dec"); jb_str(b, dec->id ? dec->id : ""); jb_chr(b, ',');
    jb_key(b, "inst"); jb_str(b, di->inst_id ? di->inst_id : ""); jb_chr(b, ',');
    jb_key(b, "row"); jb_str(b, row_id); jb_chr(b, ',');
    jb_key(b, "row_desc"); jb_str(b, row_desc); jb_chr(b, ',');
    jb_key(b, "ann"); jb_str(b, ann_id); jb_chr(b, ',');
    jb_key(b, "cls"); jb_i64(b, a->ann_type); jb_chr(b, ',');
    if (a->str_number_hex[0]) {
        jb_key(b, "hex"); jb_str(b, a->str_number_hex); jb_chr(b, ',');
        jb_key(b, "num"); jb_i64(b, a->numberic_value); jb_chr(b, ',');
    }
    jb_key(b, "texts"); jb_chr(b, '[');
    if (a->ann_text)
        for (int t = 0; a->ann_text[t]; t++) {
            if (t) jb_chr(b, ',');
            jb_str(b, a->ann_text[t]);
        }
    jb_raw(b, "]}");
}

static void ann_cb(struct srd_proto_data *pdata, void *cb_data)
{
    ann_ctx *cx = cb_data;
    if (!pdata || pdata->pdo->output_type != SRD_OUTPUT_ANN) return;
    emit_annotation(cx, pdata);
}

/* ---------- 选项 GVariant 类型化（instance.c 要求类型匹配 sdo->def） ---------- */
static GVariant *opt_variant(const struct srd_decoder *dec, const char *key, jl_val *v)
{
    const GVariantType *want = NULL;
    for (GSList *l = (GSList *)dec->options; l; l = l->next) {
        const struct srd_decoder_option *o = l->data;
        if (o->id && !strcmp(o->id, key) && o->def) { want = g_variant_get_type(o->def); break; }
    }

     if (!v) return NULL;
    if (want && g_variant_type_equal(want, G_VARIANT_TYPE_STRING))
        return g_variant_new_string(v->t == JL_STR ? v->str : "");
    if (want && g_variant_type_equal(want, G_VARIANT_TYPE_DOUBLE))
        return g_variant_new_double(v->t == JL_NUM ? v->num : v->t == JL_STR ? atof(v->str) : 0.0);
    if (want && g_variant_type_equal(want, G_VARIANT_TYPE_BOOLEAN))
        return g_variant_new_boolean(v->t == JL_BOOL ? v->boolean : v->t == JL_NUM ? v->num != 0 : 0);
    /* int64 默认 */
    if (v->t == JL_STR) return g_variant_new_int64(_strtoi64(v->str, NULL, 0));
    return g_variant_new_int64(v->t == JL_NUM ? (int64_t)v->num : v->t == JL_BOOL ? v->boolean : 0);
}

static GHashTable *build_options(const struct srd_decoder *dec, jl_val *opts)
{
    GHashTable *h = g_hash_table_new_full(g_str_hash, g_str_equal, g_free,
                                        (GDestroyNotify)g_variant_unref);
    if (opts && opts->t == JL_OBJ) {
        for (jl_pair *p = opts->pairs; p; p = p->next) {
            GVariant *gv = opt_variant(dec, p->key, p->v);
            if (gv)
                g_hash_table_insert(h, g_strdup(p->key), g_variant_ref_sink(gv));
        }
    }
    return h;
}

static GHashTable *build_pins(jl_val *pins)
{
    GHashTable *h = g_hash_table_new_full(g_str_hash, g_str_equal, g_free,
                                        (GDestroyNotify)g_variant_unref);
    if (pins && pins->t == JL_OBJ) {
        for (jl_pair *p = pins->pairs; p; p = p->next) {
            if (p->v->t != JL_NUM) continue;
            g_hash_table_insert(h, g_strdup(p->key),
                                g_variant_ref_sink(g_variant_new_int32((int)p->v->num)));
        }
    }
    return h;
}


/* ---------- GVariant -> JSON（describe 选项默认值/值域用） ---------- */
static void gv_json(jl_buf *b, GVariant *v)
{
    if (!v) { jb_raw(b, "null"); return; }
    const GVariantType *t = g_variant_get_type(v);
    if (g_variant_type_equal(t, G_VARIANT_TYPE_STRING)) {
        jb_str(b, g_variant_get_string(v, NULL));
    } else if (g_variant_type_equal(t, G_VARIANT_TYPE_BOOLEAN)) {
        jb_raw(b, g_variant_get_boolean(v) ? "true" : "false");
    } else if (g_variant_type_equal(t, G_VARIANT_TYPE_INT64)) {
        jb_i64(b, g_variant_get_int64(v));
    } else if (g_variant_type_equal(t, G_VARIANT_TYPE_INT32)) {
        jb_i64(b, g_variant_get_int32(v));
    } else if (g_variant_type_equal(t, G_VARIANT_TYPE_UINT64)) {
        jb_u64(b, g_variant_get_uint64(v));
    } else if (g_variant_type_equal(t, G_VARIANT_TYPE_DOUBLE)) {
        jb_num(b, g_variant_get_double(v));
    } else if (g_variant_is_of_type(v, G_VARIANT_TYPE_ARRAY) ||
               g_variant_is_of_type(v, G_VARIANT_TYPE_TUPLE)) {
        jb_chr(b, '[');
        gsize n = g_variant_n_children(v);
        for (gsize i = 0; i < n; i++) {
            if (i) jb_chr(b, ',');
            GVariant *c = g_variant_get_child_value(v, i);
            gv_json(b, c);
            g_variant_unref(c);
        }
        jb_chr(b, ']');
    } else {
        char *s = g_variant_print(v, FALSE);
        jb_str(b, s);
        g_free(s);
    }
}

static void emit_chan_list(jl_buf *b, GSList *l)
{
    jb_chr(b, '[');
    int first = 1;
    for (; l; l = l->next) {
        const struct srd_channel *c = l->data;
        if (!c) continue;
        if (!first) jb_chr(b, ',');
        first = 0;
        jb_chr(b, '{');
        jb_key(b, "id"); jb_str(b, c->id ? c->id : ""); jb_chr(b, ',');
        jb_key(b, "name"); jb_str(b, c->name ? c->name : ""); jb_chr(b, ',');
        jb_key(b, "desc"); jb_str(b, c->desc ? c->desc : "");
        jb_chr(b, '}');
    }
    jb_chr(b, ']');
}

void emit_describe(jl_buf *b, const struct srd_decoder *dec)
{
    jb_chr(b, '{');
    jb_key(b, "id"); jb_str(b, dec->id ? dec->id : ""); jb_chr(b, ',');
    jb_key(b, "name"); jb_str(b, dec->name ? dec->name : ""); jb_chr(b, ',');
    jb_key(b, "longname"); jb_str(b, dec->longname ? dec->longname : ""); jb_chr(b, ',');
    jb_key(b, "desc"); jb_str(b, dec->desc ? dec->desc : ""); jb_chr(b, ',');
    jb_key(b, "inputs"); jb_chr(b, '[');
    for (GSList *l = dec->inputs; l; l = l->next) {
        if (l != dec->inputs) jb_chr(b, ',');
        jb_str(b, (const char *)l->data);
    }
    jb_raw(b, "],");
    jb_key(b, "channels"); emit_chan_list(b, dec->channels); jb_chr(b, ',');
    jb_key(b, "optional_channels"); emit_chan_list(b, dec->opt_channels); jb_chr(b, ',');
    jb_key(b, "options"); jb_chr(b, '[');
    int first = 1;
    for (GSList *l = dec->options; l; l = l->next) {
        const struct srd_decoder_option *o = l->data;
        if (!o) continue;
        if (!first) jb_chr(b, ',');
        first = 0;
        jb_chr(b, '{');
        jb_key(b, "id"); jb_str(b, o->id ? o->id : ""); jb_chr(b, ',');
        jb_key(b, "desc"); jb_str(b, o->desc ? o->desc : ""); jb_chr(b, ',');
        jb_key(b, "default"); gv_json(b, o->def); jb_chr(b, ',');
        jb_key(b, "values");
        if (o->values) {
            jb_chr(b, '[');
            int vf = 1;
            for (GSList *vl = o->values; vl; vl = vl->next) {
                if (!vf) jb_chr(b, ',');
                vf = 0;
                gv_json(b, (GVariant *)vl->data);
            }
            jb_chr(b, ']');
        } else jb_raw(b, "null");
        jb_chr(b, '}');
    }
    jb_raw(b, "]}");
}

void emit_decoders(jl_buf *b)
{
    jb_chr(b, '{');
    jb_key(b, "decoders"); jb_chr(b, '[');
    const GSList *l = srd_decoder_list();
    int first = 1;
    for (; l; l = l->next) {
        const struct srd_decoder *d = l->data;
        if (!d || !d->id) continue;
        if (!first) jb_chr(b, ',');
        first = 0;
        jb_chr(b, '{');
        jb_key(b, "id"); jb_str(b, d->id); jb_chr(b, ',');
        jb_key(b, "name"); jb_str(b, d->name ? d->name : ""); jb_chr(b, ',');
        jb_key(b, "longname"); jb_str(b, d->longname ? d->longname : "");
        jb_chr(b, '}');
    }
    jb_raw(b, "]}");
}

int decode_boot(const char *decoders_dir, const char *py_home_dir, char *err, int errlen)
{
    if (py_home_dir && *py_home_dir) {
        wchar_t w[1024];
        if (MultiByteToWideChar(CP_UTF8, 0, py_home_dir, -1, w, 1024) > 0)
            srd_set_python_home(w);
    }
    if (srd_init(decoders_dir) != SRD_OK) {
        snprintf(err, errlen, "srd_init 失败（解码器目录: %s）", decoders_dir);
        return -1;
    }
    /* Python>=3.8 加载 .pyd 依赖不再搜 PATH：显式登记 <py_home>in
       （如 libffi 给 _ctypes）。胶水层调用，不触碰官方源码。 */
    if (py_home_dir && *py_home_dir) {
        char cmd[1200];
        snprintf(cmd, sizeof cmd,
                 "import os; [os.add_dll_directory(_d) for _d in (r'%s\\bin', r'%s\\DLLs') if os.path.isdir(_d)]",
                 py_home_dir, py_home_dir);
        PyGILState_STATE g = PyGILState_Ensure();
        PyRun_SimpleString(cmd);
        PyGILState_Release(g);
    }
    if (srd_decoder_load_all() != SRD_OK) {
        snprintf(err, errlen, "srd_decoder_load_all 失败");
        return -1;
    }
    for (int i = 0; DSLCORE_REQUIRED_DECODERS[i]; i++) {
        if (!srd_decoder_get_by_id(DSLCORE_REQUIRED_DECODERS[i])) {
            snprintf(err, errlen, "必需解码器缺失: %s", DSLCORE_REQUIRED_DECODERS[i]);
            return -1;
        }
    }
    return 0;
}

int decode_run(jl_buf *b, cap_file *cf, jl_val *spec, char *err, int errlen)
{
    const char *dec_id = jl_str(spec, "id", NULL);
    if (!dec_id) { snprintf(err, errlen, "spec 缺 id"); return -1; }

    struct srd_session *sess = NULL;
    if (srd_session_new(&sess) != SRD_OK || !sess) {
        snprintf(err, errlen, "srd_session_new 失败"); return -1;
    }

    /* 逐层建实例（decoderstack.cpp:716-738） */
    struct srd_decoder_inst *prev = NULL;
    jl_val *st = jl_obj_get(spec, "stacked");
    int levels = 1 + (st && st->t == JL_ARR ? (int)st->nitems : 0);
    for (int lv = 0; lv < levels; lv++) {
        jl_val *sp = lv == 0 ? spec : st->items[lv - 1];
        const char *id = jl_str(sp, "id", NULL);
        if (!id) { snprintf(err, errlen, "stacked[%d] 缺 id", lv - 1); srd_session_destroy(sess); return -1; }
        if (!srd_decoder_get_by_id(id)) {
            snprintf(err, errlen, "解码器不存在: %s", id); srd_session_destroy(sess); return -1;
        }
        const struct srd_decoder *d = srd_decoder_get_by_id(id);
        GHashTable *oh = build_options(d, jl_obj_get(sp, "options"));
        struct srd_decoder_inst *di = srd_inst_new(sess, id, oh);
        g_hash_table_destroy(oh);
        if (!di) { snprintf(err, errlen, "srd_inst_new 失败: %s", id); srd_session_destroy(sess); return -1; }
        GHashTable *ph = build_pins(jl_obj_get(sp, "pins"));
        srd_inst_channel_set_all(di, ph);
        g_hash_table_destroy(ph);
        if (prev) srd_inst_stack(sess, prev, di);
        prev = di;
    }

    /* 找首个有通道的实例（decoderstack.cpp:512-520） */
    struct srd_decoder_inst *logic_di = NULL;
    for (GSList *d = sess->di_list; d; d = d->next) {
        struct srd_decoder_inst *di = d->data;
        if ((di->decoder->channels || di->decoder->opt_channels)) { logic_di = di; break; }
    }
    if (!logic_di) { snprintf(err, errlen, "无通道型解码器实例"); srd_session_destroy(sess); return -1; }

    /* 校验 pins 指向存在数据的通道 */
    for (int j = 0; j < logic_di->dec_num_channels; j++) {
        int idx = logic_di->dec_channelmap[j];
        if (idx == -1) continue;
        int chi = cap_find_ch(cf, idx);
        if (chi < 0 || !cf->chs[chi].bits) {
            snprintf(err, errlen, "解码通道绑定的探头 %d 不存在或无数据", idx);
            srd_session_destroy(sess); return -1;
        }
    }

    srd_session_metadata_set(sess, SRD_CONF_SAMPLERATE,
                             g_variant_new_uint64((uint64_t)cf->samplerate));

    ann_ctx cx = { b, 1, 0 };
    srd_pd_output_callback_add(sess, SRD_OUTPUT_ANN, ann_cb, &cx);

    jb_key(b, "annotations"); jb_chr(b, '[');

    char *srd_err_str = NULL;
    int rc = 0;
    if (srd_session_start(sess, &srd_err_str) != SRD_OK) {
        snprintf(err, errlen, "srd_session_start: %s", srd_err_str ? srd_err_str : "?");
        if (srd_err_str) g_free(srd_err_str);
        srd_session_destroy(sess);
        return -1;
    }

    /* decode_data 喂数循环（decoderstack.cpp:548-665） */
    uint64_t i = 0, end_index = cf->total_samples ? cf->total_samples - 1 : 0;
    int bEndTime = 0;
    const uint8_t **inbuf = calloc(logic_di->dec_num_channels, sizeof(uint8_t *));
    uint8_t *cst = calloc(logic_di->dec_num_channels, 1);

    while (i <= end_index) {
        uint64_t chunk_end = end_index;
        for (int j = 0; j < logic_di->dec_num_channels; j++) {
            int idx = logic_di->dec_channelmap[j];
            if (idx == -1) { inbuf[j] = NULL; cst[j] = 0; continue; }
            int chi = cap_find_ch(cf, idx);
            const uint8_t *bits = cf->chs[chi].bits;
            inbuf[j] = bits + (i >> 3);                 /* floor(i/8) 对齐 */
            cst[j] = (bits[i >> 3] >> (i & 7)) & 1;     /* 起始样本电平 */
        }
        if (chunk_end >= end_index) chunk_end = end_index + 1;
        if (chunk_end - i > MAX_CHUNK) chunk_end = i + MAX_CHUNK;
        bEndTime = chunk_end > end_index;

        if (srd_session_send(sess, i, chunk_end, inbuf, cst,
                             chunk_end - i, &srd_err_str) != SRD_OK) {
            snprintf(err, errlen, "srd_session_send: %s",
                     srd_err_str ? srd_err_str : "?");
            if (srd_err_str) g_free(srd_err_str);
            rc = -1;
            break;
        }
        i = chunk_end;
    }

    if (!rc && bEndTime) {
        if (srd_session_end(sess, &srd_err_str) != SRD_OK) {
            snprintf(err, errlen, "srd_session_end: %s", srd_err_str ? srd_err_str : "?");
            if (srd_err_str) g_free(srd_err_str);
            rc = -1;
        }
    }
    free(inbuf); free(cst);

    jb_raw(b, "],");
    jb_key(b, "count"); jb_u64(b, cx.count); jb_chr(b, ',');
    jb_key(b, "samplerate"); jb_num(b, cf->samplerate); jb_chr(b, ',');
    jb_key(b, "total_samples"); jb_u64(b, cf->total_samples);
    srd_session_destroy(sess);
    return rc;
}
