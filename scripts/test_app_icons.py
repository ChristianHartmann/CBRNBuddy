"""Tests for the app icon geometry.

Run with the standard library only:

    python3 -m unittest discover -s scripts -p 'test_*.py'
"""

import unittest

from app_icons import (
    ADAPTIVE_FRACTION,
    ADAPTIVE_SAFE_FRACTION,
    SPLASH_FRACTION,
    SQUARE_FRACTION,
    fit_box,
)


class AdaptiveSafeZoneTest(unittest.TestCase):
    def test_artwork_stays_inside_the_launcher_mask(self):
        # The regression guard. A fraction above the safe one is what made the
        # previous icon lose its lower half on the device.
        self.assertLessEqual(ADAPTIVE_FRACTION, ADAPTIVE_SAFE_FRACTION)

    def test_longest_side_fits_the_guaranteed_circle(self):
        x, y, width, height = fit_box((498, 511), 1024, ADAPTIVE_FRACTION)
        self.assertLessEqual(max(width, height), 1024 * ADAPTIVE_SAFE_FRACTION)

    def test_the_other_assets_are_not_masked_and_may_be_larger(self):
        self.assertGreater(SPLASH_FRACTION, ADAPTIVE_FRACTION)
        self.assertEqual(SQUARE_FRACTION, 1.00)


class FitBoxTest(unittest.TestCase):
    def test_centres_a_square_source(self):
        self.assertEqual(fit_box((100, 100), 1000, 0.5), (250, 250, 500, 500))

    def test_scales_by_the_longest_side(self):
        x, y, width, height = fit_box((498, 511), 1024, 1.0)
        self.assertEqual(height, 1024)
        self.assertLess(width, 1024)

    def test_keeps_the_aspect_ratio(self):
        _, _, width, height = fit_box((400, 200), 1000, 1.0)
        self.assertEqual((width, height), (1000, 500))

    def test_centres_the_shorter_axis(self):
        x, y, width, height = fit_box((400, 200), 1000, 1.0)
        self.assertEqual(x, 0)
        self.assertEqual(y, (1000 - height) // 2)

    def test_never_scales_a_thin_source_away(self):
        _, _, width, height = fit_box((1000, 3), 64, 0.66)
        self.assertGreaterEqual(height, 1)

    def test_rejects_a_fraction_outside_the_canvas(self):
        with self.assertRaises(ValueError):
            fit_box((100, 100), 1024, 1.5)

    def test_rejects_an_empty_source(self):
        with self.assertRaises(ValueError):
            fit_box((0, 100), 1024, 1.0)


if __name__ == "__main__":
    unittest.main()
