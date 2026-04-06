"""
Download CN card images from tcg.mik.moe.
ONLY downloads cards that have cnNumber set in pokemon_data.json.

Run from: C:/Users/tonyb/Downloads/pokemon-tcg-project/tracker-patched/
Output:   public/card-images-cn/
Requires: pip install requests
"""

import json, os, re, time, requests

DATA_FILE  = "src/data/pokemon_data.json"
OUTPUT_DIR = "public/card-images-cn"
BASE_URL   = "https://tcg.mik.moe/static/img"
DELAY      = 0.35

def poke_name_slug(name):
    """Match JS: pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '')"""
    return re.sub(r'[^a-z0-9]', '', name.lower())

def make_filename(poke_name, cn_set, cn_number):
    """
    Match the app's expectedImagePath exactly:
      numerator  = padStart(3, '0')       e.g. '086'
      denominator = parseInt(total)        e.g. 49  (no leading zeros)
      if denominator is not numeric        keep raw e.g. 'SV-P'
    """
    slug = poke_name_slug(poke_name)
    if "/" in cn_number:
        base, total = cn_number.split("/", 1)
        numerator = base.strip().zfill(3)
        total = total.strip()
        # If denominator is numeric strip leading zeros, else keep as-is
        denominator = str(int(total)) if total.isdigit() else total
        return f"{cn_set}.{numerator}-{denominator}.{slug}_.png"
    else:
        numerator = cn_number.strip().zfill(3)
        return f"{cn_set}.{numerator}.{slug}_.png"

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    data = json.load(open(DATA_FILE, encoding="utf-8"))

    entries = [
        (p["name"], c)
        for p in data
        for c in p["cards"]
        if c.get("cnSetCode") and c.get("cnNumber")
    ]
    print(f"Cards with cnNumber: {len(entries)}")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0",
        "Referer":    "https://tcg.mik.moe/cards/",
        "Accept":     "image/avif,image/webp,image/png,image/*;q=0.8,*/*;q=0.5",
    })

    downloaded = skipped = failed = 0
    for i, (poke_name, card) in enumerate(entries):
        cn_num   = card["cnNumber"]
        cn_set   = card["cnSetCode"]
        filename = make_filename(poke_name, cn_set, cn_num)
        out_path = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(out_path):
            skipped += 1
            continue

        url_n = cn_num.split("/")[0].strip()
        url   = f"{BASE_URL}/{cn_set}/{url_n}.png"

        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 200:
                open(out_path, "wb").write(resp.content)
                print(f"[{i+1}/{len(entries)}] OK   {filename}  ({len(resp.content)//1024}kB)")
                downloaded += 1
            else:
                print(f"[{i+1}/{len(entries)}] {resp.status_code}  {url}  → {filename}")
                failed += 1
        except Exception as e:
            print(f"[{i+1}/{len(entries)}] ERR  {url} — {e}")
            failed += 1

        time.sleep(DELAY)

    print(f"\n✓ Downloaded: {downloaded}  Skipped: {skipped}  ✗ Failed: {failed}")
    if failed:
        print("404s are usually promo sets with different URL structures on tcg.mik.moe.")
        print("You can manually download those images and rename them to match the expected filename shown above.")

if __name__ == "__main__":
    main()
