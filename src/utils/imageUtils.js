// Shared image loading utilities for CardTile and ReviewModal
// Extracted to eliminate duplication and prevent double manifest fetches

// Global cache - images never reload after first load
export const imageCache = {};

// Clear all cached images (used when switching app modes)
export function clearImageCache() {
  Object.keys(imageCache).forEach(k => delete imageCache[k]);
}

// Manifest: set of all filenames in card-images/ (loaded once, avoids 404 waterfall)
let imageManifest = null;
let manifestInFlight = null;

export const getManifest = () => {
  if (imageManifest) return Promise.resolve(imageManifest);
  if (manifestInFlight) return manifestInFlight;
  manifestInFlight = fetch('/pokemon-tcg-tracker/card-images/manifest.json')
    .then(r => r.json())
    .then(files => { imageManifest = new Set(files); return imageManifest; })
    .catch(() => { imageManifest = new Set(); return imageManifest; });
  return manifestInFlight;
};

// Pre-fetch manifest immediately on module load
getManifest();

// Cameo manifest: set of all filenames in card-images-cameo/
let cameoManifestInFlight = null;
export const getCameoManifest = () => {
  if (cameoManifestInFlight) return cameoManifestInFlight;
  cameoManifestInFlight = fetch('/pokemon-tcg-tracker/card-images-cameo/manifest.json')
    .then(r => r.json()).then(files => new Set(files)).catch(() => new Set());
  return cameoManifestInFlight;
};

// Global request queue - limits concurrent image fetches to avoid GitHub Pages 429
const MAX_CONCURRENT = 6;
let activeRequests = 0;
const requestQueue = [];

export const enqueueImageLoad = (fn) => {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeRequests++;
      try { resolve(await fn()); }
      catch (e) { reject(e); }
      finally {
        activeRequests--;
        if (requestQueue.length > 0) requestQueue.shift()();
      }
    };
    activeRequests < MAX_CONCURRENT ? run() : requestQueue.push(run);
  });
};

// Generate all possible image filename paths for a card
export const generateImagePaths = (card, pokemonName, appMode = 'fullart') => {
  const isSecondary = card.isSecondary || !card.isPrimary;
  const displayPokemon = isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName;

  const fileSubject = appMode === 'cameos'
    ? (card.cardName || displayPokemon).toLowerCase().replace(/\s+/g, '_').replace(/[.'"]/g, '').replace(/[^a-z0-9_-]/g, '')
    : displayPokemon.toLowerCase().replace(/\s+/g, '_').replace(/[.']/g, '');

  const pokemon = fileSubject;
  const setCode = (card.setCode || card.jpSetCode || card.cnSetCode || '').toLowerCase();

  const rawNumber = appMode === 'cameos'
    ? (card.number || card.jpNumber || card.setNumber || '')
    : (card.setNumber || card.number || '');
  const number = rawNumber.toLowerCase();
  const numberOnly = number.split('/')[0];
  const numberAlreadyHasSet = numberOnly.startsWith(setCode) && setCode.length > 0;

  const numVariants = new Set([numberOnly]);
  const numParts = numberOnly.match(/^([a-z]*)(\d+)([a-z]*)$/);
  if (numParts) {
    const [, prefix, digits, suffix] = numParts;
    for (let pad = digits.length + 1; pad <= digits.length + 2; pad++) {
      numVariants.add(prefix + digits.padStart(pad, '0') + suffix);
    }
    numVariants.add(prefix + digits.replace(/^0+(?=\d)/, '') + suffix);
    numVariants.add(prefix + digits.replace(/^0(?=\d)/, '') + suffix);
  }

  const dashVariants = new Set();
  if (number.includes('/')) {
    const [rawNum, rawDen] = number.split('/');
    const denParts = rawDen.match(/^([a-z]*)(\d+)([a-z]*)$/);
    const denVariants = new Set([rawDen]);
    if (denParts) {
      const [, dp, dd, ds] = denParts;
      denVariants.add(dp + dd.padStart(3, '0') + ds);
      denVariants.add(dp + dd.replace(/^0+(?=\d)/, '') + ds);
      denVariants.add(dp + dd.replace(/^0(?=\d)/, '') + ds);
      if (dp) denVariants.add(dd.replace(/^0+(?=\d)/, ''));
    }
    for (const nv of numVariants) {
      for (const dv of denVariants) {
        dashVariants.add(nv + '-' + dv);
      }
    }
  } else {
    for (const nv of numVariants) dashVariants.add(nv);
  }

  const paths = [];
  const addPaths = (key) => {
    paths.push(setCode + '.' + key + '.' + pokemon + '_');
    paths.push(key + '.' + pokemon + '_');
    paths.push('.' + key + '.' + pokemon + '_');
    paths.push(setCode + '.' + key + '.' + pokemon);
  };

  if (numberAlreadyHasSet) {
    for (const nv of numVariants) addPaths(nv);
    for (const dv of dashVariants) addPaths(dv);
  } else {
    for (const dv of dashVariants) addPaths(dv);
    for (const nv of numVariants) addPaths(nv);
  }

  paths.push(setCode.toUpperCase() + '_' + numberOnly + '_R_EN_LG');
  return [...new Set(paths)];
};
