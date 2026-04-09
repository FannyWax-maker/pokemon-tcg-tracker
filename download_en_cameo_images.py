"""
Download EN cameo card images from limitlesstcg (best quality).
Uses cardName for filename (e.g. "Energy Switch", not the featured Pokémon name).

Run from: C:/Users/tonyb/Downloads/pokemon-tcg-project/tracker-patched/
Output:   public/card-images-cameo/
Requires: pip install requests
"""

import json, os, re, time, requests

DATA_FILE  = "src/data/steph/pokemon_data.json"
OUTPUT_DIR = "public/card-images-cameo"
LIMITLESS  = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci"
DELAY = 0.3

def name_slug(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

def make_filename(card):
    # Use cardName for slug, not the featured pokemon name
    slug     = name_slug(card.get("cardName") or "")
    set_code = card["setCode"]
    number   = card["number"]
    if "/" in number:
        base, total = number.split("/", 1)
        numerator   = base.strip().zfill(3)
        denominator = str(int(total.strip())) if total.strip().isdigit() else total.strip()
        return f"{set_code}.{numerator}-{denominator}.{slug}_.png"
    else:
        return f"{set_code}.{number.strip().zfill(3)}.{slug}_.png"

def try_url(session, url):
    try:
        resp = session.get(url, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 5000:
            return resp.content
        return None
    except Exception:
        return None

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    data = json.load(open(DATA_FILE, encoding="utf-8"))

    # Deduplicate by card id
    seen = set()
    entries = []
    for p in data:
        for c in p["cards"]:
            if c.get("setCode") and c.get("number") and c["id"] not in seen:
                seen.add(c["id"])
                entries.append(c)

    print(f"Unique EN cameo cards: {len(entries)}")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer":    "https://limitlesstcg.com/",
        "Accept":     "image/png,image/jpeg,image/*;q=0.8",
    })

    downloaded = skipped = failed = 0

    for i, card in enumerate(entries):
        set_code = card["setCode"]
        number   = card["number"]
        filename = make_filename(card)
        out_path = os.path.join(OUTPUT_DIR, filename)

        bare   = number.split("/")[0].strip()
        padded = bare.zfill(3)

        # Try LG (large) first, fall back to standard
        data_bytes = (
            try_url(session, f"{LIMITLESS}/{set_code}/{set_code}_{padded}_R_EN_LG.png") or
            try_url(session, f"{LIMITLESS}/{set_code}/{set_code}_{padded}_R_EN.png")
        )

        if data_bytes:
            existing = os.path.getsize(out_path) if os.path.exists(out_path) else 0
            if existing >= len(data_bytes):
                skipped += 1
                continue
            open(out_path, "wb").write(data_bytes)
            print(f"[{i+1}/{len(entries)}] OK  {filename}  ({len(data_bytes)//1024}kB)")
            downloaded += 1
        else:
            print(f"[{i+1}/{len(entries)}] FAIL  {set_code} {number}")
            failed += 1

        time.sleep(DELAY)

    print(f"\n✓ Downloaded:{downloaded}  Skipped:{skipped}  ✗ Failed:{failed}")

if __name__ == "__main__":
    main()
