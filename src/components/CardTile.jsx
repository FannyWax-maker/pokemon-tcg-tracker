import React from 'react';
import setNamesImport from '../data/set_names.json';
import pokemonDataImport from '../data/pokemon_data.json';
import pokemonCoordsImport from '../data/pokemon_coords.json';
import { imageCache, clearImageCache, getManifest, getCameoManifest, enqueueImageLoad, generateImagePaths } from '../utils/imageUtils';

const setNames = setNamesImport;
const SET_NAME_OVERRIDES = {
  '151C': 'Pokémon Card 151',
};
const getSetName = (code) => {
  if (!code) return '';
  if (SET_NAME_OVERRIDES[code]) return SET_NAME_OVERRIDES[code];
  const s = setNames[code];
  const n = typeof s === 'object' ? s?.name : s;
  return n != null ? String(n) : '';
};
const ALL_POKEMON_NAMES = pokemonDataImport.map(p => p.name);


// JP sets that have never had a Simplified Chinese release
const LANG_CONFIG = {
  EN: { flag: '🇬🇧', color: 'bg-blue-500 hover:bg-blue-600', owned: 'bg-blue-500' },
  JP: { flag: '🇯🇵', color: 'bg-red-500 hover:bg-red-600', owned: 'bg-red-500' },
  CN: { flag: '🇨🇳', color: 'bg-yellow-500 hover:bg-yellow-600', owned: 'bg-yellow-500' },
  KR: { flag: '🇰🇷', color: 'bg-indigo-500 hover:bg-indigo-600', owned: 'bg-indigo-500' },
  TC: { flag: '🇹🇼', color: 'bg-green-500 hover:bg-green-600', owned: 'bg-green-500' },
};

const ALL_LANGS = ['EN', 'JP', 'CN', 'TC', 'KR'];

const buildEbayUrl = (card, pokemonName, lang) => {
  const rawName = card.cardName || '';
  const isTrainerCard = rawName.startsWith('Trainer,') || rawName.startsWith('Trainer ,');
  const cleanedName = isTrainerCard ? rawName.replace(/^Trainer\s*,\s*/, '').trim() : rawName;
  const skipNames = ['Full Art', 'Trainer', 'Item', 'Stadium', 'Supporter', 'Tool', 'Energy'];
  const cardName = cleanedName && !skipNames.includes(cleanedName) ? cleanedName : null;
  const searchName = cardName || pokemonName;
  let setCode, setNumber, langKeyword;
  if (lang === 'EN') {
    setCode = card.enSetCode || card.setCode;
    setNumber = card.number || null;
    langKeyword = '';
  } else if (lang === 'JP') {
    setCode = card.jpSetCode;
    setNumber = card.jpNumber || null;
    langKeyword = 'japanese';
  } else if (lang === 'CN') {
    setCode = card.cnSetCode || card.jpSetCode;
    setNumber = card.cnNumber || null;
    langKeyword = 'chinese';
  } else if (lang === 'TC') {
    setCode = card.tcSetCode || card.jpSetCode;
    setNumber = card.tcNumber || null;
    langKeyword = 'chinese traditional';
  } else if (lang === 'KR') {
    setCode = card.krSetCode || card.jpSetCode;
    setNumber = card.krNumber || null;
    langKeyword = 'korean';
  }
  const query = [searchName, setCode, setNumber, langKeyword, '-graded -PSA -BGS -CGC'].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_ItemLocation=3&_sop=12`;
};


export default function CardTile({ card, pokemonName, onOwnershipClick, onToggleNonConforming, onToggleFavorite, onToggleUnobtainable, onToggleExpensive, onToggleVeryExpensive, onNavigateToPokemon, showOwnershipButtons = false , scrollRoot, getPriceForCard, showSetNames = false, appMode = 'fullart' }) {
  const isOwned = !!card.ownedLang;
  const hasOtherPokemon = card.otherPokemon && card.otherPokemon.length > 0;
  const isSecondary = card.isSecondary || !card.isPrimary;
  const [showZoom, setShowZoom] = React.useState(false);
  const [showHighlight, setShowHighlight] = React.useState(false);
  const [highlightName, setHighlightName] = React.useState(null);
  const [zoomScale, setZoomScale] = React.useState(2.5);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [imgRect, setImgRect] = React.useState(null);
  const [overImage, setOverImage] = React.useState(false);
  const zoomImgRef = React.useRef(null);
  const LOUPE_SIZE = 300;

  React.useEffect(() => {
    document.body.style.overflow = showZoom ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showZoom]);

  const handleZoomMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (zoomImgRef.current) setImgRect(zoomImgRef.current.getBoundingClientRect());
  };

  const handleZoomWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setZoomScale(s => Math.min(Math.max(s + (e.deltaY < 0 ? 0.25 : -0.25), 1.5), 8));
  };

  // Compute background-position for the loupe
  const getLoupeStyle = () => {
    if (!imgRect) return {};
    const relX = mousePos.x - imgRect.left;
    const relY = mousePos.y - imgRect.top;
    const fx = relX / imgRect.width;
    const fy = relY / imgRect.height;
    const scaledW = imgRect.width * zoomScale;
    const scaledH = imgRect.height * zoomScale;
    const bgX = -(fx * scaledW - LOUPE_SIZE / 2);
    const bgY = -(fy * scaledH - LOUPE_SIZE / 2);
    return {
      backgroundImage: `url(${imageSrc})`,
      backgroundSize: `${scaledW}px ${scaledH}px`,
      backgroundPosition: `${bgX}px ${bgY}px`,
      backgroundRepeat: 'no-repeat',
    };
  };
  // Coord picker state
  // Each entry: { name, count, positions: [{x,y,r}, ...] }
  const [pickerMode, setPickerMode] = React.useState(false);
  const [pickerCircles, setPickerCircles] = React.useState([]);
  const [pickerRadius, setPickerRadius] = React.useState(0.08);
  const [pickerSelected, setPickerSelected] = React.useState(null); // { ci, pi }
  const [copied, setCopied] = React.useState(false);
  const [autocompleteFor, setAutocompleteFor] = React.useState(null);
  const [autocompleteQuery, setAutocompleteQuery] = React.useState('');
  const [expandedLang, setExpandedLang] = React.useState(null); // which lang row is expanded to show set name
  const dragState = React.useRef(null);
  const pickerCirclesRef = React.useRef([]);
  React.useEffect(() => { pickerCirclesRef.current = pickerCircles; }, [pickerCircles]);

  const getAutocompleteSuggestions = (query) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return ALL_POKEMON_NAMES.filter(n => n.toLowerCase().includes(q)).slice(0, 6);
  };

  const handlePickerImageClick = (e) => {
    if (!pickerMode || !zoomImgRef.current) return;
    if (dragState.current?.didDrag) return;
    e.stopPropagation();
    const rect = zoomImgRef.current.getBoundingClientRect();
    const x = parseFloat(((e.clientX - rect.left) / rect.width).toFixed(3));
    const y = parseFloat(((e.clientY - rect.top) / rect.height).toFixed(3));
    // If selected circle still needs more positions placed, add to it
    if (pickerSelected !== null) {
      const { ci } = pickerSelected;
      const c = pickerCirclesRef.current[ci];
      if (c && c.positions.length < c.count) {
        setPickerCircles(prev => prev.map((cc, i) => i === ci
          ? { ...cc, positions: [...cc.positions, { x, y, r: pickerRadius }] }
          : cc));
        setPickerSelected({ ci, pi: c.positions.length });
        return;
      }
    }
    // New circle entry
    const newCircle = { name: '', count: 1, positions: [{ x, y, r: pickerRadius }] };
    setPickerCircles(prev => {
      const newIdx = prev.length;
      setPickerSelected({ ci: newIdx, pi: 0 });
      return [...prev, newCircle];
    });
    setAutocompleteFor(null);
  };

  // Drag a specific position: ci=circle index, pi=position index
  const handleCircleMouseDown = (e, ci, pi) => {
    e.stopPropagation();
    e.preventDefault();
    setPickerSelected({ ci, pi });
    const pos = pickerCircles[ci].positions[pi];
    setPickerRadius(pos.r ?? 0.08);
    dragState.current = { ci, pi, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, didDrag: false };
    const rect = zoomImgRef.current?.getBoundingClientRect();
    const onMove = (me) => {
      if (!rect) return;
      const dx = (me.clientX - dragState.current.startX) / rect.width;
      const dy = (me.clientY - dragState.current.startY) / rect.height;
      if (Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005) dragState.current.didDrag = true;
      const nx = parseFloat(Math.min(1, Math.max(0, dragState.current.origX + dx)).toFixed(3));
      const ny = parseFloat(Math.min(1, Math.max(0, dragState.current.origY + dy)).toFixed(3));
      setPickerCircles(prev => prev.map((c, i) => i === ci
        ? { ...c, positions: c.positions.map((p, j) => j === pi ? { ...p, x: nx, y: ny } : p) }
        : c));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTimeout(() => { dragState.current = null; }, 0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // JSON: single position inline; multiple -> positions array
  const pickerJson = JSON.stringify(
    pickerCircles.map(c => {
      const base = { name: c.name };
      if (c.positions.length === 1) return { ...base, x: c.positions[0].x, y: c.positions[0].y, r: c.positions[0].r };
      return { ...base, positions: c.positions.map(p => ({ x: p.x, y: p.y, r: p.r })) };
    }),
    null, 2
  );

  const handleCopyJson = () => {
    const cardId = card.id;
    const output = `// Card ID: ${cardId}\n"otherPokemonCoords": ${pickerJson}`;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const [showAllPokemon, setShowAllPokemon] = React.useState(false);
  const [setsOpen, setSetsOpen] = React.useState(true);
  const [featuredOpen, setFeaturedOpen] = React.useState(false);
  const [ebayOpen, setEbayOpen] = React.useState(false);
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [contextMenuPos, setContextMenuPos] = React.useState({ x: 0, y: 0 });
  const isNonConforming = !!card.nonConforming;
  const isFavorite = !!card.favorite;
  const isUnobtainable = !!card.unobtainable;
  const price = getPriceForCard ? getPriceForCard(card) : null;
  const priceValue = price ? price.gbp : null;


  // Which langs are available for this card
  const availableLangs = card.availableLangs || [];
  const isJpExclusive = card.exclusive === 'JP';
  const isCnExclusive = card.exclusive === 'CN';
  const isEnExclusive = !card.jpSetCode && !card.cnSetCode && !!card.setCode;
  const showKR = !isJpExclusive && !isCnExclusive;

  const handleLangClick = (lang) => {
    if (isSecondary) return;
    if (card.ownedLang === lang) {
      onOwnershipClick({ ...card, _action: 'unmark' });
    } else {
      onOwnershipClick({ ...card, _directLang: lang });
    }
  };

  const imagePaths = generateImagePaths(card, pokemonName, appMode);
  const cacheKey = card.id;
  const cached = imageCache[cacheKey];
  const [imageLoaded, setImageLoaded] = React.useState(!!cached?.src);
  const [imageSrc, setImageSrc] = React.useState(cached?.src || null);
  const [shouldHide, setShouldHide] = React.useState(false);
  const [inView, setInView] = React.useState(!!cached);
  const containerRef = React.useRef(null);

  // Intersection observer - only start loading when card enters viewport
  React.useEffect(() => {
    if (cached) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { root: scrollRoot || null, rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cacheKey, scrollRoot]);

  React.useEffect(() => {
    // Clear cache when appMode changes so images reload from correct folder
    clearImageCache();
  }, [appMode]);

  React.useEffect(() => {
    if (!inView) return;
    if (imageCache[cacheKey]) {
      const cached = imageCache[cacheKey];
      setImageSrc(cached.src);
      setImageLoaded(!!cached.src);
      if (card._filterMissingImages && cached.src) setShouldHide(true);
      return;
    }
    let mounted = true;

    const tryLoadImage = async () => {
      // Cameos mode: use cameo manifest and image folder
      if (appMode === 'cameos') {
        const cameoManifest = await getCameoManifest();
        const cameoBase = '/pokemon-tcg-tracker/card-images-cameo/';
        let found = null;
        if (cameoManifest.size > 0) {
          for (const path of imagePaths) {
            for (const ext of ['.png', '.jpg', '.webp']) {
              if (cameoManifest.has(path + ext)) { found = cameoBase + path + ext; break; }
            }
            if (found) break;
          }
        }
        if (found) {
          found = await enqueueImageLoad(() => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(found);
            img.onerror = reject;
            img.src = found;
          })).catch(() => null);
        }
        if (!mounted) return;
        imageCache[cacheKey] = { src: found };
        setImageSrc(found);
        setImageLoaded(!!found);
        return;
      }

      // Fullart mode: use main manifest and image folder
      const manifest = await getManifest();
      const base = '/pokemon-tcg-tracker/card-images/';

      let found = null;

      if (manifest.size > 0) {
        // Fast path: check manifest for exact filename match
        for (const path of imagePaths) {
          for (const ext of ['.png', '.jpg']) {
            if (manifest.has(path + ext)) {
              found = base + path + ext;
              break;
            }
          }
          if (found) break;
        }
      }

      if (!found) {
        // Fallback: try HTTP requests for any paths not in manifest
        // (handles cases where manifest is empty or stale)
        const allPaths = imagePaths.flatMap(path => [
          base + path + '.png',
          base + path + '.jpg'
        ]);
        const tryPath = (src) => enqueueImageLoad(() =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = reject;
            img.src = src;
          })
        );
        for (const src of allPaths) {
          if (!mounted) return;
          try { found = await tryPath(src); break; } catch (_) {}
        }
      } else {
        // Load found image through queue to respect concurrency limit
        found = await enqueueImageLoad(() =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(found);
            img.onerror = reject;
            img.src = found;
          })
        ).catch(() => null);
      }

      if (!mounted) return;
      imageCache[cacheKey] = { src: found };
      setImageSrc(found);
      setImageLoaded(!!found);
      if (card._filterMissingImages && found) setShouldHide(true);
    };

    tryLoadImage();
    return () => { mounted = false; };
  }, [inView, cacheKey, appMode]);

  // Re-evaluate hide when filter flag changes
  React.useEffect(() => {
    if (!card._filterMissingImages) {
      setShouldHide(false);
      return;
    }
    if (imageCache[cacheKey] !== undefined) {
      setShouldHide(!!imageCache[cacheKey].src);
    }
  }, [card._filterMissingImages, cacheKey]);

  if (shouldHide) return null;

  // Hide cards that have a price when filtering for missing prices
  if (card._filterMissingPrice) {
    if (!card.setCode) return null; // JP/CN-only — no EN price possible, hide too
    const p = getPriceForCard ? getPriceForCard(card) : null;
    if (p !== null) return null; // has a price — hide it
  }

  // Hide cards that have all featured Pokémon coords tagged (or have no featured Pokémon)
  if (card._filterMissingCoords) {
    const hasOtherPok = card.otherPokemon && card.otherPokemon.length > 0;
    if (!hasOtherPok) return null; // no featured pokemon — hide
    if (pokemonCoordsImport[card.id]) return null; // already has coords — hide
  }

  return (
    <>
      {/* Click-away to close context menu */}
      {showContextMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowContextMenu(false)} />
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[180px] text-sm"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onToggleNonConforming && onToggleNonConforming(card.pokemonId || card.id, card.id, card.nonConforming);
              setShowContextMenu(false);
            }}
            className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${isNonConforming ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {isNonConforming ? '✓ Mark as conforming' : '✗ Mark as non-conforming'}
          </button>
          <button
            onClick={() => {
              onToggleFavorite && onToggleFavorite(card.id, card.favorite);
              setShowContextMenu(false);
            }}
            className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${isFavorite ? 'text-gray-500' : 'text-pink-500'}`}
          >
            {isFavorite ? '♡ Remove from favourites' : '♥ Add to favourites'}
          </button>
          <button
            onClick={() => {
              onToggleUnobtainable && onToggleUnobtainable(card.id, card.unobtainable);
              setShowContextMenu(false);
            }}
            className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${isUnobtainable ? 'text-gray-500' : 'text-gray-700'}`}
          >
            {isUnobtainable ? '💀 Remove unobtainable' : '💀 Mark as unobtainable'}
          </button>

        </div>
      )}

      <div
        ref={containerRef}
        onContextMenu={(e) => {
          e.preventDefault();
          const x = Math.min(e.clientX, window.innerWidth - 200);
          const y = Math.min(e.clientY, window.innerHeight - 80);
          setContextMenuPos({ x, y });
          setShowContextMenu(true);
        }}
        className={`flex flex-col rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 ${
        isSecondary ? 'opacity-75 ring-2 ring-purple-300' : ''
      } ${isOwned ? 'ring-2 ring-red-400' : 'bg-white shadow-md'}`}
        style={isOwned ? {boxShadow: '0 4px 20px rgba(239,68,68,0.25)'} : {}}>

        {/* Card Image */}
        <div
          className="relative overflow-hidden flex items-center justify-center cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #E5E5E5 0%, #CCCCCC 100%)',
            aspectRatio: '2.5/3.5'
          }}
          onClick={() => imageSrc && setShowZoom(true)}
        >
          {/* Card back placeholder — always visible until image loads */}
          {!imageSrc && (
            <img
              src="/pokemon-tcg-tracker/card-back.jpg"
              alt="Loading..."
              className="w-full h-full object-cover"
            />
          )}
          {/* Actual card image — fades in when loaded */}
          {imageSrc && (
            <img
              src={imageSrc}
              alt={`${pokemonName} ${card.cardName}`}
              className="w-full h-full object-contain"
            />
          )}
          {/* IMAGE MISSING overlay — only shown after load attempt fails (imageLoaded=false, inView=true, no src) */}
          {inView && imageLoaded === false && !imageSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-black/60">
              <div className="px-3 py-1 bg-red-600 rounded text-white text-xs font-bold mb-3">IMAGE MISSING</div>
              <div className="w-full">
                <div className="text-white/50 text-[9px] mb-1">Expected filename:</div>
                <div className="bg-black/40 px-2 py-1.5 rounded text-white font-mono text-[10px] leading-tight break-all select-all cursor-text hover:bg-black/60 transition-colors mb-2">
                  {imagePaths[0]}.png
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(imagePaths[0] + '.png').then(() => alert('Copied!'));
                  }}
                  className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                >
                  Copy Filename
                </button>
              </div>
            </div>
          )}

          {/* Untagged featured Pokémon indicator */}
          {card.otherPokemon && card.otherPokemon.length > 0 && !pokemonCoordsImport[card.id] && (
            <div className="absolute top-2 left-2 z-20" title="Featured Pokémon not yet tagged with coords">
              <div style={{ background: 'rgba(0,0,0,0.65)', borderRadius: '999px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold', color: '#fbbf24', backdropFilter: 'blur(2px)', border: '1px solid rgba(251,191,36,0.5)' }}>
                🎯 {card.otherPokemon.length}
              </div>
            </div>
          )}

          {/* Top-right badge cluster: exclusive + status badges */}
          <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
            {card.exclusive && (
              <div className={`px-2 py-0.5 rounded text-xs font-bold shadow-lg text-white ${
                card.exclusive.includes('JP') && card.exclusive.includes('CN') ? 'bg-purple-500' :
                card.exclusive.includes('JP') ? 'bg-red-500' : 'bg-yellow-500'
              }`}>
                {card.exclusive === 'JP' ? '🇯🇵 JP' : card.exclusive === 'CN' ? '🇨🇳 CN' : card.exclusive}
              </div>
            )}
            {!card.exclusive && isEnExclusive && (
              <div className="px-2 py-0.5 rounded text-xs font-bold shadow-lg text-white bg-blue-500">
                🇬🇧 EN
              </div>
            )}
            {isNonConforming && (
              <div style={{fontSize:'1.6rem',lineHeight:1,textShadow:'0 0 6px rgba(0,0,0,0.9)'}}>
                ✗
              </div>
            )}
            {isFavorite && (
              <div style={{fontSize:'1.6rem',lineHeight:1,color:'#f472b6',textShadow:'0 0 6px rgba(0,0,0,0.9)'}}>
                ♥
              </div>
            )}
            {isUnobtainable && (
              <div style={{fontSize:'1.6rem',lineHeight:1,textShadow:'0 0 6px rgba(0,0,0,0.9)'}}>
                💀
              </div>
            )}

          </div>

          {/* Secondary: link to primary pokemon */}
          {isSecondary && card.primaryPokemon && onNavigateToPokemon && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToPokemon(card.primaryPokemon);
              }}
              className="absolute top-2 left-2 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg z-10 transition-colors"
              title={`Go to ${card.primaryPokemon}`}
            >
              → {card.primaryPokemon}
            </button>
          )}

          {/* Secondary badge */}
          {isSecondary && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-purple-500 text-white rounded-full shadow-lg font-bold text-xs z-10">
              Ref
            </div>
          )}
        </div>

        {/* Card Details */}
        <div className={`p-2 space-y-0`} style={isOwned ? {background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'} : {background: 'white'}}>

          {/* === IDENTITY: always visible === */}
          <div className="space-y-0.5 pb-1.5">
            {/* Row 1: dex # + price + year */}
            <div className={`flex items-center gap-1 text-[10px] font-mono ${isOwned ? 'text-red-200' : 'text-gray-400'}`}>
              <span className="shrink-0">#{String(card.pokemonId || '').padStart(4, '0')}</span>
              {priceValue !== null && (
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${isOwned ? 'bg-red-700 text-red-100' : 'bg-emerald-100 text-emerald-700'}`}>
                  £{priceValue.toFixed(2)}
                </span>
              )}
              <span className="shrink-0 ml-auto">{(() => { try { const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const sd = setNames[card.enSetCode || card.setCode] || setNames[card.jpSetCode] || setNames[card.cnSetCode] || {}; if (!sd.year) return ''; return sd.month ? `${MONTHS[sd.month - 1]} ${sd.year}` : String(sd.year); } catch(e) { return ''; } })()}</span>
            </div>
            {/* Row 2: Pokemon name */}
            <div className={`font-bold text-sm leading-tight ${isOwned ? 'text-white' : 'text-gray-900'}`}>{isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName}</div>
            {/* Row 3: card name */}
            {appMode !== 'cameos' && (
              <div className={`text-xs leading-tight min-h-[0.9rem] font-medium truncate ${isOwned ? 'text-red-100' : 'text-gray-600'}`}>
                {(() => { const n = (card.cardName||'').replace(', Japanese Exclusive','').replace('Japanese Exclusive','').replace(', Chinese Exclusive','').replace('Chinese Exclusive','').trim(); const dn = (n && n !== 'Full Art') ? n : null; return dn || ' '; })()}
              </div>
            )}
          </div>

          {/* === SETS section === */}
          {appMode === 'cameos' ? (
            // Cameos: always expanded, no toggle
            <div className={`border-t pt-1.5 space-y-0.5 ${isOwned ? 'border-red-700' : 'border-gray-100'}`}>
              <div className={`text-[10px] leading-tight min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
                <div className="flex items-center gap-1">
                  {(card.enSetCode || card.setCode) ? (
                    <><span className="text-blue-500 font-bold shrink-0">EN</span><span className="truncate flex-1">{card.enSetCode || card.setCode}{card.number ? ` ${card.number}` : ''}</span></>
                  ) : <><span className="text-blue-500 font-bold shrink-0 opacity-40">EN</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
                </div>
                {!!((card.enSetCode || card.setCode)) && <div className="text-[9px] text-gray-400 pl-5 leading-tight mt-0.5">{getSetName(card.enSetCode || card.setCode)}</div>}
              </div>
              <div className={`text-[10px] leading-tight min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
                <div className="flex items-center gap-1">
                  {card.jpSetCode ? (
                    <><span className="text-red-400 font-bold shrink-0">JP</span><span className="truncate flex-1">{card.jpSetCode}{card.jpNumber ? ` ${card.jpNumber}` : ''}</span></>
                  ) : <><span className="text-red-400 font-bold shrink-0 opacity-40">JP</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
                </div>
                {!!(card.jpSetCode) && <div className="text-[9px] text-gray-400 pl-5 leading-tight mt-0.5">{getSetName(card.jpSetCode)}</div>}
              </div>
            </div>
          ) : (
            // Illustrations: collapsible sets section
            <div className={`border-t ${isOwned ? 'border-red-700' : 'border-gray-100'}`}>
              {/* Sets header / toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setSetsOpen(o => !o); }}
                className={`w-full flex items-center justify-between py-1 text-[10px] font-bold ${isOwned ? 'text-red-200 hover:text-white' : 'text-gray-500 hover:text-gray-800'} transition-colors`}
              >
                <span>Sets</span>
                {!setsOpen && (
                  <span className={`truncate mx-1 font-normal text-[9px] ${isOwned ? 'text-red-300' : 'text-gray-400'}`}>
                    {(() => {
                      const primary = card.enSetCode || card.setCode;
                      const code = primary || card.jpSetCode || card.cnSetCode;
                      const num = primary ? card.number : card.jpSetCode ? card.jpNumber : card.cnNumber;
                      const others = [card.jpSetCode, card.cnSetCode, card.tcSetCode, card.krSetCode].filter(Boolean).length;
                      return code ? `${code}${num ? ` ${num}` : ''}${others > 0 ? ` +${others}` : ''}` : 'N/A';
                    })()}
                  </span>
                )}
                <span className="shrink-0">{setsOpen ? '▴' : '▾'}</span>
              </button>
              {setsOpen && (
                <div className="space-y-0.5 pb-1.5">
                  {/* EN */}
                  <div className={`text-[10px] leading-tight min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-1">
                      {(card.enSetCode || card.setCode) ? (
                        <>
                          <span className="text-blue-500 font-bold shrink-0">EN</span>
                          <span className="truncate flex-1">{card.enSetCode || card.setCode}{card.number ? ` ${card.number}` : ''}</span>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedLang(prev => prev === 'en' ? null : 'en'); }} className={`shrink-0 text-[9px] font-bold ${isOwned ? 'text-red-300 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>{expandedLang === 'en' ? '−' : '+'}</button>
                        </>
                      ) : <><span className="text-blue-500 font-bold shrink-0 opacity-40">EN</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
                    </div>
                    {expandedLang === 'en' && !!((card.enSetCode || card.setCode)) && <div className="text-[9px] text-gray-400 pl-5 leading-tight mt-0.5">{getSetName(card.enSetCode || card.setCode)}</div>}
                  </div>
                  {/* JP */}
                  <div className={`text-[10px] leading-tight min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-1">
                      {card.jpSetCode ? (
                        <>
                          <span className="text-red-400 font-bold shrink-0">JP</span>
                          <span className="truncate flex-1">{card.jpSetCode}{card.jpNumber ? ` ${card.jpNumber}` : ''}</span>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedLang(prev => prev === 'jp' ? null : 'jp'); }} className={`shrink-0 text-[9px] font-bold ${isOwned ? 'text-red-300 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>{expandedLang === 'jp' ? '−' : '+'}</button>
                        </>
                      ) : <><span className="text-red-400 font-bold shrink-0 opacity-40">JP</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
                    </div>
                    {expandedLang === 'jp' && !!(card.jpSetCode) && <div className="text-[9px] text-gray-400 pl-5 leading-tight mt-0.5">{getSetName(card.jpSetCode)}</div>}
                  </div>
                  {/* CN */}
                  <div className={`text-[10px] leading-tight min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-1">
                      {card.cnSetCode ? (
                        <>
                          <span className="text-yellow-500 font-bold shrink-0">CN</span>
                          <span className="truncate flex-1">{card.cnSetCode}{card.cnNumber ? ` ${card.cnNumber}` : ''}</span>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedLang(prev => prev === 'cn' ? null : 'cn'); }} className={`shrink-0 text-[9px] font-bold ${isOwned ? 'text-red-300 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>{expandedLang === 'cn' ? '−' : '+'}</button>
                        </>
                      ) : <><span className="text-yellow-500 font-bold shrink-0 opacity-40">CN</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
                    </div>
                    {expandedLang === 'cn' && !!(card.cnSetCode) && <div className="text-[9px] text-gray-400 pl-5 leading-tight mt-0.5">{getSetName(card.cnSetCode)}</div>}
                  </div>
                  {/* TC */}
                  <div className={`text-[10px] leading-tight min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-1">
                      {card.tcSetCode ? (
                        <>
                          <span className="text-green-500 font-bold shrink-0">TC</span>
                          <span className="truncate flex-1">{card.tcSetCode}{card.tcNumber ? ` ${card.tcNumber}` : ''}</span>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedLang(prev => prev === 'tc' ? null : 'tc'); }} className={`shrink-0 text-[9px] font-bold ${isOwned ? 'text-red-300 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>{expandedLang === 'tc' ? '−' : '+'}</button>
                        </>
                      ) : <><span className="text-green-500 font-bold shrink-0 opacity-40">TC</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
                    </div>
                    {expandedLang === 'tc' && !!(card.tcSetCode) && <div className="text-[9px] text-gray-400 pl-5 leading-tight mt-0.5">{getSetName(card.tcSetCode)}</div>}
                  </div>
                  {/* KR */}
                  <div className={`text-[10px] leading-tight min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
                    <div className="flex items-center gap-1">
                      {card.krSetCode ? (
                        <>
                          <span className="text-indigo-400 font-bold shrink-0">KR</span>
                          <span className="truncate flex-1">{card.krSetCode}{card.krNumber ? ` ${card.krNumber}` : ''}</span>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedLang(prev => prev === 'kr' ? null : 'kr'); }} className={`shrink-0 text-[9px] font-bold ${isOwned ? 'text-red-300 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>{expandedLang === 'kr' ? '−' : '+'}</button>
                        </>
                      ) : <><span className="text-indigo-400 font-bold shrink-0 opacity-40">KR</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
                    </div>
                    {expandedLang === 'kr' && !!(card.krSetCode) && <div className="text-[9px] text-gray-400 pl-5 leading-tight mt-0.5">{getSetName(card.krSetCode)}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === FEATURED / ARTIST section === */}
          {appMode !== 'cameos' && (
            <div className={`border-t ${isOwned ? 'border-red-700' : 'border-gray-100'}`}>
              <button
                onClick={(e) => { e.stopPropagation(); setFeaturedOpen(o => !o); }}
                className={`w-full flex items-center justify-between py-1 text-[10px] font-bold ${isOwned ? 'text-red-200 hover:text-white' : 'text-gray-500 hover:text-gray-800'} transition-colors`}
              >
                <span>Featured</span>
                {!featuredOpen && (
                  <span className={`truncate mx-1 font-normal text-[9px] ${isOwned ? 'text-red-300' : 'text-gray-400'}`}>
                    {hasOtherPokemon ? `w/ ${card.otherPokemon.slice(0, 2).join(', ')}${card.otherPokemon.length > 2 ? ` +${card.otherPokemon.length - 2}` : ''}` : card.artist || '—'}
                  </span>
                )}
                <span className="shrink-0">{featuredOpen ? '▴' : '▾'}</span>
              </button>
              {featuredOpen && (
                <div className="pb-1.5 space-y-0.5">
                  <div className={`text-xs min-h-[0.9rem] leading-tight ${isOwned ? 'text-red-100' : 'text-blue-500'}`}>
                    {hasOtherPokemon ? (showAllPokemon
                      ? <span>w/ {card.otherPokemon.join(', ')} <button onClick={(e) => { e.stopPropagation(); setShowAllPokemon(false); }} className={`font-bold underline ${isOwned ? 'text-white' : 'text-blue-400'}`}>less</button></span>
                      : <span className="flex items-baseline gap-1"><span className="truncate">w/ {card.otherPokemon.slice(0, 2).join(', ')}</span>{card.otherPokemon.length > 2 && <button onClick={(e) => { e.stopPropagation(); setShowAllPokemon(true); }} className={`shrink-0 font-bold underline ${isOwned ? 'text-white' : 'text-blue-400'}`}>+{card.otherPokemon.length - 2}</button>}</span>
                    ) : <span>&nbsp;</span>}
                  </div>
                  <div className={`text-xs leading-tight truncate min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-400'}`}>{card.artist || ' '}</div>
                </div>
              )}
            </div>
          )}

          {/* === EBAY section === */}
          <div className={`border-t ${isOwned ? 'border-red-700' : 'border-gray-100'}`}>
            <button
              onClick={(e) => { e.stopPropagation(); setEbayOpen(o => !o); }}
              className={`w-full flex items-center justify-between py-1 text-[10px] font-bold ${isOwned ? 'text-red-200 hover:text-white' : 'text-gray-500 hover:text-gray-800'} transition-colors`}
            >
              <span>eBay</span>
              {!ebayOpen && (
                <span className={`font-normal text-[9px] ${isOwned ? 'text-red-300' : 'text-gray-400'}`}>
                  {[
                    (card.enSetCode || card.setCode) ? '🇬🇧' : null,
                    card.jpSetCode ? '🇯🇵' : null,
                    card.cnSetCode ? '🇨🇳' : null,
                    card.tcSetCode ? '🇹🇼' : null,
                    showKR ? '🇰🇷' : null,
                  ].filter(Boolean).join(' ')}
                </span>
              )}
              <span className="shrink-0">{ebayOpen ? '▴' : '▾'}</span>
            </button>
            {ebayOpen && (
              <div className="flex gap-1 pb-1.5">
                {ALL_LANGS.map(lang => {
                  const hasLang = lang === 'EN' ? !!(card.enSetCode || card.setCode)
                    : lang === 'JP' ? !!card.jpSetCode
                    : lang === 'CN' ? !!card.cnSetCode
                    : lang === 'TC' ? !!(card.tcSetCode || card.setCode || card.jpSetCode)
                    : showKR;
                  const cfg = LANG_CONFIG[lang];
                  return (
                    <a
                      key={lang}
                      href={hasLang ? buildEbayUrl(card, isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName, lang) : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      title={hasLang ? `Search eBay sold listings (${lang})` : `Not available in ${lang}`}
                      className={`flex-1 py-0.5 rounded text-[10px] font-bold text-center transition-all duration-150
                        ${hasLang
                          ? `${cfg.color} text-white opacity-70 hover:opacity-100`
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-30'
                        }`}
                    >
                      {cfg.flag}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Language ownership buttons */}
          {!isSecondary && showOwnershipButtons && (
            <div className={`border-t pt-1 ${isOwned ? 'border-red-700' : 'border-gray-100'}`}>
              {isOwned ? (
                <button
                  onClick={() => handleLangClick(card.ownedLang)}
                  className={`w-full py-1 rounded text-xs font-bold text-white transition-colors ${LANG_CONFIG[card.ownedLang]?.owned || 'bg-emerald-500'} hover:opacity-80`}
                  title="Click to unmark"
                >
                  ✓ {card.ownedLang} · tap to unmark
                </button>
              ) : (
                <div className="flex gap-1">
                  {ALL_LANGS.map(lang => {
                    const isAvailable = availableLangs.includes(lang) || (lang === 'KR' && showKR) || (lang === 'TC' && !!card.tcSetCode);
                    const cfg = LANG_CONFIG[lang];
                    return (
                      <button
                        key={lang}
                        onClick={() => isAvailable && handleLangClick(lang)}
                        title={isAvailable ? `Mark as owned (${lang})` : `Not available in ${lang}`}
                        className={`flex-1 py-1 rounded text-xs font-bold transition-all duration-150
                          ${isAvailable
                            ? `${cfg.color} text-white`
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-40'
                          }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zoom Modal with Loupe + Coord Picker */}
      {showZoom && (
        <div
          className="fixed inset-0 bg-black/90 flex items-start sm:items-center justify-center z-50 overflow-y-auto py-4 sm:py-0"
          style={{ cursor: pickerMode ? 'crosshair' : overImage ? 'none' : 'default' }}
          onClick={() => { if (!pickerMode) { setShowZoom(false); setZoomScale(2.5); setPickerMode(false); setPickerCircles([]); setPickerSelected(null); setShowHighlight(false); }}}
          onMouseMove={handleZoomMouseMove}
          onWheel={handleZoomWheel}
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 w-full sm:w-auto px-2 sm:px-0" onClick={e => e.stopPropagation()}>

            {/* Left checklist panel */}
            {card.otherPokemon && card.otherPokemon.length > 0 && (
              <div className="hidden sm:block" style={{ width: '220px', flexShrink: 0, background: '#1f2937', borderRadius: '10px', padding: '10px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '8px', fontWeight: 'bold' }}>
                  Featured ({card.otherPokemon.length})
                </div>
                {card.otherPokemon.map(name => {
                  const tagged = pickerCircles.some(c => c.name.toLowerCase() === name.toLowerCase());
                  const saved = (pokemonCoordsImport[card.id] || []).some(c => c.name.toLowerCase() === name.toLowerCase());
                  // Find all positions for this pokemon in saved coords
                  const coordEntry = (pokemonCoordsImport[card.id] || []).find(c => c.name.toLowerCase() === name.toLowerCase());
                  const positions = coordEntry
                    ? (coordEntry.positions || [{ x: coordEntry.x, y: coordEntry.y, r: coordEntry.r }])
                    : [];
                  const THUMB = 44; // circle thumbnail px
                  return (
                    <div key={name} onClick={() => { if (highlightName === name) { setHighlightName(null); setShowHighlight(false); } else { setHighlightName(name); setShowHighlight(true); } }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid #374151', cursor: 'pointer', background: highlightName === name ? 'rgba(255,255,255,0.08)' : 'transparent', borderRadius: '6px' }}>
                      {/* Circle crop thumbnail(s) — use first position */}
                      {positions.length > 0 && imageSrc ? (
                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0, alignItems: 'center' }}>
                          {positions.slice(0, 2).map((pos, pi) => {
                            // We render the card image clipped to the circle region
                            // bg-size = THUMB / (r*2) * 100% of natural img
                            // We need: the circle centre at pos.x,pos.y with radius pos.r (all fractions of card width)
                            // Card aspect ratio ~2.5/3.5
                            const cardAspect = 2.5 / 3.5;
                            // In the zoomed card, width is the reference dimension for r
                            // bg-size: scale so the circle diameter fills the thumb
                            const scale = THUMB / (pos.r * 2); // scale factor: px per unit-width
                            const bgW = scale; // background-size width in px (1 card-width = scale px)
                            const bgH = scale / cardAspect; // height follows aspect ratio
                            const bgX = -(pos.x * bgW - THUMB / 2);
                            const bgY = -(pos.y * bgH - THUMB / 2);
                            return (
                              <div key={pi} style={{
                                width: THUMB, height: THUMB, borderRadius: '50%', flexShrink: 0,
                                backgroundImage: `url(${imageSrc})`,
                                backgroundSize: `${bgW}px ${bgH}px`,
                                backgroundPosition: `${bgX}px ${bgY}px`,
                                backgroundRepeat: 'no-repeat',
                                border: '2px solid rgba(255,255,255,0.25)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                              }} />
                            );
                          })}
                          {positions.length > 2 && (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold', color: '#9ca3af', border: '1px solid #6b7280' }}>
                              +{positions.length - 2}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{
                          width: THUMB, height: THUMB, borderRadius: '50%', flexShrink: 0,
                          background: tagged ? '#22c55e' : saved ? '#3b82f6' : '#374151',
                          border: tagged || saved ? 'none' : '1px solid #6b7280',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 'bold', color: 'white'
                        }}>{tagged || saved ? '✓' : '?'}</div>
                      )}
                      <span style={{ fontSize: '11px', color: positions.length > 0 ? 'white' : tagged ? '#86efac' : saved ? '#93c5fd' : '#6b7280', lineHeight: 1.3, wordBreak: 'break-word' }}>{name}</span>
                    </div>
                  );
                })}
                {pickerCircles.filter(c => c.name && !card.otherPokemon.some(n => n.toLowerCase() === c.name.toLowerCase())).map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'white' }}>?</div>
                    <span style={{ fontSize: '11px', color: '#fbbf24' }}>{c.name} <span style={{ color: '#6b7280', fontSize: '9px' }}>(not in list)</span></span>
                  </div>
                ))}
              </div>
            )}

            {/* Card image column */}
            <div className="relative" style={{ width: appMode === 'cameos' ? 'clamp(300px, 92vw, 600px)' : 'clamp(260px, 80vw, 420px)' }}>
              <img
                ref={zoomImgRef}
                src={imageSrc}
                alt={`${pokemonName} ${card.cardName}`}
                className="w-full h-auto object-contain rounded-lg"
                style={{ cursor: pickerMode ? 'crosshair' : 'none', display: 'block', userSelect: 'none',
                  ...(appMode === 'cameos' ? { clipPath: 'inset(8% 3% 38% 3% round 4px)', marginBottom: '-38%', marginTop: '-8%' } : {}) }}
                onMouseEnter={() => setOverImage(true)}
                onMouseLeave={() => setOverImage(false)}
                onLoad={() => { if (zoomImgRef.current) setImgRect(zoomImgRef.current.getBoundingClientRect()); }}
                onClick={pickerMode ? handlePickerImageClick : undefined}
                draggable={false}
              />

              {/* Highlight overlay — dims card and draws circles around featured Pokémon */}
              {showHighlight && (() => {
                const coords = pokemonCoordsImport[card.id] || [];
                if (!coords.length || !zoomImgRef.current) return null;
                const rect = zoomImgRef.current.getBoundingClientRect();
                const containerRect = zoomImgRef.current.parentElement.getBoundingClientRect();
                const w = rect.width;
                const h = rect.height;
                // Build SVG clipPath circles
                const allPositions = coords.flatMap(entry =>
                  entry.positions
                    ? entry.positions.map(p => ({ ...p, name: entry.name }))
                    : [{ x: entry.x, y: entry.y, r: entry.r, name: entry.name }]
                ).filter(p => !highlightName || p.name.toLowerCase() === highlightName.toLowerCase());
                return (
                  <svg
                    style={{ position: 'absolute', top: rect.top - containerRect.top, left: rect.left - containerRect.left, width: w, height: h, pointerEvents: 'none', borderRadius: '8px', overflow: 'hidden' }}
                    viewBox={`0 0 ${w} ${h}`}
                  >
                    <defs>
                      <mask id="highlight-mask">
                        <rect width={w} height={h} fill="white" />
                        {allPositions.map((p, i) => (
                          <circle key={i} cx={p.x * w} cy={p.y * h} r={p.r * w} fill="black" />
                        ))}
                      </mask>
                    </defs>
                    {/* Dark overlay everywhere except circles */}
                    <rect width={w} height={h} fill="rgba(0,0,0,0.6)" mask="url(#highlight-mask)" />
                    {/* Animated fire rings + labels */}
                    {allPositions.map((p, i) => {
                      const cx = p.x * w;
                      const cy = p.y * h;
                      const r = p.r * w;
                      const circ = 2 * Math.PI * r;
                      const dur1 = 2.8 + i * 0.35;
                      const dur2 = dur1 * 1.4;
                      const dur3 = dur1 * 0.65;
                      return (
                        <g key={i}>
                          {/* Soft glow fill */}
                          <circle cx={cx} cy={cy} r={r}
                            fill="rgba(251,146,60,0.08)" />
                          {/* Base ember ring */}
                          <circle cx={cx} cy={cy} r={r} fill="none"
                            stroke="rgba(251,146,60,0.35)" strokeWidth="2.5" />
                          {/* Arc 1 — main flame, gold/orange */}
                          <circle cx={cx} cy={cy} r={r} fill="none"
                            stroke="#fbbf24" strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${circ * 0.22} ${circ * 0.78}`}>
                            <animateTransform attributeName="transform" type="rotate"
                              from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`}
                              dur={`${dur1}s`} repeatCount="indefinite" />
                          </circle>
                          {/* Arc 2 — mid flame, orange */}
                          <circle cx={cx} cy={cy} r={r} fill="none"
                            stroke="#f97316" strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${circ * 0.14} ${circ * 0.86}`}>
                            <animateTransform attributeName="transform" type="rotate"
                              from={`120 ${cx} ${cy}`} to={`480 ${cx} ${cy}`}
                              dur={`${dur2}s`} repeatCount="indefinite" />
                          </circle>
                          {/* Arc 3 — flicker, red */}
                          <circle cx={cx} cy={cy} r={r} fill="none"
                            stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray={`${circ * 0.09} ${circ * 0.91}`}>
                            <animateTransform attributeName="transform" type="rotate"
                              from={`240 ${cx} ${cy}`} to={`600 ${cx} ${cy}`}
                              dur={`${dur3}s`} repeatCount="indefinite" />
                          </circle>
                          {/* Label */}
                          <text x={cx} y={cy - r - 6}
                            textAnchor="middle" fill="white" fontSize="12" fontWeight="bold"
                            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 10px rgba(251,146,60,0.9)' }}>
                            {p.name}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}

              {/* SVG overlay — draggable circles */}
              {pickerMode && pickerCircles.length > 0 && zoomImgRef.current && (() => {
                const rect = zoomImgRef.current.getBoundingClientRect();
                const containerRect = zoomImgRef.current.parentElement.getBoundingClientRect();
                const needsPlacement = pickerSelected !== null && (() => { const sc = pickerCircles[pickerSelected.ci]; return sc && sc.positions.length < sc.count; })();
                return (
                  <svg
                    style={{ position: 'absolute', top: rect.top - containerRect.top, left: rect.left - containerRect.left, width: rect.width, height: rect.height, pointerEvents: 'none', overflow: 'visible' }}
                    viewBox={`0 0 ${rect.width} ${rect.height}`}
                  >
                    {pickerCircles.flatMap((c, ci) =>
                      c.positions.map((pos, pi) => {
                        const cx = pos.x * rect.width;
                        const cy = pos.y * rect.height;
                        const r = pos.r * rect.width;
                        const isSelected = pickerSelected?.ci === ci && pickerSelected?.pi === pi;
                        const label = c.name || `#${ci + 1}`;
                        return (
                          <g key={`${ci}-${pi}`}
                            style={{ pointerEvents: needsPlacement ? 'none' : 'all', cursor: needsPlacement ? 'crosshair' : 'grab' }}
                            onMouseDown={needsPlacement ? undefined : (e) => handleCircleMouseDown(e, ci, pi)}>
                            <circle cx={cx} cy={cy} r={r + 8} fill="transparent" />
                            <circle cx={cx} cy={cy} r={r} fill="none"
                              stroke="#ef4444"
                              strokeWidth={isSelected ? 3 : 2}
                              strokeDasharray={isSelected ? '5 3' : 'none'} />
                            <text x={cx} y={cy - r - 4} textAnchor="middle" fill="white"
                              fontSize="11" fontWeight="bold"
                              style={{ textShadow: '0 1px 3px black', pointerEvents: 'none' }}>
                              {label}
                            </text>
                          </g>
                        );
                      })
                    )}
                  </svg>
                );
              })()}

              {/* Close button */}
              <button
                onClick={() => { setShowZoom(false); setZoomScale(2.5); setPickerMode(false); setPickerCircles([]); setPickerSelected(null); setShowHighlight(false); }}
                className="absolute top-2 right-2 bg-white text-gray-900 rounded-full p-1.5 hover:bg-gray-100 shadow-lg"
                style={{ cursor: 'pointer' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Right panel */}
            <div style={{ width: '100%', maxWidth: '230px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '90vh', overflowY: 'auto', paddingRight: '4px' }}>

              {/* Highlight toggle — only show if coords exist for this card */}
              {pokemonCoordsImport[card.id] && (
                <button
                  onClick={() => setShowHighlight(v => !v)}
                  style={{ padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', border: 'none',
                    background: showHighlight ? '#ef4444' : '#374151', color: 'white' }}
                >
                  {showHighlight ? '👁 Hide Pokémon' : '👁 Show Pokémon'}
                </button>
              )}

              {/* Picker toggle */}
              <button
                onClick={() => { setPickerMode(v => !v); setPickerSelected(null); setAutocompleteFor(null); }}
                style={{ padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', border: 'none',
                  background: pickerMode ? '#facc15' : '#374151', color: pickerMode ? '#1a1a1a' : 'white' }}
              >
                {pickerMode ? '🎯 Picker ON — click card' : '🎯 Coord Picker'}
              </button>

              {pickerMode && (
                <>
                  {/* Radius slider */}
                  <div style={{ background: '#1f2937', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>
                      Circle radius: <strong style={{ color: 'white' }}>{pickerRadius.toFixed(3)}</strong>
                    </div>
                    <input type="range" min="0.03" max="0.25" step="0.005" value={pickerRadius}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setPickerRadius(v);
                        if (pickerSelected !== null) {
                          setPickerCircles(prev => prev.map((c, i) => i === pickerSelected.ci ? { ...c, positions: c.positions.map((p, j) => j === pickerSelected.pi ? { ...p, r: v } : p) } : c));
                        }
                      }}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>Drag circles to reposition · slider resizes selected</div>
                  </div>

                  {/* Circle list */}
                  {pickerCircles.length > 0 && (
                    <div style={{ background: '#1f2937', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ color: '#9ca3af', fontSize: '11px' }}>Placed circles</div>
                      {pickerCircles.map((c, ci) => {
                        const isCircleSelected = pickerSelected?.ci === ci;
                        const suggestions = autocompleteFor === ci ? getAutocompleteSuggestions(autocompleteQuery) : [];
                        const needsMore = c.positions.length < c.count;
                        return (
                          <div key={ci} onClick={() => { setPickerSelected({ ci, pi: 0 }); setPickerRadius(c.positions[0]?.r ?? 0.08); }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px', borderRadius: '8px',
                              background: isCircleSelected ? '#374151' : 'transparent',
                              border: isCircleSelected ? '1px solid #ef4444' : '1px solid transparent', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                              <div style={{ flex: 1, position: 'relative' }}>
                                <input
                                  value={c.name}
                                  placeholder={`Pokémon #${ci + 1}`}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setPickerCircles(prev => prev.map((cc, i) => i === ci ? { ...cc, name: v } : cc));
                                    setAutocompleteFor(ci);
                                    setAutocompleteQuery(v);
                                  }}
                                  onFocus={() => { setAutocompleteFor(ci); setAutocompleteQuery(c.name); setPickerSelected({ ci, pi: 0 }); setPickerRadius(c.positions[0]?.r ?? 0.08); }}
                                  onBlur={() => setTimeout(() => setAutocompleteFor(null), 150)}
                                  onClick={e => e.stopPropagation()}
                                  style={{ width: '100%', background: '#1f2937', border: '1px solid #4b5563', borderRadius: '6px',
                                    padding: '3px 6px', color: 'white', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                                />
                                {suggestions.length > 0 && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1f2937', border: '1px solid #4b5563',
                                    borderRadius: '6px', zIndex: 100, overflow: 'hidden', marginTop: '2px' }}>
                                    {suggestions.map(name => (
                                      <div key={name}
                                        onMouseDown={() => {
                                          setPickerCircles(prev => prev.map((cc, i) => i === ci ? { ...cc, name } : cc));
                                          setAutocompleteFor(null);
                                        }}
                                        style={{ padding: '4px 8px', fontSize: '11px', color: 'white', cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#374151'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                      >{name}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <input type="number" min="1" max="20" value={c.count}
                                onChange={e => {
                                  const v = Math.max(1, parseInt(e.target.value) || 1);
                                  setPickerCircles(prev => prev.map((cc, i) => i === ci
                                    ? { ...cc, count: v, positions: cc.positions.slice(0, v) }
                                    : cc));
                                }}
                                onClick={e => e.stopPropagation()}
                                title="How many times this Pokémon appears"
                                style={{ width: '36px', background: '#1f2937', border: '1px solid #4b5563', borderRadius: '6px',
                                  padding: '3px 4px', color: 'white', fontSize: '11px', outline: 'none', textAlign: 'center' }}
                              />
                              <button onClick={e => { e.stopPropagation(); setPickerCircles(prev => prev.filter((_, i) => i !== ci)); if (isCircleSelected) setPickerSelected(null); }}
                                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>✕</button>
                            </div>
                            {isCircleSelected && needsMore && (
                              <div style={{ fontSize: '10px', color: '#fbbf24', paddingLeft: '12px' }}>
                                Click card to place position {c.positions.length + 1} of {c.count}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* JSON output + copy */}
                  {pickerCircles.length > 0 && (
                    <div style={{ background: '#111827', borderRadius: '10px', padding: '10px' }}>
                      <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>Card ID: <span style={{ color: '#93c5fd' }}>{card.id}</span></div>
                      <pre style={{ color: '#86efac', fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, maxHeight: '140px', overflowY: 'auto' }}>
                        {`"otherPokemonCoords": ${pickerJson}`}
                      </pre>
                      <button onClick={handleCopyJson}
                        style={{ marginTop: '8px', width: '100%', padding: '6px', borderRadius: '8px', border: 'none',
                          background: copied ? '#059669' : '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                        {copied ? '✓ Copied!' : 'Copy JSON'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {!pickerMode && (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textAlign: 'center' }}>
                  Scroll to zoom · {zoomScale.toFixed(1)}×
                </div>
              )}
            </div>
          </div>

          {/* Loupe — only when not in picker mode */}
          {!pickerMode && overImage && (
            <div style={{
              position: 'fixed', left: mousePos.x - LOUPE_SIZE / 2, top: mousePos.y - LOUPE_SIZE / 2,
              width: LOUPE_SIZE, height: LOUPE_SIZE, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.85)', boxShadow: '0 0 0 2px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.7)',
              pointerEvents: 'none', overflow: 'hidden', ...getLoupeStyle(),
            }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', width: 1, height: 20, background: 'rgba(255,255,255,0.5)' }} />
                <div style={{ position: 'absolute', width: 20, height: 1, background: 'rgba(255,255,255,0.5)' }} />
              </div>
            </div>
          )}

          {!pickerMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs pointer-events-none">
              Scroll to zoom · {zoomScale.toFixed(1)}×
            </div>
          )}
        </div>
      )}
    </>
  );
}
