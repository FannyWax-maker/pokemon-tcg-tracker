"""
Download JP card images from limitlesstcg (best quality) with pokecardex fallback.
Covers both Illustrations and Cameos.

Run from: C:/Users/tonyb/Downloads/pokemon-tcg-project/tracker-patched/
Output:   public/card-images-jp/
          public/card-images-cameo-jp/
Requires: pip install requests
"""

import json, os, re, time, requests

SOURCES = [
    {
        "data_file":  "src/data/pokemon_data.json",
        "output_dir": "public/card-images-jp",
    },
    {
        "data_file":  "src/data/steph/pokemon_data.json",
        "output_dir": "public/card-images-cameo-jp",
    },
]

LIMITLESS  = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci"
POKECARDEX = "https://pokecardex-scans.b-cdn.net/sets_jp"
DELAY = 0.3

def poke_name_slug(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

def make_filename(poke_name, jp_set, jp_number, ext=".png"):
    slug = poke_name_slug(poke_name)
    if "/" in jp_number:
        base, total = jp_number.split("/", 1)
        numerator   = base.strip().zfill(3)
        total       = total.strip()
        denominator = str(int(total)) if total.isdigit() else total
        return f"{jp_set}.{numerator}-{denominator}.{slug}_{ext}"
    else:
        numerator = jp_number.strip().zfill(3)
        return f"{jp_set}.{numerator}.{slug}_{ext}"

def is_numeric_number(jp_number):
    """Return True if the card number is actually a number, not a card name."""
    base = jp_number.split("/")[0].strip()
    return base.isdigit()

def try_url(session, url):
    try:
        resp = session.get(url, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 5000:
            return resp.content
        return None
    except Exception:
        return None

def process_source(session, data_file, output_dir):
    if not os.path.exists(data_file):
        print(f"  Skipping {data_file} (not found)")
        return

    os.makedirs(output_dir, exist_ok=True)
    data = json.load(open(data_file, encoding="utf-8"))

    entries = [
        (p["name"], c)
        for p in data
        for c in p["cards"]
        if c.get("jpSetCode") and c.get("jpNumber")
    ]

    print(f"\n{'='*55}")
    print(f"Source : {data_file}")
    print(f"Output : {output_dir}")
    print(f"Cards  : {len(entries)}")

    downloaded = skipped = failed = replaced = no_number = 0

    for i, (poke_name, card) in enumerate(entries):
        jp_num = card["jpNumber"]
        jp_set = card["jpSetCode"]

        # Skip cards where jpNumber is a card name, not a number
        if not is_numeric_number(jp_num):
            print(f"[{i+1}/{len(entries)}] SKIP  {jp_set} '{jp_num}' (not a number)")
            no_number += 1
            continue

        bare_num = jp_num.split("/")[0].strip()
        padded   = bare_num.zfill(3)
        bare_int = str(int(bare_num))

        # --- Try Limitless (best quality PNG) ---
        url_limitless = f"{LIMITLESS}/{jp_set}/{jp_set}_{padded}_R_JP_SM.png"
        data_bytes = try_url(session, url_limitless)
        ext = ".png"

        # --- Fallback: pokecardex HD then MD ---
        if not data_bytes:
            data_bytes = (
                try_url(session, f"{POKECARDEX}/{jp_set}/{bare_int}.jpg?class=hd") or
                try_url(session, f"{POKECARDEX}/{jp_set}/{bare_int}.jpg?class=md")
            )
            if data_bytes:
                ext = ".jpg"

        filename = make_filename(poke_name, jp_set, jp_num, ext)
        out_path = os.path.join(output_dir, filename)

        if data_bytes:
            existing = os.path.getsize(out_path) if os.path.exists(out_path) else 0
            if existing >= len(data_bytes):
                skipped += 1
                continue
            open(out_path, "wb").write(data_bytes)
            if existing > 0:
                print(f"[{i+1}/{len(entries)}] REPLACED {filename} ({existing//1024}→{len(data_bytes)//1024}kB)")
                replaced += 1
            else:
                print(f"[{i+1}/{len(entries)}] OK  {filename}  ({len(data_bytes)//1024}kB)")
                downloaded += 1
        else:
            print(f"[{i+1}/{len(entries)}] FAIL  {jp_set} {jp_num}")
            failed += 1

        time.sleep(DELAY)

    print(f"\n✓ Downloaded:{downloaded}  Replaced:{replaced}  Skipped:{skipped}  ✗ Failed:{failed}  No-number:{no_number}")

def main():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer":    "https://limitlesstcg.com/",
        "Accept":     "image/png,image/jpeg,image/*;q=0.8",
    })
    for src in SOURCES:
        process_source(session, src["data_file"], src["output_dir"])
    print("\nDone.")

if __name__ == "__main__":
    main()
