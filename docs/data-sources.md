# Data sources

Two datasets carry the app, and they arrive differently. The ADR substance data ships with
the repository, under a licence that allows it as long as the source is named. The ERICards
do not: they have to be fetched locally, which takes about 40 minutes, unattended.

Section 1 below therefore documents how `substances.json` was produced, not a step you have
to run before the app works. You need it to refresh the data against a newer ADR edition.

## 1. Substance data, ADR Table A

**Source:** Bundesanstalt für Materialforschung und -prüfung (BAM), Datenbank GEFAHRGUT
**Terms:** Datenlizenz Deutschland - Namensnennung - Version 2.0 (dl-de/by-2-0)
**Cost:** free since 23 July 2025, no registration
**Ships with the repository.** Run the steps below only to update it.

Download the ADR package from
<https://tes.bam.de/datenbank-gefahrgut/produkte/gefahrgutdatenservice>. Take the UN number
system, road transport (ADR), and unpack it to:

    raw_data/gefahrgut-datenbanken/dgg-daten-adr-un/

Then:

    python3 scripts/parse-un-numbers.py

This writes `apps/mobile/assets/data/substances.json`, around 3,300 entries.

**Which file the parser reads.** The package contains the same table as CSV, Excel and
XML. The parser reads the CSV, because the XML variant stopped at ADR 2023 while the CSV
is kept current. That is not cosmetic: between those editions UN 3423 moved from hazard
class 8 to 6.1 and its Kemler number from 80 to 668, and eleven substances were added,
among them sodium-ion batteries and electrically powered vehicles.

The CSV is tab separated and **cp1252 encoded**, not UTF-8. Reading it as UTF-8 fails on
the first accented French name.

**Attribution is required.** The licence permits redistribution and commercial use, but the
source has to be named wherever the data is used. The app carries it under Mehr, Impressum,
Datenquellen. If you build something else from this data, carry it there too:

    Quelle: Bundesanstalt für Materialforschung und -prüfung (BAM) - Datenbank GEFAHRGUT
    tes.bam.de/TES/Navigation/DE/DGG/dgg.html
    Datenlizenz Deutschland - Namensnennung - Version 2.0 (dl-de/by-2-0)

One restriction worth knowing: the BAM prohibits text and data mining of their site under
§44b UrhG without written permission. Parsing a package you downloaded is the intended use.
Training a model on the data is not, and would need to be cleared with them.

## 2. ERICards

**Source:** CEFIC, <https://www.ericards.net>
**Terms:** free for fire services

    python3 scripts/parse-ericards.py

This searches by UN number and therefore needs `substances.json`, which ships with the
repository. It fetches around 2,300 cards in roughly 40 minutes.

**Why this is a scraper and not a data file.** "Free for fire services" is a permission to
use, not a permission for us to redistribute. So the repository ships the scraper and you
fetch your own copy. The `ericards.json` in the repository is an empty array, present only
because Metro resolves the import at bundle time and the app would not build without it.

**Please leave the rate limit alone.** The scraper waits half a second between requests and
identifies itself in the user agent. That is deliberate: the site belongs to someone else
and carries no advertising to pay for the traffic. The run is resumable, so there is no
reason to speed it up. Interrupt with Ctrl-C and start it again to continue; `--restart`
begins from scratch.

## 3. Isolation distances, ERG 2024

**Source:** Emergency Response Guidebook 2024, PHMSA and Transport Canada
**Terms:** public domain

Already in the repository as `apps/mobile/lib/calculations/erg-distances.json`, extracted
from Table 1. Public domain, so redistribution is not an issue.

## 4. Breathing air

The calculation follows FwDV 7, the German fire service regulation on respiratory
protection. No data file, the rule is in the code and tested against the values from the
regulation.

## After a data update

Both parser scripts update `apps/mobile/assets/data/data-version.json`, a content hash per
dataset. The app compares it on start and reloads its database when it changed, so an
update reaches devices that already have the app installed. Do not edit the JSON files by
hand: the change is lost on the next run and silently diverges from the regulation.
