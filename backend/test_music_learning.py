"""Local lyric, render-queue, cache, and topic selection checks."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
import main
from music_learning import MusicError, SongStore, textbook_lyrics
from local_songs import SongJobs
from local_song_renderer import lyric_lines, speech_text


class SongTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = SongStore(self.root / 'songs.db')
        self.out_patch = patch('local_songs.OUTPUT', self.root)
        self.out_patch.start()
        self.addCleanup(self.out_patch.stop)
        self.hash_patch = patch('local_songs.backing_fingerprint', return_value='fixture-backing')
        self.hash_patch.start()
        self.addCleanup(self.hash_patch.stop)
        self.client = TestClient(main.app)
        self.draft = textbook_lyrics({'title': 'Length', 'page_start': 5, 'page_end': 6,
            'learning_sections': [{'points': ['Length is the distance between two points.',
                'The metre is its SI unit.', 'Look straight down to avoid parallax error.']}]}, 'English')

    def jobs(self):
        renderer = Mock()
        def render(draft, key, progress):
            progress('Recording vocals', 1, 2)
            name = key + '.mp3'
            (self.root / name).write_bytes(b'audio-fixture' * 100)
            return {'title': draft['title'], 'lyrics': draft['lyrics'], 'filename': name,
                    'audio_url': 'http://localhost:8000/static/lesson_songs/' + name}
        renderer.render.side_effect = render
        return SongJobs(self.store, renderer), renderer

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


    def test_section_labels_are_not_sung(self):
        self.assertEqual(lyric_lines('[Verse 1]\nFirst fact.\n\n[Chorus]\nSing it back.'),
                         ['First fact.', 'Sing it back.'])

    def test_numbers_and_units_are_pronounced_instead_of_dropped(self):
        self.assertEqual(speech_text('100°C and 2.5%', 'English'), 'one hundred degrees Celsius and two point five percent')
        self.assertIn('ஒன்று பூஜ்ஜியம்', speech_text('10', 'Tamil'))

    def test_long_text_is_split_without_losing_words(self):
        text = ' '.join(['measurement'] * 70)
        lines = lyric_lines('[Verse]\n' + text)
        self.assertGreater(len(lines), 1)
        self.assertEqual(' '.join(lines), text)

    def test_same_lyrics_are_queued_once_and_finished_audio_is_reused(self):
        jobs, renderer = self.jobs()
        first = jobs.ensure(self.draft)
        jobs.ensure(self.draft)
        jobs.queue.join()
        finished = jobs.status(first['id'])
        self.assertEqual(finished['status'], 'complete')
        self.assertEqual(finished['recording']['lyrics'], self.draft['lyrics'])
        restarted = SongJobs(SongStore(self.store.path), renderer)
        self.assertEqual(restarted.ensure(self.draft)['status'], 'complete')
        renderer.render.assert_called_once()

    def test_another_topic_language_or_backing_has_a_separate_song(self):
        jobs, _ = self.jobs()
        first = jobs.fingerprint(self.draft)
        self.assertNotEqual(first, jobs.fingerprint({**self.draft, 'lyrics': 'A different topic.'}))
        self.assertNotEqual(first, jobs.fingerprint({**self.draft, 'language': 'Tamil'}))
        jobs.backing_hash = 'another-backing'
        self.assertNotEqual(first, jobs.fingerprint(self.draft))

    def test_missing_cached_file_is_rendered_again(self):
        jobs, renderer = self.jobs()
        first = jobs.ensure(self.draft)
        jobs.queue.join()
        (self.root / (first['id'] + '.mp3')).unlink()
        jobs.ensure(self.draft)
        jobs.queue.join()
        self.assertEqual(renderer.render.call_count, 2)

    def test_render_failure_can_be_retried_without_fake_audio(self):
        jobs, renderer = self.jobs()
        renderer.render.side_effect = RuntimeError('fixture failure')
        with patch('local_songs.traceback.print_exc'):
            first = jobs.ensure(self.draft)
            jobs.queue.join()
        failed = jobs.status(first['id'])
        self.assertEqual(failed['status'], 'failed')
        self.assertNotIn('recording', failed)
        jobs.ensure(self.draft)
        self.assertEqual(renderer.render.call_count, 1)
        failed['updated_at'] = 0
        self.store.save(first['id'], failed)
        renderer.render.side_effect = lambda draft, key, progress: {'filename': 'retry.mp3', 'lyrics': draft['lyrics']}
        jobs.ensure(self.draft, retry=True)
        jobs.queue.join()
        self.assertEqual(renderer.render.call_count, 2)

    def test_interrupted_pending_job_resumes_on_status_poll(self):
        jobs, renderer = self.jobs()
        key = jobs.fingerprint(self.draft)
        self.store.save(key, {'id': key, 'status': 'rendering', 'title': self.draft['title'],
                             'language': 'English', 'lyrics': self.draft['lyrics']})
        jobs.status(key)
        jobs.queue.join()
        self.assertEqual(jobs.status(key)['status'], 'complete')
        renderer.render.assert_called_once()

    def test_api_uses_the_selected_topic_and_returns_no_external_music_links(self):
        jobs, _ = self.jobs()
        with patch.object(main, 'lesson_songs', jobs), patch.object(main, 'get_gemini_client', return_value=None):
            result = self.client.post('/api/music/lyrics', json={'topic_key': 't3_ch6', 'subtopic_key': '6.3.2', 'language': 'English'})
            jobs.queue.join()
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertEqual(data['title'], 'Application Software')
        self.assertIn('hard disk', data['lyrics'])
        self.assertNotIn('suno.com', result.text)
        saved = jobs.status(data['song']['id'])
        self.assertEqual(saved['recording']['lyrics'], data['lyrics'])

    def test_invalid_selection_never_queues_a_render(self):
        jobs, renderer = self.jobs()
        with patch.object(main, 'lesson_songs', jobs):
            response = self.client.post('/api/music/generate', json={'topic_key':'t3_ch6', 'subtopic_key':'invalid', 'language':'English'})
        self.assertEqual(response.status_code, 422)
        renderer.render.assert_not_called()


if __name__ == '__main__':
    unittest.main()
