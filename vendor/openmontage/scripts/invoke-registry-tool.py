#!/usr/bin/env python3
"""Invoke an OpenMontage registry tool by name. Stdin: JSON {tool, inputs}. Stdout: JSON result."""
from __future__ import annotations
import json, os, sys, traceback, importlib, re
from pathlib import Path

def main() -> int:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
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
        vendor = Path(__file__).resolve().parents[1]
        policy = json.loads((vendor / "zora-policy.json").read_text(encoding="utf-8-sig"))
        if name not in policy["allowedTools"]:
            print(json.dumps({"ok": False, "error": "OM tool disabled by Zora local-media policy", "tool": name}))
            return 1
        catalog = json.loads((vendor / "tool-catalog.json").read_text(encoding="utf-8-sig"))
        entry = next((t for t in catalog["tools"] if t["name"] == name), None)
        if not entry:
            raise ValueError("Tool missing from bundled catalog")
        module_path = Path(entry["file"])
        if module_path.is_absolute() or ".." in module_path.parts or module_path.suffix != ".py":
            raise ValueError("Invalid bundled tool module")
        # Import only the explicitly allowed local tool; never discover GPU/model providers.
        stock_keys = {k: os.environ[k] for k in ("PEXELS_API_KEY", "UNSPLASH_ACCESS_KEY") if k in os.environ} if name == "direct_clip_search" else {}
        module = importlib.import_module("tools." + module_path.with_suffix("").as_posix().replace("/", "."))
        # BaseTool can load the engine .env at import; do not inherit those credentials.
        for key in list(os.environ):
            if re.search(r"API_KEY|ACCESS_KEY|TOKEN|SECRET|PASSWORD|CODEX|ANTHROPIC|OPENAI|DUOYUANX|MINIMAX|GPU_RENT|AUTODL|RUNPOD|VAST_AI", key, re.I):
                del os.environ[key]
        os.environ.update(stock_keys)
        if name == "direct_clip_search":
            from zora_stock_hooks import configure_stock_sources
            configure_stock_sources()
        tool = getattr(module, entry["className"])()
        if name == 'piper_tts':
            from zora_local_speech import configure_piper
            configure_piper(tool)
        if tool.name != name:
            raise ValueError("Tool metadata mismatch")
        if payload.get("mode") == "describe":
            print(json.dumps({"ok": True, "tool": name, "inputSchema": getattr(tool, "input_schema", {}), "dependencies": getattr(tool, "dependencies", []), "sideEffects": getattr(tool, "side_effects", [])}, ensure_ascii=False, default=str))
            return 0
        from jsonschema import validate
        validate(inputs, getattr(tool, "input_schema", {}))
        result = tool.execute(inputs)
        if hasattr(result, "__dict__"):
            data = {k: getattr(result, k) for k in dir(result) if not k.startswith("_") and not callable(getattr(result, k))}
            # ToolResult common fields
            for key in ("success", "status", "message", "artifacts", "outputs", "data", "error"):
                if hasattr(result, key):
                    data[key] = getattr(result, key)
            out = {"ok": bool(getattr(result, "success", True)), "tool": name, "result": data}
        elif isinstance(result, dict):
            out = {"ok": bool(result.get("success", result.get("ok", not result.get("error")))), "tool": name, "result": result}
        else:
            out = {"ok": True, "tool": name, "result": str(result)}
        print(json.dumps(out, ensure_ascii=False, default=str))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "tool": name, "error": str(e), "trace": traceback.format_exc()[-2000:]}))
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
