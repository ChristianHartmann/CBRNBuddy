# CBRN-Buddy

**[Deutsch](#deutsch) · [English](#english)**

## Deutsch

Offline-Gefahrstoff-Assistent für Feuerwehren. Kamera auf eine orange ADR-Warntafel
halten: Die App liest Kemler-Zahl und UN-Nummer, identifiziert den Stoff und zeigt die
Sofortmaßnahmen. Alles auf dem Gerät, ohne Netzverbindung.

Der Detektor ist ein eigens dafür trainiertes YOLO26-nano-Modell, nach TFLite exportiert
und auf dem Gerät ausgeführt. Die Stoffdaten stammen aus ADR Tabelle A, die
Einsatzmaßnahmen von den CEFIC ERICards.

**Plattform: Android.** iOS wird nicht unterstützt, siehe [Lizenz](#licence).

**Die App ist auf Deutsch**, sie ist für Feuerwehren in Deutschland, Österreich und der
Schweiz gebaut. Code und Dokumentation sind auf Englisch.

### Haftungsausschluss

Diese App ist ein Hilfsmittel. Sie ersetzt weder Ausbildung noch Erfahrung noch die
Beurteilung der Einsatzkräfte vor Ort; es entscheidet die Einsatzleitung. Alle Daten sind
ohne Gewähr und können veraltet oder falsch sein. Alles, worauf es ankommt, ist gegen die
geltenden Vorschriften zu prüfen; im Zweifel ist ein Fachberater Gefahrgut hinzuzuziehen.

Das ist ein Hobbyprojekt, kein zertifiziertes Produkt.

### Funktionsumfang

- **Scanner**: Live-Erkennung oranger ADR-Warntafeln, OCR von Kemler-Zahl und UN-Nummer
  auf dem Gerät, Stoffidentifikation. Trägt eine UN-Nummer mehrere Einträge, löst die
  Kemler-Zahl auf, welcher davon auf dem Fahrzeug steht.
- **Suche** nach UN-Nummer, Stoffname oder Kemler-Zahl
- **ERICards** mit Sofortmaßnahmen, Gefahren, Schutzausrüstung, Löschmitteln
- **Absperrradien** nach ERG 2024, mit Karte
- **Rechner und Merkhilfen**: Atemluft, ppm-Umrechnung, Volumenabschätzung,
  Beaufort-Skala, GAMS-Checkliste

Die technische Dokumentation ab [Getting started](#getting-started) ist auf Englisch.

## English

An offline hazmat assistant for firefighters. Point the camera at an orange ADR placard
and the app reads the Kemler and UN number, identifies the substance and shows the
immediate measures, all on the device and without a network connection.

The detector is a YOLO26-nano model trained specifically for this, exported to TFLite and
running on-device. The substance data comes from ADR Table A, the emergency measures from
CEFIC ERICards.

**Platform: Android.** iOS is not supported, see [Licence](#licence).

**The app language is German**, since it is built for fire services in Germany, Austria
and Switzerland. Code and documentation are English.

### Disclaimer

This app is an aid. It does not replace training, experience or the judgement of the
people on scene, and the incident commander decides. All data is provided without
warranty and may be outdated or wrong. Verify anything that matters against the current
regulations and involve a hazmat adviser.

This is a hobby project, not a certified product.

### What it does

- **Scanner**: live detection of orange ADR placards, on-device OCR of the Kemler and UN
  number, substance identification. Where a UN number has several entries, the Kemler
  number resolves which one is on the truck.
- **Search** by UN number, substance name or Kemler number
- **ERICards** with immediate measures, hazards, protective equipment, firefighting media
- **Isolation distances** to ERG 2024, with a map
- **Calculators and reference cards**: breathing air, ppm conversion, volume estimation,
  Beaufort scale, GAMS checklist

## Getting started

### Prerequisites

- Node.js 20 or newer, npm
- Python 3.12 or newer
- Android device with API 28 or newer, developer mode enabled
- JDK 17 and the Android SDK for local builds

### 1. Fetch the ERICards

The substance data ships with the repository. The ERICards do not: "free for fire services"
is a permission to use, not a permission for us to redistribute, so you fetch your own copy.

    python3 scripts/parse-ericards.py

Around 2,300 cards in roughly 40 minutes. It runs unattended and can be resumed, so an
interruption costs nothing. Until it has run the app works, but a substance shows no
emergency measures.

**Please leave the rate limit alone.** The scraper waits half a second between requests
because the site belongs to someone else and carries no advertising to pay for the traffic.

Which terms apply to both datasets, and what the attribution has to carry, is in
[docs/data-sources.md](docs/data-sources.md).

### 2. Build and install

    cd apps/mobile
    npm install
    npx expo run:android

The scanner needs a real device. The camera and the GPU frame processing do not work in
an emulator.

## Tests

    cd apps/mobile && npm test          # logic and components
    python3 -m unittest discover -s scripts -p 'test_*.py'

The database tests run against a real in-memory SQLite instance including the full text
index, not against mocks.

## Retraining the model

`scripts/` holds the whole chain: synthetic training data, YOLO26-nano training and the
TFLite export. The trained model is in the repository, so this is optional. See
[docs/training.md](docs/training.md).

## Data sources and attribution

**Substance data**: ADR Table A from the Bundesanstalt für Materialforschung und -prüfung
(BAM), Datenbank GEFAHRGUT, under Datenlizenz Deutschland - Namensnennung - Version 2.0.
The attribution the licence requires is carried in the app and spelled out in
[docs/data-sources.md](docs/data-sources.md).

**ERICards**: CEFIC, free for fire services, fetched by you rather than redistributed here.

**Isolation distances**: ERG 2024 (PHMSA / Transport Canada), public domain.

**Breathing air**: FwDV 7.

## Documentation

| | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | how the app is put together and why offline |
| [docs/scanner-pipeline.md](docs/scanner-pipeline.md) | camera frame to substance, including what failed |
| [docs/data-sources.md](docs/data-sources.md) | where the data comes from and under which terms |
| [docs/training.md](docs/training.md) | retraining the detector |

## Licence

AGPL-3.0. See `LICENSE`.

The detector is built with [Ultralytics](https://github.com/ultralytics/ultralytics),
which is AGPL-3.0 itself and treats trained weights as derived works. The whole project
follows suit, which also settles the question rather than leaving it open.

One consequence worth knowing: the GPL family conflicts with Apple's App Store terms, so
this cannot be distributed on iOS. Android and self-built installs are unaffected.
