// usePrices.js
// Routes price lookups through Google Apps Script (server-side) to avoid CORS issues.
// Apps Script fetches from pokemontcg.io and caches results in the Prices sheet.
// Client-side: caches per card in localStorage with 24h TTL.

import { useState, useCallback } from 'react';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMgDPDy9wpz2YFJoYuYaDQfZ2u5uou3wYQgL6ULUSZDbaJTMNLFDC-Ho57qRHAJ6Osug/exec';

const memCache = {};   // in-memory: cardId -> gbp
const inFlight = {};   // deduplicate concurrent fetches for same card

function lsKey(cardId) { return `price_v2_${cardId}`; }

function loadFromLS(cardId) {
  try {
    const raw = localStorage.getItem(lsKey(cardId));
    if (!raw) return undefined;
    const { ts, gbp } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(lsKey(cardId)); return undefined; }
    return gbp; // may be null (confirmed no price)
  } catch { return undefined; }
}

function saveToLS(cardId, gbp) {
  try { localStorage.setItem(lsKey(cardId), JSON.stringify({ ts: Date.now(), gbp })); } catch {}
}

async function fetchPrice(cardId, setCode, number) {
  const url = `${APPS_SCRIPT_URL}?action=getPrice&cardId=${encodeURIComponent(cardId)}&setCode=${encodeURIComponent(setCode)}&number=${encodeURIComponent(number)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apps Script error ${res.status}`);
  const json = await res.json();
  return json.price ?? null; // GBP value or null
}

export function usePrices() {
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const getPriceForCard = useCallback((card) => {
    if (!card.setCode) return null;
    const number = (card.number || card.setNumber || '').split('/')[0];
    if (!number) return null;

    const cardId = card.id;

    // Return from memory cache immediately if available
    if (cardId in memCache) {
      const gbp = memCache[cardId];
      return gbp !== null ? { gbp, usd: null } : null;
    }

    // Check localStorage
    const cached = loadFromLS(cardId);
    if (cached !== undefined) {
      memCache[cardId] = cached;
      return cached !== null ? { gbp: cached, usd: null } : null;
    }

    // Fetch from Apps Script (deduped)
    if (!inFlight[cardId]) {
      inFlight[cardId] = fetchPrice(cardId, card.setCode, number)
        .then(gbp => {
          memCache[cardId] = gbp;
          saveToLS(cardId, gbp);
          delete inFlight[cardId];
          forceUpdate();
        })
        .catch(() => {
          memCache[cardId] = null;
          delete inFlight[cardId];
        });
    }

    return null; // loading
  }, [forceUpdate]);

  return { getPriceForCard };
}
