#!/usr/bin/env python3
"""Invoke an OpenMontage registry tool by name. Stdin: JSON {tool, inputs}. Stdout: JSON result."""
from __future__ import annotations
import json, os, sys, traceback
from pathlib import Path

def main() -> int:
    engine = Path(os.environ["OM_ENGINE_ROOT"]) if os.environ.get("OM_ENGINE_ROOT") else Path(__file__).resolve().parents[1] / "engine"
    sys.path.insert(0, str(engine))
    raw = sys.stdin.read() or "{}"
    try:
        payload = json.loads(raw)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid json: {e}"}))
        return 2
    name = str(payload.get("tool") or payload.get("tool_name") or "").strip()
    inputs = payload.get("inputs") or payload.get("args") or {}
    if not name:
        print(json.dumps({"ok": False, "error": "tool required"}))
        return 2
    if not isinstance(inputs, dict):
        inputs = {"instruction": str(inputs)}
    try:
        from tools.tool_registry import registry
        registry.discover()
        tool = registry.get(name)
        if tool is None:
            # try class-name style / fuzzy
            all_tools = {t.name: t for t in registry.list_all()}
            tool = all_tools.get(name)
        if tool is None:
            print(json.dumps({"ok": False, "error": f"unknown tool: {name}", "available_sample": [t.name for t in registry.list_all()[:30]]}))
            return 1
        result = tool.execute(inputs)
        if hasattr(result, "__dict__"):
            data = {k: getattr(result, k) for k in dir(result) if not k.startswith("_") and not callable(getattr(result, k))}
            # ToolResult common fields
            for key in ("success", "status", "message", "artifacts", "outputs", "data", "error"):
                if hasattr(result, key):
                    data[key] = getattr(result, key)
            out = {"ok": bool(getattr(result, "success", True)), "tool": name, "result": data}
        elif isinstance(result, dict):
            out = {"ok": True, "tool": name, "result": result}
        else:
            out = {"ok": True, "tool": name, "result": str(result)}
        print(json.dumps(out, ensure_ascii=False, default=str))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "tool": name, "error": str(e), "trace": traceback.format_exc()[-2000:]}))
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
