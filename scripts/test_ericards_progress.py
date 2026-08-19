"""Tests for the resume bookkeeping of the ERICard scraper.

Run with the standard library only:

    python3 -m unittest discover -s scripts -p 'test_*.py'
"""

import json
import tempfile
import unittest
from pathlib import Path

from ericards_progress import load_attempted, remaining, save_attempted


class RemainingTest(unittest.TestCase):
    def test_returns_everything_when_nothing_was_attempted(self):
        self.assertEqual(remaining(["0004", "1203"], set()), ["0004", "1203"])

    def test_skips_numbers_that_were_already_attempted(self):
        self.assertEqual(remaining(["0004", "1203", "1017"], {"1203"}), ["0004", "1017"])

    def test_keeps_the_original_order(self):
        self.assertEqual(remaining(["1017", "0004", "1203"], {"0004"}), ["1017", "1203"])

    def test_counts_a_number_that_yielded_no_card_as_attempted(self):
        """Without this a run would retry every miss on each restart."""
        self.assertEqual(remaining(["1203"], {"1203"}), [])


class PersistenceTest(unittest.TestCase):
    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.path = Path(self._dir.name) / "progress.json"

    def tearDown(self):
        self._dir.cleanup()

    def test_missing_file_means_nothing_was_attempted(self):
        self.assertEqual(load_attempted(self.path), set())

    def test_saved_numbers_survive_a_round_trip(self):
        save_attempted(self.path, {"1203", "1017"})

        self.assertEqual(load_attempted(self.path), {"1203", "1017"})

    def test_unreadable_progress_is_treated_as_no_progress(self):
        """A truncated file from a kill must not abort the next run."""
        self.path.write_text("{ this is not json", encoding="utf-8")

        self.assertEqual(load_attempted(self.path), set())

    def test_progress_is_written_as_a_sorted_list(self):
        save_attempted(self.path, {"1203", "0004"})

        self.assertEqual(json.loads(self.path.read_text(encoding="utf-8")), ["0004", "1203"])


if __name__ == "__main__":
    unittest.main()
