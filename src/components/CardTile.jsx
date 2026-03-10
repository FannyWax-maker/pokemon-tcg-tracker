import React from 'react';
import setNamesImport from '../data/set_names.json';
const setNames = setNamesImport;

// Global cache - images never reload after first load
const imageCache = {};

// Global request queue - limits concurrent image fetches to avoid GitHub Pages 429
const MAX_CONCURRENT = 6;
let activeRequests = 0;
const requestQueue = [];

const enqueueImageLoad = (fn) => {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeRequests++;
      try {
        const result = await fn();
        resolve(result);
      } catch (e) {
        reject(e);
      } finally {
        activeRequests--;
        if (requestQueue.length > 0) {
          const next = requestQueue.shift();
          next();
        }
      }
    };
    if (activeRequests < MAX_CONCURRENT) {
      run();
    } else {
      requestQueue.push(run);
    }
  });
};

const LANG_CONFIG = {
  EN: { flag: '🇬🇧', color: 'bg-blue-500 hover:bg-blue-600', owned: 'bg-blue-500' },
  JP: { flag: '🇯🇵', color: 'bg-red-500 hover:bg-red-600', owned: 'bg-red-500' },
  CN: { flag: '🇨🇳', color: 'bg-yellow-500 hover:bg-yellow-600', owned: 'bg-yellow-500' },
  KR: { flag: '🇰🇷', color: 'bg-indigo-500 hover:bg-indigo-600', owned: 'bg-indigo-500' },
};

const ALL_LANGS = ['EN', 'JP', 'CN', 'KR'];

const buildEbayUrl = (card, pokemonName, lang) => {
  const rawName = card.cardName || '';
  const isTrainerCard = rawName.startsWith('Trainer,') || rawName.startsWith('Trainer ,');
  const cleanedName = isTrainerCard ? rawName.replace(/^Trainer\s*,\s*/, '').trim() : rawName;
  const skipNames = ['Full Art', 'Trainer', 'Item', 'Stadium', 'Supporter', 'Tool', 'Energy'];
  const cardName = cleanedName && !skipNames.includes(cleanedName) ? cleanedName : null;
  const searchName = cardName || pokemonName;
  const setCode = lang === 'JP' ? card.jpSetCode : lang === 'CN' ? card.cnSetCode : card.setCode;
  const setNumber = lang === 'EN' ? (card.setNumber || card.number || null) : null;
  const langKeyword = lang === 'JP' ? 'japanese' : lang === 'CN' ? 'chinese' : lang === 'KR' ? 'korean' : '';
  const query = [searchName, setCode, setNumber, langKeyword].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_ItemLocation=3&_sop=12`;
};


export default function CardTile({ card, pokemonName, onOwnershipClick, onToggleNonConforming, onToggleFavorite, onToggleUnobtainable, onNavigateToPokemon, showOwnershipButtons = false , scrollRoot }) {
  const isOwned = !!card.ownedLang;
  const hasOtherPokemon = card.otherPokemon && card.otherPokemon.length > 0;
  const isSecondary = card.isSecondary || !card.isPrimary;
  const [showZoom, setShowZoom] = React.useState(false);
  const [zoomScale, setZoomScale] = React.useState(2.5);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [imgRect, setImgRect] = React.useState(null);
  const [overImage, setOverImage] = React.useState(false);
  const zoomImgRef = React.useRef(null);
  const LOUPE_SIZE = 180;

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
  const [showAllPokemon, setShowAllPokemon] = React.useState(false);
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [contextMenuPos, setContextMenuPos] = React.useState({ x: 0, y: 0 });
  const isNonConforming = !!card.nonConforming;
  const isFavorite = !!card.favorite;
  const isUnobtainable = !!card.unobtainable;

  // Which langs are available for this card
  const availableLangs = card.availableLangs || [];
  const isJpExclusive = card.exclusive === 'JP';
  const isCnExclusive = card.exclusive === 'CN';
  const showKR = !isJpExclusive && !isCnExclusive;

  const handleLangClick = (lang) => {
    if (isSecondary) return;
    if (card.ownedLang === lang) {
      onOwnershipClick({ ...card, _action: 'unmark' });
    } else {
      onOwnershipClick({ ...card, _directLang: lang });
    }
  };

  const generateImagePaths = () => {
    const displayPokemon = isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName;
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

  const imagePaths = generateImagePaths();
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
      // Try paths sequentially through the queue - prevents burst of 200+ requests when fast-scrolling
      const allPaths = imagePaths.flatMap(path => [
        `/pokemon-tcg-tracker/card-images/${path}.png`,
        `/pokemon-tcg-tracker/card-images/${path}.jpg`
      ]);

      const tryPath = (src) => enqueueImageLoad(() =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(src);
          img.onerror = reject;
          img.src = src;
        })
      );

      let found = null;
      for (const src of allPaths) {
        if (!mounted) return;
        try {
          found = await tryPath(src);
          break;
        } catch (_) {
          // try next path
        }
      }

      if (!mounted) return;
      imageCache[cacheKey] = { src: found };
      setImageSrc(found);
      setImageLoaded(!!found);
      if (card._filterMissingImages && found) setShouldHide(true);
    };

    tryLoadImage();
    return () => { mounted = false; };
  }, [inView, cacheKey]);

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
          onClick={() => imageLoaded && setShowZoom(true)}
        >
          {imageLoaded && imageSrc ? (
            <img
              src={imageSrc}
              alt={`${pokemonName} ${card.cardName}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center h-full">
              <div className="text-5xl mb-2 opacity-20">🃏</div>
              <div className="text-white/90 font-bold text-xs mb-1">{card.cardName}</div>
              <div className="text-white/60 text-xs mb-3">{card.setCode} {card.number}</div>
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
        <div className={`p-2 space-y-0.5`} style={isOwned ? {background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'} : {background: 'white'}}>


          {/* Row 1: dex # + year + price — compact metadata line */}
          <div className={`flex items-center justify-between text-[10px] font-mono ${isOwned ? 'text-red-200' : 'text-gray-400'}`}>
            <span>#{String(card.pokemonId || '').padStart(4, '0')}</span>
            <div className="flex items-center gap-1">
              {card.priceGBP && <span className={`font-semibold ${isOwned ? 'text-red-100' : 'text-emerald-600'}`}>£{Number(card.priceGBP).toFixed(2)}</span>}
              <span>{(() => { try { const _se = setNames[card.enSetCode || card.setCode]; const _n = typeof _se === 'object' ? (_se?.name || '') : (typeof _se === 'string' ? _se : ''); const yrMatch = _n.match(/\d{4}(?:-\d{4})?$/); return yrMatch ? yrMatch[0] : (_se?.year || ''); } catch(e) { return ''; } })()}</span>
            </div>
          </div>

          {/* Row 2: Pokemon name — full width, wraps if needed */}
          <div className={`font-bold text-sm leading-tight ${isOwned ? 'text-white' : 'text-gray-900'}`}>{isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName}</div>

          {/* Row 3: card name — always reserve space */}
          <div className={`text-xs leading-tight min-h-[0.9rem] font-medium truncate ${isOwned ? 'text-red-100' : 'text-gray-600'}`}>
            {(() => { const n = (card.cardName||'').replace(', Japanese Exclusive','').replace('Japanese Exclusive','').replace(', Chinese Exclusive','').replace('Chinese Exclusive','').trim(); const dn = (n && n !== 'Full Art') ? n : null; return dn || ' '; })()}
          </div>

          {/* Row 4: EN */}
          <div className={`text-[10px] leading-tight min-h-[0.9rem] flex items-start gap-1 ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
            {(card.enSetCode || card.setCode) ? (
              <>
                <span className="text-blue-500 font-bold shrink-0">EN</span>
                <span className="truncate">{card.enSetCode || card.setCode}{card.number ? ` ${card.number}` : ''}{(() => { const _ec = card.enSetCode || card.setCode; const _e = setNames[_ec]; const n = typeof _e === 'object' ? _e?.name : _e; return n ? ` - ${String(n).replace(/ \d{4}(-\d{4})?$/, '').trim()}` : ''; })()}</span>
              </>
            ) : <><span className="text-blue-500 font-bold shrink-0 opacity-40">EN</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
          </div>

          {/* Row 5: JP */}
          <div className={`text-[10px] leading-tight min-h-[0.9rem] flex items-start gap-1 ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
            {card.jpSetCode ? (
              <>
                <span className="text-red-400 font-bold shrink-0">JP</span>
                <span className="truncate">{card.jpSetCode}{(() => { const _j = setNames[card.jpSetCode]; const n = typeof _j === 'object' ? _j?.name : _j; return n ? ` - ${n.replace(/ \d{4}.*/, '').trim()}` : ''; })()}</span>
              </>
            ) : <><span className="text-red-400 font-bold shrink-0 opacity-40">JP</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
          </div>

          {/* Row 6: CN */}
          <div className={`text-[10px] leading-tight min-h-[0.9rem] flex items-start gap-1 ${isOwned ? 'text-red-200' : 'text-gray-500'}`}>
            {card.cnSetCode ? (
              <>
                <span className="text-yellow-500 font-bold shrink-0">CN</span>
                <span className="truncate">{card.cnSetCode}{(() => { const _c = setNames[card.cnSetCode]; const n = typeof _c === 'object' ? _c?.name : _c; return n ? ` - ${n.replace(/ \d{4}.*/, '').trim()}` : ''; })()}</span>
              </>
            ) : <><span className="text-yellow-500 font-bold shrink-0 opacity-40">CN</span><span className={`${isOwned ? 'text-red-300' : 'text-gray-400'} italic`}>N/A</span></>}
          </div>

          {/* Row 7: other pokemon — always reserve space */}
          <div className={`text-xs min-h-[0.9rem] leading-tight ${isOwned ? 'text-red-100' : 'text-blue-500'}`}>
            {hasOtherPokemon ? (showAllPokemon
              ? <span>w/ {card.otherPokemon.join(', ')} <button onClick={(e) => { e.stopPropagation(); setShowAllPokemon(false); }} className={`font-bold underline ${isOwned ? 'text-white' : 'text-blue-400'}`}>less</button></span>
              : <span className="flex items-baseline gap-1"><span className="truncate">w/ {card.otherPokemon.slice(0, 2).join(', ')}</span>{card.otherPokemon.length > 2 && <button onClick={(e) => { e.stopPropagation(); setShowAllPokemon(true); }} className={`shrink-0 font-bold underline ${isOwned ? 'text-white' : 'text-blue-400'}`}>+{card.otherPokemon.length - 2}</button>}</span>
            ) : <span>&nbsp;</span>}
          </div>

          {/* Row 8: artist — always reserve space */}
          <div className={`text-xs leading-tight truncate min-h-[0.9rem] ${isOwned ? 'text-red-200' : 'text-gray-400'}`}>{card.artist || ' '}</div>

          {/* Language buttons — hidden when owned, show owned pill instead */}
          {!isSecondary && showOwnershipButtons && (
            <div className="pt-1">
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
                    const isAvailable = availableLangs.includes(lang) || (lang === 'KR' && showKR);
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

          {/* eBay search buttons */}
          <div className="flex gap-1 pt-2 border-t border-gray-100/30 mt-1">
            {ALL_LANGS.map(lang => {
              const hasLang = lang === 'EN' ? !!(card.enSetCode || card.setCode)
                : lang === 'JP' ? !!card.jpSetCode
                : lang === 'CN' ? !!card.cnSetCode
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
        </div>
      </div>

      {/* Zoom Modal with Loupe */}
      {showZoom && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          style={{ cursor: overImage ? 'none' : 'default' }}
          onClick={() => { setShowZoom(false); setZoomScale(2.5); }}
          onMouseMove={handleZoomMouseMove}
          onWheel={handleZoomWheel}
        >
          {/* Full card image (reference for rect + display) */}
          <div className="relative" onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 85vw)' }}>
            <img
              ref={zoomImgRef}
              src={imageSrc}
              alt={`${pokemonName} ${card.cardName}`}
              className="w-full h-auto object-contain rounded-lg"
              style={{ cursor: 'none' }}
              onMouseEnter={() => setOverImage(true)}
              onMouseLeave={() => setOverImage(false)}
              onLoad={() => { if (zoomImgRef.current) setImgRect(zoomImgRef.current.getBoundingClientRect()); }}
            />
            <button
              onClick={() => { setShowZoom(false); setZoomScale(2.5); }}
              className="absolute top-2 right-2 bg-white text-gray-900 rounded-full p-1.5 hover:bg-gray-100 shadow-lg"
              style={{ cursor: 'pointer' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Loupe — follows mouse, only when over image */}
          {overImage && (
          <div
            style={{
              position: 'fixed',
              left: mousePos.x - LOUPE_SIZE / 2,
              top: mousePos.y - LOUPE_SIZE / 2,
              width: LOUPE_SIZE,
              height: LOUPE_SIZE,
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.85)',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.7)',
              pointerEvents: 'none',
              overflow: 'hidden',
              ...getLoupeStyle(),
            }}
          >
            {/* Crosshair */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', width: 1, height: 20, background: 'rgba(255,255,255,0.5)' }} />
              <div style={{ position: 'absolute', width: 20, height: 1, background: 'rgba(255,255,255,0.5)' }} />
            </div>
          </div>
          )}

          {/* Scroll hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs pointer-events-none">
            Scroll to zoom · {zoomScale.toFixed(1)}×
          </div>
        </div>
      )}
    </>
  );
}
