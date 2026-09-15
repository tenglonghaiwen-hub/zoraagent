# Zora · OpenMontage vendor runtime

Bundled layout for the **造境桌面客户端** to host [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) dependencies.

## Layout

```
vendor/openmontage/
  runtime-manifest.json   # expected versions + relative paths
  runtime/
    node/                 # node.exe (win-x64)
    python/               # embedded Python 3.12+
    ffmpeg/bin/           # ffmpeg.exe + ffprobe.exe
    hyperframes/          # HyperFrames CLI + chrome-headless-shell (optional)
    codex/                # optional bundled Codex CLI
  engine/                 # OpenMontage source root (junction/clone; not emptied stubs)
  config/                 # example + local overrides
  projects/               # default project library (user data may live elsewhere)
  scripts/
    probe-runtime.mjs     # check what is present
    link-engine.ps1       # junction engine -> local OM checkout
    sync-runtime-from-om-release.ps1  # optional copy from OM win-unpacked resources/runtime
```

## Do not commit large binaries

Keep `runtime/**` executables out of git (see repo `.gitignore`). CI/release packs them into the installer.

## Wire up locally (dev)

1. Point engine at your checkout:
   ```powershell
   pwsh vendor/openmontage/scripts/link-engine.ps1 -Source "D:\ui\_review\OpenMontage-current"
   ```
2. Either install tools on PATH, or copy from an official OM desktop `win-unpacked\resources\runtime`:
   ```powershell
   pwsh vendor/openmontage/scripts/sync-runtime-from-om-release.ps1 -Source "...\win-unpacked\resources\runtime"
   ```
3. Probe:
   ```powershell
   node vendor/openmontage/scripts/probe-runtime.mjs
   ```

## Security

Only use **calesthio/OpenMontage**. Do not use lookalike `Open-Montage/OpenMontage` installers.
