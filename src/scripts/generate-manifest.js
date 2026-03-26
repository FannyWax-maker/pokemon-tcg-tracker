// src/scripts/generate-manifest.js
// Run before build to generate public/card-images/manifest.json

import { readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/scripts/ -> up two levels -> project root -> public/card-images
const imageDir = join(__dirname, '..', '..', 'public', 'card-images');
const outFile = join(imageDir, 'manifest.json');

try {
  const files = readdirSync(imageDir)
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  writeFileSync(outFile, JSON.stringify(files));
  console.log(`✓ manifest.json generated: ${files.length} images`);
} catch (e) {
  console.error('Failed to generate manifest:', e.message);
  writeFileSync(outFile, '[]');
}
