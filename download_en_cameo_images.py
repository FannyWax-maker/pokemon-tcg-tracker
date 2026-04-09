"""
Download EN cameo card images.
Sources (in order of quality):
  1. limitlesstcg CDN (_LG then standard) — modern sets
  2. pokemontcg.io hires — WOTC/EX/DP/HGSS/BW era fallback

Run from: C:/Users/tonyb/Downloads/pokemon-tcg-project/tracker-patched/
Output:   public/card-images-cameo/
Requires: pip install requests
"""

import json, os, re, time, requests
from collections import Counter

DATA_FILE  = "src/data/steph/pokemon_data.json"
OUTPUT_DIR = "public/card-images-cameo"
LIMITLESS  = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci"
TCGIO      = "https://images.pokemontcg.io"
DELAY = 0.3

# Your EN set code → pokemontcg.io set ID
TCGIO_MAP = {
    'BS':'base1', 'B2':'base2', 'FO':'base3', 'TR':'base5',
    'GH':'gym1',  'GC':'gym2',
    'N1':'neo1',  'N2':'neo2', 'N3':'neo3', 'N4':'neo4',
    'NG':'neo1',  'NR':'neo3', 'NP':'np',
    'EX':'ecard1','AQ':'ecard2','SK':'ecard3',
    'LC':'base6', 'WP':'basep', 'SI':'si1',
    'RS':'ex1', 'SS':'ex2', 'DR':'ex3', 'TM':'ex4', 'HL':'ex5',
    'RG':'ex6', 'TRR':'ex7', 'DX':'ex8', 'EM':'ex9', 'UF':'ex10',
    'DS':'ex11','LM':'ex12','HP':'ex13','CG':'ex14','DF':'ex15','PK':'ex16',
    'POP2':'pop2','POP4':'pop4','POP5':'pop5',
    'DP':'dp1','MT':'dp2','SW':'dp3','GE':'dp4','MD':'dp5','LA':'dp6','STF':'dp7',
    'PL':'pl1','RR':'pl2','AR':'pl4','DPPR':'dpp',
    'HS':'hgss1','UL':'hgss2','UD':'hgss3','CLG':'col1',
    'NVI':'bw3','NDE':'bw4','LTR':'bw10','BWP':'bwp',
    'XY':'xy1','FLF':'xy2','FFI':'xy3','PHF':'xy4','PRC':'xy5',
    'ROS':'xy6','AOR':'xy7','BKT':'xy8','BKP':'xy9','FCO':'xy10',
    'STS':'xy11','EVO':'xy12','GEN':'g1','XYP':'xyp',
    'SUM':'sm1','GRI':'sm2','BUS':'sm3','CIN':'sm4','UPR':'sm5','FLI':'sm6',
    'CES':'sm7','LOT':'sm8','TEU':'sm9','UNB':'sm10','UNM':'sm11',
    'CEC':'sm12','HIM':'sm12a','SMP':'smp',
    'SSH':'swsh1','RCL':'swsh2','DAA':'swsh3','VIV':'swsh4',
    'BST':'swsh5','CRE':'swsh6','EVS':'swsh7','FST':'swsh8','BRS':'swsh9',
    'ASR':'swsh10','LOR':'swsh11','SIT':'swsh12','CRZ':'swsh12pt5',
    'SWSH':'swshp','BWP':'bwp',
    'SVP':'svp','SVI':'sv1','PAL':'sv2','OBF':'sv3','MEW':'sv3pt5',
    'PAR':'sv4','PAF':'sv4pt5','TEF':'sv5','TWM':'sv6','SFA':'sv6pt5',
    'SCR':'sv7','SSP':'sv8','PRE':'sv8pt5','JTG':'sv9',
}

def name_slug(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

def make_filename(card):
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
    fail_log = []

    for i, card in enumerate(entries):
        set_code = card["setCode"]
        number   = card["number"]
        filename = make_filename(card)
        out_path = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(out_path) and os.path.getsize(out_path) > 5000:
            skipped += 1
            continue

        bare   = number.split("/")[0].strip()
        padded = bare.zfill(3) if bare.isdigit() else bare
        bare_int = str(int(bare)) if bare.isdigit() else bare

        # 1. Try Limitless LG then standard
        data_bytes = (
            try_url(session, f"{LIMITLESS}/{set_code}/{set_code}_{padded}_R_EN_LG.png") or
            try_url(session, f"{LIMITLESS}/{set_code}/{set_code}_{padded}_R_EN.png")
        )
        source = "limitless"

        # 2. Fallback: pokemontcg.io hires
        if not data_bytes:
            tcgio_id = TCGIO_MAP.get(set_code)
            if tcgio_id:
                data_bytes = try_url(session, f"{TCGIO}/{tcgio_id}/{bare_int}_hires.png")
                if data_bytes:
                    source = "tcgio"

        if data_bytes:
            open(out_path, "wb").write(data_bytes)
            print(f"[{i+1}/{len(entries)}] OK  {filename}  ({len(data_bytes)//1024}kB) [{source}]")
            downloaded += 1
        else:
            print(f"[{i+1}/{len(entries)}] FAIL  {set_code} {number}")
            fail_log.append({"set": set_code, "number": number, "cardName": card.get("cardName", "")})
            failed += 1

        time.sleep(DELAY)

    print(f"\n✓ Downloaded:{downloaded}  Skipped:{skipped}  ✗ Failed:{failed}")
    if fail_log:
        json.dump(fail_log, open("en_cameo_failures.json", "w"), indent=2)
        print(f"Failures saved to en_cameo_failures.json")
        print("Failed sets:", dict(Counter(f["set"] for f in fail_log).most_common()))

if __name__ == "__main__":
    main()
