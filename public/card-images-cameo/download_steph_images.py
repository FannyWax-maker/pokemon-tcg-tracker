"""
Download card images for Steph's cameo collection using TCGdex EN images.
Matches JP card name to EN card in the same set to get the correct image URL.

Run from: C:/Users/tonyb/Downloads/pokemon-tcg-project/tracker-patched/
Output:   public/card-images-steph/
Requires: pip install requests
"""
import json, os, time, requests, re

DATA_FILE  = "src/data/steph/pokemon_data.json"
OUTPUT_DIR = "public/card-images-steph"
BASE_URL   = "https://assets.tcgdex.net/en"
API_BASE   = "https://api.tcgdex.net/v2/en/sets"
DELAY      = 0.4

# JP set code -> EN set code on TCGdex
EN_SET_MAP = {
    'XY2':  'xy2',   # Wild Blaze -> Flashfire
    'XY3':  'xy3',   # Rising Fist -> Furious Fists
    'DCGR': 'dc1',   # Double Crisis
    'XY5':  'xy5',   # Emerald Break -> Roaring Skies
    'XY6':  'xy6',   # Legendary Shine -> Ancient Origins (partial)
    'XY6B': 'xy6',   # Blue Shock -> Ancient Origins (partial)
    'XY7':  'xy7',   # Bandit Ring -> BREAKthrough
    'XY8':  'xy8',   # Rage of Broken Heavens -> BREAKpoint
    'CP4':  'g1',    # PokeKyun -> Generations
    'XY9':  'xy9',   # Awakening Psychic King -> Fates Collide
    'XY10': 'xy10',  # Cruel Traitor -> Steam Siege
}

def safe(s): return re.sub(r'[^a-z0-9_]', '_', (s or '').lower().strip())
def make_filename(card):
    sc  = card.get('jpSetCode', '')
    num = card.get('jpNumber', '').split('/')[0]
    name = safe(card.get('cardName', ''))
    return f"{sc}.{num}.{name}_.png"

def fetch_set_cards(en_set_code):
    url = f"{API_BASE}/{en_set_code}"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            # Build name -> localId map
            name_map = {}
            for c in data.get('cards', []):
                name_map[c['name'].lower()] = c['localId']
            return name_map, data.get('cards', [])
    except Exception as e:
        print(f"  Error fetching {en_set_code}: {e}")
    return {}, []

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    data = json.load(open(DATA_FILE, encoding='utf-8'))

    seen = set()
    cards = [c for p in data for c in p['cards'] if c['id'] not in seen and not seen.add(c['id'])]
    print(f"Unique cards: {len(cards)}")

    # Pre-fetch all set card lists
    set_cache = {}
    for jp_set, en_set in EN_SET_MAP.items():
        if en_set not in set_cache:
            print(f"Fetching EN set {en_set}...")
            name_map, all_cards = fetch_set_cards(en_set)
            set_cache[en_set] = {'names': name_map, 'cards': all_cards}
            time.sleep(0.5)

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    downloaded = skipped = failed = 0
    failed_list = []

    for i, card in enumerate(cards):
        jp_set   = card.get('jpSetCode', '')
        jp_num   = card.get('jpNumber', '')
        card_name = card.get('cardName', '')

        filename = make_filename(card)
        out_path = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(out_path):
            skipped += 1
            continue

        # Skip promos for now
        if jp_set in ('XY-P', 'SM-P'):
            print(f"[{i+1}/{len(cards)}] SKIP promo {jp_set} {jp_num}")
            skipped += 1
            continue

        en_set = EN_SET_MAP.get(jp_set)
        if not en_set:
            print(f"[{i+1}/{len(cards)}] No EN set for {jp_set}")
            failed_list.append({'id': card['id'], 'reason': f'no en set for {jp_set}'})
            failed += 1
            continue

        set_data = set_cache.get(en_set, {})
        name_map = set_data.get('names', {})

        # Try name match
        local_id = name_map.get(card_name.lower())

        # Fallback: try JP number as local ID
        if not local_id:
            jp_num_base = jp_num.split('/')[0].lstrip('0') or '0'
            local_id = jp_num_base

        url = f"{BASE_URL}/xy/{en_set}/{local_id}/high.webp"
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 200:
                open(out_path, 'wb').write(resp.content)
                print(f"[{i+1}/{len(cards)}] OK   {filename}  ({len(resp.content)//1024}kB) [{card_name} -> {local_id}]")
                downloaded += 1
            else:
                print(f"[{i+1}/{len(cards)}] {resp.status_code} {url} [{card_name}]")
                failed_list.append({'id': card['id'], 'jpSet': jp_set, 'jpNum': jp_num, 'cardName': card_name, 'tried': url})
                failed += 1
        except Exception as e:
            print(f"[{i+1}/{len(cards)}] ERR {e}")
            failed += 1

        time.sleep(DELAY)

    print(f"\nDone: {downloaded} downloaded, {skipped} skipped, {failed} failed")
    if failed_list:
        json.dump(failed_list, open('steph_failed.json', 'w'), indent=2)
        print("Failed saved to steph_failed.json")

if __name__ == "__main__":
    main()
