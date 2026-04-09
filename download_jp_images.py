"""
Download JP card images.
Sources (in order):
  1. limitlesstcg CDN — best quality PNG
  2. pokecardex HD then MD — fallback JPG
  3. pokemontcg.io hires — WOTC/EX/DP/HGSS era fallback

Run from: C:/Users/tonyb/Downloads/pokemon-tcg-project/tracker-patched/
Output:   public/card-images-jp/
          public/card-images-cameo-jp/
Requires: pip install requests
"""

import json, os, re, time, requests
from collections import Counter

SOURCES = [
    {"data_file": "src/data/pokemon_data.json",       "output_dir": "public/card-images-jp",       "use_card_name": False},
    {"data_file": "src/data/steph/pokemon_data.json", "output_dir": "public/card-images-cameo-jp", "use_card_name": True},
]

LIMITLESS  = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci"
POKECARDEX = "https://pokecardex-scans.b-cdn.net/sets_jp"
TCGIO      = "https://images.pokemontcg.io"
DELAY = 0.3

# JP set code → pokemontcg.io set ID (for old sets not on limitlesstcg/pokecardex)
TCGIO_MAP = {
    'EC1':'ecard1', 'EC2':'ecard2', 'EC3':'ecard3', 'EC4':'ecard4', 'EC5':'ecard5',
    'N1':'neo1', 'N2':'neo2', 'N3':'neo3', 'N4':'neo4',
    'G1':'gym1', 'G2':'gym2',
    'BS':'base1', 'WP':'basep', 'SI-JP':'si1',
    'EXP':'ex1',
    'ADV1':'ex2', 'ADV2':'ex3', 'ADV3':'ex4', 'ADV4':'ex5',
    'PCG1':'ex6', 'PCG2':'ex7', 'PCG3':'ex8', 'PCG4':'ex9',
    'PCG5':'ex10', 'PCG6':'ex11',
    'DP1':'dp1', 'DP2':'dp2', 'DP3':'dp3', 'DP4':'dp4', 'DP5':'dp5', 'DP6':'dp6',
    'Pt1':'pl1', 'Pt2':'pl2', 'Pt4':'pl4',
    'L1HG':'hgss1', 'L1SS':'hgss2', 'L2':'hgss3', 'L3':'col1', 'LL':'col1',
    'BW1':'bw1', 'BW2':'bw2', 'BW4':'bw4', 'BW5':'bw5', 'BW6':'bw6',
    'BW8':'bw8', 'BW9':'bw9',
    'IFDS':'dp5',
}

def name_slug(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

def make_filename(card, poke_name, use_card_name, ext=".png"):
    slug = name_slug(card.get("cardName") or poke_name) if use_card_name else name_slug(poke_name)
    jp_set    = card["jpSetCode"]
    jp_number = card["jpNumber"]
    if "/" in jp_number:
        base, total = jp_number.split("/", 1)
        numerator   = base.strip().zfill(3)
        denom_clean = re.sub(r'[^a-z0-9]', '', total.strip().lower())
        denominator = str(int(total.strip())) if total.strip().isdigit() else denom_clean
        return f"{jp_set}.{numerator}-{denominator}.{slug}_.{ext.lstrip('.')}"
    else:
        return f"{jp_set}.{jp_number.strip().zfill(3)}.{slug}_.{ext.lstrip('.')}"

def is_numeric_number(jp_number):
    return jp_number.split("/")[0].strip().isdigit()

def try_url(session, url):
    try:
        resp = session.get(url, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 5000:
            return resp.content, None
        return None, f"HTTP {resp.status_code}"
    except Exception as e:
        return None, str(e)[:60]

def process_source(session, data_file, output_dir, use_card_name, all_failures):
    if not os.path.exists(data_file):
        print(f"  Skipping {data_file} (not found)")
        return

    os.makedirs(output_dir, exist_ok=True)
    data = json.load(open(data_file, encoding="utf-8"))

    # Deduplicate by card id
    seen = set()
    entries = []
    for p in data:
        for c in p["cards"]:
            if c.get("jpSetCode") and c.get("jpNumber") and c["id"] not in seen:
                seen.add(c["id"])
                entries.append((p["name"], c))

    print(f"\n{'='*55}")
    print(f"Source : {data_file}")
    print(f"Output : {output_dir}")
    print(f"Cards  : {len(entries)}")

    downloaded = skipped = failed = replaced = no_number = 0

    for i, (poke_name, card) in enumerate(entries):
        jp_num = card["jpNumber"]
        jp_set = card["jpSetCode"]

        if not is_numeric_number(jp_num):
            no_number += 1
            continue

        bare_num = jp_num.split("/")[0].strip()
        padded   = bare_num.zfill(3)
        bare_int = str(int(bare_num))

        # 1. Try Limitless (best quality PNG)
        data_bytes, reason_l = try_url(session, f"{LIMITLESS}/{jp_set}/{jp_set}_{padded}_R_JP_SM.png")
        ext = "png"
        source = "limitless"

        # 2. Fallback: pokecardex HD then MD
        if not data_bytes:
            data_bytes, reason_hd = try_url(session, f"{POKECARDEX}/{jp_set}/{bare_int}.jpg?class=hd")
            if not data_bytes:
                data_bytes, reason_md = try_url(session, f"{POKECARDEX}/{jp_set}/{bare_int}.jpg?class=md")
                fail_reason = f"limitless={reason_l} | pokecardex={reason_md}"
            else:
                fail_reason = None
            if data_bytes:
                ext = "jpg"
                source = "pokecardex"

        # 3. Fallback: pokemontcg.io hires
        if not data_bytes:
            tcgio_id = TCGIO_MAP.get(jp_set)
            if tcgio_id:
                data_bytes, reason_tcgio = try_url(session, f"{TCGIO}/{tcgio_id}/{bare_int}_hires.png")
                if data_bytes:
                    ext = "png"
                    source = "tcgio"
                    fail_reason = None
                else:
                    fail_reason = f"limitless={reason_l} | tcgio={reason_tcgio}"

        filename = make_filename(card, poke_name, use_card_name, ext)
        out_path = os.path.join(output_dir, filename)

        if data_bytes:
            existing = os.path.getsize(out_path) if os.path.exists(out_path) else 0
            if existing >= len(data_bytes):
                skipped += 1
                continue
            open(out_path, "wb").write(data_bytes)
            if existing > 0:
                print(f"[{i+1}/{len(entries)}] REPLACED {filename} [{source}]")
                replaced += 1
            else:
                print(f"[{i+1}/{len(entries)}] OK  {filename}  ({len(data_bytes)//1024}kB) [{source}]")
                downloaded += 1
        else:
            print(f"[{i+1}/{len(entries)}] FAIL  {jp_set} {jp_num}  | {fail_reason}")
            all_failures.append({"source": output_dir, "set": jp_set, "number": jp_num, "pokemon": poke_name, "reason": fail_reason})
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

    all_failures = []
    for src in SOURCES:
        process_source(session, src["data_file"], src["output_dir"], src["use_card_name"], all_failures)

    if all_failures:
        json.dump(all_failures, open("jp_download_failures.json", "w"), indent=2)
        print(f"\n⚠ {len(all_failures)} failures saved to jp_download_failures.json")
        reasons = Counter()
        for f in all_failures:
            key = f["reason"].split("|")[0].strip() if f["reason"] else "unknown"
            reasons[key] += 1
        print("Breakdown:", dict(reasons.most_common()))

    print("\nDone.")

if __name__ == "__main__":
    main()
