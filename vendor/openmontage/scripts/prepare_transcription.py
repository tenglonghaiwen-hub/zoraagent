"""Explicit user-triggered preparation; never download on a read-only check."""
import json
import sys
from faster_whisper import WhisperModel
from faster_whisper.utils import download_model
import faster_whisper.utils as utils
from tqdm import tqdm

def report(**data):
    print(json.dumps(data), flush=True)

progress_active = True

class Progress(tqdm):
    def display(self, *args, **kwargs):
        if progress_active and self.total:
            report(phase="downloading", done=self.n, total=self.total,
                   unit=self.unit, message="正在下载转录模型")

model, action = sys.argv[1:3]
if model not in ["tiny", "base", "small", "medium", "large-v2", "large-v3"]:
    raise ValueError("Unsupported model")
try:
    if action == "download":
        utils.disabled_tqdm = Progress
    folder = download_model(model, local_files_only=action != "download")
    progress_active = False
    report(phase="verifying", message="正在检查模型能否在 CPU 上加载")
    loaded = WhisperModel(folder, device="cpu", compute_type="int8", local_files_only=True)
    report(phase="ready", message="转录模型已就绪")
except Exception:
    progress_active = False
    report(phase="error" if action == "download" else "missing",
           message="模型准备失败，请检查网络、磁盘空间后重试" if action == "download" else "模型未缓存或无法加载，请点击下载/重试")
    sys.exit(1)
