// usePrices.js
// Fetches EN market prices from TCGCSV (tcgcsv.com) — free, no auth, no CORS issues.
// Converts USD → GBP using live rate from frankfurter.app (free, no key).
// Caches prices per set in localStorage with a 24h TTL.
// Caches exchange rate in localStorage with a 24h TTL.

import { useState, useCallback } from 'react';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BASE = 'https://tcgcsv.com/tcgplayer/3';

const SET_CODE_REMAP = {
  SSH:  'SWSH01', RCL: 'SWSH02', DAA: 'SWSH03', VIV: 'SWSH04',
  BST:  'SWSH05', CRE: 'SWSH06', EVS: 'SWSH07', FST: 'SWSH08',
  BRS:  'SWSH09', ASR: 'SWSH10', LOR: 'SWSH11', SIT: 'SWSH12',
  CPA:  'CHP',    CEL: 'CLB',    SWSH: 'SWSD',
  SUM:  'SM01',   GRI: 'SM02',   SLG: 'SHL',    UPR: 'SM05',
  LOT:  'SM8',    TEU: 'SM9',    UNB: 'SM10',   UNM: 'SM11',
  CEC:  'SM12',   CLG: 'CL',
};

// Sets where TCGCSV abbreviation is ambiguous or cards split into sub-groups
const GROUP_ID_OVERRIDE = {
  XYP:      1451,   // XY Promos (abbr 'PR' is shared)
  BWP:      1407,   // BW Promos (abbr 'PR' is shared)
  // Trainer Gallery sub-sets — keyed as SETCODE_TG
  BRS_TG:   3020,   // Brilliant Stars Trainer Gallery
  ASR_TG:   3068,   // Astral Radiance Trainer Gallery
  LOR_TG:   3172,   // Lost Origin Trainer Gallery
  SIT_TG:   17674,  // Silver Tempest Trainer Gallery
  // Crown Zenith Galactic Gallery — keyed as CRZ_GG
  CRZ_GG:   17689,  // Crown Zenith: Galactic Gallery
  // Radiant Collection sub-sets — keyed as SETCODE_RC
  GEN_RC:   1729,   // Generations: Radiant Collection
  LTR_RC:   1465,   // Legendary Treasures: Radiant Collection
  // Hidden Fates Shiny Vault — keyed as HIF_SV
  HIF_SV:   2594,   // Hidden Fates: Shiny Vault
  // Shining Fates Shiny Vault — keyed as SHF_SV
  SHF_SV:   2781,   // Shining Fates: Shiny Vault
  // Crown Zenith: Galarian Gallery (CRZ:GG already handled above)
  // Celebrations: Classic Collection — keyed as CEL_CC
  CEL_CC:   2931,   // Celebrations: Classic Collection
};

// Resolve which cache key and groupId to use for a card
function resolveKey(setCode, number) {
  const n = (number || '').toUpperCase();
  if (n.startsWith('TG')) {
    const k = setCode + '_TG';
    if (GROUP_ID_OVERRIDE[k]) return { cacheKey: k, groupIdOverride: GROUP_ID_OVERRIDE[k] };
  }
  if (n.startsWith('GG')) {
    const k = setCode + '_GG';
    if (GROUP_ID_OVERRIDE[k]) return { cacheKey: k, groupIdOverride: GROUP_ID_OVERRIDE[k] };
  }
  if (n.startsWith('RC')) {
    const k = setCode + '_RC';
    if (GROUP_ID_OVERRIDE[k]) return { cacheKey: k, groupIdOverride: GROUP_ID_OVERRIDE[k] };
  }
  if (n.startsWith('SV') && (setCode === 'HIF' || setCode === 'SHF')) {
    const k = setCode + '_SV';
    if (GROUP_ID_OVERRIDE[k]) return { cacheKey: k, groupIdOverride: GROUP_ID_OVERRIDE[k] };
  }
  // Classic Collection cards in Celebrations use CC prefix
  if (n.startsWith('CC') && setCode === 'CEL') {
    return { cacheKey: 'CEL_CC', groupIdOverride: GROUP_ID_OVERRIDE['CEL_CC'] };
  }
  const abbr = SET_CODE_REMAP[setCode] || setCode;
  return { cacheKey: abbr, groupIdOverride: GROUP_ID_OVERRIDE[setCode] || null };
}

const priceCache = {};
const inFlight = {};
const failed = new Set();
let usdToGbp = null;
let fxInFlight = null; // deduplicate concurrent FX fetches

function lsKey(abbr) { return `tcgcsv_v1_${abbr}`; }

function loadFromLS(abbr) {
  try {
    const raw = localStorage.getItem(lsKey(abbr));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(lsKey(abbr)); return null; }
    return data;
  } catch { return null; }
}

function saveToLS(abbr, data) {
  try { localStorage.setItem(lsKey(abbr), JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function getUsdToGbp() {
  if (usdToGbp) return usdToGbp;
  if (fxInFlight) return fxInFlight;
  fxInFlight = (async () => {
    try {
      const cached = localStorage.getItem('tcgcsv_usd_gbp');
      if (cached) {
        const { ts, rate } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS) { usdToGbp = rate; return rate; }
      }
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=GBP');
      if (!res.ok) throw new Error('fx fetch failed');
      const json = await res.json();
      usdToGbp = json.rates.GBP;
      localStorage.setItem('tcgcsv_usd_gbp', JSON.stringify({ ts: Date.now(), rate: usdToGbp }));
      return usdToGbp;
    } catch {
      usdToGbp = 0.79;
      return usdToGbp;
    }
  })();
  return fxInFlight;
}

function buildMap(data) {
  const pidToNumber = new Map(data.products);
  const pidToPrice = new Map(data.prices.map(([id, n, h]) => [id, { normal: n, holofoil: h }]));
  const byNumber = new Map();
  for (const [pid, number] of pidToNumber) {
    if (!number) continue;
    const p = pidToPrice.get(pid);
    if (!p) continue;
    byNumber.set(number.toLowerCase(), p);
  }
  return byNumber;
}

async function fetchAndCache(abbr, groupIdOverride) {
  let groupId = groupIdOverride;
  if (!groupId) {
    const groupsRes = await fetch(`${BASE}/groups`);
    if (!groupsRes.ok) throw new Error('groups fetch failed');
    const groups = await groupsRes.json();
    const group = groups.results.find(g => g.abbreviation === abbr);
    if (!group) throw new Error(`No TCGCSV group for: ${abbr}`);
    groupId = group.groupId;
  }

  const [prodRes, priceRes] = await Promise.all([
    fetch(`${BASE}/${groupId}/products`),
    fetch(`${BASE}/${groupId}/prices`),
  ]);
  if (!prodRes.ok || !priceRes.ok) throw new Error('products/prices fetch failed');
  const [prodJson, priceJson] = await Promise.all([prodRes.json(), priceRes.json()]);

  const products = prodJson.results
    .map(p => {
      const numField = (p.extendedData || []).find(e => e.name === 'Number');
      return [p.productId, numField ? numField.value : null];
    })
    .filter(([, n]) => n);

  const priceMap = {};
  for (const p of priceJson.results) {
    if (!priceMap[p.productId]) priceMap[p.productId] = {};
    const sub = (p.subTypeName || '').toLowerCase();
    if (sub === 'normal') priceMap[p.productId].normal = p.marketPrice;
    else if (sub === 'holofoil') priceMap[p.productId].holofoil = p.marketPrice;
  }
  const prices = Object.entries(priceMap).map(([id, v]) => [Number(id), v.normal ?? null, v.holofoil ?? null]);

  const data = { products, prices };
  saveToLS(abbr, data);
  return buildMap(data);
}

function ensureLoaded(abbr, onLoaded, groupIdOverride) {
  if (priceCache[abbr] || failed.has(abbr)) return;
  const stored = loadFromLS(abbr);
  if (stored) {
    priceCache[abbr] = buildMap(stored);
    onLoaded();
    return;
  }
  if (!inFlight[abbr]) {
    inFlight[abbr] = Promise.all([fetchAndCache(abbr, groupIdOverride || null), getUsdToGbp()])
      .then(([map]) => {
        priceCache[abbr] = map;
        delete inFlight[abbr];
        onLoaded();
      })
      .catch(() => {
        failed.add(abbr);
        delete inFlight[abbr];
      });
  }
}

export function usePrices() {
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const getPriceForCard = useCallback((card) => {
    if (!card.setCode) return null;
    const number = (card.number || card.setNumber || '');
    const { cacheKey, groupIdOverride } = resolveKey(card.setCode, number);

    // Kick off FX fetch once if not yet loaded (deduped by fxInFlight)
    if (!usdToGbp && !fxInFlight) getUsdToGbp().then(forceUpdate);

    ensureLoaded(cacheKey, forceUpdate, groupIdOverride);
    const byNumber = priceCache[cacheKey];
    if (!byNumber || !usdToGbp) return null;
    if (!number) return null;
    // Normalise number format: TCGCSV uses TG01/TG30, GG01/GG70 etc.
    // but spreadsheets often have TG01/30, GG01/70 — fix the suffix
    let lookupNumber = number.toLowerCase();
    // Normalise set totals: TCGCSV zero-pads the total (074/64 → 074/064)
    lookupNumber = lookupNumber.replace(/^(\d+)\/(\d+)$/, (_, a, b) => `${a}/${b.padStart(3, '0')}`);
    const tgMatch = lookupNumber.match(/^(tg\d+)\/(\d+)$/);
    if (tgMatch) lookupNumber = `${tgMatch[1]}/tg${tgMatch[2]}`;
    const ggMatch = lookupNumber.match(/^(gg\d+)\/(\d+)$/);
    if (ggMatch) lookupNumber = `${ggMatch[1]}/gg${ggMatch[2]}`;
    const rcMatch = lookupNumber.match(/^(rc\d+)\/(\d+)$/);
    if (rcMatch) lookupNumber = `${rcMatch[1]}/rc${rcMatch[2]}`;
    const svMatch = lookupNumber.match(/^(sv\d+)\/(\d+)$/);
    if (svMatch) lookupNumber = `${svMatch[1]}/sv${svMatch[2]}`;
    const p = byNumber.get(lookupNumber);
    if (!p) return null;
    const usd = p.normal ?? p.holofoil ?? null;
    if (usd === null) return null;
    return { gbp: usd * usdToGbp, usd };
  }, [forceUpdate]);

  return { getPriceForCard };
}
