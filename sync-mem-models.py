#!/usr/bin/env python3
# sync-mem-models.py — 从 Magpie /v1/models 生成 .mem 模型目录,同步到
# Pi models.json 与 DSH cordis.patch.yml(单一数据源 = Magpie 通告列表)。
# 位于工作台插件目录(工具代码);Pi Drawer 模型选择器的刷新按钮会先调本脚本再 reload。
#
# 用法(插件目录下):
#   py sync-mem-models.py            # 同步已验证集合(INCLUDE_IDS)
#   py sync-mem-models.py --all      # 同步 Magpie 通告的全部模型
#   py sync-mem-models.py --dry-run  # 只打印差异,不写文件
#   py sync-mem-models.py --reasoning # 额外生成推理档位(未经实测,默认关)
#
# 上游切换不再依赖本脚本:上游由服务器 instance-upstream 组管理
# (grp-kvdoo4dz7a "Magpie LAN" → http://192.168.10.137:3425/v1)。

import argparse
import json
import re
import shutil
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

MAGPIE_URL = "http://127.0.0.1:3425/v1/models"
MAGPIE_KEY = "magpie"

PI_MODELS_JSON = Path.home() / ".pi" / "agent" / "models.json"
DSH_PATCH_YML = Path.home() / ".dsh" / "profiles" / "desktop" / "cordis.patch.yml"
PI_PROVIDER = "agentmemory"
DSH_BLOCK_ID = "llm-deepseek"  # deepseek-official 卡(.mem 模型都在这张卡下)

# 已端到端验证过 proxy→Magpie 链路的模型;--all 时忽略本表,仅排 EXCLUDE_IDS
INCLUDE_IDS = [
    "prize/claude-sonnet-5-5",
    "prize/claude-opus-5-5",
    "kiro/auto",
    "kiro/claude-sonnet-4.5",
    "workbuddy/glm-5.3",
    "workbuddy/deepseek-v4-pro",
    "workbuddy-ai/deepseek-v4.1-flash",
    "space-agent/gpt-6.1-sol",
    "space-agent/gpt-6-astra",
]
EXCLUDE_IDS = []

REASONING_KEYS = ["minimal", "low", "medium", "high", "xhigh", "max", "off"]


def fetch_models():
    req = urllib.request.Request(
        MAGPIE_URL, headers={"Authorization": f"Bearer {MAGPIE_KEY}"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)["data"]


def mem_name(m):
    label = m.get("magpie_label") or m["id"]
    return label.replace("· routing group", "· Auto").strip() + " .mem"


def pi_entry(m, reasoning=False):
    e = {
        "id": m["id"],
        "name": mem_name(m),
        "reasoning": bool(m.get("reasoning")) and reasoning,
        "input": m.get("modalities", {}).get("input", ["text"]),
        "contextWindow": m.get("context_window") or m.get("context_length"),
        "maxTokens": m.get("max_output_tokens") or 64000,
    }
    levels = [x["effort"] for x in m.get("supported_reasoning_levels") or [] if x.get("effort")]
    if e["reasoning"] and levels:
        e["thinkingLevelMap"] = {k: (k if k in levels else None) for k in REASONING_KEYS}
    return e


def dsh_entry_lines(m, reasoning=False):
    lines = [
        f'      - id: {m["id"]}',
        f"        name: {mem_name(m)}",
        f"        contextWindow: {m.get('context_window') or m.get('context_length')}",
    ]
    if m.get("max_output_tokens"):
        lines.append(f"        maxTokens: {m['max_output_tokens']}")
    mods = ", ".join(m.get("modalities", {}).get("input", ["text"]))
    lines.append(f"        inputModalities: [{mods}]")
    levels = [x["effort"] for x in m.get("supported_reasoning_levels") or [] if x.get("effort")]
    if reasoning and m.get("reasoning") and levels:
        lines.append("        reasoningEfforts:")
        lines += [f'          {"off" if k == "none" else k}: {k}' for k in levels]
    return lines


def backup(path):
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = path.with_name(f"{path.name}.bak-{ts}-memsync")
    shutil.copy2(path, dst)
    return dst


def sync_pi(models, dry, reasoning):
    data = json.loads(PI_MODELS_JSON.read_text(encoding="utf-8"))
    prov = data["providers"][PI_PROVIDER]
    old = [m["id"] for m in prov["models"]]
    new_entries = [pi_entry(m, reasoning) for m in models]
    if prov["models"] == new_entries:
        print(f"[pi] 模型目录无变化 ({len(new_entries)} 个)")
        return False
    print(f"[pi] {len(old)} → {len(new_entries)} 个模型")
    for e in new_entries:
        print(f"     + {e['id']}" if e["id"] not in old else f"       {e['id']}")
    for mid in old:
        if mid not in {e["id"] for e in new_entries}:
            print(f"     - {mid}")
    if dry:
        return False
    prov["models"] = new_entries
    b = backup(PI_MODELS_JSON)
    PI_MODELS_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"[pi] 已写入,备份 {b.name}")
    return True


def sync_dsh(models, dry, reasoning):
    text = DSH_PATCH_YML.read_text(encoding="utf-8")
    # 定位 "- id: llm-deepseek" 块内的 "    models:" 段,替换到块尾
    # (块尾 = 下一个 "- id:" 行或文件尾)
    block = re.search(
        rf"(?ms)^- id: {re.escape(DSH_BLOCK_ID)}\n(.*?)^    models:\n((?:      .*\n?)*)",
        text,
    )
    if not block:
        print("[dsh] 未找到 llm-deepseek 的 models: 段", file=sys.stderr)
        return False
    old_ids = re.findall(r"^      - id: (\S+)", block.group(2), re.M)
    new_ids = [m["id"] for m in models]
    new_models = "".join("\n".join(dsh_entry_lines(m)) + "\n" for m in models)
    if block.group(2) == new_models:
        print(f"[dsh] 模型目录无变化 ({len(new_ids)} 个)")
        return False
    print(f"[dsh] {len(old_ids)} → {len(new_ids)} 个模型")
    for mid in new_ids:
        print(f"     + {mid}" if mid not in old_ids else f"       {mid}")
    for mid in old_ids:
        if mid not in new_ids:
            print(f"     - {mid}")
    if dry:
        return False
    out = text[: block.start(2)] + new_models + text[block.end(2):]
    b = backup(DSH_PATCH_YML)
    DSH_PATCH_YML.write_text(out, encoding="utf-8")
    print(f"[dsh] 已写入,备份 {b.name}")
    return True


def main():
    ap = argparse.ArgumentParser(description="同步 Magpie 模型目录到 .mem 客户端配置")
    ap.add_argument("--all", action="store_true", help="同步全部通告模型(忽略 INCLUDE_IDS)")
    ap.add_argument("--reasoning", action="store_true", help="同时生成推理档位(默认关闭,与已验证形态一致)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    models = fetch_models()
    if not args.all:
        keep = set(INCLUDE_IDS) - set(EXCLUDE_IDS)
        models = [m for m in models if m["id"] in keep]
        missing = keep - {m["id"] for m in models}
        if missing:
            print(f"!! Magpie 未通告: {sorted(missing)}", file=sys.stderr)
    else:
        models = [m for m in models if m["id"] not in EXCLUDE_IDS]
    if not models:
        sys.exit("无可用模型,中止")

    print(f"Magpie 通告 {len(models)} 个模型进入 .mem 目录:")
    changed = sync_pi(models, args.dry_run, args.reasoning)
    changed |= sync_dsh(models, args.dry_run, args.reasoning)
    if args.dry_run:
        print("(dry-run,未写文件)")
    elif changed:
        print("完成。重启 Pi / DSH 后生效。")


if __name__ == "__main__":
    main()
