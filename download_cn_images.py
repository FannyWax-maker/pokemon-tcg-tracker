"""
Download CN card images — tries pokecardex (HD) first, falls back to tcg.mik.moe.
Replaces existing files if pokecardex has a better (larger) version.

Run from: C:/Users/tonyb/Downloads/pokemon-tcg-project/tracker-patched/
Output:   public/card-images-cn/
Requires: pip install requests
"""

import json, os, re, time, requests

DATA_FILE  = "src/data/pokemon_data.json"
OUTPUT_DIR = "public/card-images-cn"
PRIMARY    = "https://pokecardex-scans.b-cdn.net/sets_chn"
FALLBACK   = "https://tcg.mik.moe/static/img"
DELAY      = 0.3

def poke_name_slug(name):
    """Match JS: pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '')"""
    return re.sub(r'[^a-z0-9]', '', name.lower())

def make_filename(poke_name, cn_set, cn_number):
    """Match the app's expectedImagePath exactly."""
    slug = poke_name_slug(poke_name)
    if "/" in cn_number:
        base, total = cn_number.split("/", 1)
        numerator   = base.strip().zfill(3)
        total       = total.strip()
        denominator = str(int(total)) if total.isdigit() else total
        return f"{cn_set}.{numerator}-{denominator}.{slug}_.jpg"
    else:
        numerator = cn_number.strip().zfill(3)
        return f"{cn_set}.{numerator}.{slug}_.jpg"

def try_download(session, url):
    """Returns (bytes, status_code) or (None, status_code)."""
    try:
        resp = session.get(url, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 5000:
            return resp.content, 200
        return None, resp.status_code
    except Exception as e:
        return None, str(e)

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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer":    "https://www.pokecardex.com/",
        "Accept":     "image/avif,image/webp,image/jpeg,image/*;q=0.8",
    })

    downloaded = skipped = failed = replaced = 0

    for i, (poke_name, card) in enumerate(entries):
        cn_num  = card["cnNumber"]
        cn_set  = card["cnSetCode"]
        filename = make_filename(poke_name, cn_set, cn_num)
        out_path = os.path.join(OUTPUT_DIR, filename)

        # Card number for URL (bare integer, no leading zeros, no /total)
        url_n = str(int(cn_num.split("/")[0].strip()))

        # --- Try pokecardex (HD) ---
        url_primary = f"{PRIMARY}/{cn_set}/{url_n}.jpg?class=hd"
        data_bytes, status = try_download(session, url_primary)

        if data_bytes:
            existing_size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
            if existing_size >= len(data_bytes):
                skipped += 1
                continue
            open(out_path, "wb").write(data_bytes)
            if existing_size > 0:
                print(f"[{i+1}/{len(entries)}] REPLACED {filename}  ({existing_size//1024}kB → {len(data_bytes)//1024}kB)")
                replaced += 1
            else:
                print(f"[{i+1}/{len(entries)}] OK(HD)  {filename}  ({len(data_bytes)//1024}kB)")
                downloaded += 1
            time.sleep(DELAY)
            continue

        # --- Fallback: tcg.mik.moe ---
        url_fallback = f"{FALLBACK}/{cn_set}/{url_n}.png"
        # Switch to png extension for fallback
        filename_png = filename.replace(".jpg", ".png")
        out_path_png = os.path.join(OUTPUT_DIR, filename_png)

        if os.path.exists(out_path_png):
            skipped += 1
            continue

        session.headers["Referer"] = "https://tcg.mik.moe/cards/"
        data_bytes, status = try_download(session, url_fallback)
        session.headers["Referer"] = "https://www.pokecardex.com/"

        if data_bytes:
            open(out_path_png, "wb").write(data_bytes)
            print(f"[{i+1}/{len(entries)}] OK(FB)  {filename_png}  ({len(data_bytes)//1024}kB)")
            downloaded += 1
        else:
            print(f"[{i+1}/{len(entries)}] FAIL    {cn_set}/{url_n}  (pokecardex:{status})")
            failed += 1

        time.sleep(DELAY)

    print(f"\n✓ Downloaded: {downloaded}  Replaced: {replaced}  Skipped: {skipped}  ✗ Failed: {failed}")

if __name__ == "__main__":
    main()
