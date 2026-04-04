import { useState, useCallback } from 'react';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMgDPDy9wpz2YFJoYuYaDQfZ2u5uou3wYQgL6ULUSZDbaJTMNLFDC-Ho57qRHAJ6Osug/exec';
const MAX_CONCURRENT = 2;

const memCache = {};
const inFlight = {};
let activeCount = 0;
const queue = [];
let echoBase = null; // resolved googleusercontent base URL + lib param

function processQueue() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const { fn, resolve, reject } = queue.shift();
    activeCount++;
    fn().then(resolve).catch(reject).finally(() => {
      activeCount--;
      processQueue();
    });
  }
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

function lsKey(cardId) { return `price_v2_${cardId}`; }

function loadFromLS(cardId) {
  try {
    const raw = localStorage.getItem(lsKey(cardId));
    if (!raw) return undefined;
    const { ts, gbp } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(lsKey(cardId)); return undefined; }
    return gbp;
  } catch { return undefined; }
}

function saveToLS(cardId, gbp) {
  try { localStorage.setItem(lsKey(cardId), JSON.stringify({ ts: Date.now(), gbp })); } catch {}
}

// Resolve the stable googleusercontent base by following the redirect once
async function resolveEchoBase() {
  if (echoBase) return echoBase;
  const res = await fetch(`${APPS_SCRIPT_URL}?action=ping&_t=${Date.now()}`, { redirect: 'follow' });
  const finalUrl = res.url; // This is the googleusercontent.com URL after redirect
  if (finalUrl && finalUrl.includes('googleusercontent.com')) {
    const u = new URL(finalUrl);
    const lib = u.searchParams.get('lib');
    if (lib) {
      echoBase = `https://script.googleusercontent.com/macros/echo?lib=${lib}`;
      return echoBase;
    }
  }
  // Fallback: use Apps Script URL directly
  echoBase = APPS_SCRIPT_URL;
  return echoBase;
}

async function fetchPrice(cardId, setCode, number) {
  const base = await resolveEchoBase();
  const params = `&action=getPrice&cardId=${encodeURIComponent(cardId)}&setCode=${encodeURIComponent(setCode)}&number=${encodeURIComponent(number)}&_t=${Date.now()}`;
  const url = base.includes('googleusercontent') 
    ? `${base}${params}`
    : `${base}?action=getPrice&cardId=${encodeURIComponent(cardId)}&setCode=${encodeURIComponent(setCode)}&number=${encodeURIComponent(number)}&_t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`error ${res.status}`);
  const json = await res.json();
  return typeof json.price === 'number' ? json.price : null;
}

export function usePrices() {
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  // Kick off base URL resolution immediately
  resolveEchoBase().catch(() => {});

  const getPriceForCard = useCallback((card) => {
    if (!card.setCode) return null;
    const number = (card.number || card.setNumber || '').split('/')[0];
    if (!number) return null;
    const cardId = card.id;

    if (cardId in memCache) {
      const gbp = memCache[cardId];
      return gbp !== null ? { gbp, usd: null } : null;
    }

    const cached = loadFromLS(cardId);
    if (cached !== undefined) {
      memCache[cardId] = cached;
      return cached !== null ? { gbp: cached, usd: null } : null;
    }

    if (!inFlight[cardId]) {
      inFlight[cardId] = enqueue(() => fetchPrice(cardId, card.setCode, number))
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
    return null;
  }, [forceUpdate]);

  return { getPriceForCard };
}
