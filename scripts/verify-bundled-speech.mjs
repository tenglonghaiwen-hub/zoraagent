import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.');
const assets=path.resolve(process.argv[3]||'outputs/om-speech-smoke-assets');
const vendor=path.join(root,'vendor/openmontage');
const script=String.raw`
import sys,json,wave
from pathlib import Path
vendor,assets=map(Path,sys.argv[1:3])
sys.path.insert(0,str(vendor/'engine'))
sys.path.insert(0,str(vendor/'scripts'))
import piper,faster_whisper,ctranslate2
for module in (piper,faster_whisper,ctranslate2):
 assert Path(module.__file__).resolve().is_relative_to(vendor.resolve()),module.__file__
from zora_local_speech import configure_piper
from tools.audio.piper_tts import PiperTTS
tts=PiperTTS();configure_piper(tts)
output=assets/'bundled-speech.wav'
result=tts.execute({'text':'你好，这是本地语音测试。今天阳光很好，我们一起制作视频。','model':str(assets/'zh_CN-huayan-medium.onnx'),'output_path':str(output)})
assert result.success,result.error
with wave.open(str(output)) as audio:
 assert audio.getnframes()>0
 duration=audio.getnframes()/audio.getframerate()
# Test-only offline model path: do not download weights or use the machine cache.
original=faster_whisper.WhisperModel
faster_whisper.WhisperModel=lambda size,**kw: original(str(assets/'whisper-base'),local_files_only=True,**kw)
ctranslate2.get_cuda_device_count=lambda:0
from tools.analysis.transcriber import Transcriber
transcription=Transcriber().execute({'input_path':str(output),'language':'zh','model_size':'base','output_dir':str(assets/'bundled-transcript')})
assert transcription.success,transcription.error
assert transcription.data['segments']
assert transcription.data['device']=='cpu'
print(json.dumps({'ok':True,'python':sys.executable,'duration':duration,'device':transcription.data['device'],'text':''.join(s['text'] for s in transcription.data['segments']),'modules':[piper.__file__,faster_whisper.__file__]},ensure_ascii=True))
`;
const result=JSON.parse(execFileSync(path.join(vendor,'runtime/python/python.exe'),['-c',script,vendor,assets],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONNOUSERSITE:'1',HF_HUB_OFFLINE:'1'}}));
fs.writeFileSync(path.join(assets,'bundled-speech-result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
