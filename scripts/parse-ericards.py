#!/usr/bin/env python3
"""
ERICards scraper: fetches ERICards from ericards.net and converts them to JSON.

Steps:
1. For every UN number in substances.json, search ericards.net
2. Parse the result page and extract the subkey(s)
3. Fetch the ERICard page, parse the HTML into structured JSON

Source: https://www.ericards.net (CEFIC, free for fire services)
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

from data_version import update_data_version
from ericards_progress import load_attempted, remaining, save_attempted

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
SUBSTANCES_PATH = PROJECT_ROOT / "apps" / "mobile" / "assets" / "data" / "substances.json"
OUTPUT_PATH = PROJECT_ROOT / "apps" / "mobile" / "assets" / "data" / "ericards.json"

BASE_URL = "https://www.ericards.net/psp"
SEARCH_URL = f"{BASE_URL}/ericards.psp_search_result"
CARD_URL = f"{BASE_URL}/ericards.psp_ericard"
LANG = 3  # Deutsch

# Polite scraping: pause between requests
REQUEST_DELAY = 0.5  # seconds

# Which UN numbers have been attempted, so an interrupted run can pick up where it
# stopped instead of re-fetching everything. Local bookkeeping, not part of the repo.
PROGRESS_PATH = SCRIPT_DIR / ".ericards-progress.json"

# Persist after this many UN numbers. A crash then costs at most this much work.
FLUSH_EVERY = 25


def fetch_url(url: str, post_data: dict | None = None) -> str:
    """HTTP GET/POST mit einfachem Error-Handling."""
    headers = {
        "User-Agent": "CBRN-Buddy ERICard Collector (Feuerwehr-App, einmalig)",
    }
    if post_data:
        data = urllib.parse.urlencode(post_data).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers)
    else:
        req = urllib.request.Request(url, headers=headers)

    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def search_un_number(un_number: str) -> list[dict]:
    """Search a UN number and return a list of {subkey, name, hin, eric}."""
    html = fetch_url(SEARCH_URL, {
        "p_lang": LANG,
        "lang": LANG,
        "substance": "",
        "unnumber": un_number,
    })

    results = []
    # Pattern: href="ericards.psp_ericard?lang=3&subkey=12030534"
    for match in re.finditer(
        r'href="ericards\.psp_ericard\?lang=\d+&(?:amp;)?subkey=(\d+)"[^>]*>'
        r'<b>([^<]+)</b></a><br>'
        r'UN Nummer: (\d+), HIN: ([^,]*), ERIC: ([^<]*)',
        html,
    ):
        results.append({
            "subkey": match.group(1),
            "name": match.group(2).strip(),
            "un_number": match.group(3).strip(),
            "hin": match.group(4).strip(),
            "eric": match.group(5).strip(),
        })

    return results


def parse_card_html(html: str) -> dict:
    """Parse an ERICard HTML page into structured sections."""
    card = {
        "substance_name": "",
        "un_number": "",
        "hin": "",
        "adr_label": "",
        "adr_class": "",
        "classification_code": "",
        "packing_group": "",
        "eric": "",
        "sections": {},
    }

    # Header-Felder extrahieren (Tabellen-Zeilen)
    header_fields = {
        "Stoff": "substance_name",
        "UN Nummer": "un_number",
        "Gefahrnummer": "hin",
        "ADR Gefahrzettel": "adr_label",
        "ADR Klasse": "adr_class",
        "Klassifizierungscode": "classification_code",
        "Verpackungsgruppe": "packing_group",
        "ERI-Card": "eric",
    }

    for label, field in header_fields.items():
        pattern = re.compile(
            rf"<td>{re.escape(label)}</td>\s*<td>&nbsp;</td>\s*<td>([^<]*)</td>",
            re.DOTALL,
        )
        match = pattern.search(html)
        if match:
            card[field] = match.group(1).strip()

    # Sektionen extrahieren (nummerierte Ueberschriften)
    # Format: "1. Eigenschaften." or "4.1 Allgemeine Massnahmen."
    section_pattern = re.compile(
        r'<b><u>(\d+(?:\.\d+)?)\.?\s+(.+?)</u></b><br>(.*?)(?=<b><u>\d|</td></tr>)',
        re.DOTALL,
    )

    for match in section_pattern.finditer(html):
        section_num = match.group(1).strip()
        section_title = match.group(2).strip().rstrip(".")
        section_content = match.group(3).strip()

        # Listenpunkte extrahieren
        items = []
        for li_match in re.finditer(r"<li>(.+?)</(?:ul|li)>", section_content, re.DOTALL):
            text = li_match.group(1).strip()
            # HTML-Tags entfernen
            text = re.sub(r"<[^>]+>", "", text).strip()
            if text:
                items.append(text)

        card["sections"][section_num] = {
            "title": section_title,
            "items": items,
        }

    return card


def card_to_ericard_json(card: dict) -> dict:
    """Convert a parsed card into the ERICard JSON format used for seeding."""
    sections = card.get("sections", {})

    def get_section_items(prefix: str) -> list[str]:
        """Sammelt Items aus allen Sektionen die mit prefix beginnen."""
        items = []
        for key, section in sorted(sections.items()):
            if key == prefix or key.startswith(prefix + "."):
                items.extend(section.get("items", []))
        return items

    return {
        "un_number": card.get("un_number", "").zfill(4),
        "substance_name": card.get("substance_name", ""),
        "ericard_id": card.get("eric", ""),
        "immediate_actions": json.dumps(get_section_items("4"), ensure_ascii=False),
        "firefighting": json.dumps(get_section_items("4.3"), ensure_ascii=False),
        "personal_protection": json.dumps(get_section_items("3"), ensure_ascii=False),
        "first_aid": json.dumps(get_section_items("5"), ensure_ascii=False),
        "spillage": json.dumps(get_section_items("4.2"), ensure_ascii=False),
        "hazards": json.dumps(get_section_items("2"), ensure_ascii=False),
        "physical_properties": json.dumps(get_section_items("1"), ensure_ascii=False),
        "evacuation_distance_m": None,
        "water_hazard_class": None,
    }


def write_output(ericards: list[dict], attempted: set[str]) -> None:
    """Persist cards and progress together, so both always describe the same run."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(ericards, f, ensure_ascii=False, indent=2)
    save_attempted(PROGRESS_PATH, attempted)


def load_previous_cards() -> list[dict]:
    """Cards from an earlier run. Unreadable output starts over rather than crashing."""
    if not OUTPUT_PATH.exists():
        return []
    try:
        data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def main():
    restart = "--restart" in sys.argv

    if not SUBSTANCES_PATH.exists():
        print(f"ERROR: {SUBSTANCES_PATH} not found. Run parse-un-numbers.py first.")
        sys.exit(1)

    with open(SUBSTANCES_PATH, encoding="utf-8") as f:
        substances = json.load(f)

    # Unique UN numbers
    all_un_numbers = sorted(set(s["un_number"] for s in substances))

    if restart:
        attempted: set[str] = set()
        ericards: list[dict] = []
    else:
        attempted = load_attempted(PROGRESS_PATH)
        ericards = load_previous_cards()

    un_numbers = remaining(all_un_numbers, attempted)

    if attempted:
        print(f"Resuming: {len(attempted)} of {len(all_un_numbers)} UN numbers already done.")
        print(f"Pass --restart to ignore {PROGRESS_PATH.name} and start over.")
    print(f"Scraping ERICards for {len(un_numbers)} UN numbers...")
    print(f"Estimated duration: ~{len(un_numbers) * REQUEST_DELAY / 60:.0f} minutes")
    print()

    found = len(ericards)
    not_found = 0
    errors = 0

    for i, un in enumerate(un_numbers, 1):
        if i % 100 == 0 or i <= 5:
            print(f"  [{i}/{len(un_numbers)}] UN {un}... ", end="", flush=True)

        # Rollback marker: a UN number that fails halfway must leave no partial cards
        # behind, otherwise the retry would append a second, incomplete set.
        cards_before = len(ericards)

        try:
            results = search_un_number(un)
            time.sleep(REQUEST_DELAY)

            # The search went through, so this number counts as attempted regardless of
            # the outcome. Marking only the hits would retry every miss on the next run.
            attempted.add(un)

            if not results:
                not_found += 1
                if i % 100 == 0 or i <= 5:
                    print("not found")
                if i % FLUSH_EVERY == 0:
                    write_output(ericards, attempted)
                continue

            # Use the first hit(s)
            for result in results:
                card_html = fetch_url(
                    f"{CARD_URL}?lang={LANG}&subkey={result['subkey']}"
                )
                time.sleep(REQUEST_DELAY)

                card = parse_card_html(card_html)
                ericard = card_to_ericard_json(card)
                ericards.append(ericard)
                found += 1

            if i % 100 == 0 or i <= 5:
                print(f"{len(results)} card(s)")

        except KeyboardInterrupt:
            print("\nInterrupted. Progress is saved, rerun to continue.")
            write_output(ericards, attempted)
            sys.exit(130)
        except Exception as e:
            errors += 1
            print(f"ERROR on UN {un}: {e}")
            # Undo this iteration entirely so the next run retries it cleanly.
            del ericards[cards_before:]
            found = len(ericards)
            attempted.discard(un)
            continue

        if i % FLUSH_EVERY == 0:
            write_output(ericards, attempted)

    print("\nResult:")
    print(f"  Found:      {found} ERICards")
    print(f"  Not found:  {not_found} UN numbers")
    print(f"  Errors:     {errors}")

    # Save
    write_output(ericards, attempted)

    print(f"\nWritten: {OUTPUT_PATH}")
    print(f"File size: {OUTPUT_PATH.stat().st_size / 1024:.0f} KB")

    # Update the data version so the app notices the change
    update_data_version()
    print("Data version updated.")


if __name__ == "__main__":
    main()
