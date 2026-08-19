#!/usr/bin/env python3
"""CBRN-69 - Synthetische ADR-Warntafeln für YOLO-Training (Klasse: placard_orange).

Erzeugt realistische orange Warntafeln (Kemler oben / UN unten, schwarzer Rahmen +
Trennlinie) aus echten Kemler/UN-Paaren der Gefahrstoff-DB, komponiert sie auf
prozedurale Hintergründe und wendet bbox-synchrone Augmentation an (Rotation, Beleuchtung,
Verschmutzung, Teilverdeckung). Ausgabe im Standard-YOLO-Detektionsformat.

Wichtig: reale Fotos mit (ungelabelten) Tafeln werden NICHT als Hintergrund verwendet -
das würde unlabeled False-Negatives erzeugen. Hintergründe sind rein prozedural.

Beispiel:
    python scripts/generate-synth-data.py --count 2100 --out scripts/datasets/warntafeln
"""
from __future__ import annotations

import argparse
import json
import os
import re
import random
from pathlib import Path

import numpy as np
import cv2
import albumentations as A
from PIL import Image, ImageDraw, ImageFont
from tqdm import tqdm

REPO_ROOT = Path(__file__).resolve().parent.parent
SUBSTANCES_JSON = REPO_ROOT / "apps" / "mobile" / "assets" / "data" / "substances.json"

KEMLER_PATTERN = re.compile(r"^X?\d{2,3}$")
CLASS_ID = 0  # placard_orange
CLASS_NAMES = ["placard_orange"]

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


def find_font_path() -> str | None:
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    try:  # matplotlib ships DejaVu
        import matplotlib.font_manager as fm

        return fm.findfont("DejaVu Sans:bold")
    except Exception:
        return None


FONT_PATH = find_font_path()


def load_font(size: int) -> ImageFont.FreeTypeFont:
    if FONT_PATH:
        return ImageFont.truetype(FONT_PATH, size)
    return ImageFont.load_default()


def load_kemler_un_pairs() -> list[tuple[str, str]]:
    """Valid (kemler, un) pairs from the substance DB (filters classification codes)."""
    data = json.loads(SUBSTANCES_JSON.read_text(encoding="utf-8"))
    rows = data if isinstance(data, list) else data.get("substances", data)
    pairs: list[tuple[str, str]] = []
    for r in rows:
        kemler = str(r.get("kemler_number") or "").strip().upper()
        un = str(r.get("un_number") or "").strip()
        if KEMLER_PATTERN.match(kemler) and re.fullmatch(r"\d{4}", un):
            pairs.append((kemler, un))
    if not pairs:
        raise SystemExit(f"Keine gültigen Kemler/UN-Paare in {SUBSTANCES_JSON}")
    return pairs


def _fit_font(text: str, max_w: int, max_h: int) -> ImageFont.FreeTypeFont:
    """Largest font for which `text` fits within (max_w, max_h)."""
    size = max_h
    while size > 6:
        font = load_font(size)
        box = font.getbbox(text)
        w, h = box[2] - box[0], box[3] - box[1]
        if w <= max_w and h <= max_h:
            return font
        size -= 2
    return load_font(8)


def render_placard(kemler: str, un: str, rng: random.Random) -> Image.Image:
    """Render a single ADR orange placard (Kemler top / UN bottom)."""
    width = 400
    aspect = rng.uniform(1.15, 1.45)  # w/h, ADR board ~4:3
    height = int(width / aspect)

    # Orange with mild per-sample variation (stays within detector's hue range).
    orange = (rng.randint(225, 248), rng.randint(120, 150), rng.randint(5, 30))
    img = Image.new("RGB", (width, height), orange)
    draw = ImageDraw.Draw(img)

    border = max(3, int(width * rng.uniform(0.03, 0.05)))
    line_h = max(2, int(border * 0.7))

    # Outer black frame + horizontal divider.
    draw.rectangle([0, 0, width - 1, height - 1], outline=(15, 15, 15), width=border)
    mid = height // 2
    draw.rectangle([border, mid - line_h // 2, width - border, mid + line_h // 2], fill=(15, 15, 15))

    pad = border + int(width * 0.04)
    cell_h = mid - pad - int(height * 0.03)
    cell_w = width - 2 * pad

    for text, y0, y1 in ((kemler, pad, mid), (un, mid, height - pad)):
        font = _fit_font(text, cell_w, int((y1 - y0) - height * 0.04))
        box = font.getbbox(text)
        tw, th = box[2] - box[0], box[3] - box[1]
        tx = (width - tw) // 2 - box[0]
        ty = y0 + ((y1 - y0) - th) // 2 - box[1]
        draw.text((tx, ty), text, fill=(15, 15, 15), font=font)

    return img


def make_background(size: int, rng: random.Random) -> np.ndarray:
    """Procedural placard-free background (solid / gradient / noisy texture)."""
    kind = rng.random()
    if kind < 0.4:  # solid with slight noise
        base = np.array([rng.randint(40, 210) for _ in range(3)], np.uint8)
        bg = np.full((size, size, 3), base, np.uint8)
    elif kind < 0.75:  # vertical gradient
        c0 = np.array([rng.randint(30, 220) for _ in range(3)], np.float32)
        c1 = np.array([rng.randint(30, 220) for _ in range(3)], np.float32)
        t = np.linspace(0, 1, size, dtype=np.float32)[:, None, None]
        bg = (c0 * (1 - t) + c1 * t).astype(np.uint8)
        bg = np.repeat(bg, size, axis=1)
    else:  # coarse colored noise (texture)
        small = np.random.randint(40, 215, (size // 16, size // 16, 3), np.uint8)
        bg = cv2.resize(small, (size, size), interpolation=cv2.INTER_LINEAR)
    noise = np.random.randint(-12, 12, (size, size, 3), np.int16)
    return np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)


def add_dirt(img: np.ndarray, rng: random.Random) -> np.ndarray:
    """Random translucent grime blobs to mimic dirty/weathered placards."""
    out = img.copy()
    h, w = img.shape[:2]
    for _ in range(rng.randint(0, 6)):
        cx, cy = rng.randint(0, w), rng.randint(0, h)
        r = rng.randint(int(w * 0.02), int(w * 0.10))
        shade = rng.randint(30, 110)
        overlay = out.copy()
        cv2.circle(overlay, (cx, cy), r, (shade, shade, shade), -1)
        alpha = rng.uniform(0.1, 0.35)
        out = cv2.addWeighted(overlay, alpha, out, 1 - alpha, 0)
    return out


def build_augmenter(img_size: int) -> A.Compose:
    return A.Compose(
        [
            A.Affine(
                scale=(0.85, 1.1),
                translate_percent=(-0.04, 0.04),
                rotate=(-22, 22),
                shear=(-7, 7),
                border_mode=cv2.BORDER_REPLICATE,
                p=0.95,
            ),
            A.Perspective(scale=(0.02, 0.08), border_mode=cv2.BORDER_REPLICATE, p=0.5),
            A.RandomBrightnessContrast(brightness_limit=0.35, contrast_limit=0.3, p=0.9),
            A.OneOf([A.MotionBlur(blur_limit=7), A.GaussianBlur(blur_limit=5)], p=0.4),
            A.GaussNoise(p=0.4),
            A.RandomShadow(p=0.3),
            A.CoarseDropout(p=0.4),  # partial occlusion
        ],
        bbox_params=A.BboxParams(
            format="pascal_voc", label_fields=["cls"], min_visibility=0.35, min_area=64
        ),
    )


def compose_sample(
    pairs: list[tuple[str, str]], aug: A.Compose, img_size: int, rng: random.Random
) -> tuple[np.ndarray, tuple[float, float, float, float]] | None:
    """Build one composited+augmented sample. Returns (image_bgr, yolo_bbox) or None."""
    kemler, un = rng.choice(pairs)
    placard = render_placard(kemler, un, rng)

    bg = make_background(img_size, rng)

    frac = rng.uniform(0.18, 0.5)
    pw = int(img_size * frac)
    ph = max(1, int(pw * placard.height / placard.width))
    if ph >= img_size:
        return None
    placard_np = cv2.cvtColor(np.array(placard.resize((pw, ph))), cv2.COLOR_RGB2BGR)
    placard_np = add_dirt(placard_np, rng)

    x0 = rng.randint(0, img_size - pw)
    y0 = rng.randint(0, img_size - ph)
    canvas = bg.copy()
    canvas[y0 : y0 + ph, x0 : x0 + pw] = placard_np
    pascal_bbox = [x0, y0, x0 + pw, y0 + ph]

    try:
        out = aug(image=canvas, bboxes=[pascal_bbox], cls=[CLASS_ID])
    except Exception:
        return None
    if not out["bboxes"]:
        return None

    img = out["image"]
    bx0, by0, bx1, by1 = out["bboxes"][0]
    h, w = img.shape[:2]
    xc = ((bx0 + bx1) / 2) / w
    yc = ((by0 + by1) / 2) / h
    bw = (bx1 - bx0) / w
    bh = (by1 - by0) / h
    if not (0 < bw <= 1 and 0 < bh <= 1 and 0 <= xc <= 1 and 0 <= yc <= 1):
        return None
    return img, (xc, yc, bw, bh)


def pick_split(rng: random.Random, ratios: tuple[float, float, float]) -> str:
    r = rng.random()
    if r < ratios[0]:
        return "train"
    if r < ratios[0] + ratios[1]:
        return "val"
    return "test"


def write_yaml(out: Path) -> None:
    import yaml

    cfg = {
        "path": str(out.resolve()),
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "nc": len(CLASS_NAMES),
        "names": CLASS_NAMES,
    }
    (out / "warntafeln.yaml").write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")


def draw_check(out: Path, n: int) -> None:
    """Render N samples with their YOLO box drawn, to visually verify alignment."""
    check = out / "_check"
    check.mkdir(exist_ok=True)
    train_imgs = sorted((out / "images" / "train").glob("*.jpg"))[:n]
    for img_path in train_imgs:
        lbl = out / "labels" / "train" / (img_path.stem + ".txt")
        img = cv2.imread(str(img_path))
        h, w = img.shape[:2]
        for line in lbl.read_text().splitlines():
            _, xc, yc, bw, bh = (float(v) for v in line.split())
            x0 = int((xc - bw / 2) * w)
            y0 = int((yc - bh / 2) * h)
            x1 = int((xc + bw / 2) * w)
            y1 = int((yc + bh / 2) * h)
            cv2.rectangle(img, (x0, y0), (x1, y1), (0, 255, 0), 2)
        cv2.imwrite(str(check / img_path.name), img)
    print(f"  Verify-Bilder mit Boxen: {check}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Synthetische ADR-Warntafeln (YOLO).")
    ap.add_argument("--count", type=int, default=2100, help="Anzahl Bilder")
    ap.add_argument("--out", type=Path, default=REPO_ROOT / "scripts" / "datasets" / "warntafeln")
    ap.add_argument("--img-size", type=int, default=640)
    ap.add_argument("--split", default="0.8,0.15,0.05", help="train,val,test")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--draw-check", type=int, default=0, help="N Verify-Bilder mit Boxen")
    args = ap.parse_args()

    ratios = tuple(float(x) for x in args.split.split(","))
    assert abs(sum(ratios) - 1.0) < 1e-6, "Split muss sich zu 1.0 summieren"

    rng = random.Random(args.seed)
    np.random.seed(args.seed)

    pairs = load_kemler_un_pairs()
    print(f"Gültige Kemler/UN-Paare: {len(pairs)} | Font: {FONT_PATH or 'PIL-default'}")

    out = args.out
    for sub in ("images", "labels"):
        for split in ("train", "val", "test"):
            (out / sub / split).mkdir(parents=True, exist_ok=True)

    aug = build_augmenter(args.img_size)
    counts = {"train": 0, "val": 0, "test": 0}
    made = 0
    attempts = 0
    max_attempts = args.count * 4

    with tqdm(total=args.count, desc="Generiere") as bar:
        while made < args.count and attempts < max_attempts:
            attempts += 1
            sample = compose_sample(pairs, aug, args.img_size, rng)
            if sample is None:
                continue
            img, (xc, yc, bw, bh) = sample
            split = pick_split(rng, ratios)
            name = f"synth_{made:06d}"
            cv2.imwrite(str(out / "images" / split / f"{name}.jpg"), img,
                        [cv2.IMWRITE_JPEG_QUALITY, 90])
            (out / "labels" / split / f"{name}.txt").write_text(
                f"{CLASS_ID} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}\n"
            )
            counts[split] += 1
            made += 1
            bar.update(1)

    write_yaml(out)
    print(f"Fertig: {made} Bilder ({attempts} Versuche) → {out}")
    print(f"  Split: {counts}")
    if args.draw_check:
        draw_check(out, args.draw_check)


if __name__ == "__main__":
    main()
