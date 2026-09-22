"""Use the embedded interpreter, never a pip launcher bound to a developer path."""
import importlib.util
import wave
from pathlib import Path

def configure_piper(tool):
    from tools.base_tool import ToolStatus, ToolResult
    tool.get_status = lambda: ToolStatus.AVAILABLE if importlib.util.find_spec('piper') else ToolStatus.UNAVAILABLE

    def generate(inputs):
        from piper import PiperVoice, SynthesisConfig
        output = Path(inputs.get('output_path', 'tts_output.wav'))
        output.parent.mkdir(parents=True, exist_ok=True)
        voice = PiperVoice.load(inputs['model'], use_cuda=False)
        config = SynthesisConfig(speaker_id=inputs.get('speaker_id', 0), length_scale=inputs.get('length_scale', 1.0))
        with wave.open(str(output), 'wb') as wav:
            voice.synthesize_wav(inputs['text'], wav, syn_config=config)
        return ToolResult(success=True, data={'output': str(output), 'format': 'wav', 'provider': 'piper', 'model': inputs['model']}, artifacts=[str(output)])

    tool._generate = generate
