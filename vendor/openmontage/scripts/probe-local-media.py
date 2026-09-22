import importlib
import json
result = {}
errors = {}
for key, module in [("fasterWhisper", "faster_whisper"), ("whisperX", "whisperx"), ("piper", "piper"), ("requests", "requests")]:
    try:
        importlib.import_module(module)
        result[key] = True
    except Exception as error:
        result[key] = False
        errors[key] = type(error).__name__
result["runtimeErrors"] = errors
print(json.dumps(result))
