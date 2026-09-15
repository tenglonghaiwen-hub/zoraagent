#!/usr/bin/env python3
"""Read-only scene analysis and approval-gated 2-7 second reference splitting."""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path


PTS_RE = re.compile(r"pts_time:([0-9]+(?:\.[0-9]+)?)")
SUGGESTED_GENERATION_MINIMUM = 2


def tool_path(explicit: str | None, name: str) -> str:
    if explicit:
        return explicit
    found = shutil.which(name)
    if not found:
        raise SystemExit(f"{name} was not found. Pass --{name} with an absolute path.")
    return found


def run_json(cmd: list[str]) -> dict:
    result = subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf-8")
    return json.loads(result.stdout)


def probe(path: Path, ffprobe: str) -> dict:
    data = run_json([
        ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ])
    video = next((s for s in data["streams"] if s.get("codec_type") == "video"), None)
    audio = next((s for s in data["streams"] if s.get("codec_type") == "audio"), None)
    if not video:
        raise SystemExit("Input has no video stream.")
    rate = video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"
    num, den = (float(v) for v in rate.split("/"))
    fps = num / den if den else 0.0
    duration = float(data["format"]["duration"])
    return {
        "input": str(path.resolve()),
        "duration": duration,
        "size": int(data["format"].get("size", 0)),
        "video": {
            "codec": video.get("codec_name"),
            "width": video.get("width"),
            "height": video.get("height"),
            "fps": fps,
            "frames": int(video["nb_frames"]) if video.get("nb_frames", "").isdigit() else round(duration * fps),
        },
        "audio": None if not audio else {
            "codec": audio.get("codec_name"),
            "sample_rate": int(audio.get("sample_rate", 0)),
            "channels": audio.get("channels"),
        },
    }


def scene_cuts(path: Path, ffmpeg: str, threshold: float) -> list[float]:
    vf = f"select='gt(scene,{threshold})',showinfo"
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(path), "-vf", vf, "-an", "-f", "null", "-"],
        check=False, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    cuts = []
    for line in result.stderr.splitlines():
        if "showinfo" not in line or "pts_time:" not in line:
            continue
        match = PTS_RE.search(line)
        if match:
            cuts.append(float(match.group(1)))
    return sorted(set(cuts))


def make_segments(duration: float, cuts: list[float], minimum: float, maximum: float) -> list[dict]:
    if duration <= 0:
        raise SystemExit("Duration must be positive.")
    if duration < minimum:
        return [{
            "index": 1,
            "start": 0.0,
            "end": duration,
            "source_duration": duration,
            "reference_duration": minimum,
            "padding": minimum - duration,
            "boundary": "source_end_with_motion_or_hold_extension",
            "suggested_h3_duration": max(SUGGESTED_GENERATION_MINIMUM, math.ceil(minimum)),
        }]

    boundaries = [0.0]
    current = 0.0
    while duration - current > maximum + 1e-6:
        low = current + minimum
        high = min(current + maximum, duration - minimum)
        valid = [c for c in cuts if low <= c <= high]
        target = min(current + 6.0, high)
        boundary = min(valid, key=lambda c: abs(c - target)) if valid else high
        if boundary <= current:
            raise SystemExit("Could not construct valid 2-7 second segments.")
        boundaries.append(boundary)
        current = boundary
    boundaries.append(duration)

    segments = []
    for index, (start, end) in enumerate(zip(boundaries, boundaries[1:]), 1):
        length = end - start
        if length < minimum - 1e-4 or length > maximum + 1e-4:
            raise SystemExit(f"Planned segment {index} violates bounds: {length:.6f}s")
        natural = any(abs(end - c) <= 0.05 for c in cuts) or abs(end - duration) <= 0.05
        suggested = max(SUGGESTED_GENERATION_MINIMUM, min(7, math.floor(length + 0.5)))
        segments.append({
            "index": index,
            "start": round(start, 6),
            "end": round(end, 6),
            "source_duration": round(length, 6),
            "reference_duration": round(length, 6),
            "padding": 0.0,
            "boundary": "natural_cut" if natural else "constructed_boundary",
            "suggested_h3_duration": suggested,
        })
    return segments


def analyze(args: argparse.Namespace) -> dict:
    source = Path(args.input)
    if not source.is_file():
        raise SystemExit(f"Input not found: {source}")
    ffprobe = tool_path(args.ffprobe, "ffprobe")
    ffmpeg = tool_path(args.ffmpeg, "ffmpeg")
    info = probe(source, ffprobe)
    cuts = scene_cuts(source, ffmpeg, args.scene_threshold)
    info["scene_cuts"] = cuts
    info["segment_constraints"] = {
        "reference_minimum": args.minimum,
        "reference_maximum": args.maximum,
        "suggested_generation_minimum": SUGGESTED_GENERATION_MINIMUM,
        "duration_policy": "use_script_minimum_without_official_clamp",
    }
    info["segments"] = make_segments(info["duration"], cuts, args.minimum, args.maximum)
    info["approval_required_before_writes"] = True
    return info


def split(args: argparse.Namespace) -> None:
    if not args.approved:
        raise SystemExit("Refusing to write: pass --approved only after the user confirms the displayed plan.")
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    source = Path(plan["input"])
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg = tool_path(args.ffmpeg, "ffmpeg")
    has_audio = bool(plan.get("audio"))

    for segment in plan["segments"]:
        duration = float(segment["source_duration"])
        pad = float(segment.get("padding", 0.0))
        target = duration + pad
        name = f"{source.stem}_part_{segment['index']:02d}_{target:.3f}s.mp4"
        destination = output_dir / name
        if destination.exists():
            raise SystemExit(f"Refusing to overwrite existing file: {destination}")
        video_filter = f"trim=start={segment['start']}:end={segment['end']},setpts=PTS-STARTPTS"
        if pad > 0:
            video_filter += f",tpad=stop_mode=clone:stop_duration={pad}"
        cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-n", "-i", str(source)]
        if has_audio:
            audio_filter = f"atrim=start={segment['start']}:end={segment['end']},asetpts=PTS-STARTPTS"
            if pad > 0:
                audio_filter += f",apad=pad_dur={pad}"
            cmd += [
                "-filter_complex", f"[0:v]{video_filter}[v];[0:a]{audio_filter}[a]",
                "-map", "[v]", "-map", "[a]",
            ]
        else:
            cmd += ["-vf", video_filter, "-an"]
        cmd += [
            "-t", f"{target:.6f}", "-c:v", "libx264", "-crf", "17", "-preset", "medium",
            "-pix_fmt", "yuv420p",
        ]
        if has_audio:
            cmd += ["-c:a", "aac", "-b:a", "192k"]
        cmd += ["-movflags", "+faststart", str(destination)]
        subprocess.run(cmd, check=True)
        print(destination)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--ffmpeg")
    common.add_argument("--ffprobe")

    p_analyze = sub.add_parser("analyze", parents=[common], help="Read-only metadata, cut and segment plan")
    p_analyze.add_argument("--input", required=True)
    p_analyze.add_argument("--minimum", type=float, default=2.0)
    p_analyze.add_argument("--maximum", type=float, default=7.0)
    p_analyze.add_argument("--scene-threshold", type=float, default=0.15)
    p_analyze.add_argument("--plan-out", help="Write JSON only after user approval")

    p_split = sub.add_parser("split", parents=[common], help="Create reference copies from an approved plan")
    p_split.add_argument("--plan", required=True)
    p_split.add_argument("--output-dir", required=True)
    p_split.add_argument("--approved", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "analyze":
        plan = analyze(args)
        rendered = json.dumps(plan, ensure_ascii=False, indent=2)
        print(rendered)
        if args.plan_out:
            Path(args.plan_out).write_text(rendered + "\n", encoding="utf-8")
        return 0
    split(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
