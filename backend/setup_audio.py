"""Install local voice model data and import an accompaniment file.

python backend/setup_audio.py --backing "C:/path/to/background.weba"
Install requirements-audio.txt first. Model data is CC-BY-NC 4.0; see README.
"""
import argparse
from pathlib import Path
import shutil

import httpx

BASE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backing", type=Path)
    args = parser.parse_args()
    assets = BASE / "audio_assets"
    assets.mkdir(exist_ok=True)
    if args.backing:
        source = args.backing.resolve(strict=True)
        target = assets / "backing-track.weba"
        if source != target.resolve():
            shutil.copy2(source, target)
        for generated in ("music-analysis.wav", "music-profile.json"):
            (assets / generated).unlink(missing_ok=True)
    with httpx.Client(follow_redirects=True, timeout=120) as client:
        for language, code in (("English", "eng"), ("Tamil", "tam")):
            directory = assets / "models" / language
            directory.mkdir(parents=True, exist_ok=True)
            for name in ("config.json", "tokenizer_config.json", "vocab.json", "special_tokens_map.json", "model.safetensors"):
                target = directory / name
                if target.exists() and target.stat().st_size > (100_000_000 if name.endswith("safetensors") else 0):
                    continue
                print(f"Downloading {language}: {name}", flush=True)
                url = f"https://huggingface.co/facebook/mms-tts-{code}/resolve/main/{name}?download=true"
                with client.stream("GET", url) as response:
                    if response.status_code == 404 and name == "special_tokens_map.json":
                        continue
                    response.raise_for_status()
                    temporary = target.with_suffix(target.suffix + ".partial")
                    with temporary.open("wb") as output:
                        for chunk in response.iter_bytes(1024 * 1024):
                            output.write(chunk)
                    temporary.replace(target)
            print(f"{language} voice ready", flush=True)


if __name__ == "__main__":
    main()
