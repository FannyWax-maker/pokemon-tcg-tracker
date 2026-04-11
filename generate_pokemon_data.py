"""
Generate pokemon_data.json from Illustration_List_for_App.xlsx
Run this whenever you update the spreadsheet.

Usage:
  python generate_pokemon_data.py

Edit the paths below to match your setup.
"""

import pandas as pd, json

XLSX_PATH = r'C:\Users\steph\Downloads\pokemon-tcg-project\tracker-patched\public\Illustration_List_for_App.xlsx'
OUTPUT_PATH = r'C:\Users\steph\Downloads\pokemon-tcg-project\tracker-patched\src\data\pokemon_data.json'

# ─────────────────────────────────────────────────────────────────────────────

df = pd.read_excel(XLSX_PATH, header=None)
df.columns = df.iloc[0]
df = df.iloc[1:].reset_index(drop=True)
df = df[df['Dex'].notna() & df['Pokemon'].notna()].copy()
df['dex_num'] = df['Dex'].str.extract(r'(\d+)').astype(int)
df['gen_num'] = df['Gen'].str.extract(r'Gen (\d+)').astype(float).fillna(0).astype(int)

def make_stable_id(dex_num, set_code, number):
    sc = str(set_code).lower().replace(' ', '')
    num = str(number).lower().replace('/', '-').replace(' ', '')
    return f"{dex_num}_{sc}_{num}"

def get_set_code(row):
    if pd.notna(row['English Set']) and str(row['English Set']).strip():
        return str(row['English Set']).strip()
    if pd.notna(row['Japanese Set']) and str(row['Japanese Set']).strip():
        return str(row['Japanese Set']).strip().split('/')[0]
    if pd.notna(row['Chinese Set']) and str(row['Chinese Set']).strip():
        return str(row['Chinese Set']).strip()
    return None

def get_available_langs(row):
    langs = []
    if pd.notna(row['English Set']): langs.append('EN')
    if pd.notna(row['Japanese Set']): langs.append('JP')
    if pd.notna(row['Chinese Set']): langs.append('CN')
    return langs or ['EN']

def get_exclusive(row):
    ex = row.get('Exclusive')
    if pd.isna(ex): return None
    s = str(ex).strip().lower()
    if 'japanese' in s or s == 'jp': return 'JP'
    if 'chinese' in s or s == 'cn': return 'CN'
    return None

def get_card_name(row):
    cn = row.get('Card Name')
    if pd.isna(cn) or not str(cn).strip(): return 'Full Art'
    return str(cn).strip().replace('\n', '').strip()

def name_to_part(name):
    if not name or str(name).strip() in ('', 'nan'): return ''
    return str(name).strip().lower().replace(' ', '_').replace("'", '').replace('.', '').replace('-', '_')

def num_to_part(num):
    if not num or str(num).strip() in ('', 'nan'): return ''
    return str(num).strip().lower().replace('/', '-')

output = []
for (dex_num, pokemon_name, gen_num), group in df.groupby(['dex_num', 'Pokemon', 'gen_num'], sort=True):
    cards = []
    for _, row in group.iterrows():
        num = str(row['Set Number']).strip() if pd.notna(row['Set Number']) else ''
        if not num or num == 'nan': continue
        sc = get_set_code(row)
        if not sc: continue

        excl = get_exclusive(row)
        langs = get_available_langs(row)
        others = row.get('Other Pokemon')
        other_list = [o.strip() for o in str(others).split(',') if o.strip()] if pd.notna(others) and str(others).strip() else None

        # Build artwork filename directly from data
        sc_lower = sc.lower().split('/')[0]
        artwork_fn = f"{sc_lower}.{num_to_part(num)}.{name_to_part(pokemon_name)}_.png"

        owned_val = row.get('Owned')
        owned_lang = None
        if owned_val is True:
            if excl == 'JP': owned_lang = 'JP'
            elif excl == 'CN': owned_lang = 'CN'
            else: owned_lang = 'EN'

        card = {
            'id': make_stable_id(dex_num, sc, num),  # STABLE ID
            'cardName': get_card_name(row),
            'setCode': sc,
            'number': num,
            'artist': str(row['Artist']).strip() if pd.notna(row['Artist']) else 'Unknown',
            'availableLangs': langs,
            'ownedLang': owned_lang,
            'isPrimary': True,
            'isSecondary': False,
            'artworkFilename': artwork_fn,
        }
        if excl: card['exclusive'] = excl
        if other_list: card['otherPokemon'] = other_list
        cards.append(card)

    output.append({'id': dex_num, 'name': pokemon_name.strip(), 'gen': gen_num, 'cards': cards})

# Fix known dex errors in spreadsheet
for p in output:
    if p['id'] == 20 and p['name'] == 'Rattata':
        p['id'] = 19
        for c in p['cards']:
            c['id'] = '19' + c['id'][2:]

# Merge duplicate dex IDs (spreadsheet typos)
from collections import defaultdict
by_id = defaultdict(list)
for p in output:
    by_id[p['id']].append(p)

correct_names = {282: 'Gardevoir', 334: 'Altaria', 527: 'Woobat', 547: 'Whimsicott', 873: 'Snom'}
merged, seen = [], set()
for p in output:
    if p['id'] in seen: continue
    seen.add(p['id'])
    dupes = by_id[p['id']]
    if len(dupes) == 1:
        merged.append(p)
    else:
        primary = next((d for d in dupes if d['name'] == correct_names.get(p['id'])), dupes[0])
        primary['cards'] = [c for d in dupes for c in d['cards']]
        merged.append(primary)
        print(f"Merged {[d['name'] for d in dupes]} -> {primary['name']}")

# Fix Snom(872)/Frosmoth(873)
for p in merged:
    if p['id'] == 873 and p['name'] == 'Snom':
        frosmoth_cards = [c for c in p['cards'] if c['setCode'] == 'ASR']
        snom_extra = [c for c in p['cards'] if c['setCode'] != 'ASR']
        snom_entry = next(e for e in merged if e['id'] == 872)
        snom_entry['cards'].extend(snom_extra)
        p['name'] = 'Frosmoth'
        p['cards'] = frosmoth_cards

# Add secondary card references from otherPokemon
by_name = {p['name']: p for p in merged}
for pokemon in merged:
    for card in list(pokemon['cards']):
        for other_name in (card.get('otherPokemon') or []):
            other_name = other_name.strip()
            if other_name in by_name:
                target = by_name[other_name]
                ref = {**card,
                    'id': card['id'] + '_ref',
                    'isPrimary': False,
                    'isSecondary': True,
                    'primaryPokemon': pokemon['name'],
                    'ownedLang': None,
                }
                target['cards'].append(ref)

ids = [p['id'] for p in merged]
dupes = set(id for id in ids if ids.count(id) > 1)
print(f"Duplicate IDs: {dupes}")
print(f"Pokemon: {len(merged)}, Cards: {sum(len(p['cards']) for p in merged)}")

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(merged, f, indent=2, ensure_ascii=False)
print(f"Saved to {OUTPUT_PATH}")
