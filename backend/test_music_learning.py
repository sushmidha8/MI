"""Song workflow tests use a fake provider and never spend music credits."""
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

import main
from music_learning import MusicError, SongStore, SunoSongs, textbook_lyrics, music_configuration, recording_for


class SongTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = SongStore(Path(self.temp.name) / "songs.db")
        self.client = TestClient(main.app)
        self.draft = textbook_lyrics({"title": "Length", "page_start": 5, "page_end": 6,
            "learning_sections": [{"points": ["Length is the distance between two points.",
                "The metre is its SI unit.", "Look straight down to avoid parallax error."]}]}, "English")

    def provider(self, responses):
        provider = Mock()
        provider.generate.return_value = "task-1"
        provider.status.side_effect = responses
        return SunoSongs(self.store, provider), provider

    def test_rhymes_preserve_every_textbook_fact(self):
        for fact in self.draft["facts"]:
            self.assertIn(fact.rstrip('.'), self.draft["lyrics"])
        self.assertIn("[Chorus]", self.draft["lyrics"])
        self.assertIn("know,", self.draft["lyrics"])
        self.assertIn("flow.", self.draft["lyrics"])
        self.assertIn("clear English lead vocals", self.draft["style"])

    def test_tamil_source_and_rhyme_are_kept(self):
        selected = {"title": "நீளம்", "page_start": 5, "page_end": 6,
                    "learning_sections": [{"points": ["இரு புள்ளிகளுக்கு இடையே உள்ள தொலைவே நீளம்."]}]}
        draft = textbook_lyrics(selected, "Tamil")
        self.assertIn("இரு புள்ளிகளுக்கு இடையே உள்ள தொலைவே நீளம்", draft["lyrics"])
        self.assertIn("அறிந்திடுவோம்", draft["lyrics"])
        self.assertIn("clear Tamil lead vocals", draft["style"])

    def test_ai_failure_preserves_accurate_local_lyrics(self):
        model = Mock()
        model.generate_content.side_effect = RuntimeError("unavailable")
        selected = {"title": "Length", "page_start": 5, "page_end": 6,
                    "learning_sections": [{"points": ["Length is measured in metres."]}]}
        draft = textbook_lyrics(selected, "English", model)
        self.assertIn("Length is measured in metres", draft["lyrics"])
        self.assertEqual(draft["lyrics_origin"], "Textbook facts with rhyming refrains")

    def test_official_provider_requires_documentation_before_any_request(self):
        self.assertFalse(music_configuration()["configured"])
        self.assertEqual(music_configuration()["provider"], "Suno")
        with self.assertRaises(MusicError) as error:
            SunoSongs(self.store).generate(self.draft)
        self.assertEqual(error.exception.status, 503)
        self.assertIn("official Suno", str(error.exception))

    def test_submit_uses_exact_lyrics_and_reuses_persisted_job(self):
        songs, provider = self.provider([])
        first = songs.generate(self.draft)
        restarted = SunoSongs(SongStore(self.store.path), provider)
        self.assertEqual(restarted.generate(self.draft)["id"], first["id"])
        provider.generate.assert_called_once_with(self.draft)
        self.assertEqual(first["lyrics"], self.draft["lyrics"])
        self.assertEqual(first["provider"], "Suno")

    def test_pending_then_streaming_then_complete_filters_unsafe_urls(self):
        songs, provider = self.provider([
            {"status": "pending"},
            {"status": "streaming", "tracks": [
                {"id": "a", "audio_url": "javascript:alert(1)"},
                {"id": "b", "audio_url": "https://audio.example/one.mp3"}]},
            {"status": "complete", "tracks": [
                {"id": "b", "audio_url": "https://audio.example/one.mp3"},
                {"id": "c", "audio_url": "https://audio.example/two.mp3"}]},
        ])
        song = songs.generate(self.draft)
        self.assertEqual(songs.status(song["id"])["status"], "pending")
        streaming = songs.status(song["id"])
        self.assertEqual(streaming["status"], "streaming")
        self.assertEqual(len(streaming["tracks"]), 1)
        complete = songs.status(song["id"])
        self.assertEqual(complete["status"], "complete")
        self.assertEqual(len(complete["tracks"]), 2)
        songs.status(song["id"])
        self.assertEqual(provider.status.call_count, 3)

    def test_failure_and_timeout_leave_no_fake_audio(self):
        songs, _ = self.provider([{"status": "failed"}])
        song = songs.generate(self.draft)
        failed = songs.status(song["id"])
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(failed["tracks"], [])
        failed.update(status="pending", created_at=time.time() - 1300)
        self.store.save(song["id"], failed)
        self.assertIn("timed out", songs.status(song["id"])["error"])

    def test_invalid_selection_does_not_reach_provider(self):
        result = self.client.post('/api/music/generate', json={"topic_key": "t3_ch6", "language": "English", "subtopic_key": "invalid"})
        self.assertEqual(result.status_code, 422)

    def test_api_returns_topic_specific_draft_and_no_secrets(self):
        with patch.object(main, 'suno_songs', SunoSongs(self.store)), patch.object(main, 'get_gemini_client', return_value=None):
            result = self.client.post('/api/music/lyrics', json={"topic_key": "t3_ch6", "subtopic_key": "6.3.2", "language": "English"})
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertEqual(data["title"], "Application Software")
        self.assertIn("hard disk", data["lyrics"])
        self.assertIn("drawing tools", data["lyrics"].lower())
        self.assertNotIn("Heat", data["lyrics"])
        self.assertNotIn("fixture-key", result.text)

    def test_software_song_uses_readable_tamil_despite_pdf_font_mapping(self):
        with patch.object(main, 'suno_songs', SunoSongs(self.store)), patch.object(main, 'get_gemini_client', return_value=None):
            result = self.client.post('/api/music/lyrics', json={"topic_key": "t3_ch6", "subtopic_key": "6.3", "language": "Tamil"})
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertEqual(data["title"], "மென்பொருளின் வகைகள்")
        self.assertIn("இயக்க முறைமை", data["lyrics"])
        self.assertIn("வன்தட்டில்", data["lyrics"])

    def test_shared_recording_only_appears_in_covered_english_topics(self):
        for key in ('6.3', '6.3.1', '6.3.2'):
            recording = recording_for('t3_ch6', key, 'English')
            self.assertEqual(recording['title'], 'Software Song')
            self.assertEqual(recording['embed_url'], 'https://suno.com/embed/0f2a8431-fad2-4d40-9499-260b9b70527f')
            self.assertIn('Word processors help us write', recording['lyrics'])
        self.assertIsNone(recording_for('t3_ch6', '6.3', 'Tamil'))
        self.assertIsNone(recording_for('t2_ch1', '1.1', 'English'))

    def test_lyrics_endpoint_returns_recording_and_matching_sung_lyrics(self):
        with patch.object(main, 'suno_songs', SunoSongs(self.store)), patch.object(main, 'get_gemini_client', return_value=None):
            result = self.client.post('/api/music/lyrics', json={"topic_key": "t3_ch6", "subtopic_key": "6.3", "language": "English"})
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertEqual(data['lyrics'], data['recording']['lyrics'])


if __name__ == '__main__':
    unittest.main()
