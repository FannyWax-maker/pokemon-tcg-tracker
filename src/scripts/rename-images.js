// src/scripts/rename-images.js
// Normalises card image filenames to: setcode.NNN-MM.pokemon_.ext
// Run: node src/scripts/rename-images.js --dry-run
//      node src/scripts/rename-images.js

import { readdirSync, renameSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imageDir = join(__dirname, '..', '..', 'public', 'card-images');
const dryRun = process.argv.includes('--dry-run');

if (dryRun) console.log('DRY RUN — no files will be changed\n');

const files = readdirSync(imageDir).filter(f =>
  (f.endsWith('.png') || f.endsWith('.jpg')) && f !== 'manifest.json'
);

function parseFilename(file) {
  // Handle double extension: file.png.png → strip one
  let base = file;
  let ext = extname(file);
  let inner = extname(base.slice(0, -ext.length));
  if (inner === ext) {
    // Double extension — strip one
    base = base.slice(0, -ext.length);
    ext = inner;
  }
  base = base.slice(0, -ext.length);

  const parts = base.split('.');
  if (parts.length < 2) return null;

  // Handle sword_shield_promos prefix → swsh
  if (parts[0] === 'sword_shield_promos') {
    // sword_shield_promos.SWSH184.jolteon_ → swsh.swsh184.jolteon_
    // but since number already contains 'swsh', setCode should be ''
    return { setCode: '', numPart: parts[1].toLowerCase(), pokemon: parts.slice(2).join('.').replace(/_$/, ''), ext };
  }

  // Detect if first part is a number containing set code (e.g. swsh184, xy60)
  // These have no setCode prefix — they start with letters followed by digits
  if (parts.length === 2) {
    const first = parts[0];
    if (/^[a-z]+-?p?$/.test(first) === false && /^[a-z]+\d/i.test(first)) {
      return { setCode: '', numPart: parts[0], pokemon: parts[1].replace(/_$/, ''), ext };
    }
  }

  // Dot-prefixed files: .swsh184.jolteon_ (first part is empty string)
  if (parts[0] === '') {
    if (parts.length >= 3) {
      return { setCode: '', numPart: parts[1], pokemon: parts.slice(2).join('.').replace(/_$/, ''), ext };
    }
    if (parts.length === 2) {
      return { setCode: '', numPart: parts[1], pokemon: '', ext };
    }
  }

  return {
    setCode: parts[0].toLowerCase(),
    numPart: parts[1],
    pokemon: parts.slice(2).join('.').replace(/_$/, ''),
    ext
  };
}

function normaliseNum(numPart) {
  // TG/GG with denominator: tg003-30, tg04-tg30 → tg003-30
  const tgMatch = numPart.match(/^(tg|gg)(\d+)-(?:tg|gg)?(\d+)$/i);
  if (tgMatch) {
    const [, prefix, num, total] = tgMatch;
    return `${prefix.toLowerCase()}${num.padStart(3, '0')}-${parseInt(total)}`;
  }

  // Standard num-total with optional letter prefix/suffix
  const dashMatch = numPart.match(/^([a-z]*)(\d+)-([^-]+)$/i);
  if (dashMatch) {
    const [, prefix, num, total] = dashMatch;
    // Strip leading zeros from denominator but keep letter suffixes (sv-p, sm-p, xy-p)
    const totalClean = total.replace(/^0+(?=\d)/, '');
    return `${prefix.toLowerCase()}${num.padStart(3, '0')}-${totalClean}`;
  }

  // Plain number with optional letter prefix (xy60, swsh184, sm25)
  const plainMatch = numPart.match(/^([a-z]*)(\d+)([a-z]*)$/i);
  if (plainMatch) {
    const [, prefix, num, suffix] = plainMatch;
    if (prefix) return `${prefix.toLowerCase()}${num}${suffix.toLowerCase()}`; // keep promo as-is
    return num.padStart(3, '0'); // plain number: pad to 3
  }

  return numPart.toLowerCase();
}

let renamed = 0, skipped = 0, errors = 0;

for (const file of files) {
  const parsed = parseFilename(file);
  if (!parsed) { skipped++; continue; }

  const { setCode, numPart, pokemon, ext } = parsed;
  if (!numPart) { skipped++; continue; }

  const normNum = normaliseNum(numPart);
  const pokemonClean = pokemon.toLowerCase();

  const canonical = setCode
    ? `${setCode}.${normNum}.${pokemonClean}_.${ext.slice(1)}`
    : `${normNum}.${pokemonClean}_.${ext.slice(1)}`;

  if (canonical === file) { skipped++; continue; }

  const target = join(imageDir, canonical);
  if (existsSync(target)) {
    console.log(`  SKIP (target exists): ${file} → ${canonical}`);
    skipped++;
    continue;
  }

  if (dryRun) {
    console.log(`  ${file} → ${canonical}`);
    renamed++;
  } else {
    try {
      renameSync(join(imageDir, file), target);
      console.log(`  ✓ ${file} → ${canonical}`);
      renamed++;
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`);
      errors++;
    }
  }
}

console.log(`\n${dryRun ? 'Would rename' : 'Renamed'}: ${renamed} | Skipped: ${skipped} | Errors: ${errors}`);
