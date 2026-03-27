import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ENV_LABELS = [
  { score: 1, label: 'Minimal',      desc: 'Colour wash or gradient only' },
  { score: 2, label: 'Abstract',     desc: 'Background unclear or indistinct' },
  { score: 3, label: 'Partial',      desc: 'Some environmental elements' },
  { score: 4, label: 'Rich & clear', desc: 'Fully identifiable environment' },
];
const ENV_LABEL_MAP = Object.fromEntries(ENV_LABELS.map(e => [e.score, e]));

// Environment is worth 50% of total score, everything else shares the other 50%
// ENV_BASE: base score just from environment (0–50)
const ENV_BASE = [0, 8, 20, 38, 50];

// ── Conformance formula ──────────────────────────────────────────────────────
export function calcConformance(data) {
  const env        = data.environmentScore ?? null;
  const trainer    = data.trainerPresence  ?? 'none';
  const pokCount   = data.pokemonCount     ?? 0;
  const connecting = data.connectingCard   ?? false;
  const living     = data.nonPokemonLiving ?? null;
  const unaware    = data.unawareOfViewer  ?? null;
  const finish     = data.cardFinish       ?? null;
  const tjayRating  = data.tjayRating  ?? null;
  const stephRating = data.stephRating ?? null;

  if (env === null) return null;

  const envScore = ENV_BASE[env];

  const additional = Math.max(0, pokCount);
  let pokBonus = 0;
  for (let i = 0; i < additional; i++) {
    if      (i === 0) pokBonus += 8;
    else if (i === 1) pokBonus += 5;
    else if (i === 2) pokBonus += 3;
    else              pokBonus += 1;
  }

  let trainerBonus = 0;
  if      (trainer === 'interacting') trainerBonus = 15;
  else if (trainer === 'present')     trainerBonus = 4;

  const connectingBonus = connecting ? 6 : 0;
  const livingBonus     = living === true ? 7 : living === false ? -3 : 0;
  const unawareBonus    = unaware === true ? 6 : unaware === false ? -5 : 0;
  const finishBonus     = finish === 'textured' ? 4 : finish === 'matte' ? -4 : 0;

  const formulaScore = Math.min(100, Math.max(0, Math.round(
    envScore + pokBonus + trainerBonus + connectingBonus + livingBonus + unawareBonus + finishBonus
  )));

  // Personal ratings — average available ratings, then blend 50/50 with formula
  const ratings = [tjayRating, stephRating].filter(r => r !== null);
  if (ratings.length > 0) {
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const ratingScore = Math.round((avgRating / 10) * 100);
    return Math.min(100, Math.round((formulaScore + ratingScore) / 2));
  }

  return formulaScore;
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

// Manifest: shared with CardTile via module-level singleton pattern
// Fetch once and reuse across both components
let imageManifest = null;
let manifestInFlight = null;
const getManifest = () => {
  if (imageManifest) return Promise.resolve(imageManifest);
  if (manifestInFlight) return manifestInFlight;
  manifestInFlight = fetch('/pokemon-tcg-tracker/card-images/manifest.json')
    .then(r => r.json())
    .then(files => { imageManifest = new Set(files); return imageManifest; })
    .catch(() => { imageManifest = new Set(); return imageManifest; });
  return manifestInFlight;
};
getManifest();

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
  const number = (card.setNumber || card.number || '').toLowerCase();
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

function useCardImage(card, pokemonName) {
  const cacheKey = card.id;
  const [imageSrc, setImageSrc] = useState(imageCache[cacheKey]?.src || null);
  useEffect(() => {
    if (imageCache[cacheKey]) { setImageSrc(imageCache[cacheKey].src); return; }
    let mounted = true;
    const paths = generateImagePaths(card, pokemonName);
    const base  = '/pokemon-tcg-tracker/card-images/';
    (async () => {
      const manifest = await getManifest();
      let found = null;
      if (manifest.size > 0) {
        for (const p of paths) {
          for (const ext of ['.png', '.jpg']) {
            if (manifest.has(p + ext)) { found = base + p + ext; break; }
          }
          if (found) break;
        }
      }
      if (!found) {
        const tryPath = (src) => enqueueImageLoad(() => new Promise((res, rej) => {
          const img = new Image(); img.onload = () => res(src); img.onerror = rej; img.src = src;
        }));
        for (const src of paths.flatMap(p => [base+p+'.png', base+p+'.jpg'])) {
          if (!mounted) return;
          try { found = await tryPath(src); break; } catch (_) {}
        }
      } else {
        found = await enqueueImageLoad(() => new Promise((res, rej) => {
          const img = new Image(); img.onload = () => res(found); img.onerror = rej; img.src = found;
        })).catch(() => null);
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

function ConformanceMeter({ pct, tjayRating, stephRating }) {
  if (pct === null) return (
    <div className="text-center py-1">
      <div className="text-2xl font-black text-gray-400 opacity-40">—</div>
      <div className="text-[10px] text-gray-500 mt-0.5">Set environment to score</div>
    </div>
  );
  const color = conformanceColor(pct);
  const label = pct >= 80 ? '★ Highly conforming' : pct >= 60 ? 'Conforming' : pct >= 35 ? 'Partial' : 'Non-conforming';
  const hasRatings = tjayRating !== null || stephRating !== null;
  return (
    <div className="text-center">
      <div className="text-4xl font-black leading-none" style={{ color }}>{pct}%</div>
      <div className="text-[11px] font-bold mt-1" style={{ color }}>{label}</div>
      {hasRatings && (
        <div className="text-[9px] text-gray-400 mt-0.5">
          {[tjayRating !== null && `Tjay ${tjayRating}/10`, stephRating !== null && `Steph ${stephRating}/10`].filter(Boolean).join(' · ')}
        </div>
      )}
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
  const [pokemonCount,     setPokemonCount]     = useState(reviewData.pokemonCount     ?? 0);
  const [connectingCard,   setConnectingCard]   = useState(reviewData.connectingCard   ?? null);
  const [nonPokemonLiving, setNonPokemonLiving] = useState(reviewData.nonPokemonLiving ?? null);
  const [unawareOfViewer,  setUnawareOfViewer]  = useState(reviewData.unawareOfViewer  ?? null);
  const [cardFinish,       setCardFinish]       = useState(reviewData.cardFinish       ?? null);
  const [tjayRating,       setTjayRating]       = useState(reviewData.tjayRating       ?? null);
  const [stephRating,      setStephRating]      = useState(reviewData.stephRating      ?? null);

  const [isDirty, setIsDirty] = useState(false);
  const dirty = () => setIsDirty(true);

  useEffect(() => {
    setEnvironmentScore(reviewData.environmentScore ?? null);
    setTrainerPresence(reviewData.trainerPresence   ?? 'none');
    setPokemonCount(reviewData.pokemonCount         ?? 0);
    setConnectingCard(reviewData.connectingCard     ?? null);
    setNonPokemonLiving(reviewData.nonPokemonLiving ?? null);
    setUnawareOfViewer(reviewData.unawareOfViewer   ?? null);
    setCardFinish(reviewData.cardFinish             ?? null);
    setTjayRating(reviewData.tjayRating             ?? null);
    setStephRating(reviewData.stephRating           ?? null);
    setSavedData(Object.keys(reviewData).length > 0 ? reviewData : null);
    setCopied(false);
    setIsDirty(false);
  }, [card.id]);

  const conformancePct = calcConformance({
    environmentScore, trainerPresence, pokemonCount,
    connectingCard, nonPokemonLiving, unawareOfViewer, cardFinish, tjayRating, stephRating,
  });

  const [savedData,  setSavedData]  = useState(Object.keys(reviewData).length > 0 ? reviewData : null);
  const [copied,     setCopied]     = useState(false);

  const buildData = () => ({
    environmentScore, trainerPresence, pokemonCount,
    connectingCard, nonPokemonLiving, unawareOfViewer, cardFinish, tjayRating, stephRating,
    conformancePct,
    reviewedAt: new Date().toISOString(),
  });

  const handleClose = () => { if (isDirty) { const data = buildData(); onSave(data); setSavedData(data); setIsDirty(false); } onClose(); };

  const handleCopyJson = () => {
    const data = buildData();
    if (isDirty) { onSave(data); setSavedData(data); setIsDirty(false); }
    const json = JSON.stringify({ [card.id]: data }, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft'  && hasPrev) { if (isDirty) { const d = buildData(); onSave(d); setSavedData(d); } onPrev(); }
      if (e.key === 'ArrowRight' && hasNext) { if (isDirty) { const d = buildData(); onSave(d); setSavedData(d); } onNext(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [hasPrev, hasNext, isDirty, environmentScore, trainerPresence, pokemonCount,
      connectingCard, nonPokemonLiving, unawareOfViewer, cardFinish, tjayRating, stephRating]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="relative bg-white rounded-3xl shadow-2xl flex overflow-hidden"
        style={{ width: 'min(960px, 96vw)', height: 'min(88vh, 680px)' }}>

        {/* LEFT — image + score */}
        <div className="relative flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 shrink-0 py-6"
          style={{ width: '240px' }}>

          <button onClick={() => { if (isDirty) { const d = buildData(); onSave(d); setSavedData(d); setIsDirty(false); } onPrev(); }} disabled={!hasPrev}
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold z-10 transition-all
              ${hasPrev ? 'bg-white/20 hover:bg-white/30 text-white' : 'text-white/20 cursor-not-allowed'}`}>‹</button>
          <button onClick={() => { if (isDirty) { const d = buildData(); onSave(d); setSavedData(d); setIsDirty(false); } onNext(); }} disabled={!hasNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold z-10 transition-all
              ${hasNext ? 'bg-white/20 hover:bg-white/30 text-white' : 'text-white/20 cursor-not-allowed'}`}>›</button>

          {imageSrc
            ? <img src={imageSrc} alt={pokemonName} className="object-contain rounded-xl shadow-2xl" style={{ maxHeight: '280px', maxWidth: '170px' }} />
            : <div className="w-32 h-44 rounded-xl bg-gray-700 flex items-center justify-center"><span className="text-4xl opacity-30">🃏</span></div>
          }

          <div className="mt-3 text-center px-3 w-full">
            <div className="text-white font-black text-sm leading-tight">{pokemonName}</div>
            <div className="text-gray-400 text-xs mt-0.5 truncate">{card.cardName}</div>
            <div className="text-gray-500 text-xs">{card.setCode || card.jpSetCode} {card.number}</div>
          </div>

          <div className="mt-3 px-4 w-full">
            <div className="bg-black/40 rounded-2xl p-3">
              <ConformanceMeter pct={conformancePct} tjayRating={tjayRating} stephRating={stephRating} />
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
            <button onClick={handleClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            <section className="rounded-2xl border-2 border-purple-100 bg-purple-50/40 p-3 space-y-3">
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
                  {environmentScore !== null ? (ENV_LABEL_MAP[environmentScore]?.desc ?? '') : 'Tap a score — this multiplies everything else'}
                </div>
              </div>

              {/* Trainer */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-700">Trainer in card</div>
                  <div className="text-[9px] text-gray-400">Present +4 · Interacting with Pokémon +15</div>
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

              {/* Additional Pokémon count */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-700">Additional Pokémon in artwork</div>
                  <div className="text-[9px] text-gray-400">1st +8 · 2nd +5 · 3rd +3 · diminishing</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setPokemonCount(c => Math.max(0,c-1)); dirty(); }}
                    className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 font-bold flex items-center justify-center">−</button>
                  <input type="number" min="0" max="20" value={pokemonCount}
                    onChange={(e) => { setPokemonCount(Math.max(0,parseInt(e.target.value)||0)); dirty(); }}
                    className="w-12 text-center border border-gray-200 rounded-lg py-1 text-sm font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button onClick={() => { setPokemonCount(c => c+1); dirty(); }}
                    className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 font-bold flex items-center justify-center">+</button>
                </div>
              </div>

              {/* Boolean flags */}
              {[
                { label: 'Has a connecting card',              hint: '+6',       key: 'connectingCard',   val: connectingCard,   set: setConnectingCard },
                { label: 'Non-Pokémon living things',          hint: 'Yes +7 · No −3', key: 'nonPokemonLiving', val: nonPokemonLiving, set: setNonPokemonLiving },
                { label: 'Pokémon unaware / not facing camera',hint: 'Yes +6 · No −5', key: 'unawareOfViewer',  val: unawareOfViewer,  set: setUnawareOfViewer },
              ].map(({ label, hint, key, val, set }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-gray-700">{label}</div>
                    <div className="text-[9px] text-gray-400">{hint}</div>
                  </div>
                  <YesNo value={val} onChange={(v) => { set(v); dirty(); }} />
                </div>
              ))}

              {/* Card finish */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-700">Card finish</div>
                  <div className="text-[9px] text-gray-400">Matte −4 · Glossy ±0 · Textured +4</div>
                </div>
                <div className="flex gap-1">
                  {[['matte','Matte'],['glossy','Glossy'],['textured','Textured']].map(([val, label]) => (
                    <button key={val} onClick={() => { setCardFinish(cardFinish === val ? null : val); dirty(); }}
                      className="px-2 py-1 rounded-lg text-[10px] font-black transition-all border"
                      style={cardFinish === val
                        ? { background: val === 'textured' ? '#7c3aed' : val === 'matte' ? '#6b7280' : '#3b82f6', color: 'white', borderColor: 'transparent' }
                        : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal ratings */}
              {[
                { name: 'Tjay', val: tjayRating, set: setTjayRating, color: '#3b82f6' },
                { name: 'Steph', val: stephRating, set: setStephRating, color: '#ec4899' },
              ].map(({ name, val, set, color }) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700">{name}'s rating</span>
                      {val !== null && <span className="text-[10px] font-black" style={{ color }}>{val}/10</span>}
                    </div>
                    {val !== null && (
                      <button onClick={() => { set(null); dirty(); }} className="text-[9px] text-gray-400 hover:text-gray-600">✕</button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} onClick={() => { set(val === n ? null : n); dirty(); }}
                        className="flex-1 py-1 rounded-lg text-[10px] font-black transition-all border"
                        style={val !== null && n <= val
                          ? { background: color, color: 'white', borderColor: color }
                          : { background: '#f9fafb', color: '#d1d5db', borderColor: '#e5e7eb' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </div>

          {/* Footer — Copy JSON button only */}
          <div className="shrink-0 px-4 py-2 border-t border-gray-100 flex items-center justify-between">
            <div className="text-[10px] text-gray-400">Auto-saves on navigate / close</div>
            {savedData && (
              <button onClick={handleCopyJson}
                className="px-4 py-1.5 rounded-lg text-xs font-black text-white transition-all"
                style={{ background: copied ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                {copied ? '✓ Copied!' : `Copy JSON · ${card.id}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
