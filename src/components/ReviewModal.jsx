import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const CATEGORIES = {
  'Scene': {
    color: '#10b981',
    icon: '🌿',
    subTags: ['Outdoors', 'In nature', 'Urban', 'Cave / Indoor', 'Weather', 'Water']
  },
  'Action Scene': {
    color: '#ef4444',
    icon: '⚡',
    subTags: ['Charging move', 'Fighting Pokémon', 'Mid-flight', 'Group battle']
  },
  'Action Posed': {
    color: '#f59e0b',
    icon: '🔥',
    subTags: ['Solo', 'Minimal background', 'White background']
  },
  'Portrait': {
    color: '#3b82f6',
    icon: '🎨',
    subTags: ['Close-up', 'Centred', 'Background absent', 'Background secondary']
  },
  'Trainer': {
    color: '#8b5cf6',
    icon: '🧑',
    subTags: ['Primary subject', 'Co-subject', 'Solo', 'With Pokémon']
  },
};

const ACTIVITIES = [
  'Flying', 'Running', 'Swimming', 'Jumping', 'Climbing',
  'Attacking', 'Charging move', 'Defending', 'Fighting',
  'Sleeping', 'Resting', 'Sitting',
  'Playing', 'With trainer', 'With other Pokémon',
  'Roaring', 'Crying', 'Surprised',
  'Standing', 'Walking', 'Floating',
];

const ART_STYLES = [
  'Realistic', 'Stylised', 'Cartoon', 'Chibi',
  'Watercolour', 'Graphic / Geometric', 'Sketch / Lineart', 'CGI / 3D', 'Retro',
];

const DISTANCE_STEPS = ['Close-up', 'Near', 'Mid', 'Far', 'Distant'];
const PROMINENCE_STEPS = ['Featured', 'Present', 'Background', 'Incidental'];

// Reuse image cache from CardTile pattern
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
  const number = (card.setNumber || card.number || '').toLowerCase();
  const numberWithDash = number.replace(/\//g, '-');
  const numberOnly = number.split('/')[0];
  const numberAlreadyHasSet = numberOnly.toLowerCase().startsWith(setCode);
  const paths = [];
  if (numberAlreadyHasSet) {
    paths.push(`.${numberWithDash}.${pokemon}_`);
    paths.push(`.${numberOnly}.${pokemon}_`);
  } else {
    paths.push(`${setCode}.${numberWithDash}.${pokemon}_`);
    paths.push(`${setCode}.${numberOnly}.${pokemon}_`);
    paths.push(`${setCode}.${numberWithDash}.${pokemon}`);
    paths.push(`${setCode}.${numberOnly}.${pokemon}`);
    paths.push(`.${numberWithDash}.${pokemon}_`);
    paths.push(`.${numberOnly}.${pokemon}_`);
  }
  paths.push(`${setCode.toUpperCase()}_${numberOnly}_R_EN_LG`);
  return [...new Set(paths)];
};

function useCardImage(card, pokemonName) {
  const cacheKey = card.id;
  const cached = imageCache[cacheKey];
  const [imageSrc, setImageSrc] = useState(cached?.src || null);

  useEffect(() => {
    if (imageCache[cacheKey]) { setImageSrc(imageCache[cacheKey].src); return; }
    let mounted = true;
    const paths = generateImagePaths(card, pokemonName);
    const allPaths = paths.flatMap(p => [
      `/pokemon-tcg-tracker/card-images/${p}.png`,
      `/pokemon-tcg-tracker/card-images/${p}.jpg`,
    ]);
    const tryPath = (src) => enqueueImageLoad(() => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(src); img.onerror = reject; img.src = src;
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

function Toggle({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-150 border"
      style={active
        ? { background: color, color: 'white', borderColor: color, boxShadow: `0 0 0 2px ${color}40` }
        : { background: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
      }
    >
      {label}
    </button>
  );
}

function StepSlider({ steps, value, onChange, color }) {
  return (
    <div className="flex gap-1">
      {steps.map((step, i) => (
        <button
          key={step}
          onClick={() => onChange(i === value ? null : i)}
          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border"
          style={value === i
            ? { background: color, color: 'white', borderColor: color }
            : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e5e7eb' }
          }
        >
          {step}
        </button>
      ))}
    </div>
  );
}

export default function ReviewModal({ card, reviewData, onSave, onClose, onPrev, onNext, hasPrev, hasNext, darkMode }) {
  const pokemonName = card.pokemonName || '';
  const imageSrc = useCardImage(card, pokemonName);

  // Local state — initialised from saved reviewData
  const [categories, setCategories] = useState(reviewData.categories || []);
  const [subTags, setSubTags] = useState(reviewData.subTags || {});
  const [activities, setActivities] = useState(reviewData.activities || []);
  const [activityCustom, setActivityCustom] = useState(reviewData.activityCustom || '');
  const [artStyles, setArtStyles] = useState(reviewData.artStyles || []);
  const [illustrationCoverage, setIllustrationCoverage] = useState(reviewData.illustrationCoverage ?? 70);
  const [subjectDistance, setSubjectDistance] = useState(reviewData.subjectDistance ?? null);
  const [pokemonCount, setPokemonCount] = useState(reviewData.pokemonCount ?? 1);
  const [pokemonProminence, setPokemonProminence] = useState(reviewData.pokemonProminence ?? null);
  const [isDirty, setIsDirty] = useState(false);

  // Reset state when card changes
  useEffect(() => {
    setCategories(reviewData.categories || []);
    setSubTags(reviewData.subTags || {});
    setActivities(reviewData.activities || []);
    setActivityCustom(reviewData.activityCustom || '');
    setArtStyles(reviewData.artStyles || []);
    setIllustrationCoverage(reviewData.illustrationCoverage ?? 70);
    setSubjectDistance(reviewData.subjectDistance ?? null);
    setPokemonCount(reviewData.pokemonCount ?? 1);
    setPokemonProminence(reviewData.pokemonProminence ?? null);
    setIsDirty(false);
  }, [card.id]);

  const markDirty = () => setIsDirty(true);

  const toggleCategory = (cat) => {
    setCategories(prev => {
      const next = prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat];
      // Clear subtags for removed category
      if (prev.includes(cat)) {
        setSubTags(st => { const n = { ...st }; delete n[cat]; return n; });
      }
      return next;
    });
    markDirty();
  };

  const toggleSubTag = (cat, tag) => {
    setSubTags(prev => {
      const existing = prev[cat] || [];
      const next = existing.includes(tag) ? existing.filter(t => t !== tag) : [...existing, tag];
      return { ...prev, [cat]: next };
    });
    markDirty();
  };

  const toggleActivity = (act) => {
    setActivities(prev => prev.includes(act) ? prev.filter(a => a !== act) : [...prev, act]);
    markDirty();
  };

  const toggleArtStyle = (style) => {
    setArtStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]);
    markDirty();
  };

  const buildSaveData = () => ({
    categories, subTags, activities,
    activityCustom: activityCustom.trim(),
    artStyles, illustrationCoverage, subjectDistance,
    pokemonCount, pokemonProminence,
    reviewedAt: new Date().toISOString(),
  });

  const handleSave = () => {
    onSave(buildSaveData());
    setIsDirty(false);
  };

  const handleSaveAndNext = () => {
    onSave(buildSaveData());
    setIsDirty(false);
    onNext();
  };

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) { if (isDirty) handleSave(); onPrev(); }
      if (e.key === 'ArrowRight' && hasNext) { if (isDirty) handleSave(); onNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, isDirty, categories, subTags, activities, artStyles, illustrationCoverage, subjectDistance, pokemonCount, pokemonProminence, activityCustom]);

  const isReviewed = reviewData && Object.keys(reviewData).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl flex overflow-hidden"
        style={{ width: 'min(920px, 95vw)', height: 'min(90vh, 700px)' }}
      >
        {/* LEFT — card image */}
        <div className="relative flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 shrink-0"
          style={{ width: '260px' }}>

          {/* Nav arrows */}
          <button onClick={() => { if (isDirty) handleSave(); onPrev(); }} disabled={!hasPrev}
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-all z-10
              ${hasPrev ? 'bg-white/20 hover:bg-white/30 text-white' : 'text-white/20 cursor-not-allowed'}`}>
            ‹
          </button>
          <button onClick={() => { if (isDirty) handleSave(); onNext(); }} disabled={!hasNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-all z-10
              ${hasNext ? 'bg-white/20 hover:bg-white/30 text-white' : 'text-white/20 cursor-not-allowed'}`}>
            ›
          </button>

          {imageSrc ? (
            <img src={imageSrc} alt={`${pokemonName} ${card.cardName}`}
              className="object-contain rounded-xl shadow-2xl"
              style={{ maxHeight: '420px', maxWidth: '200px' }} />
          ) : (
            <div className="w-40 h-56 rounded-xl bg-gray-700 flex items-center justify-center">
              <span className="text-4xl opacity-30">🃏</span>
            </div>
          )}

          <div className="mt-4 text-center px-4">
            <div className="text-white font-black text-base leading-tight">{pokemonName}</div>
            <div className="text-gray-400 text-xs mt-0.5">{card.cardName}</div>
            <div className="text-gray-500 text-xs mt-0.5">{card.setCode || card.jpSetCode} {card.number}</div>
            {isReviewed && (
              <div className="mt-2 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold inline-block">
                ✓ Reviewed
              </div>
            )}
          </div>

          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 text-[10px] text-gray-500">
            <span>← → to navigate</span>
          </div>
        </div>

        {/* RIGHT — controls */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900" style={{background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                Review Mode
              </span>
              {isDirty && <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">Unsaved</span>}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* CATEGORIES */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Category</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.entries(CATEGORIES).map(([cat, cfg]) => (
                  <button key={cat} onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                    style={categories.includes(cat)
                      ? { background: cfg.color, color: 'white', borderColor: cfg.color, boxShadow: `0 0 0 2px ${cfg.color}40` }
                      : { background: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                    }>
                    <span>{cfg.icon}</span> {cat}
                  </button>
                ))}
              </div>
              {/* Sub-tags for selected categories */}
              {categories.map(cat => CATEGORIES[cat] && (
                <div key={cat} className="mt-2 pl-3 border-l-2" style={{ borderColor: CATEGORIES[cat].color }}>
                  <div className="text-[10px] font-bold mb-1.5" style={{ color: CATEGORIES[cat].color }}>{cat} · sub-tags</div>
                  <div className="flex flex-wrap gap-1">
                    {CATEGORIES[cat].subTags.map(tag => (
                      <Toggle key={tag} label={tag}
                        active={(subTags[cat] || []).includes(tag)}
                        onClick={() => toggleSubTag(cat, tag)}
                        color={CATEGORIES[cat].color} />
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* ART STYLE */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Art Style</h3>
              <div className="flex flex-wrap gap-1.5">
                {ART_STYLES.map(style => (
                  <Toggle key={style} label={style}
                    active={artStyles.includes(style)}
                    onClick={() => toggleArtStyle(style)}
                    color="#6366f1" />
                ))}
              </div>
            </section>

            {/* ACTIVITY */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Pokémon Activity</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ACTIVITIES.map(act => (
                  <Toggle key={act} label={act}
                    active={activities.includes(act)}
                    onClick={() => toggleActivity(act)}
                    color="#f59e0b" />
                ))}
              </div>
              <input
                type="text"
                value={activityCustom}
                onChange={(e) => { setActivityCustom(e.target.value); markDirty(); }}
                placeholder="Other activity..."
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 text-gray-700"
              />
            </section>

            {/* SLIDERS */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Artwork Metrics</h3>

              {/* Illustration coverage */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-600">Illustration coverage</span>
                  <span className="text-xs font-black text-purple-600">{illustrationCoverage}%</span>
                </div>
                <div className="relative">
                  <input type="range" min="0" max="100" step="5"
                    value={illustrationCoverage}
                    onChange={(e) => { setIllustrationCoverage(Number(e.target.value)); markDirty(); }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: '#8b5cf6' }}
                  />
                  <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>
              </div>

              {/* Subject distance */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-600">Subject distance</span>
                  <span className="text-xs font-black text-blue-600">
                    {subjectDistance !== null ? DISTANCE_STEPS[subjectDistance] : 'Not set'}
                  </span>
                </div>
                <StepSlider steps={DISTANCE_STEPS} value={subjectDistance} onChange={(v) => { setSubjectDistance(v); markDirty(); }} color="#3b82f6" />
              </div>

              {/* Pokemon prominence */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-600">Pokémon prominence</span>
                  <span className="text-xs font-black text-emerald-600">
                    {pokemonProminence !== null ? PROMINENCE_STEPS[pokemonProminence] : 'Not set'}
                  </span>
                </div>
                <StepSlider steps={PROMINENCE_STEPS} value={pokemonProminence} onChange={(v) => { setPokemonProminence(v); markDirty(); }} color="#10b981" />
              </div>

              {/* Pokemon count */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-600 shrink-0">Pokémon in artwork</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => { setPokemonCount(c => Math.max(1, c - 1)); markDirty(); }}
                    className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 font-bold text-sm flex items-center justify-center">−</button>
                  <input type="number" min="1" max="20" value={pokemonCount}
                    onChange={(e) => { setPokemonCount(Math.max(1, parseInt(e.target.value) || 1)); markDirty(); }}
                    className="w-12 text-center border border-gray-200 rounded-lg py-1 text-sm font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                  <button onClick={() => { setPokemonCount(c => c + 1); markDirty(); }}
                    className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 font-bold text-sm flex items-center justify-center">+</button>
                </div>
              </div>
            </section>
          </div>

          {/* Footer buttons */}
          <div className="shrink-0 px-5 py-3 border-t border-gray-100 flex gap-2">
            <button onClick={handleSave}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors border border-purple-200 text-purple-700 hover:bg-purple-50">
              Save
            </button>
            <button onClick={handleSaveAndNext} disabled={!hasNext}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: hasNext ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : '#e5e7eb' }}>
              Save & Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
