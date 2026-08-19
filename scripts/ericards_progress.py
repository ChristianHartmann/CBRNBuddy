#!/usr/bin/env python3
"""
Resume bookkeeping for the ERICard scraper.

A full run takes around 40 minutes and makes a few thousand requests to a third party
site. Without this, an interrupted run has to start over from the first UN number, which
wastes the operator's time and hammers ericards.net for data already fetched.

Every UN number that has been *attempted* is recorded, whether or not it yielded a card.
Recording only the hits would retry every miss on the next run.
"""

import json
from pathlib import Path


def load_attempted(path: Path) -> set[str]:
    """UN numbers already attempted. Anything unreadable counts as no progress."""
    if not path.exists():
        return set()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        # A truncated file from a killed run must not block the next one.
        return set()
    if not isinstance(data, list):
        return set()
    return {str(entry) for entry in data}


def save_attempted(path: Path, attempted: set[str]) -> None:
    """Write the progress file. Sorted, so a diff between runs stays readable."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(attempted), f)


def remaining(un_numbers: list[str], attempted: set[str]) -> list[str]:
    """The UN numbers still to process, in their original order."""
    return [un for un in un_numbers if un not in attempted]
