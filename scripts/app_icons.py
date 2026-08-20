#!/usr/bin/env python3
"""
Geometry for the app icon assets.

Android composes an adaptive icon on a 108dp canvas but only ever shows the centre
72dp of it, and the shape it cuts out of those 72dp is up to the launcher: a circle,
a squircle or a rounded rectangle. Only the inscribed circle is guaranteed on every
device, so the artwork has to stay inside it. Filling the canvas instead is what cut
the lower half off the previous icon.

The logic lives here, free of image handling, so it can be tested. The rendering is
in generate-app-icons.py.
"""

# Of the 108dp adaptive icon canvas, 72dp survive the launcher mask.
ADAPTIVE_SAFE_FRACTION = 72 / 108

# How much of the canvas the artwork covers per asset. The adaptive value stays at or
# below the safe fraction; see test_app_icons.py, which fails if it is raised.
ADAPTIVE_FRACTION = 0.66
SPLASH_FRACTION = 0.80
SQUARE_FRACTION = 1.00


def fit_box(source_size, canvas, fraction):
    """Place an image centred on a square canvas, scaled by its longest side.

    Returns (x, y, width, height) in pixels, aspect ratio preserved.
    """
    if canvas <= 0:
        raise ValueError(f"canvas must be positive, got {canvas}")
    if not 0 < fraction <= 1:
        raise ValueError(f"fraction must be within (0, 1], got {fraction}")

    width, height = source_size
    if width <= 0 or height <= 0:
        raise ValueError(f"source must have a positive size, got {source_size}")

    scale = round(canvas * fraction) / max(width, height)
    scaled = (max(1, round(width * scale)), max(1, round(height * scale)))
    return ((canvas - scaled[0]) // 2, (canvas - scaled[1]) // 2, scaled[0], scaled[1])
