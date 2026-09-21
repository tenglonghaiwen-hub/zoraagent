# Third-party notices

## Bundled desktop components

OpenMontage source is from https://github.com/calesthio/OpenMontage. Its AGPL-3.0 license is preserved at `vendor/openmontage/engine/LICENSE` in the desktop payload; the source revision and file hashes are recorded in `vendor/openmontage/bundle.json` and `bundle-files.json`. This snapshot includes local working-tree changes, rather than claiming to be an unmodified upstream release.

Node and Codex license texts are included under `licenses/`. FFmpeg's supplied license is retained under `runtime/ffmpeg/`. Python and npm runtime dependencies retain their packaged license and distribution metadata. This local test package has not been published as a signed production release.

## Local speech runtime

The Windows speech payload includes faster-whisper 1.2.1 (MIT), Piper TTS 1.8.0 (GPL-3.0), and their binary wheel dependencies. Distribution metadata and included license files are retained under `vendor/openmontage/runtime/python/media-site`. Reproducible wheel versions and SHA256 hashes are in `vendor/openmontage/speech-requirements.lock`. Upstream source: https://github.com/SYSTRAN/faster-whisper and https://github.com/OHF-Voice/piper1-gpl (v1.8.0). Piper includes eSpeak NG components with their own included notices. This local installer does not include any voice weights or Whisper model weights. A downloaded voice's separate model license must be checked before redistributing it.

## Interface attribution

Send button adapted from https://uiverse.io/prikshit_1236/loud-fly-32 and the code supplied by the user. Colors adapted to monochrome; native CSS instead of styled-components.

MIT License
Copyright - 2026 prikshit_1236 (X man)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 桌面更新与文档运行库（2026-09-21）

新增 electron-updater 6.6.2、PptxGenJS 4.0.1、ExcelJS 4.4.0、docx 9.7.1、pdf-lib 1.17.1，均为 MIT 许可；依赖版本锁定于 package-lock.json，许可证随各包目录提供。
