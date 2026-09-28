"""Explicit user-triggered preparation; never download on a read-only check."""
import json
import sys
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
    from faster_whisper import WhisperModel
    from faster_whisper.utils import download_model
    import faster_whisper.utils as utils
    if action == "download":
        utils.disabled_tqdm = Progress
    folder = download_model(model, local_files_only=action != "download")
    progress_active = False
    report(phase="verifying", message="正在检查模型能否在 CPU 上加载")
    loaded = WhisperModel(folder, device="cpu", compute_type="int8", local_files_only=True)
    report(phase="ready", message="转录模型已就绪")
except Exception as error:
    progress_active = False
    chain = []
    current = error
    while current is not None and len(chain) < 8:
        chain.append(type(current).__name__)
        current = current.__cause__ or current.__context__
    diagnostic = (str(error) + " " + " ".join(chain)).lower()
    reason = "模型下载或加载失败"
    if type(error).__name__ == "LocalEntryNotFoundError" and action != "download":
        reason = "本机尚未缓存此模型，请点击下载/重试"
    elif "proxy" in diagnostic:
        reason = "代理连接失败，请检查代理软件及 HTTP 端口"
    elif "ssl" in diagnostic or "certificate" in diagnostic:
        reason = "TLS 证书校验失败，请检查系统时间与代理证书"
    elif "timeout" in diagnostic or "timed out" in diagnostic:
        reason = "连接模型下载源超时，请检查代理或稍后重试"
    elif "connection" in diagnostic or "resolve" in diagnostic:
        reason = "无法连接模型下载源，请检查网络与代理"
    elif getattr(error, "errno", None) == 28 or "no space left" in diagnostic:
        reason = "磁盘空间不足或缓存写入失败"
    elif "permission" in diagnostic or getattr(error, "errno", None) == 13:
        reason = "模型缓存目录没有写入权限"
    elif isinstance(error, (ImportError, ModuleNotFoundError)):
        reason = "模型运行库加载失败，请检查包内运行库及 Microsoft C++ 组件"
    report(phase="error" if action == "download" else "missing",
           message=reason + "（" + "/".join(chain) + "）", errorType=type(error).__name__)
    sys.exit(1)
