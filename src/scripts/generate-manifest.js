// src/scripts/generate-manifest.js
// Run before build to generate manifests for all card image folders
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const dirs = [
  { dir: join(root, 'public', 'card-images'),           out: join(root, 'public', 'card-images',           'manifest.json') },
  { dir: join(root, 'public', 'card-images-cameo'),     out: join(root, 'public', 'card-images-cameo',     'manifest.json') },
  { dir: join(root, 'public', 'card-images-jp'),        out: join(root, 'public', 'card-images-jp',        'manifest.json') },
  { dir: join(root, 'public', 'card-images-cameo-jp'),  out: join(root, 'public', 'card-images-cameo-jp',  'manifest.json') },
  { dir: join(root, 'public', 'card-images-cn'),        out: join(root, 'public', 'card-images-cn',        'manifest.json') },
];

for (const { dir, out } of dirs) {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const files = readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp'));
    writeFileSync(out, JSON.stringify(files));
    console.log(`✓ manifest.json generated: ${files.length} images (${dir.split(/[\\/]/).pop()})`);
  } catch (e) {
    console.error(`Failed to generate manifest for ${dir}:`, e.message);
    writeFileSync(out, '[]');
  }
}
