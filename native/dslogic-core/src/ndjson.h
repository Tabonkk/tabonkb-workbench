/* ndjson — stdin/stdout NDJSON 信封（与 dslogic_worker.py 契约一致）：
 *   请求:  {"id":n,"method":"info","params":{...}}\n
 *   响应:  {"id":n,"ok":true,"data":{...}}\n
 *         {"id":n,"ok":false,"error":"中文原因"}\n
 *   hello: {"id":0,"ok":true,"data":{"ready":true,...}}\n
 */
#ifndef DSLCORE_NDJSON_H
#define DSLCORE_NDJSON_H

#include "jsonlite.h"

/* 读一行 stdin（动态缓冲）；EOF/错误返回 NULL。行不含 \n。 */
char *rpc_read_line(void);

/* 发送 {id,ok:true,data:<data_json_raw>}；data_json_raw 为已序列化 JSON 片段 */
void  rpc_respond_raw(jl_val *id, const char *data_json_raw);

/* 发送 {id,ok:false,error:msg} */
void  rpc_respond_err(jl_val *id, const char *msg);

/* hello 帧 */
void  rpc_hello_ok(const char *data_json_raw);
void  rpc_hello_err(const char *msg);

/* 通用输出 {"id":id,...} 外壳——body 由调用方通过 jb 填充后调 rpc_flush */
void  rpc_begin(jl_buf *b, jl_val *id);
void  rpc_flush(jl_buf *b);

#endif
