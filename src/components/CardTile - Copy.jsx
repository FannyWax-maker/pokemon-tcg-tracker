import React from 'react';

// Global cache - images never reload after first load
const imageCache = {};

const LANG_CONFIG = {
  EN: { flag: '🇬🇧', color: 'bg-blue-500 hover:bg-blue-600', owned: 'bg-blue-500' },
  JP: { flag: '🇯🇵', color: 'bg-red-500 hover:bg-red-600', owned: 'bg-red-500' },
  CN: { flag: '🇨🇳', color: 'bg-yellow-500 hover:bg-yellow-600', owned: 'bg-yellow-500' },
  KR: { flag: '🇰🇷', color: 'bg-indigo-500 hover:bg-indigo-600', owned: 'bg-indigo-500' },
};

const ALL_LANGS = ['EN', 'JP', 'CN', 'KR'];

export default function CardTile({ card, pokemonName, onOwnershipClick, onNavigateToPokemon }) {
  const isOwned = !!card.ownedLang;
  const hasOtherPokemon = card.otherPokemon && card.otherPokemon.length > 0;
  const isSecondary = card.isSecondary || !card.isPrimary;
  const [showZoom, setShowZoom] = React.useState(false);
  const [showAllPokemon, setShowAllPokemon] = React.useState(false);

  // Which langs are available for this card
  const availableLangs = card.availableLangs || [];
  const isJpExclusive = card.exclusive === 'JP';
  const isCnExclusive = card.exclusive === 'CN';
  const showKR = !isJpExclusive && !isCnExclusive;

  const handleLangClick = (lang) => {
    if (isSecondary) return;
    if (card.ownedLang === lang) {
      // Already owned in this lang - unmark
      onOwnershipClick({ ...card, _action: 'unmark' });
    } else {
      // Mark as owned in this lang directly
      onOwnershipClick({ ...card, _directLang: lang });
    }
  };

  const generateImagePaths = () => {
    const displayPokemon = isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName;
    const setCode = (card.setCode || '').toLowerCase();
    const pokemon = displayPokemon.toLowerCase().replace(/\s+/g, '_').replace(/[.']/g, '');
    const number = (card.number || '').toLowerCase();
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
  const [inView, setInView] = React.useState(!!cached); // if cached, no need to wait
  const containerRef = React.useRef(null);

  // Intersection observer - only start loading when card enters viewport
  React.useEffect(() => {
    if (cached) return; // already cached, skip observer
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px' } // start loading 200px before visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cacheKey]);

  React.useEffect(() => {
    if (!inView) return;
    if (imageCache[cacheKey]) {
      setImageSrc(imageCache[cacheKey].src);
      setImageLoaded(!!imageCache[cacheKey].src);
      return;
    }
    let mounted = true;
    const tryLoadImage = async () => {
      const allPaths = imagePaths.flatMap(path => [
        `/card-images/${path}.png`,
        `/card-images/${path}.jpg`
      ]);
      const loadPromises = allPaths.map(src =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(src);
          img.onerror = reject;
          img.src = src;
        })
      );
      try {
        const successfulSrc = await Promise.any(loadPromises);
        imageCache[cacheKey] = { src: successfulSrc };
        if (mounted) {
          setImageSrc(successfulSrc);
          setImageLoaded(true);
          if (card._filterMissingImages) setShouldHide(true);
        }
      } catch (e) {
        imageCache[cacheKey] = { src: null };
        if (mounted) setImageLoaded(false);
      }
    };
    tryLoadImage();
    return () => { mounted = false; };
  }, [inView, cacheKey]);

  if (shouldHide) return null;

  return (
    <>
      <div ref={containerRef} className={`flex flex-col rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 ${
        isSecondary ? 'opacity-75 ring-2 ring-purple-300' : ''
      } ${isOwned ? 'ring-4 ring-emerald-500 shadow-emerald-200' : 'bg-white'}`}>

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
              className="w-full h-full object-cover"
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

          {/* Exclusive Badge */}
          {card.exclusive && (
            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold shadow-lg z-10 text-white ${
              card.exclusive === 'JP' ? 'bg-red-500' : card.exclusive === 'CN' ? 'bg-yellow-500' : 'bg-purple-500'
            }`}>
              {card.exclusive === 'JP' ? '🇯🇵 JP' : card.exclusive === 'CN' ? '🇨🇳 CN' : card.exclusive}
            </div>
          )}

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
        <div className={`p-2 space-y-0.5 ${isOwned ? 'bg-emerald-500' : 'bg-white'}`}>
          {/* Row 1: name + set/number */}
          <div className="flex items-baseline justify-between gap-1">
            <div className={`font-bold text-sm truncate ${isOwned ? 'text-white' : 'text-gray-900'}`}>{pokemonName}</div>
            <div className={`font-mono text-[10px] shrink-0 ${isOwned ? 'text-emerald-100' : 'text-gray-400'}`}>{card.setCode} {card.number}</div>
          </div>

          {/* Row 2: card name */}
          <div className={`text-xs leading-tight truncate ${isOwned ? 'text-emerald-100' : 'text-gray-500'}`}>
            {(card.cardName || '')
              .replace(', Japanese Exclusive', '').replace('Japanese Exclusive', '')
              .replace(', Chinese Exclusive', '').replace('Chinese Exclusive', '')
              .trim() || 'Full Art'}
          </div>

          {/* Row 3: other pokemon / artist */}
          {hasOtherPokemon ? (
            <div className={`text-xs leading-tight ${isOwned ? 'text-emerald-100' : 'text-blue-500'}`}>
              <span>w/ </span>
              {showAllPokemon
                ? card.otherPokemon.join(', ')
                : card.otherPokemon.slice(0, 3).join(', ')
              }
              {card.otherPokemon.length > 3 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllPokemon(v => !v); }}
                  className={`ml-1 font-bold underline ${isOwned ? 'text-emerald-100' : 'text-blue-400'}`}
                >
                  {showAllPokemon ? 'less' : `+${card.otherPokemon.length - 3} more`}
                </button>
              )}
            </div>
          ) : (
            <div className={`text-xs leading-tight truncate ${isOwned ? 'text-emerald-100' : 'text-gray-400'}`}>{card.artist}</div>
          )}

          {/* Language buttons — hidden when owned, show owned pill instead */}
          {!isSecondary && (
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
        </div>
      </div>

      {/* Zoom Modal */}
      {showZoom && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowZoom(false)}
        >
          <div className="max-w-2xl max-h-[90vh] relative">
            <img src={imageSrc} alt={`${pokemonName} ${card.cardName}`} className="w-full h-full object-contain" />
            <button
              onClick={() => setShowZoom(false)}
              className="absolute top-4 right-4 bg-white text-gray-900 rounded-full p-2 hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
