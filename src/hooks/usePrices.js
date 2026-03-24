// usePrices.js
// Fetches EN market prices from TCGCSV (tcgcsv.com) — free, no auth, no CORS issues.
// Caches per set in localStorage with a 24h TTL.
// Returns getPriceForCard(card) → { normal, holofoil } | null

import { useRef, useCallback } from 'react';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BASE = 'https://tcgcsv.com/tcgplayer/3';
const CATEGORY_ID = 3; // Pokemon

// Map your EN set codes → TCGCSV abbreviation
// Direct matches (your code === TCGCSV abbreviation) need no entry here.
// Only remaps needed.
const SET_CODE_REMAP = {
  // SWSH era — TCGCSV uses SWSH01-SWSH12
  SSH:  'SWSH01', RCL: 'SWSH02', DAA: 'SWSH03', VIV: 'SWSH04',
  BST:  'SWSH05', CRE: 'SWSH06', EVS: 'SWSH07', FST: 'SWSH08',
  BRS:  'SWSH09', ASR: 'SWSH10', LOR: 'SWSH11', SIT: 'SWSH12',
  CPA:  'CHP',    CEL: 'CLB',    SWSH: 'SWSD',
  // SM era — TCGCSV uses SM01-SM12
  SUM:  'SM01',   GRI: 'SM02',   SLG: 'SHL',   UPR: 'SM05',
  LOT:  'SM8',    TEU: 'SM9',    UNB: 'SM10',   UNM: 'SM11',
  CEC:  'SM12',
  // Call of Legends uses 'CL' in TCGCSV
  CLG:  'CL',
};

// In-memory cache for this session (avoids re-parsing JSON each lookup)
const priceCache = {}; // setCode → { products: Map<number,name>, prices: Map<number,{normal,holofoil}> }
const inFlight = {}; // setCode → Promise

function lsKey(abbreviation) { return `tcgcsv_prices_${abbreviation}`; }

function loadFromLS(abbreviation) {
  try {
    const raw = localStorage.getItem(lsKey(abbreviation));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(lsKey(abbreviation)); return null; }
    return data; // { products: [[id, number], ...], prices: [[id, normal, holofoil], ...] }
  } catch { return null; }
}

function saveToLS(abbreviation, data) {
  try { localStorage.setItem(lsKey(abbreviation), JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// Build in-memory price lookup from stored/fetched data
function buildPriceMap(data) {
  // products: [[productId, cardNumber], ...]
  // prices:   [[productId, normal, holofoil], ...]
  const productToNumber = new Map(data.products); // productId → cardNumber (e.g. "139/195")
  const priceByProduct = new Map(data.prices.map(([id, n, h]) => [id, { normal: n, holofoil: h }]));
  // Build number → price (prefer Normal, fallback Holofoil)
  const byNumber = new Map();
  for (const [pid, number] of productToNumber) {
    if (!number) continue;
    const p = priceByProduct.get(pid);
    if (!p) continue;
    const key = number.toLowerCase();
    if (!byNumber.has(key)) byNumber.set(key, p);
  }
  return byNumber; // Map<cardNumber, {normal, holofoil}>
}

async function fetchSetPrices(abbreviation) {
  // 1. Fetch groups to find groupId for this abbreviation
  const groupsRes = await fetch(`${BASE}/groups`);
  if (!groupsRes.ok) throw new Error('groups fetch failed');
  const groups = await groupsRes.json();
  const group = groups.results.find(g => g.abbreviation === abbreviation);
  if (!group) throw new Error(`No group for abbreviation: ${abbreviation}`);
  const groupId = group.groupId;

  // 2. Fetch products and prices in parallel
  const [prodRes, priceRes] = await Promise.all([
    fetch(`${BASE}/${groupId}/products`),
    fetch(`${BASE}/${groupId}/prices`),
  ]);
  if (!prodRes.ok || !priceRes.ok) throw new Error('products/prices fetch failed');
  const [prodJson, priceJson] = await Promise.all([prodRes.json(), priceRes.json()]);

  // 3. Extract card number from extendedData
  const products = prodJson.results
    .map(p => {
      const numField = (p.extendedData || []).find(e => e.name === 'Number');
      const number = numField ? numField.value : null;
      return [p.productId, number];
    })
    .filter(([, n]) => n); // only cards with a number

  // 4. Build price table: productId → { normal, holofoil }
  // subTypeName can be: Normal, Holofoil, Reverse Holofoil, etc.
  const priceMap = {};
  for (const p of priceJson.results) {
    if (!priceMap[p.productId]) priceMap[p.productId] = {};
    const sub = (p.subTypeName || '').toLowerCase();
    if (sub === 'normal') priceMap[p.productId].normal = p.marketPrice;
    else if (sub === 'holofoil') priceMap[p.productId].holofoil = p.marketPrice;
  }

  const prices = Object.entries(priceMap).map(([id, v]) => [Number(id), v.normal ?? null, v.holofoil ?? null]);
  const data = { products, prices };
  saveToLS(abbreviation, data);
  return data;
}

async function ensureSetLoaded(abbreviation) {
  if (priceCache[abbreviation]) return priceCache[abbreviation];
  
  const stored = loadFromLS(abbreviation);
  if (stored) {
    priceCache[abbreviation] = buildPriceMap(stored);
    return priceCache[abbreviation];
  }

  // Deduplicate concurrent fetches for same set
  if (!inFlight[abbreviation]) {
    inFlight[abbreviation] = fetchSetPrices(abbreviation)
      .then(data => {
        priceCache[abbreviation] = buildPriceMap(data);
        delete inFlight[abbreviation];
        return priceCache[abbreviation];
      })
      .catch(err => {
        delete inFlight[abbreviation];
        throw err;
      });
  }
  return inFlight[abbreviation];
}

export function usePrices() {
  const loadingRef = useRef(new Set());

  // Trigger background load for a set; resolves silently, triggers re-render via forceUpdate
  const loadSetPrices = useCallback(async (setCode) => {
    const abbreviation = SET_CODE_REMAP[setCode] || setCode;
    if (priceCache[abbreviation] || loadingRef.current.has(abbreviation)) return;
    loadingRef.current.add(abbreviation);
    try {
      await ensureSetLoaded(abbreviation);
    } catch (e) {
      // Fail silently — prices are optional
    }
  }, []);

  // Synchronous lookup — returns null if not yet loaded
  const getPriceForCard = useCallback((card) => {
    if (!card.setCode) return null; // JP/CN/TC/KR-exclusive, no EN data
    const abbreviation = SET_CODE_REMAP[card.setCode] || card.setCode;
    const byNumber = priceCache[abbreviation];
    if (!byNumber) return null;
    const number = (card.number || card.setNumber || '').toLowerCase();
    if (!number) return null;
    return byNumber.get(number) || null;
  }, []);

  return { getPriceForCard, loadSetPrices };
}
