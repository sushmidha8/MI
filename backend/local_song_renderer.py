"""Offline synthetic singing: MMS voices, WORLD pitch/timing, supplied accompaniment.

Voice checkpoints are Meta MMS (CC-BY-NC 4.0). No external music service is used.
The output is an electronic synthesized singing voice, not a human performance.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import textwrap

BASE = Path(__file__).resolve().parent
ASSETS = BASE / "audio_assets"
RUNTIME = BASE / "audio_runtime"
OUTPUT = BASE / "static" / "lesson_songs"
ENGINE_VERSION = "mms-world-song-v3"
VOICE_CACHE_VERSION = "mms-world-song-v1"
SAMPLE_RATE = 24000


def audio_imports():
    if str(RUNTIME) not in sys.path:
        sys.path.insert(0, str(RUNTIME))
    os.environ.setdefault("USE_TF", "0")
    import numpy as np
    import soundfile as sf
    import pyworld as world
    import imageio_ffmpeg
    return np, sf, world, imageio_ffmpeg.get_ffmpeg_exe()


def lyric_lines(lyrics):
    return [part for line in lyrics.splitlines()
            if line.strip() and not re.fullmatch(r"\[[^\]]+\]", line.strip())
            for part in textwrap.wrap(line.strip().replace("—", ","), width=180, break_long_words=False)]


def english_number(value):
    small = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen").split()
    tens = "zero ten twenty thirty forty fifty sixty seventy eighty ninety".split()
    if value < 20:
        return small[value]
    if value < 100:
        return tens[value // 10] + (" " + small[value % 10] if value % 10 else "")
    for size, name in ((1_000_000, "million"), (1000, "thousand"), (100, "hundred")):
        if value >= size:
            return english_number(value // size) + " " + name + (" " + english_number(value % size) if value % size else "")


def speech_text(text, language):
    if language == "English":
        text = text.replace("°C", " degrees Celsius ").replace("°F", " degrees Fahrenheit ").replace("%", " percent ")
        def number(match):
            parts = match[0].split(".")
            return english_number(int(parts[0])) + (" point " + " ".join(english_number(int(n)) for n in parts[1]) if len(parts) == 2 else "")
        text = re.sub(r"\d+(?:\.\d+)?", number, text)
    else:
        # Preserve every digit where a local tokenizer otherwise drops numerals.
        digits = ["பூஜ்ஜியம்", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது"]
        text = re.sub(r"\d+", lambda m: " ".join(digits[int(n)] for n in m[0]), text)
    return re.sub(r"\s+", " ", text).strip()


def backing_fingerprint():
    path = ASSETS / "backing-track.weba"
    if not path.is_file():
        raise RuntimeError("The supplied background audio is missing.")
    return hashlib.sha256(path.read_bytes()).hexdigest()


class LocalSongRenderer:
    def __init__(self):
        self.voices = {}
        self.profile = None

    def prepare(self):
        np, sf, _, ffmpeg = audio_imports()
        ASSETS.mkdir(exist_ok=True)
        preview = ASSETS / "music-analysis.wav"
        if not preview.exists():
            subprocess.run([ffmpeg, "-v", "error", "-i", str(ASSETS / "backing-track.weba"),
                            "-t", "90", "-ar", str(SAMPLE_RATE), "-ac", "1", "-y", str(preview)],
                           check=True, capture_output=True)
        samples, sr = sf.read(preview)
        # Estimate pulse from spectral-flux autocorrelation, restricted to a
        # comfortable educational-song tempo. Fall back to a steady 96 BPM.
        from scipy.signal import stft, find_peaks, fftconvolve
        _, _, spectrum = stft(samples, sr, nperseg=1024, noverlap=768)
        magnitude = np.abs(spectrum)
        flux = np.maximum(np.diff(magnitude, axis=1), 0).sum(axis=0)
        flux -= flux.mean()
        corr = fftconvolve(flux, flux[::-1], mode="full")[len(flux) - 1:]
        fps = sr / 256
        lower, upper = int(fps * 60 / 128), int(fps * 60 / 72)
        peak = lower + int(np.argmax(corr[lower:upper]))
        bpm = float(60 * fps / peak) if corr[peak] > 0 else 96.0
        # Pick a tonal centre from prominent harmonic peaks in the music.
        chroma = np.zeros(12)
        frequencies = np.arange(magnitude.shape[0]) * sr / 1024
        mean_spectrum = magnitude.mean(axis=1)
        peaks, _ = find_peaks(mean_spectrum)
        for index in peaks:
            if 90 <= frequencies[index] <= 1800:
                midi = round(69 + 12 * math.log2(frequencies[index] / 440))
                chroma[midi % 12] += mean_spectrum[index]
        major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
        choices = [(float(np.dot(chroma, np.roll(template, tonic))), tonic, mode)
                   for mode, template in (("major", major), ("minor", minor)) for tonic in range(12)]
        _, tonic, mode = max(choices)
        self.profile = {"bpm": round(bpm, 2), "tonic": tonic, "mode": mode}
        (ASSETS / "music-profile.json").write_text(json.dumps(self.profile), encoding="utf-8")
        return self.profile

    def voice(self, language):
        if language not in self.voices:
            import torch
            from transformers import VitsModel, AutoTokenizer
            torch.set_num_threads(min(4, os.cpu_count() or 2))
            directory = ASSETS / "models" / language
            if not (directory / "model.safetensors").is_file():
                raise RuntimeError(f"The {language} voice model has not been installed.")
            model = VitsModel.from_pretrained(str(directory), local_files_only=True).eval()
            tokenizer = AutoTokenizer.from_pretrained(str(directory), local_files_only=True)
            self.voices[language] = (model, tokenizer)
        return self.voices[language]

    def sung_line(self, text, language, phrase):
        np, sf, world, _ = audio_imports()
        profile = self.profile or self.prepare()
        pronounced = speech_text(text, language)
        key = hashlib.sha256(json.dumps([VOICE_CACHE_VERSION, pronounced, language, phrase % 4, profile]).encode()).hexdigest()
        cache = ASSETS / "vocal_lines"
        cache.mkdir(exist_ok=True)
        target = cache / f"{key}.wav"
        if target.exists():
            return sf.read(target, dtype="float32")[0]
        import torch
        from scipy.signal import resample_poly, savgol_filter
        from scipy.interpolate import interp1d
        model, tokenizer = self.voice(language)
        # Convert printed list numbers and punctuation into speakable words;
        # bracketed section labels are excluded before synthesis.
        pronounced = re.sub(r"[•*]", " ", pronounced)
        inputs = tokenizer(pronounced, return_tensors="pt")
        if inputs["input_ids"].numel() < 2:
            raise RuntimeError("A lyric line could not be pronounced by the selected voice.")
        with torch.inference_mode():
            torch.manual_seed(42)
            wave = model(**inputs).waveform[0].float().numpy()
        sr = model.config.sampling_rate
        wave = np.asarray(wave, dtype=np.float64)
        if not len(wave) or not np.isfinite(wave).all():
            raise RuntimeError("Voice generation produced invalid audio.")
        # Remove only leading/trailing silence, retaining pauses inside words.
        audible = np.flatnonzero(np.abs(wave) > max(.003, np.max(np.abs(wave)) * .015))
        if len(audible):
            wave = wave[max(0, audible[0] - 320):min(len(wave), audible[-1] + 320)]
        f0, time_axis = world.dio(wave, sr, f0_floor=60, f0_ceil=500, frame_period=5)
        f0 = world.stonemask(wave, f0, time_axis, sr)
        spectral = world.cheaptrick(wave, f0, time_axis, sr)
        noise = world.d4c(wave, f0, time_axis, sr)
        beat = 60 / profile["bpm"]
        duration = len(wave) / sr
        # Whole bars place each line on the beat. Stretch voiced vowels more
        # than consonants so diction survives the longer sung note durations.
        beats = max(4, math.ceil((duration + .15) / (4 * beat)) * 4)
        target_duration = beats * beat - .12
        frames = max(2, round(target_duration / .005))
        voiced = f0 > 0
        stretch = target_duration / max(duration, .01)
        weights = np.where(voiced, max(1, 1 + (stretch - 1) / max(voiced.mean(), .2)), 1.0)
        timeline = np.cumsum(weights)
        positions = np.interp(np.linspace(timeline[0], timeline[-1], frames), timeline, np.arange(len(f0)))
        nearest = np.clip(np.rint(positions).astype(int), 0, len(f0) - 1)
        pitch_mid = float(np.median(f0[voiced])) if voiced.any() else 140
        base = 48 + profile["tonic"]
        if pitch_mid > 190:
            base += 12
        third = 3 if profile["mode"] == "minor" else 4
        patterns = [[0, 0, 2, third, 2, 0, 2, 0], [third, third, 5, 7, 5, third, 2, 0],
                    [7, 7, 5, third, 2, 2, third, 0], [third, 2, 0, 2, third, 2, 0, 0]]
        phases = np.arange(frames) * .005 / beat
        steps = np.floor(phases).astype(int) % 8
        midi = base + np.asarray(patterns[phrase % 4])[steps]
        hz = 440 * 2 ** ((midi - 69) / 12)
        # Brief glides and subtle vibrato avoid hard, buzzer-like note changes.
        hz = savgol_filter(hz, 11 if len(hz) >= 11 else 3, 1)
        hz *= 2 ** (.09 * np.sin(np.arange(frames) * .005 * 2 * np.pi * 5) / 12)
        new_f0 = np.where(voiced[nearest], hz, 0).astype(np.float64)
        new_spectral = interp1d(np.arange(len(f0)), spectral, axis=0)(positions).astype(np.float64)
        new_noise = interp1d(np.arange(len(f0)), noise, axis=0)(positions).astype(np.float64)
        sung = world.synthesize(new_f0, new_spectral, new_noise, sr, frame_period=5)
        sung = resample_poly(sung, SAMPLE_RATE, sr).astype(np.float32)
        rms = float(np.sqrt(np.mean(sung ** 2)))
        if rms < .0001:
            raise RuntimeError("Voice generation produced silence.")
        sung *= min(3.0, .12 / rms)
        sung = np.clip(sung, -.85, .85)
        full = np.zeros(round(beats * beat * SAMPLE_RATE), dtype=np.float32)
        full[:min(len(full), len(sung))] = sung[:len(full)]
        temporary = target.with_suffix(".tmp.wav")
        sf.write(temporary, full, SAMPLE_RATE, subtype="FLOAT")
        temporary.replace(target)
        return full

    def render(self, draft, song_id, progress=lambda *_: None):
        np, sf, _, ffmpeg = audio_imports()
        profile = self.profile or self.prepare()
        OUTPUT.mkdir(parents=True, exist_ok=True)
        lines = lyric_lines(draft["lyrics"])
        chunks = [np.zeros(round(2 * 60 / profile["bpm"] * SAMPLE_RATE), dtype=np.float32)]
        timings = []
        cursor = len(chunks[0]) / SAMPLE_RATE
        for i, line in enumerate(lines):
            progress("Recording vocals", i, len(lines))
            voice = self.sung_line(line, draft["language"], i)
            timings.append({"text": line, "start": round(cursor, 3), "end": round(cursor + len(voice) / SAMPLE_RATE, 3)})
            chunks.append(voice)
            cursor += len(voice) / SAMPLE_RATE
        chunks.append(np.zeros(round(4 * 60 / profile["bpm"] * SAMPLE_RATE), dtype=np.float32))
        vocal = np.concatenate(chunks)
        progress("Mixing background music", len(lines), len(lines))
        duration = len(vocal) / SAMPLE_RATE
        command = [ffmpeg, "-v", "error", "-stream_loop", "-1", "-i", str(ASSETS / "backing-track.weba"),
                   "-t", str(duration), "-ar", str(SAMPLE_RATE), "-ac", "2", "-f", "f32le", "pipe:1"]
        decoded = subprocess.run(command, check=True, capture_output=True).stdout
        music = np.frombuffer(decoded, dtype="<f4").reshape(-1, 2).copy()
        music = music[:len(vocal)]
        if len(music) < len(vocal):
            music = np.pad(music, ((0, len(vocal) - len(music)), (0, 0)))
        music_rms = float(np.sqrt(np.mean(music ** 2)))
        music *= .055 / max(music_rms, .001)
        # Duck accompaniment during vocals; keep breathing spaces musical.
        from scipy.ndimage import uniform_filter1d
        power = uniform_filter1d(vocal.astype(np.float64) ** 2, size=SAMPLE_RATE // 5)
        envelope = np.sqrt(np.maximum(power, 0))
        duck = 1 - .55 * np.clip(envelope / .06, 0, 1)
        stereo = music * duck[:, None] + vocal[:, None]
        # A quiet short echo adds sustain to synthesized notes without obscuring words.
        delay = int(.14 * SAMPLE_RATE)
        stereo[delay:] += vocal[:-delay, None] * .09
        fade = min(len(stereo) // 2, 2 * SAMPLE_RATE)
        stereo[:fade] *= np.linspace(0, 1, fade)[:, None]
        stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
        if not np.isfinite(stereo).all():
            raise RuntimeError("Audio mixing produced invalid samples.")
        peak = float(np.max(np.abs(stereo)))
        # Leave codec headroom: MP3 reconstruction can exceed PCM sample peaks.
        if peak > .75:
            stereo *= .75 / peak
        wav = OUTPUT / f"{song_id}.tmp.wav"
        mp3 = OUTPUT / f"{song_id}.mp3"
        sf.write(wav, stereo, SAMPLE_RATE, subtype="PCM_16")
        temporary = mp3.with_suffix(".tmp.mp3")
        subprocess.run([ffmpeg, "-v", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "160k", "-y", str(temporary)],
                       check=True, capture_output=True)
        temporary.replace(mp3)
        wav.unlink()
        return {"title": draft["title"], "lyrics": "\n".join(lines), "duration": round(duration, 2),
                "filename": mp3.name, "audio_url": f"http://localhost:8000/static/lesson_songs/{mp3.name}",
                "line_timings": timings, "voice_type": "synthetic singing"}
