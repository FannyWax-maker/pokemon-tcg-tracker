import pandas as pd
import json

def extract_set_code(set_str):
    if pd.isna(set_str):
        return None
    parts = str(set_str).split('\n')
    return parts[-1].strip() if len(parts) > 1 else None

print("Loading spreadsheet...")
df = pd.read_excel('Copy_of_Our_Illustration_List__2_.xlsx')
print(f"Loaded {len(df)} rows")

df['dex_num'] = pd.to_numeric(df['Dex'].str.replace('#', '').str.strip(), errors='coerce')
df['gen_num'] = pd.to_numeric(df['Gen'].str.extract(r'Gen (\d+)')[0], errors='coerce')
df['SetCode'] = df['Set'].apply(extract_set_code)

pokemon_dict = {}

print("Building Pokemon data...")
for _, row in df.iterrows():
    if pd.isna(row['dex_num']):
        continue
        
    dex = int(row['dex_num'])
    
    if dex not in pokemon_dict:
        pokemon_dict[dex] = {
            'id': dex,
            'name': row['Pokemon'],
            'gen': int(row['gen_num']) if pd.notna(row['gen_num']) else 1,
            'cards': []
        }
    
    set_code = row['SetCode']
    if pd.notna(set_code) and str(set_code).strip():
        card = {
            'id': f"{dex}_{len(pokemon_dict[dex]['cards'])}",
            'cardName': row['Card Name'] if pd.notna(row['Card Name']) else 'Full Art',
            'setCode': str(set_code).strip(),
            'number': str(row['Number']) if pd.notna(row['Number']) else '',
            'priceGBP': float(row['Price']) if pd.notna(row['Price']) else 0.0,
            'artist': row['Artist'] if pd.notna(row['Artist']) else 'Unknown',
            'availableLangs': ['EN'],
            'ownedLang': None,
            'isPrimary': True,
            'isSecondary': False
        }
        
        other = row.get('Other Pokemon ')
        if pd.notna(other) and str(other).strip():
            card['otherPokemon'] = [p.strip() for p in str(other).split(',')]
        
        pokemon_dict[dex]['cards'].append(card)

print("Adding secondary cards...")
# Build name-to-dex lookup ONCE (optimization)
name_to_dex = {p['name']: dex for dex, p in pokemon_dict.items()}

secondary_count = 0
for dex, pokemon in list(pokemon_dict.items()):  # Use list() to avoid modification during iteration
    for card in list(pokemon['cards']):  # Use list() to copy
        if 'otherPokemon' in card and not card.get('isSecondary'):  # Only process primary cards
            for other_name in card['otherPokemon']:
                other_dex = name_to_dex.get(other_name)
                if other_dex and other_dex in pokemon_dict:
                    sec_card = {
                        'id': card['id'],
                        'cardName': card['cardName'],
                        'setCode': card['setCode'],
                        'number': card['number'],
                        'priceGBP': card['priceGBP'],
                        'artist': card['artist'],
                        'availableLangs': card['availableLangs'],
                        'ownedLang': None,
                        'isPrimary': False,
                        'isSecondary': True,
                        'primaryPokemon': pokemon['name']
                    }
                    pokemon_dict[other_dex]['cards'].append(sec_card)
                    secondary_count += 1

print(f"Added {secondary_count} secondary card references")

pokemon_list = sorted(list(pokemon_dict.values()), key=lambda p: p['id'])

print("Saving to file...")
with open('src/data/pokemon_data.json', 'w') as f:
    json.dump(pokemon_list, f, indent=2)

print(f"\nSUCCESS!")
print(f"  Pokemon: {len(pokemon_list)}")
print(f"  Total cards: {sum(len(p['cards']) for p in pokemon_list)}")

arcanine = next((p for p in pokemon_list if p['name'] == 'Arcanine'), None)
if arcanine:
    print(f"\nArcanine: #{arcanine['id']:04d}, {len(arcanine['cards'])} cards")
    for card in arcanine['cards']:
        if not card.get('isSecondary'):
            print(f"    - {card['cardName']} ({card['setCode']} {card['number']})")

print("\nDone! Run: npm run dev")