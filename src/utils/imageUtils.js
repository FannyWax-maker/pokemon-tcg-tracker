// Shared image loading utilities for CardTile and ReviewModal

export const imageCache = {};

export function clearImageCache() {
  Object.keys(imageCache).forEach(k => delete imageCache[k]);
}

// Single manifest cache for all folders
const manifestCache = {};
const manifestInFlights = {};

const getManifestForFolder = (folder) => {
  if (manifestCache[folder]) return Promise.resolve(manifestCache[folder]);
  if (manifestInFlights[folder]) return manifestInFlights[folder];
  manifestInFlights[folder] = fetch(`/pokemon-tcg-tracker/${folder}/manifest.json`)
    .then(r => r.json())
    .then(files => { manifestCache[folder] = new Set(files.map(f => f.toLowerCase())); return manifestCache[folder]; })
    .catch(() => { manifestCache[folder] = new Set(); return manifestCache[folder]; });
  return manifestInFlights[folder];
};

export const getManifest       = () => getManifestForFolder('card-images');
export const getCameoManifest  = () => getManifestForFolder('card-images-cameo');
export const getCameoJpManifest = () => getManifestForFolder('card-images-cameo-jp');
export const getCameoCnManifest = () => getManifestForFolder('card-images-cameo-cn');
export const getJpManifest     = () => getManifestForFolder('card-images-jp');
export const getCnManifest     = () => getManifestForFolder('card-images-cn');

// Pre-fetch all manifests on load
getManifest(); getCameoManifest(); getCameoJpManifest(); getJpManifest(); getCnManifest();

// Request queue
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

export const generateImagePaths = (card, pokemonName, appMode = 'fullart') => {
  const isSecondary = card.isSecondary || !card.isPrimary;
  const displayPokemon = isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName;

  const fileSubject = appMode === 'cameos'
    ? (card.cardName || displayPokemon).toLowerCase().replace(/[^a-z0-9]/g, '')
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
