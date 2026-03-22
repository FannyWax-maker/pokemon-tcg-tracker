import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ENV_LABELS = [
  { score: 0, label: 'Blank / void',  desc: 'No background at all' },
  { score: 1, label: 'Minimal',       desc: 'Colour wash or gradient only' },
  { score: 2, label: 'Abstract',      desc: 'Background unclear or indistinct' },
  { score: 3, label: 'Partial',       desc: 'Some environmental elements' },
  { score: 4, label: 'Rich & clear',  desc: 'Fully identifiable environment' },
];

// Environment is worth 50% of total score, everything else shares the other 50%
// ENV_BASE: base score just from environment (0–50)
const ENV_BASE = [0, 8, 20, 38, 50];

// ── Conformance formula ──────────────────────────────────────────────────────
export function calcConformance(data) {
  const env        = data.environmentScore ?? null;
  const trainer    = data.trainerPresence  ?? 'none';
  const pokCount   = data.pokemonCount     ?? 1;
  const connecting = data.connectingCard   ?? false;
  const contact    = data.contactWithEnv   ?? false;
  const living     = data.nonPokemonLiving ?? false;
  const unaware    = data.unawareOfViewer  ?? false;

  if (env === null) return null;

  // Environment base (0–50 pts)
  const envScore = ENV_BASE[env];

  // Additional Pokémon — diminishing returns, each adds to bonus pool (max ~15 pts)
  const additional = Math.max(0, pokCount - 1);
  let pokBonus = 0;
  for (let i = 0; i < additional; i++) {
    if      (i === 0) pokBonus += 8;
    else if (i === 1) pokBonus += 5;
    else if (i === 2) pokBonus += 3;
    else              pokBonus += 1;
  }

  // Trainer gated by environment (max 12 pts)
  let trainerBonus = 0;
  if      (env >= 4 && trainer === 'interacting') trainerBonus = 12;
  else if (env >= 3 && trainer === 'interacting') trainerBonus = 8;
  else if (env >= 3 && trainer === 'present')     trainerBonus = 4;

  // Boolean bonuses (each ~5–8 pts, scaled so all four = ~25 pts on a rich env card)
  const connectingBonus = connecting            ? 6  : 0;
  const contactBonus    = (contact && env >= 3) ? 8  : 0;
  const livingBonus     = living                ? 7  : 0;
  const unawareBonus    = unaware               ? 6  : 0;

  const total = envScore + pokBonus + trainerBonus + connectingBonus + contactBonus + livingBonus + unawareBonus;
  return Math.min(100, Math.round(total));
}

export function conformanceColor(pct) {
  if (pct === null || pct === undefined) return '#9ca3af';
  if (pct >= 80) return '#f59e0b';
  if (pct >= 60) return '#22c55e';
  if (pct >= 35) return '#f59e0b';
  return '#ef4444';
}

// ── Image loading ────────────────────────────────────────────────────────────
const imageCache = {};
const MAX_CONCURRENT = 6;
let activeRequests = 0;
const requestQueue = [];
const enqueueImageLoad = (fn) => new Promise((resolve, reject) => {
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

const generateImagePaths = (card, pokemonName) => {
  const displayPokemon = card.isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName;
  const setCode = (card.setCode || card.jpSetCode || card.cnSetCode || '').toLowerCase();
  const pokemon = displayPokemon.toLowerCase().replace(/\s+/g, '_').replace(/[.']/g, '');
  const number  = (card.setNumber || card.number || '').toLowerCase();
  const numDash = number.replace(/\//g, '-');
  const numOnly = number.split('/')[0];
  const hasSet  = numOnly.toLowerCase().startsWith(setCode);
  const paths = [];
  if (hasSet) {
    paths.push(`.${numDash}.${pokemon}_`);
    paths.push(`.${numOnly}.${pokemon}_`);
  } else {
    paths.push(`${setCode}.${numDash}.${pokemon}_`);
    paths.push(`${setCode}.${numOnly}.${pokemon}_`);
    paths.push(`${setCode}.${numDash}.${pokemon}`);
    paths.push(`${setCode}.${numOnly}.${pokemon}`);
    paths.push(`.${numDash}.${pokemon}_`);
    paths.push(`.${numOnly}.${pokemon}_`);
  }
  paths.push(`${setCode.toUpperCase()}_${numOnly}_R_EN_LG`);
  return [...new Set(paths)];
};

function useCardImage(card, pokemonName) {
  const cacheKey = card.id;
  const [imageSrc, setImageSrc] = useState(imageCache[cacheKey]?.src || null);
  useEffect(() => {
    if (imageCache[cacheKey]) { setImageSrc(imageCache[cacheKey].src); return; }
    let mounted = true;
    const paths    = generateImagePaths(card, pokemonName);
    const allPaths = paths.flatMap(p => [
      `/pokemon-tcg-tracker/card-images/${p}.png`,
      `/pokemon-tcg-tracker/card-images/${p}.jpg`,
    ]);
    const tryPath = (src) => enqueueImageLoad(() => new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(src); img.onerror = rej; img.src = src;
    }));
    (async () => {
      let found = null;
      for (const src of allPaths) {
        if (!mounted) return;
        try { found = await tryPath(src); break; } catch (_) {}
      }
      if (!mounted) return;
      imageCache[cacheKey] = { src: found };
      setImageSrc(found);
    })();
    return () => { mounted = false; };
  }, [cacheKey]);
  return imageSrc;
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function YesNo({ value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-bold shrink-0">
      {[true, false].map(v => (
        <button key={String(v)} onClick={() => onChange(value === v ? null : v)}
          className="px-3 py-1.5 transition-colors"
          style={value === v
            ? { background: v ? '#22c55e' : '#ef4444', color: 'white' }
            : { background: '#f9fafb', color: '#9ca3af' }}>
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

function ConformanceMeter({ pct }) {
  if (pct === null) return (
    <div className="text-center py-1">
      <div className="text-2xl font-black text-gray-400 opacity-40">—</div>
      <div className="text-[10px] text-gray-500 mt-0.5">Set environment to score</div>
    </div>
  );
  const color = conformanceColor(pct);
  const label = pct >= 80 ? '★ Highly conforming' : pct >= 60 ? 'Conforming' : pct >= 35 ? 'Partial' : 'Non-conforming';
  return (
    <div className="text-center">
      <div className="text-4xl font-black leading-none" style={{ color }}>{pct}%</div>
      <div className="text-[11px] font-bold mt-1" style={{ color }}>{label}</div>
      <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ReviewModal({ card, reviewData, onSave, onClose, onPrev, onNext, hasPrev, hasNext }) {
  const pokemonName = card.pokemonName || '';
  const imageSrc    = useCardImage(card, pokemonName);

  // Conformance inputs only
  const [environmentScore, setEnvironmentScore] = useState(reviewData.environmentScore ?? null);
  const [trainerPresence,  setTrainerPresence]  = useState(reviewData.trainerPresence  ?? 'none');
  const [pokemonCount,     setPokemonCount]     = useState(reviewData.pokemonCount     ?? 1);
  const [connectingCard,   setConnectingCard]   = useState(reviewData.connectingCard   ?? null);
  const [contactWithEnv,   setContactWithEnv]   = useState(reviewData.contactWithEnv   ?? null);
  const [nonPokemonLiving, setNonPokemonLiving] = useState(reviewData.nonPokemonLiving ?? null);
  const [unawareOfViewer,  setUnawareOfViewer]  = useState(reviewData.unawareOfViewer  ?? null);

  const [isDirty, setIsDirty] = useState(false);
  const dirty = () => setIsDirty(true);

  useEffect(() => {
    setEnvironmentScore(reviewData.environmentScore ?? null);
    setTrainerPresence(reviewData.trainerPresence   ?? 'none');
    setPokemonCount(reviewData.pokemonCount         ?? 1);
    setConnectingCard(reviewData.connectingCard     ?? null);
    setContactWithEnv(reviewData.contactWithEnv     ?? null);
    setNonPokemonLiving(reviewData.nonPokemonLiving ?? null);
    setUnawareOfViewer(reviewData.unawareOfViewer   ?? null);
    setIsDirty(false);
  }, [card.id]);

  const conformancePct = calcConformance({
    environmentScore, trainerPresence, pokemonCount,
    connectingCard, contactWithEnv, nonPokemonLiving, unawareOfViewer,
  });

  const buildData = () => ({
    environmentScore, trainerPresence, pokemonCount,
    connectingCard, contactWithEnv, nonPokemonLiving, unawareOfViewer,
    conformancePct,
    reviewedAt: new Date().toISOString(),
  });

  const handleSave        = () => { onSave(buildData()); setIsDirty(false); };
  const handleSaveAndNext = () => { onSave(buildData()); setIsDirty(false); onNext(); };

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft'  && hasPrev) { if (isDirty) handleSave(); onPrev(); }
      if (e.key === 'ArrowRight' && hasNext) { if (isDirty) handleSave(); onNext(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [hasPrev, hasNext, isDirty, environmentScore, trainerPresence, pokemonCount,
      connectingCard, contactWithEnv, nonPokemonLiving, unawareOfViewer]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative bg-white rounded-3xl shadow-2xl flex overflow-hidden"
        style={{ width: 'min(960px, 96vw)', height: 'min(90vh, 720px)' }}>

        {/* LEFT — image + score */}
        <div className="relative flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 shrink-0 py-6"
          style={{ width: '240px' }}>

          <button onClick={() => { if (isDirty) handleSave(); onPrev(); }} disabled={!hasPrev}
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold z-10 transition-all
              ${hasPrev ? 'bg-white/20 hover:bg-white/30 text-white' : 'text-white/20 cursor-not-allowed'}`}>‹</button>
          <button onClick={() => { if (isDirty) handleSave(); onNext(); }} disabled={!hasNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold z-10 transition-all
              ${hasNext ? 'bg-white/20 hover:bg-white/30 text-white' : 'text-white/20 cursor-not-allowed'}`}>›</button>

          {imageSrc
            ? <img src={imageSrc} alt={pokemonName} className="object-contain rounded-xl shadow-2xl" style={{ maxHeight: '320px', maxWidth: '185px' }} />
            : <div className="w-36 h-52 rounded-xl bg-gray-700 flex items-center justify-center"><span className="text-4xl opacity-30">🃏</span></div>
          }

          <div className="mt-3 text-center px-3 w-full">
            <div className="text-white font-black text-sm leading-tight">{pokemonName}</div>
            <div className="text-gray-400 text-xs mt-0.5 truncate">{card.cardName}</div>
            <div className="text-gray-500 text-xs">{card.setCode || card.jpSetCode} {card.number}</div>
          </div>

          <div className="mt-3 px-4 w-full">
            <div className="bg-black/40 rounded-2xl p-3">
              <ConformanceMeter pct={conformancePct} />
            </div>
          </div>

          <div className="absolute bottom-2 text-[9px] text-gray-600">← → navigate · auto-saves</div>
        </div>

        {/* RIGHT — controls */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black"
                style={{background:'linear-gradient(135deg,#8b5cf6,#7c3aed)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                Review Mode
              </span>
              {isDirty && <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">Unsaved</span>}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* ── CONFORMANCE ── */}
            <section className="rounded-2xl border-2 border-purple-100 bg-purple-50/40 p-4 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-500">Conformance Score</h3>

              {/* Environment — gatekeeper */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-700">Background environment</span>
                  <span className="text-[10px] font-bold text-purple-400">multiplies all other scores</span>
                </div>
                <div className="flex gap-1.5">
                  {ENV_LABELS.map(({ score, label, desc }) => (
                    <button key={score} onClick={() => { setEnvironmentScore(environmentScore === score ? null : score); dirty(); }}
                      title={desc}
                      className="flex-1 py-2 rounded-xl text-[10px] font-bold border-2 transition-all text-center"
                      style={environmentScore === score
                        ? { background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: 'white', borderColor: '#7c3aed' }
                        : { background: 'white', color: '#9ca3af', borderColor: '#e9d5ff' }}>
                      <div className="text-sm font-black leading-none mb-0.5">{score}</div>
                      <div className="leading-tight text-[9px]">{label.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-gray-400 mt-1 text-center">
                  {environmentScore !== null ? ENV_LABELS[environmentScore].desc : 'Tap a score — this multiplies everything else'}
                </div>
              </div>

              {/* Trainer */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-700">Trainer in card</div>
                  {environmentScore !== null && environmentScore < 3 && trainerPresence !== 'none' && (
                    <div className="text-[9px] text-amber-500 font-bold">⚠ Env &lt; 3 — scores 0</div>
                  )}
                </div>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-bold shrink-0">
                  {[['none','None'],['present','Present'],['interacting','Interacting']].map(([val,label]) => (
                    <button key={val} onClick={() => { setTrainerPresence(val); dirty(); }}
                      className="px-2.5 py-1.5 transition-colors"
                      style={trainerPresence === val
                        ? { background: val === 'interacting' ? '#8b5cf6' : val === 'present' ? '#a78bfa' : '#e5e7eb', color: val === 'none' ? '#6b7280' : 'white' }
                        : { background: '#f9fafb', color: '#9ca3af' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pokémon count */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-700">Pokémon in artwork</div>
                  <div className="text-[9px] text-gray-400">2nd +3 · 3rd +2 · 4th +1 · diminishing</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setPokemonCount(c => Math.max(1,c-1)); dirty(); }}
                    className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 font-bold flex items-center justify-center">−</button>
                  <input type="number" min="1" max="20" value={pokemonCount}
                    onChange={(e) => { setPokemonCount(Math.max(1,parseInt(e.target.value)||1)); dirty(); }}
                    className="w-12 text-center border border-gray-200 rounded-lg py-1 text-sm font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                  <button onClick={() => { setPokemonCount(c => c+1); dirty(); }}
                    className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 font-bold flex items-center justify-center">+</button>
                </div>
              </div>

              {/* Boolean flags */}
              {[
                { label: 'Has a connecting card',        key: 'connectingCard',   val: connectingCard,   set: setConnectingCard },
                { label: 'Pokémon touching environment', key: 'contactWithEnv',   val: contactWithEnv,   set: setContactWithEnv,
                  warning: environmentScore !== null && environmentScore < 3 ? 'Needs env ≥ 3 to score' : null },
                { label: 'Non-Pokémon living things',    key: 'nonPokemonLiving', val: nonPokemonLiving, set: setNonPokemonLiving },
                { label: 'Pokémon unaware of viewer',    key: 'unawareOfViewer',  val: unawareOfViewer,  set: setUnawareOfViewer },
              ].map(({ label, key, val, set, warning }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-gray-700">{label}</div>
                    {warning && <div className="text-[9px] text-amber-500 font-bold">⚠ {warning}</div>}
                  </div>
                  <YesNo value={val} onChange={(v) => { set(v); dirty(); }} />
                </div>
              ))}
            </section>

          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3 border-t border-gray-100 flex gap-2">
            <button onClick={handleSave}
              className="flex-1 py-2 rounded-xl text-sm font-bold border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors">
              Save
            </button>
            <button onClick={handleSaveAndNext} disabled={!hasNext}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: hasNext ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : '#e5e7eb' }}>
              Save & Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
