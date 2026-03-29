// src/scripts/cleanup-duplicates.js
import { readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imageDir = join(__dirname, '..', '..', 'public', 'card-images');
const dryRun = process.argv.includes('--dry-run');

if (dryRun) console.log('DRY RUN — no files will be deleted\n');

const files = readdirSync(imageDir).filter(f =>
  (f.endsWith('.png') || f.endsWith('.jpg')) && f !== 'manifest.json'
);

const parsed = [];
for (const file of files) {
  const ext = extname(file);
  const base = file.slice(0, -ext.length);
  const parts = base.split('.');
  if (parts.length < 2) continue;
  const setCode = parts[0];
  const numPart = parts[1];
  const pokemon = parts.slice(2).join('.').replace(/_$/, '');
  // Normalise key: strip -total so aor.021 and aor.021-98 group together
  const numBase = numPart.split('-')[0];
  const key = setCode + '.' + numBase;
  const size = statSync(join(imageDir, file)).size;
  parsed.push({ key, numPart, pokemon, file, size });
}

const byKey = {};
for (const p of parsed) {
  if (!byKey[p.key]) byKey[p.key] = [];
  byKey[p.key].push(p);
}

let deleted = 0;

for (const [key, group] of Object.entries(byKey)) {
  if (group.length < 2) continue;

  // Prefer: file with total in number (aor.021-98 over aor.021), then longer pokemon name, then larger file
  group.sort((a, b) => {
    const aHasTotal = a.numPart.includes('-') ? 1 : 0;
    const bHasTotal = b.numPart.includes('-') ? 1 : 0;
    if (bHasTotal !== aHasTotal) return bHasTotal - aHasTotal;
    if (b.pokemon.length !== a.pokemon.length) return b.pokemon.length - a.pokemon.length;
    return b.size - a.size;
  });

  const keeper = group[0];
  const toDelete = group.slice(1).filter(p => {
    // Only delete if pokemon names are related (one is prefix of other)
    const kb = keeper.pokemon.replace(/_/g, '');
    const pb = p.pokemon.replace(/_/g, '');
    return kb.startsWith(pb) || pb.startsWith(kb);
  });

  for (const p of toDelete) {
    if (dryRun) {
      console.log(`  DELETE: ${p.file}\n  KEEP:   ${keeper.file}\n`);
      deleted++;
    } else {
      try {
        unlinkSync(join(imageDir, p.file));
        console.log(`  ✓ deleted: ${p.file}`);
        deleted++;
      } catch (e) {
        console.error(`  ✗ ${p.file}: ${e.message}`);
      }
    }
  }
}

console.log(`\n${dryRun ? 'Would delete' : 'Deleted'}: ${deleted}`);
