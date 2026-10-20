"""A single local rendering worker with persistent, topic-specific cached results."""
import hashlib
import json
from pathlib import Path
from queue import Queue
import threading
import time
import traceback

from music_learning import MusicError, SongStore
from local_song_renderer import LocalSongRenderer, ENGINE_VERSION, OUTPUT, backing_fingerprint


class SongJobs:
    def __init__(self, store=None, renderer=None):
        self.store = store or SongStore()
        self.renderer = renderer or LocalSongRenderer()
        self.queue = Queue()
        self.active = set()
        self.thread = None
        self.backing_hash = None

    def fingerprint(self, draft):
        if self.backing_hash is None:
            self.backing_hash = backing_fingerprint()
        return hashlib.sha256(json.dumps([ENGINE_VERSION, self.backing_hash, draft["lyrics"],
            draft["language"], draft["title"]], ensure_ascii=False).encode()).hexdigest()

    def existing(self, draft):
        saved = self.store.get(self.fingerprint(draft))
        if saved and saved["status"] == "complete":
            filename = saved.get("recording", {}).get("filename", "")
            if not filename or not (OUTPUT / filename).is_file() or (OUTPUT / filename).stat().st_size < 512:
                return None
        return saved

    def ensure(self, draft, retry=False):
        if draft["language"] not in ("English", "Tamil"):
            raise MusicError("Choose English or Tamil.", 422)
        key = self.fingerprint(draft)
        with self.store.lock:
            saved = self.existing(draft)
            if saved and (saved["status"] == "complete" or key in self.active):
                return saved
            if saved and saved["status"] == "failed" and not retry:
                return saved
            if saved and saved["status"] == "failed" and time.time() - saved.get("updated_at", 0) < 10:
                raise MusicError("Wait a few seconds before retrying this song.", 429)
            saved = {"id": key, "status": "queued", "stage": "Preparing song", "title": draft["title"],
                     "lyrics": draft["lyrics"], "language": draft["language"], "created_at": time.time(),
                     "completed_lines": 0, "total_lines": 0}
            self.store.save(key, saved)
            self.active.add(key)
            self.queue.put((key, dict(draft)))
            if self.thread is None or not self.thread.is_alive():
                self.thread = threading.Thread(target=self._work, daemon=True, name="lesson-song-renderer")
                self.thread.start()
            return saved

    def status(self, key):
        saved = self.store.get(key)
        if not saved:
            raise MusicError("Song not found. Open your topic's learning page first.", 404)
        if saved["status"] in ("queued", "rendering") and key not in self.active:
            return self.ensure({"title": saved["title"], "language": saved["language"], "lyrics": saved["lyrics"]})
        return saved

    def _work(self):
        while True:
            key, draft = self.queue.get()
            try:
                def progress(stage, completed, total):
                    saved = self.store.get(key)
                    saved.update(status="rendering", stage=stage, completed_lines=completed,
                                 total_lines=total, updated_at=time.time())
                    self.store.save(key, saved)
                recording = self.renderer.render(draft, key, progress)
                saved = self.store.get(key)
                saved.update(status="complete", stage="Song ready", recording=recording, updated_at=time.time())
                self.store.save(key, saved)
            except Exception:
                traceback.print_exc()
                saved = self.store.get(key)
                saved.update(status="failed", error="The song could not be generated. Please try again.", updated_at=time.time())
                self.store.save(key, saved)
            finally:
                with self.store.lock:
                    self.active.discard(key)
                self.queue.task_done()
