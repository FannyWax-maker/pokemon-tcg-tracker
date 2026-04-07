// src/scripts/generate-manifest.js
// Run before build to generate manifests for all card image folders
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const dirs = [
  'card-images',
  'card-images-cameo',
  'card-images-jp',
  'card-images-cameo-jp',
  'card-images-cn',
  'card-images-cameo-cn',
  'card-images-tc',
  'card-images-kr',
].map(name => ({
  dir: join(root, 'public', name),
  out: join(root, 'public', name, 'manifest.json'),
  name,
}));

for (const { dir, out, name } of dirs) {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const files = readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp'));
    writeFileSync(out, JSON.stringify(files));
    console.log(`✓ manifest.json generated: ${files.length} images (${name})`);
  } catch (e) {
    console.error(`Failed to generate manifest for ${dir}:`, e.message);
    writeFileSync(out, '[]');
  }
}
