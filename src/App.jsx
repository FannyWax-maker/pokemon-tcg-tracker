import { useState, useMemo, useEffect } from 'react';
import { usePrices } from './hooks/usePrices';
import { Search, Filter, Grid, List, Moon, Sun, Lock, Unlock } from 'lucide-react';
import PokemonCard from './components/PokemonCard';
import CardTile from './components/CardTile';
import DetailModal from './components/DetailModal';
import ReviewModal, { calcConformance, conformanceColor } from './components/ReviewModal';
import LanguagePicker from './components/LanguagePicker';
import pokemonDataImport from './data/pokemon_data.json';
import setNamesImport from './data/set_names.json';
import reviewDataImport from './data/review_data.json';
import pokemonCoordsImport from './data/pokemon_coords.json';
import stephPokemonDataImport from './data/steph/pokemon_data.json';
import stephSetNamesImport from './data/steph/set_names.json';
import stephReviewDataImport from './data/steph/review_data.json';
import stephPokemonCoordsImport from './data/steph/pokemon_coords.json';


// Derived dynamically in filterCounts — placeholder kept for any residual references
const CN_NEVER_RELEASED_STATIC = new Set([]);

function enrichPokemonData(rawData) {
  const enriched = rawData.map(p => ({ ...p, cards: [...p.cards] }));
  const enrichedMap = {};
  enriched.forEach(p => { enrichedMap[p.name] = p; });
  rawData.forEach(p => {
    p.cards.forEach(card => {
      if (!card.otherPokemon || !card.otherPokemon.length) return;
      card.otherPokemon.forEach(otherName => {
        const other = enrichedMap[otherName];
        if (!other) return;
        const alreadyHas = other.cards.some(c => c.id === card.id);
        if (!alreadyHas) {
          other.cards.push({ ...card, isSecondary: true, isPrimary: false, primaryPokemon: p.name });
        }
      });
    });
  });
  return enriched;
}

export default function App() {
  const [pokemonData, setPokemonData] = useState(() => enrichPokemonData(pokemonDataImport));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestion, setSearchSuggestion] = useState(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [filterSet, setFilterSet] = useState('all');
  const [filterCardType, setFilterCardType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [languagePickerCard, setLanguagePickerCard] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [filterMissingImages, setFilterMissingImages] = useState(false);
  const [filterMissingPrice, setFilterMissingPrice] = useState(false);
  const [filterMissingCoords, setFilterMissingCoords] = useState(false);
  const [filterChinese, setFilterChinese] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [conformanceMode, setConformanceMode] = useState('blended'); // 'blended' | 'formula'
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterHideNoCards, setFilterHideNoCards] = useState('all');
  const [filterHideNonConforming, setFilterHideNonConforming] = useState('all');
  const [filterFavorites, setFilterFavorites] = useState('all');
  const [filterUnobtainable, setFilterUnobtainable] = useState('all');
  const [showOwnershipButtons, setShowOwnershipButtons] = useState(false);
  const [filterOwned, setFilterOwned] = useState('all');
  const [filterGeneration, setFilterGeneration] = useState('all');
  const [artistSortBy, setArtistSortBy] = useState('card_count');
  const [setListSort, setSetListSort] = useState('release');
  const [filterSetLang, setFilterSetLang] = useState('all');
  const [filterLang, setFilterLang] = useState('all');
  const [darkMode, setDarkMode] = useState(false);
  const [appMode, setAppMode] = useState(() => localStorage.getItem('appMode') || 'fullart');
  const [stephData, setStephData] = useState(null);

  // Switch data source when appMode changes
  useEffect(() => {
    if (appMode === 'cameos') {
      setPokemonData(enrichPokemonData(stephPokemonDataImport));
    } else {
      setPokemonData(enrichPokemonData(pokemonDataImport));
    }
    // Reset filters and selection when switching modes
    setSelectedPokemon(null);
    setSearchQuery('');
    setFilterSet('all');
  }, [appMode]);
  const [syncStatus, setSyncStatus] = useState('');
  const [tileSize, setTileSize] = useState('M');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const { getPriceForCard } = usePrices();
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockInput, setLockInput] = useState('');
  const [lockError, setLockError] = useState(false);
  const [reviewData, setReviewData] = useState(() => {
    // Seed from committed JSON file based on current mode, then overlay localStorage
    const savedMode = localStorage.getItem('appMode') || 'fullart';
    const base = savedMode === 'cameos' ? (stephReviewDataImport || {}) : (reviewDataImport || {});
    try {
      const cacheKey = savedMode === 'cameos' ? 'steph_review_cache' : 'pokemon_review_cache';
      const cached = localStorage.getItem(cacheKey);
      if (cached) return { ...base, ...JSON.parse(cached) };
    } catch (_) {}
    return base;
  });
  const [reviewCard, setReviewCard] = useState(null);

  const PASSWORD_HASH = '7a19d28db440fefe6d9ffb4620db4e568c13bac3bf956b5a90884501d6681739';

  const hashString = async (str) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleUnlockAttempt = async () => {
    const hash = await hashString(lockInput);
    if (hash === PASSWORD_HASH) {
      setIsUnlocked(true); setShowLockModal(false); setLockInput(''); setLockError(false);
    } else { setLockError(true); }
  };

  const requireUnlock = (fn) => (...args) => {
    if (!isUnlocked) { setShowLockModal(true); return; }
    return fn(...args);
  };

  const setNames = appMode === 'cameos' ? stephSetNamesImport : setNamesImport;
  const setNamesLC = useMemo(() => {
    const out = {};
    Object.entries(setNames).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
    return out;
  }, [appMode]);

  const getSpellSuggestion = (query, names) => {
    if (!query || query.length < 3) return null;
    const q = query.toLowerCase();
    if (names.some(n => n.toLowerCase() === q)) return null;
    if (names.some(n => n.toLowerCase().startsWith(q))) return null;
    const lev = (a, b) => {
      const dp = Array.from({length: a.length+1}, (_, i) => Array.from({length: b.length+1}, (_, j) => i===0?j:j===0?i:0));
      for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++)
        dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
      return dp[a.length][b.length];
    };
    let best=null, bestDist=999;
    for (const name of names) {
      const dist = lev(q, name.toLowerCase());
      if (dist < bestDist && dist <= 3) { bestDist=dist; best=name; }
    }
    return best;
  };

  // Look up a cardId in a map, falling back to number-normalised variants
  // Handles cases where numbers were zero-padded after initial entry (xy57 vs xy057)
  const lookupById = (map, cardId) => {
    if (map[cardId] !== undefined) return map[cardId];
    // Try stripping/adding leading zeros from the number portion of the ID
    // cardId format: {pokemonId}_{setCode}_{number}
    const parts = cardId.split('_');
    if (parts.length >= 3) {
      const numPart = parts[parts.length - 1];
      // Try removing one leading zero
      const stripped = numPart.replace(/^0+([1-9])/, '$1');
      if (stripped !== numPart) {
        const strippedId = [...parts.slice(0, -1), stripped].join('_');
        if (map[strippedId] !== undefined) return map[strippedId];
      }
      // Try adding one leading zero
      const padded = numPart.replace(/^([a-z]*)(\d)/, '$10$2');
      if (padded !== numPart) {
        const paddedId = [...parts.slice(0, -1), padded].join('_');
        if (map[paddedId] !== undefined) return map[paddedId];
      }
    }
    return undefined;
  };

  const FULLART_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMgDPDy9wpz2YFJoYuYaDQfZ2u5uou3wYQgL6ULUSZDbaJTMNLFDC-Ho57qRHAJ6Osug/exec';
  const STEPH_SCRIPT_URL = FULLART_SCRIPT_URL + '?mode=cameo';
  const APPS_SCRIPT_URL = appMode === 'cameos' ? STEPH_SCRIPT_URL : FULLART_SCRIPT_URL;
  const cachePrefix = appMode === 'cameos' ? 'steph_' : 'pokemon_';

  useEffect(() => {
    const loadOwnership = async () => {
      const cached = localStorage.getItem(cachePrefix + 'ownership_cache');
      if (cached) {
        const ownership = JSON.parse(cached);
        setPokemonData(prev => prev.map(pokemon => ({
          ...pokemon,
          cards: pokemon.cards.map(card => ({
            ...card,
            ownedLang: lookupById(ownership, card.id) !== undefined ? lookupById(ownership, card.id) : card.ownedLang
          }))
        })));
      }
      try {
        const res = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now());
        const data = await res.json();
        const ownership = data.ownership || data;
        const nonConforming = data.nonConforming || {};
        const favorites = data.favorites || {};
        const unobtainable = data.unobtainable || {};
        const categories = data.categories || {};
        localStorage.setItem((cachePrefix + 'ownership_cache'), JSON.stringify(ownership));
        localStorage.setItem((cachePrefix + 'nonconforming_cache'), JSON.stringify(nonConforming));
        localStorage.setItem((cachePrefix + 'favorites_cache'), JSON.stringify(favorites));
        localStorage.setItem((cachePrefix + 'unobtainable_cache'), JSON.stringify(unobtainable));
        if (Object.keys(categories).length) {
          localStorage.setItem((cachePrefix + 'review_cache'), JSON.stringify(categories));
          setReviewData(categories);
        } else {
          const revCached = localStorage.getItem((cachePrefix + 'review_cache'));
          if (revCached) setReviewData(JSON.parse(revCached));
        }
        setPokemonData(prev => prev.map(pokemon => ({
          ...pokemon,
          cards: pokemon.cards.map(card => ({
            ...card,
            ownedLang: lookupById(ownership, card.id) !== undefined ? lookupById(ownership, card.id) : card.ownedLang,
            nonConforming: lookupById(nonConforming, card.id) === true ? true : card.nonConforming || false,
            favorite: lookupById(favorites, card.id) === true ? true : card.favorite || false,
            unobtainable: lookupById(unobtainable, card.id) === true ? true : card.unobtainable || false,
          }))
        })));
      } catch (e) {
        console.warn('Could not reach Google Sheets, using cached data');
        const ncCached = localStorage.getItem((cachePrefix + 'nonconforming_cache'));
        if (ncCached) {
          const nonConforming = JSON.parse(ncCached);
          setPokemonData(prev => prev.map(pokemon => ({
            ...pokemon,
            cards: pokemon.cards.map(card => ({ ...card, nonConforming: nonConforming[card.id] === true ? true : card.nonConforming || false }))
          })));
        }
        const favCached = localStorage.getItem((cachePrefix + 'favorites_cache'));
        if (favCached) {
          const favorites = JSON.parse(favCached);
          setPokemonData(prev => prev.map(pokemon => ({
            ...pokemon,
            cards: pokemon.cards.map(card => ({ ...card, favorite: favorites[card.id] === true ? true : card.favorite || false }))
          })));
        }
        const unobtCached = localStorage.getItem((cachePrefix + 'unobtainable_cache'));
        if (unobtCached) {
          const unobtainable = JSON.parse(unobtCached);
          setPokemonData(prev => prev.map(pokemon => ({
            ...pokemon,
            cards: pokemon.cards.map(card => ({ ...card, unobtainable: unobtainable[card.id] === true ? true : card.unobtainable || false }))
          })));
        }
        const revCached = localStorage.getItem((cachePrefix + 'review_cache'));
        if (revCached) setReviewData(JSON.parse(revCached));
      }
    };
    loadOwnership();
  }, [appMode]);

  const saveOwnership = async (cardId, ownedLang) => {
    setSyncStatus('saving');
    const cached = localStorage.getItem((cachePrefix + 'ownership_cache'));
    const ownership = cached ? JSON.parse(cached) : {};
    if (ownedLang) ownership[cardId] = ownedLang; else delete ownership[cardId];
    localStorage.setItem((cachePrefix + 'ownership_cache'), JSON.stringify(ownership));
    try {
      await fetch(`${APPS_SCRIPT_URL}?action=set&cardId=${encodeURIComponent(cardId)}&ownedLang=${encodeURIComponent(ownedLang || '')}`);
      setSyncStatus('saved'); setTimeout(() => setSyncStatus(''), 2000);
    } catch (e) { setSyncStatus('error'); setTimeout(() => setSyncStatus(''), 3000); }
  };

  const saveNonConforming = async (cardId, isNonConforming) => {
    setSyncStatus('saving');
    const cached = localStorage.getItem((cachePrefix + 'nonconforming_cache'));
    const nonConforming = cached ? JSON.parse(cached) : {};
    if (isNonConforming) nonConforming[cardId] = true; else delete nonConforming[cardId];
    localStorage.setItem((cachePrefix + 'nonconforming_cache'), JSON.stringify(nonConforming));
    try {
      await fetch(`${APPS_SCRIPT_URL}?action=setConforming&cardId=${encodeURIComponent(cardId)}&nonConforming=${isNonConforming ? 'true' : ''}`);
      setSyncStatus('saved'); setTimeout(() => setSyncStatus(''), 2000);
    } catch (e) { setSyncStatus('error'); setTimeout(() => setSyncStatus(''), 3000); }
  };

  const saveFavorite = async (cardId, isFavorite) => {
    setSyncStatus('saving');
    const cached = localStorage.getItem((cachePrefix + 'favorites_cache'));
    const favorites = cached ? JSON.parse(cached) : {};
    if (isFavorite) favorites[cardId] = true; else delete favorites[cardId];
    localStorage.setItem((cachePrefix + 'favorites_cache'), JSON.stringify(favorites));
    try {
      await fetch(`${APPS_SCRIPT_URL}?action=setFavorite&cardId=${encodeURIComponent(cardId)}&favorite=${isFavorite ? 'true' : ''}`);
      setSyncStatus('saved'); setTimeout(() => setSyncStatus(''), 2000);
    } catch (e) { setSyncStatus('error'); setTimeout(() => setSyncStatus(''), 3000); }
  };

  const saveReviewData = async (cardId, data) => {
    setSyncStatus('saving');
    const cached = localStorage.getItem((cachePrefix + 'review_cache'));
    const all = cached ? JSON.parse(cached) : {};
    all[cardId] = data;
    localStorage.setItem((cachePrefix + 'review_cache'), JSON.stringify(all));
    setReviewData(prev => ({ ...prev, [cardId]: data }));
    try {
      await fetch(`${APPS_SCRIPT_URL}?action=setReview&cardId=${encodeURIComponent(cardId)}&data=${encodeURIComponent(JSON.stringify(data))}`);
      setSyncStatus('saved'); setTimeout(() => setSyncStatus(''), 2000);
    } catch (e) { setSyncStatus('error'); setTimeout(() => setSyncStatus(''), 3000); }
  };

  const allSets = useMemo(() => {
    const sets = new Set();
    pokemonData.forEach(p => { p.cards.forEach(c => { if (c.setCode) sets.add(c.setCode); }); });
    return Array.from(sets).sort();
  }, [pokemonData]);

  const setStats = useMemo(() => {
    const stats = {}, jpStats = {}, cnStats = {}, tcStats = {}, krStats = {};
    pokemonData.forEach(p => {
      p.cards.filter(c => !c.isSecondary && c.isPrimary !== false).forEach(c => {
        if (c.setCode) {
          if (!stats[c.setCode]) stats[c.setCode] = { total: 0, owned: 0, langs: new Set() };
          stats[c.setCode].total++;
          if (c.ownedLang) stats[c.setCode].owned++;
          (c.availableLangs || ['EN']).filter(Boolean).forEach(l => stats[c.setCode].langs.add(l));
        }
        if (c.jpSetCode) {
          if (!jpStats[c.jpSetCode]) jpStats[c.jpSetCode] = { total: 0, owned: 0 };
          jpStats[c.jpSetCode].total++;
          if (c.ownedLang) jpStats[c.jpSetCode].owned++;
        }
        if (c.cnSetCode) {
          if (!cnStats[c.cnSetCode]) cnStats[c.cnSetCode] = { total: 0, owned: 0 };
          cnStats[c.cnSetCode].total++;
          if (c.ownedLang) cnStats[c.cnSetCode].owned++;
        }
        if (c.tcSetCode) {
          if (!tcStats[c.tcSetCode]) tcStats[c.tcSetCode] = { total: 0, owned: 0 };
          tcStats[c.tcSetCode].total++;
          if (c.ownedLang) tcStats[c.tcSetCode].owned++;
        }
        if (c.krSetCode) {
          if (!krStats[c.krSetCode]) krStats[c.krSetCode] = { total: 0, owned: 0 };
          krStats[c.krSetCode].total++;
          if (c.ownedLang) krStats[c.krSetCode].owned++;
        }
      });
    });
    return { en: stats, jp: jpStats, cn: cnStats, tc: tcStats, kr: krStats };
  }, [pokemonData]);

  // Build name -> {cards, appearances} lookup from coords data
  const coordAppearances = useMemo(() => {
    const source = appMode === 'cameos' ? stephPokemonCoordsImport : pokemonCoordsImport;
    const map = {};
    Object.values(source).forEach(entries => {
      (Array.isArray(entries) ? entries : [entries]).forEach(entry => {
        const name = (entry.name || '').toLowerCase();
        if (!name) return;
        const count = entry.positions ? entry.positions.length : (entry.x !== undefined ? 1 : 0);
        if (!map[name]) map[name] = { cards: 0, appearances: 0 };
        map[name].cards += 1;
        map[name].appearances += count;
      });
    });
    return map;
  }, [appMode]);

  // JP set codes where NO card in that set has a cnSetCode
  const cnNeverReleased = useMemo(() => {
    const allCards = pokemonData.flatMap(p => p.cards.filter(c => !c.isSecondary && c.isPrimary !== false));
    const jpSetHasCN = new Set();
    allCards.forEach(c => { if (c.jpSetCode && c.cnSetCode) jpSetHasCN.add(c.jpSetCode); });
    return new Set([...new Set(allCards.map(c => c.jpSetCode).filter(Boolean))].filter(s => !jpSetHasCN.has(s)));
  }, [pokemonData]);

  const filterCounts = useMemo(() => {
    const primary = pokemonData.flatMap(p => p.cards.filter(c => !c.isSecondary && c.isPrimary !== false && (c.setCode || c.jpSetCode || c.cnSetCode)));
    const CN_NEVER_RELEASED = cnNeverReleased;
    const jpCount = primary.filter(c => c.exclusive === 'JP').length;
    const cnExclCount = primary.filter(c => c.exclusive === 'CN').length;
    const noneCount = primary.filter(c => c.exclusive).length;
    const hasCN = primary.filter(c => !!c.cnSetCode).length;
    const noCN = primary.filter(c => !CN_NEVER_RELEASED.has(c.jpSetCode) && !c.cnSetCode).length;
    const typeCount = (type) => primary.filter(c => {
      const n = (c.cardName || '').toUpperCase();
      if (type === 'trainer') return n.includes('TRAINER');
      if (type === 'vmax') return n.includes('VMAX');
      if (type === 'vstar') return n.includes('VSTAR');
      if (type === 'v') return (n.endsWith(' V') || n.includes(' V ')) && !n.includes('VMAX') && !n.includes('VSTAR');
      if (type === 'gx') return n.includes('GX');
      if (type === 'mega') return n.includes('MEGA');
      if (type === 'ex') return n.includes('EX');
      if (type === 'promo') { const _ps = setNamesLC[(c.setCode || c.jpSetCode || c.cnSetCode||"").toLowerCase()]; const _pn = String(typeof _ps === 'object' ? (_ps?.name || '') : (_ps || '')); return _pn.toUpperCase().includes('PROMO'); }
      return false;
    }).length;
    const typeOwned = (type) => primary.filter(c => {
      if (!c.ownedLang) return false;
      const n = (c.cardName || '').toUpperCase();
      if (type === 'trainer') return n.includes('TRAINER');
      if (type === 'vmax') return n.includes('VMAX');
      if (type === 'vstar') return n.includes('VSTAR');
      if (type === 'v') return (n.endsWith(' V') || n.includes(' V ')) && !n.includes('VMAX') && !n.includes('VSTAR');
      if (type === 'gx') return n.includes('GX');
      if (type === 'mega') return n.includes('MEGA');
      if (type === 'ex') return n.includes('EX');
      if (type === 'promo') { const _ps = setNamesLC[(c.setCode || c.jpSetCode || c.cnSetCode||"").toLowerCase()]; const _pn = String(typeof _ps === 'object' ? (_ps?.name || '') : (_ps || '')); return _pn.toUpperCase().includes('PROMO'); }
      return false;
    }).length;
    const genStats = {};
    pokemonData.forEach(p => {
      if (!p.gen) return;
      const pCards = p.cards.filter(c => !c.isSecondary && c.isPrimary !== false);
      if (!genStats[p.gen]) genStats[p.gen] = { total: 0, owned: 0 };
      genStats[p.gen].total += pCards.length;
      genStats[p.gen].owned += pCards.filter(c => c.ownedLang).length;
    });
    const setCounts = {};
    primary.forEach(c => { if (c.setCode) setCounts[c.setCode] = (setCounts[c.setCode] || 0) + 1; });
    const artistCounts = {}, artistOwned = {};
    primary.forEach(c => {
      if (c.artist) {
        artistCounts[c.artist] = (artistCounts[c.artist] || 0) + 1;
        if (c.ownedLang) artistOwned[c.artist] = (artistOwned[c.artist] || 0) + 1;
      }
    });
    return { jpCount, cnExclCount, noneCount, hasCN, noCN, typeCount, typeOwned, setCounts, artistCounts, artistOwned, genStats };
  }, [pokemonData]);

  const sortedArtists = useMemo(() => {
    const entries = Object.entries(filterCounts.artistCounts || {});
    if (artistSortBy === 'alpha') return entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries.sort((a, b) => b[1] - a[1]);
  }, [filterCounts.artistCounts, artistSortBy]);

  const overallStats = useMemo(() => {
    let allCards;
    if (appMode === 'cameos') {
      // In cameos mode deduplicate by card ID — trainer cards appear as secondary under multiple Pokémon
      const seen = new Set();
      allCards = pokemonData.flatMap(p => p.cards.filter(c => (c.setCode || c.jpSetCode) && !seen.has(c.id) && seen.add(c.id)));
    } else {
      allCards = pokemonData.flatMap(p => p.cards.filter(c => !c.isSecondary && c.isPrimary !== false && (c.setCode || c.jpSetCode || c.cnSetCode)));
    }
    const totalCards = allCards.length;
    const ownedCards = allCards.filter(c => c.ownedLang).length;
    const completionPercent = totalCards > 0 ? (ownedCards / totalCards) * 100 : 0;
    const langStats = { EN: allCards.filter(c => c.ownedLang === 'EN').length, JP: allCards.filter(c => c.ownedLang === 'JP').length, CN: allCards.filter(c => c.ownedLang === 'CN').length, KR: allCards.filter(c => c.ownedLang === 'KR').length };
    return { totalCards, ownedCards, completionPercent, langStats };
  }, [pokemonData, appMode]);

  const hasActiveFilters = filterLang !== 'all' || filterSet !== 'all' || filterCardType !== 'all' || filterMissingImages || filterMissingPrice || filterMissingCoords || filterChinese !== 'all' || filterArtist !== 'all' || filterHideNoCards !== 'all' || filterHideNonConforming !== 'all' || filterOwned !== 'all' || filterSetLang !== 'all' || filterGeneration !== 'all' || filterFavorites !== 'all' || filterUnobtainable !== 'all';
  const activeFilterCount = [filterSet !== 'all', filterCardType !== 'all', filterMissingImages, filterChinese !== 'all', filterArtist !== 'all', filterHideNoCards !== 'all', filterHideNonConforming !== 'all', filterOwned !== 'all', filterGeneration !== 'all'].filter(Boolean).length;

  const filteredData = useMemo(() => {
    let filtered = pokemonData;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(query) || String(p.id).includes(query));
    }
    if (filterGeneration !== 'all') { const gen = parseInt(filterGeneration); filtered = filtered.filter(p => p.gen === gen); }
    if (filterHideNoCards === 'hide' || filterHideNoCards === true) {
      filtered = filtered.filter(p => p.cards.some(c => !c.isSecondary && c.isPrimary !== false && (c.setCode || c.jpSetCode || c.cnSetCode)));
    } else if (filterHideNoCards === 'only') {
      filtered = filtered.filter(p => !p.cards.some(c => !c.isSecondary && c.isPrimary !== false && (c.setCode || c.jpSetCode || c.cnSetCode)) && !p.cards.some(c => c.isSecondary || c.isPrimary === false));
    } else if (filterHideNoCards === 'refs') {
      filtered = filtered.filter(p => !p.cards.some(c => !c.isSecondary && c.isPrimary !== false && (c.setCode || c.jpSetCode || c.cnSetCode)) && p.cards.some(c => c.isSecondary || c.isPrimary === false));
    }
    if (filterHideNonConforming === 'hide') {
      filtered = filtered.map(p => ({ ...p, cards: p.cards.filter(c => !c.nonConforming) })).filter(p => p.cards.some(c => !c.isSecondary && c.isPrimary !== false) || p.cards.some(c => c.isSecondary || c.isPrimary === false) || p.cards.length === 0);
    } else if (filterHideNonConforming === 'only') {
      filtered = filtered.map(p => ({ ...p, cards: p.cards.filter(c => c.nonConforming) })).filter(p => p.cards.length > 0);
    }
    if (filterFavorites === 'only') {
      filtered = filtered.map(p => ({ ...p, cards: p.cards.filter(c => c.favorite) })).filter(p => p.cards.length > 0);
    } else if (filterFavorites === 'hide') {
      filtered = filtered.map(p => ({ ...p, cards: p.cards.filter(c => !c.favorite) })).filter(p => p.cards.length > 0);
    }
    if (filterArtist !== 'all') {
      filtered = filtered.filter(p => p.cards.some(c => !c.isSecondary && c.isPrimary !== false && c.artist === filterArtist));
    }
    const cardFilterActive = filterChinese !== 'all' || filterLang !== 'all' || filterSet !== 'all' || filterCardType !== 'all' || filterSetLang !== 'all';
    if (cardFilterActive) {
      filtered = filtered.filter(pokemon => pokemon.cards.some(card => {
        if (card.isSecondary || card.isPrimary === false) return false;
        if (filterChinese !== 'all') { const cnNever = cnNeverReleased.has(card.jpSetCode); const hasCN = !cnNever && !!card.cnSetCode; if (filterChinese === 'has_cn' && !hasCN) return false; if (filterChinese === 'no_cn' && (hasCN || cnNever)) return false; }
        if (filterSet !== 'all') { const matchesSet = card.setCode === filterSet || card.enSetCode === filterSet || card.jpSetCode === filterSet || card.cnSetCode === filterSet; if (!matchesSet) return false; }
        if (filterSetLang !== 'all' && filterSet === 'all') { const langs = card.availableLangs || []; if (filterSetLang === 'JP' && !card.jpSetCode) return false; if (filterSetLang === 'CN' && !card.cnSetCode) return false; if (filterSetLang === 'TC' && !card.tcSetCode) return false; if (filterSetLang === 'KR' && !card.krSetCode) return false; if (filterSetLang === 'EN' && !card.setCode) return false; }
        if (filterLang !== 'all') { const al = card.availableLangs || []; if (al.length !== 1 || al[0] !== filterLang) return false; }
        if (filterCardType !== 'all') {
          const cn = String(card.cardName || '').trim(); const cu = cn.toUpperCase();
          if (filterCardType === 'trainer' && !cu.includes('TRAINER')) return false;
          if (filterCardType === 'vmax' && !cu.includes('VMAX')) return false;
          if (filterCardType === 'vstar' && !cu.includes('VSTAR')) return false;
          if (filterCardType === 'v' && !(cn.endsWith(' V') || cn === 'V') || cu.includes('VMAX') || cu.includes('VSTAR')) { if (filterCardType === 'v') return false; }
          if (filterCardType === 'gx' && !cu.includes('GX')) return false;
          if (filterCardType === 'mega' && !cu.includes('MEGA')) return false;
          if (filterCardType === 'ex') { if (!(cu.includes(' EX') || cn.includes(' ex')) || cu.includes('EXCLUSIVE')) return false; }
          if (filterCardType === 'promo') { const _s = setNamesLC[(card.setCode || card.jpSetCode || card.cnSetCode||"").toLowerCase()]; const _sn = String(typeof _s === 'object' ? (_s?.name || '') : (_s || '')); if (!_sn.toUpperCase().includes('PROMO')) return false; }
        }
        return true;
      }));
    }
    if (filterMissingImages) { filtered = filtered.map(p => ({ ...p, cards: p.cards.map(c => ({ ...c, _filterMissingImages: true })) })); }
    if (filterMissingCoords) { filtered = filtered.map(p => ({ ...p, cards: p.cards.map(c => ({ ...c, _filterMissingCoords: true })) })); }
    filtered = [...filtered].sort((a, b) => {
      const aPrimary = a.cards.filter(c => !c.isSecondary && c.isPrimary !== false).length;
      const bPrimary = b.cards.filter(c => !c.isSecondary && c.isPrimary !== false).length;
      const pushToEnd = sortBy !== 'default';
      if (pushToEnd) { if (aPrimary === 0 && bPrimary === 0) return a.id - b.id; if (aPrimary === 0) return 1; if (bPrimary === 0) return -1; }
      if (sortBy === 'alpha_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'alpha_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'seen_desc') { const aS = coordAppearances[(a.name||'').toLowerCase()]?.appearances ?? -1; const bS = coordAppearances[(b.name||'').toLowerCase()]?.appearances ?? -1; return bS - aS; }
      return a.id - b.id;
    });
    return { type: 'pokemon', data: filtered };
  }, [searchQuery, pokemonData, filterLang, filterSet, filterCardType, filterMissingImages, filterMissingCoords, filterSetLang, filterChinese, filterArtist, filterHideNoCards, filterHideNonConforming, filterGeneration, filterFavorites, filterUnobtainable, sortBy, cnNeverReleased]);

  const allCardsFlat = useMemo(() => {
    const cards = [];
    filteredData.data.forEach(pokemon => {
      pokemon.cards.filter(c => {
        if (!c.isSecondary && c.isPrimary !== false && (c.setCode || c.jpSetCode || c.cnSetCode)) return true;
        // In cameos mode, also include secondary cards so trainer/non-pokemon cards appear in cards view
        // They'll be deduplicated by card ID below
        if (appMode === 'cameos' && c.isSecondary && (c.setCode || c.jpSetCode)) return true;
        if (searchQuery.trim() && c.isSecondary) { const q = searchQuery.trim().toLowerCase(); return pokemon.name.toLowerCase().includes(q); }
        return false;
      }).forEach(card => {
        if (filterChinese !== 'all') { const cnNever = cnNeverReleased.has(card.jpSetCode); const hasCN = !cnNever && !!card.cnSetCode; if (filterChinese === 'has_cn' && !hasCN) return; if (filterChinese === 'no_cn' && (hasCN || cnNever)) return; }
        if (filterSet !== 'all') { const matchesSet2 = card.setCode === filterSet || card.enSetCode === filterSet || card.jpSetCode === filterSet || card.cnSetCode === filterSet; if (!matchesSet2) return; }
        if (filterSetLang !== 'all' && filterSet === 'all') { if (filterSetLang === 'JP' && !card.jpSetCode) return; if (filterSetLang === 'CN' && !card.cnSetCode) return; if (filterSetLang === 'TC' && !card.tcSetCode) return; if (filterSetLang === 'KR' && !card.krSetCode) return; if (filterSetLang === 'EN' && !card.setCode) return; }
        if (filterLang !== 'all') { const al = card.availableLangs || []; if (al.length !== 1 || al[0] !== filterLang) return; }
        if (filterCardType !== 'all') {
          const cn = String(card.cardName || '').trim(); const cu = cn.toUpperCase(); let matches = false;
          if (filterCardType === 'trainer') matches = cu.includes('TRAINER');
          else if (filterCardType === 'vmax') matches = cu.includes('VMAX');
          else if (filterCardType === 'vstar') matches = cu.includes('VSTAR');
          else if (filterCardType === 'v') matches = (cn.endsWith(' V') || cn === 'V') && !cu.includes('VMAX') && !cu.includes('VSTAR');
          else if (filterCardType === 'gx') matches = cu.includes('GX');
          else if (filterCardType === 'mega') matches = cu.includes('MEGA');
          else if (filterCardType === 'ex') matches = (cu.includes(' EX') || cn.includes(' ex')) && !cu.includes('EXCLUSIVE');
          else if (filterCardType === 'promo') { const _s = setNamesLC[(card.setCode || card.jpSetCode || card.cnSetCode||"").toLowerCase()]; const _sn = String(typeof _s === 'object' ? (_s?.name || '') : (_s || '')); matches = _sn.toUpperCase().includes('PROMO'); }
          if (!matches) return;
        }
        if (filterArtist !== 'all' && card.artist !== filterArtist) return;
        if (filterOwned === 'owned' && !card.ownedLang) return;
        if (filterOwned === 'unowned' && card.ownedLang) return;
        if (filterUnobtainable === 'only' && !card.unobtainable) return;
        if (filterUnobtainable === 'hide' && card.unobtainable) return;
        const cardEntry = { ...card, pokemonName: pokemon.name, pokemonId: pokemon.id };
        if (filterMissingImages) cardEntry._filterMissingImages = true;
        if (filterMissingPrice) cardEntry._filterMissingPrice = true;
        if (filterMissingCoords) cardEntry._filterMissingCoords = true;
        cards.push(cardEntry);
      });
    });
    if (sortBy === 'featured_desc') { cards.sort((a, b) => (b.otherPokemon || []).length - (a.otherPokemon || []).length); }
    // In cameos mode deduplicate by card ID — same card may appear under multiple featured Pokémon
    if (appMode === 'cameos') {
      const seen = new Set();
      return cards.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
    }
    else if (sortBy === 'featured_asc') { cards.sort((a, b) => (a.otherPokemon || []).length - (b.otherPokemon || []).length); }
    else if (sortBy === 'release_desc') { cards.sort((a, b) => { const score = (c) => { const d = setNamesLC[(c.setCode||"").toLowerCase()] || setNamesLC[(c.jpSetCode||"").toLowerCase()] || setNamesLC[(c.cnSetCode||"").toLowerCase()] || {}; return (d.year||0)*100+(d.month||0); }; return score(b) - score(a); }); }
    else if (sortBy === 'release_asc') { cards.sort((a, b) => { const score = (c) => { const d = setNamesLC[(c.setCode||"").toLowerCase()] || setNamesLC[(c.jpSetCode||"").toLowerCase()] || setNamesLC[(c.cnSetCode||"").toLowerCase()] || {}; return (d.year||9999)*100+(d.month||99); }; return score(a) - score(b); }); }
    else if (sortBy === 'conformance_desc') { cards.sort((a, b) => { const pa = calcConformance(reviewData[a.id] || {}, conformanceMode) ?? -1; const pb = calcConformance(reviewData[b.id] || {}, conformanceMode) ?? -1; return pb - pa; }); }
    else if (sortBy === 'conformance_asc')  { cards.sort((a, b) => { const pa = calcConformance(reviewData[a.id] || {}, conformanceMode) ?? 101; const pb = calcConformance(reviewData[b.id] || {}, conformanceMode) ?? 101; return pa - pb; }); }
    else if (sortBy === 'price_desc') { cards.sort((a, b) => { const pa = getPriceForCard(a)?.gbp ?? -1; const pb = getPriceForCard(b)?.gbp ?? -1; return pb - pa; }); }
    else if (sortBy === 'price_asc')  { cards.sort((a, b) => { const pa = getPriceForCard(a)?.gbp ?? Infinity; const pb = getPriceForCard(b)?.gbp ?? Infinity; return pa - pb; }); }
    return cards;
  }, [filteredData, filterChinese, filterLang, filterSet, filterCardType, sortBy, filterOwned, filterArtist, filterUnobtainable, filterMissingImages, filterMissingPrice, filterMissingCoords, filterSetLang, getPriceForCard, conformanceMode, cnNeverReleased]);

  const handleInlineUpdateCard = requireUnlock((pokemonId, cardId, updates) => {
    setPokemonData(pokemonData.map(pokemon => {
      if (pokemon.id === pokemonId) { return { ...pokemon, cards: pokemon.cards.map(card => card.id === cardId ? { ...card, ...updates } : card) }; }
      return pokemon;
    }));
  });

  const handleUpdateCard = requireUnlock((pokemonId, cardId, language) => {
    setPokemonData(prev => prev.map(pokemon => {
      if (pokemon.id === pokemonId) { return { ...pokemon, cards: pokemon.cards.map(card => card.id === cardId ? { ...card, ownedLang: language } : card) }; }
      return pokemon;
    }));
    if (selectedPokemon && selectedPokemon.id === pokemonId) {
      setSelectedPokemon(prev => ({ ...prev, cards: prev.cards.map(card => card.id === cardId ? { ...card, ownedLang: language } : card) }));
    }
    saveOwnership(cardId, language);
  });

  const handleCardOwnershipClick = requireUnlock((card) => {
    if (card._directLang) { handleUpdateCard(card.pokemonId, card.id, card._directLang); }
    else if (card._action === 'unmark') { handleUpdateCard(card.pokemonId, card.id, null); }
    else if (card.ownedLang) { handleUpdateCard(card.pokemonId, card.id, null); }
    else { setLanguagePickerCard(card); }
  });

  const handleLanguageConfirm = requireUnlock((language) => {
    if (languagePickerCard) { handleUpdateCard(languagePickerCard.pokemonId, languagePickerCard.id, language); setLanguagePickerCard(null); }
  });

  const saveUnobtainable = async (cardId, isUnobtainable) => {
    try { await fetch(`${APPS_SCRIPT_URL}?action=setUnobtainable&cardId=${encodeURIComponent(cardId)}&unobtainable=${isUnobtainable ? 'true' : ''}`); } catch(e) {}
  };

  const handleToggleNonConforming = requireUnlock((pokemonId, cardId, currentValue) => {
    const newValue = !currentValue;
    setPokemonData(prev => prev.map(pokemon => ({ ...pokemon, cards: pokemon.cards.map(card => card.id === cardId ? { ...card, nonConforming: newValue } : card) })));
    setSelectedPokemon(prev => prev && prev.id === pokemonId ? ({ ...prev, cards: prev.cards.map(card => card.id === cardId ? { ...card, nonConforming: newValue } : card) }) : prev);
    saveNonConforming(cardId, newValue);
  });

  const handleToggleFavorite = requireUnlock((cardId, currentValue) => {
    const newValue = !currentValue;
    setPokemonData(prev => prev.map(pokemon => ({ ...pokemon, cards: pokemon.cards.map(card => card.id === cardId ? { ...card, favorite: newValue } : card) })));
    setSelectedPokemon(prev => prev ? ({ ...prev, cards: prev.cards.map(card => card.id === cardId ? { ...card, favorite: newValue } : card) }) : prev);
    saveFavorite(cardId, newValue);
  });

  const handleToggleUnobtainable = requireUnlock((cardId, currentValue) => {
    const newValue = !currentValue;
    setPokemonData(prev => prev.map(pokemon => ({ ...pokemon, cards: pokemon.cards.map(card => card.id === cardId ? { ...card, unobtainable: newValue } : card) })));
    setSelectedPokemon(prev => prev ? ({ ...prev, cards: prev.cards.map(card => card.id === cardId ? { ...card, unobtainable: newValue } : card) }) : prev);
    saveUnobtainable(cardId, newValue);
  });

  const clearFilters = () => {
    setFilterSet('all'); setFilterCardType('all'); setFilterMissingImages(false);
    setFilterChinese('all'); setFilterArtist('all'); setFilterHideNoCards('all'); setFilterHideNonConforming('all');
    setFilterLang('all'); setFilterOwned('all'); setFilterSetLang('all'); setFilterGeneration('all'); setFilterFavorites('all'); setFilterUnobtainable('all');
  };

  const tileGridClass = { S: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2', M: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3', L: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4' };
  const pokemonGridClass = { S: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2', M: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4', L: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-5' };

  return (
    <div className={`min-h-screen font-sans ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} style={{fontFamily: "'Segoe UI', system-ui, sans-serif"}}>

      {/* HEADER */}
      <div className={`sticky top-0 z-30 ${darkMode ? 'bg-gray-900 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`} style={{boxShadow: darkMode ? 'none' : '0 2px 12px rgba(0,0,0,0.07)'}}>
        <div className="max-w-7xl mx-auto px-3 pt-2 pb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="shrink-0 flex items-center gap-1.5">
              <div className="relative w-6 h-6" title="Pokémon TCG Tracker">
                <svg viewBox="0 0 24 24" className="w-6 h-6">
                  <circle cx="12" cy="12" r="11" fill={darkMode ? '#374151' : '#e5e7eb'} stroke={darkMode ? '#6b7280' : '#9ca3af'} strokeWidth="1"/>
                  <path d="M1 12 Q1 1 12 1 Q23 1 23 12 Z" fill="#ef4444"/>
                  <rect x="1" y="11" width="22" height="2" fill="#6b7280"/>
                  <circle cx="12" cy="12" r="3.5" fill={darkMode ? '#374151' : 'white'} stroke={darkMode ? '#9ca3af' : '#6b7280'} strokeWidth="1.5"/>
                  <circle cx="12" cy="12" r="1.5" fill="#9ca3af"/>
                </svg>
              </div>
              <h1 className={`text-sm font-black tracking-tight shrink-0 hidden sm:block ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pokémon TCG</h1>
            </div>
            <div className="flex items-center gap-1 shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', boxShadow: '0 1px 4px rgba(239,68,68,0.4)'}}>
              <span>{overallStats.ownedCards}/{overallStats.totalCards}</span>
              <span className="opacity-70">·</span>
              <span>{Math.round(overallStats.completionPercent)}%</span>
            </div>
            {/* Mode toggle: Full Art / Cameos */}
            <div className="flex items-center rounded-full p-0.5 text-xs font-bold shrink-0 bg-gray-100">
              <button
                onClick={() => { setAppMode('fullart'); localStorage.setItem('appMode', 'fullart'); }}
                className={`px-2.5 py-1 rounded-full transition-colors ${appMode === 'fullart' ? 'text-white' : 'text-gray-500'}`}
                style={appMode === 'fullart' ? {background: 'linear-gradient(135deg, #ef4444, #dc2626)'} : {}}
              >Illustrations</button>
              <button
                onClick={() => { setAppMode('cameos'); localStorage.setItem('appMode', 'cameos'); }}
                className={`px-2.5 py-1 rounded-full transition-colors ${appMode === 'cameos' ? 'text-white' : 'text-gray-500'}`}
                style={appMode === 'cameos' ? {background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'} : {}}
              >Cameos</button>
            </div>

            <div className="relative flex-1 min-w-0 hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input type="text" placeholder="Search Pokémon..." value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value; setSearchQuery(val);
                  const names = pokemonData.map(p => p.name);
                  setSearchSuggestion(getSpellSuggestion(val, names));
                  if (val.length >= 2) { const q = val.toLowerCase(); const matches = names.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 6); setAutocompleteSuggestions(matches); setShowAutocomplete(matches.length > 0); }
                  else { setAutocompleteSuggestions([]); setShowAutocomplete(false); }
                }}
                onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
                onFocus={(e) => { if (e.target.value.length >= 2 && autocompleteSuggestions.length > 0) setShowAutocomplete(true); }}
                className={`w-full pl-8 pr-3 py-1.5 rounded-full border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200 text-gray-700 bg-gray-50'}`}
              />
              {showAutocomplete && (
                <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 overflow-hidden border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                  {autocompleteSuggestions.map(name => (
                    <button key={name} onMouseDown={() => { setSearchQuery(name); setShowAutocomplete(false); setSearchSuggestion(null); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 ${darkMode ? 'text-white hover:bg-gray-600' : 'text-gray-700'}`}>{name}</button>
                  ))}
                </div>
              )}
            </div>
            <div className={`flex items-center rounded-full p-0.5 text-xs font-bold shrink-0 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <button onClick={() => { setViewMode('pokemon'); setFilterHideNonConforming('all'); if (['featured_desc','featured_asc','release_desc','release_asc'].includes(sortBy)) setSortBy('default'); }}
                className={`px-2.5 py-1 rounded-full transition-colors ${viewMode === 'pokemon' ? 'text-white' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                style={viewMode === 'pokemon' ? {background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'} : {}}>Grid</button>
              <button onClick={() => { setViewMode('cards'); setFilterHideNoCards('all'); setFilterHideNonConforming('hide'); }}
                className={`px-2.5 py-1 rounded-full transition-colors ${viewMode === 'cards' ? 'text-white' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                style={viewMode === 'cards' ? {background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'} : {}}>Cards</button>
              {appMode === 'fullart' && (
                <button onClick={() => { setViewMode('review'); setFilterHideNoCards('hide'); setFilterHideNonConforming('all'); }}
                  className={`px-2.5 py-1 rounded-full transition-colors ${viewMode === 'review' ? 'text-white' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  style={viewMode === 'review' ? {background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'} : {}}>Review</button>
              )}
            </div>
            <div className={`hidden sm:flex items-center rounded-lg overflow-hidden text-xs font-bold shrink-0 border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              {['S','M','L'].map(s => (
                <button key={s} onClick={() => setTileSize(s)}
                  className={`px-2 py-1 transition-colors ${tileSize === s ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  style={tileSize === s ? {background: 'linear-gradient(135deg, #f59e0b, #d97706)'} : {}}>{s}</button>
              ))}
            </div>
            {syncStatus && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${syncStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' : syncStatus === 'saved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {syncStatus === 'saving' ? '⏳' : syncStatus === 'saved' ? '✓' : '⚠'}
              </span>
            )}
            {viewMode === 'cards' && (
              <button onClick={() => setShowOwnershipButtons(v => !v)}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${showOwnershipButtons ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={showOwnershipButtons ? {background: 'linear-gradient(135deg, #22c55e, #16a34a)'} : {}}>
                {showOwnershipButtons ? '🔓' : '🔒'}
              </button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className={`p-1.5 rounded-lg transition-colors shrink-0 ${darkMode ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => isUnlocked ? setIsUnlocked(false) : setShowLockModal(true)} title={isUnlocked ? 'Lock collection' : 'Unlock to edit'}
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${isUnlocked ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : darkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {isUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${hasActiveFilters ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={hasActiveFilters ? {background: 'linear-gradient(135deg, #ef4444, #dc2626)'} : {}}>
              <Filter className="w-3.5 h-3.5" />
              {hasActiveFilters ? activeFilterCount : 'Filters'}
            </button>
          </div>
          <div className="sm:hidden mt-1.5 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Search Pokémon..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 rounded-full border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200 text-gray-700 bg-gray-50'}`}
            />
          </div>
        </div>

        {/* Progress bar */}
        <div className={`h-1.5 w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className="h-full transition-all duration-700 ease-out"
            style={{ width: `${overallStats.completionPercent}%`, background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%)', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div className={`border-t ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
            <div className="max-w-7xl mx-auto px-3 py-3">
              <div className="flex flex-wrap gap-2 mb-2">
                <select value={filterGeneration} onChange={(e) => setFilterGeneration(e.target.value)}
                  className={`w-auto px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400 font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Generations</option>
                  {[[1,'Gen 1 · Kanto'],[2,'Gen 2 · Johto'],[3,'Gen 3 · Hoenn'],[4,'Gen 4 · Sinnoh'],[5,'Gen 5 · Unova'],[6,'Gen 6 · Kalos'],[7,'Gen 7 · Alola'],[8,'Gen 8 · Galar'],[9,'Gen 9 · Paldea'],[10,'Gen 10 · Winds']].map(([g, label]) => {
                    const s = filterCounts.genStats[g] || { total: 0, owned: 0 };
                    const pct = s.total > 0 ? Math.round((s.owned / s.total) * 100) : 0;
                    const complete = s.total > 0 && s.owned === s.total;
                    return <option key={g} value={String(g)}>{complete ? '★ ' : ''}{label} ({s.owned}/{s.total}{!complete ? ` · ${pct}%` : ''})</option>;
                  })}
                </select>

                <div className="flex gap-1 min-w-0">
                  <div className={`flex rounded-lg overflow-hidden border shrink-0 text-xs font-bold ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                    {[['all','All'],['EN','EN'],['JP','JP'],['CN','CN'],['TC','TC'],['KR','KR']].map(([val, label]) => (
                      <button key={val} onClick={() => { setFilterSetLang(val); setFilterSet('all'); }}
                        className={`px-2.5 py-1.5 transition-colors ${filterSetLang === val ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        style={filterSetLang === val ? {background: val === 'all' ? 'linear-gradient(135deg, #6b7280, #4b5563)' : val === 'EN' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : val === 'JP' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : val === 'CN' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : val === 'TC' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)'} : {}}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setSetListSort(s => s === 'release' ? 'alpha' : 'release')}
                    title={setListSort === 'release' ? 'Sorted by release date — click for A→Z' : 'Sorted A→Z — click for release date'}
                    className={`shrink-0 px-2 py-1.5 border rounded-lg text-xs font-bold transition-colors ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {setListSort === 'release' ? '📅' : 'A→Z'}
                  </button>
                  <select value={filterSet} onChange={(e) => setFilterSet(e.target.value)}
                    className={`flex-1 min-w-0 px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400 font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="all">All Sets</option>
                    {(() => {
                      const getScore = (code) => { const s = setNamesLC[(code||"").toLowerCase()]; return s?.year ? s.year * 100 + (s.month || 0) : 0; };
                      const sortCodes = (arr) => setListSort === 'alpha' ? arr.sort((a,b) => a.localeCompare(b)) : arr.sort((a,b) => getScore(b)-getScore(a));
                      const fmtOption = (code, name, owned, total) => {
                        const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
                        const complete = total > 0 && owned === total;
                        const sd = setNamesLC[(code||"").toLowerCase()];
                        const yr = typeof sd === 'object' ? sd?.year : null;
                        const cleanName = String(name || '').replace(/ \d{4}(-\d{4})?$/, '').trim();
                        return <option key={code} value={code}>{complete ? '✓ ' : ''}{code} - {cleanName}{yr ? ` · ${yr}` : ''} ({owned}/{total}{!complete ? ` · ${pct}%` : ''})</option>;
                      };
                      if (filterSetLang === 'JP') return sortCodes(Object.keys(setStats.jp)).map(code => { const s = setStats.jp[code]; const name = (typeof setNamesLC[(code||"").toLowerCase()] === 'object' ? setNamesLC[(code||"").toLowerCase()]?.name : setNamesLC[(code||"").toLowerCase()]) || 'Unknown'; return fmtOption(code, name, s.owned, s.total); });
                      if (filterSetLang === 'CN') return sortCodes(Object.keys(setStats.cn)).map(code => { const s = setStats.cn[code]; const name = (typeof setNamesLC[(code||"").toLowerCase()] === 'object' ? setNamesLC[(code||"").toLowerCase()]?.name : setNamesLC[(code||"").toLowerCase()]) || 'Unknown'; return fmtOption(code, name, s.owned, s.total); });
                      if (filterSetLang === 'TC') return sortCodes(Object.keys(setStats.tc || {})).map(code => { const s = (setStats.tc || {})[code]; const name = (typeof setNamesLC[(code||"").toLowerCase()] === 'object' ? setNamesLC[(code||"").toLowerCase()]?.name : setNamesLC[(code||"").toLowerCase()]) || 'Unknown'; return fmtOption(code, name, s.owned, s.total); });
                      if (filterSetLang === 'KR') return sortCodes(Object.keys(setStats.kr || {})).map(code => { const s = (setStats.kr || {})[code]; const name = (typeof setNamesLC[(code||"").toLowerCase()] === 'object' ? setNamesLC[(code||"").toLowerCase()]?.name : setNamesLC[(code||"").toLowerCase()]) || 'Unknown'; return fmtOption(code, name, s.owned, s.total); });
                      if (filterSetLang === 'all') {
                        const allCodes = new Set([...Object.keys(setStats.en), ...Object.keys(setStats.jp), ...Object.keys(setStats.cn), ...Object.keys(setStats.tc || {}), ...Object.keys(setStats.kr || {})]);
                        return sortCodes(Array.from(allCodes)).map(code => {
                          const en = setStats.en[code] || { total: 0, owned: 0 }; const jp = setStats.jp[code] || { total: 0, owned: 0 }; const cn = setStats.cn[code] || { total: 0, owned: 0 }; const tc = (setStats.tc || {})[code] || { total: 0, owned: 0 }; const kr = (setStats.kr || {})[code] || { total: 0, owned: 0 };
                          const total = en.total || jp.total || cn.total || tc.total || kr.total; const owned = en.owned || jp.owned || cn.owned || tc.owned || kr.owned;
                          const _s = setNamesLC[(code||"").toLowerCase()]; const name = (typeof _s === 'object' ? (_s?.name || 'Unknown') : (_s || 'Unknown'));
                          return fmtOption(code, name, owned, total);
                        });
                      }
                      return sortCodes(allSets.filter(set => setStats.en[set]?.langs?.has(filterSetLang))).map(code => { const s = setStats.en[code] || { total: 0, owned: 0 }; const name = (typeof setNamesLC[(code||"").toLowerCase()] === 'object' ? setNamesLC[(code||"").toLowerCase()]?.name : setNamesLC[(code||"").toLowerCase()]) || 'Unknown'; return fmtOption(code, name, s.owned, s.total); });
                    })()}
                  </select>
                </div>

                <select value={filterCardType} onChange={(e) => setFilterCardType(e.target.value)}
                  className={`px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400 font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Types</option>
                  {[['trainer','Trainer'],['v','V'],['vmax','VMAX'],['vstar','VSTAR'],['gx','GX'],['mega','Mega'],['ex','EX / ex'],['promo','Promo']].map(([type, label]) => {
                    const total = filterCounts.typeCount(type); const owned = filterCounts.typeOwned(type);
                    const pct = total > 0 ? Math.round((owned / total) * 100) : 0; const complete = total > 0 && owned === total;
                    return <option key={type} value={type}>{complete ? '★ ' : ''}{label} ({owned}/{total}{!complete ? ` · ${pct}%` : ''})</option>;
                  })}
                </select>

                <div className="flex gap-1">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className={`flex-1 px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400 font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="default">Sort: Dex Order</option>
                    <option value="alpha_asc">Sort: A → Z</option>
                    <option value="alpha_desc">Sort: Z → A</option>
                    {viewMode === 'pokemon' && <option value="seen_desc">Sort: Most seen (coords)</option>}
                    {viewMode === 'cards' && <option value="featured_desc">Sort: Most featured</option>}
                    {viewMode === 'cards' && <option value="featured_asc">Sort: Fewest featured</option>}
                    {viewMode === 'cards' && <option value="release_desc">Sort: Newest first</option>}
                    {viewMode === 'cards' && <option value="release_asc">Sort: Oldest first</option>}
                    {viewMode === 'cards' && <option value="conformance_desc">Sort: Highest conformance</option>}
                    {viewMode === 'cards' && <option value="conformance_asc">Sort: Lowest conformance</option>}
                    {viewMode === 'cards' && <option value="price_desc">Sort: Price high → low</option>}
                    {viewMode === 'cards' && <option value="price_asc">Sort: Price low → high</option>}
                    {viewMode === 'review' && <option value="featured_desc">Sort: Most featured</option>}
                    {viewMode === 'review' && <option value="featured_asc">Sort: Fewest featured</option>}
                    {viewMode === 'review' && <option value="release_desc">Sort: Newest first</option>}
                    {viewMode === 'review' && <option value="release_asc">Sort: Oldest first</option>}
                    {viewMode === 'review' && <option value="conformance_desc">Sort: Highest conformance</option>}
                    {viewMode === 'review' && <option value="conformance_asc">Sort: Lowest conformance</option>}
                    {viewMode === 'review' && <option value="price_desc">Sort: Price high → low</option>}
                    {viewMode === 'review' && <option value="price_asc">Sort: Price low → high</option>}
                  </select>
                  {(hasActiveFilters || sortBy !== 'default') && (
                    <button onClick={() => { clearFilters(); setSortBy('default'); }} className="text-xs font-bold px-2 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 shrink-0">✕</button>
                  )}
                </div>
                {(sortBy === 'conformance_desc' || sortBy === 'conformance_asc') && (
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[10px] font-bold shrink-0">
                    <button onClick={() => setConformanceMode('blended')}
                      className="px-2 py-1 transition-colors"
                      style={conformanceMode === 'blended' ? { background: '#7c3aed', color: 'white' } : { background: '#f9fafb', color: '#9ca3af' }}>
                      Blended
                    </button>
                    <button onClick={() => setConformanceMode('formula')}
                      className="px-2 py-1 transition-colors"
                      style={conformanceMode === 'formula' ? { background: '#7c3aed', color: 'white' } : { background: '#f9fafb', color: '#9ca3af' }}>
                      Formula only
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center flex-wrap gap-3 mb-2">
                {viewMode === 'cards' && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Owned</span>
                    <div className={`flex rounded-lg overflow-hidden border text-xs font-bold ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      {[['all','All'],['owned','Owned'],['unowned','Unowned']].map(([val, label]) => (
                        <button key={val} onClick={() => setFilterOwned(val)}
                          className={`px-2.5 py-1 transition-colors ${filterOwned === val ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          style={filterOwned === val ? {background: 'linear-gradient(135deg, #22c55e, #16a34a)'} : {}}>{label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {viewMode === 'pokemon' && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No cards</span>
                    <div className={`flex rounded-lg overflow-hidden border text-xs font-bold ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      {[['all','All'],['hide','Hide'],['only','Only'],['refs','Refs']].map(([val, label]) => (
                        <button key={val} onClick={() => setFilterHideNoCards(val)}
                          className={`px-2.5 py-1 transition-colors ${filterHideNoCards === val ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          style={filterHideNoCards === val ? {background: 'linear-gradient(135deg, #22c55e, #16a34a)'} : {}}>{label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {viewMode === 'cards' && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Non-conform</span>
                    <div className={`flex rounded-lg overflow-hidden border text-xs font-bold ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      {[['all','All'],['hide','Hide'],['only','Only']].map(([val, label]) => (
                        <button key={val} onClick={() => setFilterHideNonConforming(val)}
                          className={`px-2.5 py-1 transition-colors ${filterHideNonConforming === val ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          style={filterHideNonConforming === val ? {background: val === 'only' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'} : {}}>{label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {viewMode === 'cards' && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Favourites</span>
                    <div className={`flex rounded-lg overflow-hidden border text-xs font-bold ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      {[['all','All'],['hide','Hide'],['only','Only']].map(([val, label]) => (
                        <button key={val} onClick={() => setFilterFavorites(val)}
                          className={`px-2.5 py-1 transition-colors ${filterFavorites === val ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          style={filterFavorites === val ? {background: 'linear-gradient(135deg, #ec4899, #db2777)'} : {}}>{label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {viewMode === 'cards' && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Unobtainable</span>
                    <div className={`flex rounded-lg overflow-hidden border text-xs font-bold ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      {[['all','All'],['hide','Hide'],['only','Only']].map(([val, label]) => (
                        <button key={val} onClick={() => setFilterUnobtainable(val)}
                          className={`px-2.5 py-1 transition-colors ${filterUnobtainable === val ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          style={filterUnobtainable === val ? {background: 'linear-gradient(135deg, #6b7280, #374151)'} : {}}>{label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {viewMode === 'cards' && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Exclusive</span>
                    <div className={`flex rounded-lg overflow-hidden border text-xs font-bold ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      {[['all','All'],['EN','EN'],['JP','JP'],['CN','CN'],['TC','TC'],['KR','KR']].map(([val, label]) => (
                        <button key={val} onClick={() => setFilterLang(filterLang === val ? 'all' : val)}
                          className={`px-2.5 py-1 transition-colors ${filterLang === val ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          style={filterLang === val ? {background: val === 'all' ? 'linear-gradient(135deg, #6b7280, #4b5563)' : val === 'EN' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : val === 'JP' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : val === 'CN' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : val === 'TC' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)'} : {}}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              <button onClick={() => setShowAdvancedFilters(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${showAdvancedFilters ? 'text-white' : darkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                style={showAdvancedFilters ? {background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'} : {}}>
                {showAdvancedFilters ? '▲' : '▼'} Advanced filters {(filterChinese !== 'all' || filterArtist !== 'all' || filterMissingImages) ? '●' : ''}
              </button>

              {showAdvancedFilters && (
                <div className={`mt-2 p-3 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">


                    <select value={filterChinese} onChange={(e) => setFilterChinese(e.target.value)}
                      className={`px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                      <option value="all">All CN Status</option>
                      <option value="has_cn">🇨🇳 Has Chinese ({filterCounts.hasCN})</option>
                      <option value="no_cn">Not in Chinese ({filterCounts.noCN})</option>
                    </select>
                    <div className="flex gap-1 col-span-2 md:col-span-1">
                      <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)}
                        className={`flex-1 px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <option value="all">All Artists</option>
                        {sortedArtists.map(([artist, count]) => {
                          const owned = filterCounts.artistOwned[artist] || 0;
                          const pct = count > 0 ? Math.round((owned / count) * 100) : 0;
                          const complete = count > 0 && owned === count;
                          return <option key={artist} value={artist}>{complete ? '★ ' : ''}{artist} ({owned}/{count}{!complete ? ` · ${pct}%` : ''})</option>;
                        })}
                      </select>
                      <select value={artistSortBy} onChange={(e) => setArtistSortBy(e.target.value)}
                        className={`w-24 px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <option value="card_count">By count</option>
                        <option value="alpha">A → Z</option>
                      </select>
                    </div>
                  </div>
                  <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <input type="checkbox" checked={filterMissingImages} onChange={(e) => setFilterMissingImages(e.target.checked)} className="rounded" />
                    Show only cards with missing images
                  </label>
                  <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <input type="checkbox" checked={filterMissingPrice} onChange={(e) => setFilterMissingPrice(e.target.checked)} className="rounded" />
                    Show only EN cards with no price (bad set number)
                  </label>
                  <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <input type="checkbox" checked={filterMissingCoords} onChange={(e) => setFilterMissingCoords(e.target.checked)} className="rounded" />
                    Show only cards with featured Pokémon missing coords
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className={`mb-4 text-xs font-semibold flex items-center justify-between ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="flex items-center gap-2 flex-wrap">
            {filteredData.type === 'pokemon' ? (<><Grid className="w-3.5 h-3.5" /><span>{filteredData.data.length} Pokémon</span></>) : (<><List className="w-3.5 h-3.5" /><span>{filteredData.data.length} Cards</span></>)}
          </div>
          {hasActiveFilters && (
            <span className="font-bold text-red-500 text-xs">
              {filterCardType !== 'all' && `${filterCardType.toUpperCase()}`}
              {filterCardType !== 'all' && filterSet !== 'all' && ' · '}
              {filterSet !== 'all' && `${filterSet}`}
            </span>
          )}
        </div>

        {viewMode === 'pokemon' ? (
          <div className={`grid ${pokemonGridClass[tileSize]}`}>
            {filteredData.data.map(pokemon => (
              <PokemonCard key={`${pokemon.id}-${pokemon.name}`} pokemon={pokemon} onClick={() => setSelectedPokemon(pokemon)} coordAppearances={coordAppearances} />
            ))}
          </div>
        ) : viewMode === 'review' ? (
          <div>
            <div className={`flex items-center justify-between mb-4 text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{fontSize:'0.85rem'}}>🔬</span>
                <span>Review Mode — {allCardsFlat.length} cards · {allCardsFlat.filter(c => reviewData[c.id]).length} reviewed</span>
              </div>
              <div className={`px-2 py-1 rounded-lg text-xs font-bold ${darkMode ? 'bg-gray-700 text-purple-300' : 'bg-purple-50 text-purple-600'}`}>
                Click any card to tag it
              </div>
            </div>
            <div className={`grid ${tileGridClass[tileSize]}`}>
              {allCardsFlat.filter(card => {
                if (card._filterMissingCoords) {
                  const hasOtherPok = card.otherPokemon && card.otherPokemon.length > 0;
                  if (!hasOtherPok) return false;
                  if (pokemonCoordsImport[card.id]) return false;
                }
                return true;
              }).map((card, idx) => {
                const rd = reviewData[card.id];
                const isReviewed = !!rd;
                return (
                  <div key={`${card.pokemonId}-${card.id}-${idx}`} className="relative cursor-pointer" onClick={() => setReviewCard({ ...card, pokemonName: card.pokemonName })}>
                    <CardTile card={card} pokemonName={card.pokemonName} appMode={appMode}
                      onOwnershipClick={handleCardOwnershipClick} onToggleNonConforming={handleToggleNonConforming}
                      onToggleFavorite={handleToggleFavorite} onToggleUnobtainable={handleToggleUnobtainable}
                     
                      onUpdateCard={handleInlineUpdateCard} showOwnershipButtons={false} getPriceForCard={getPriceForCard} />
                    {/* Review badge overlay */}
                    <div className="absolute top-1 left-1 z-20 pointer-events-none">
                      {isReviewed ? (() => {
                        const pct = rd.conformancePct ?? null;
                        const color = conformanceColor(pct);
                        return (
                          <div className="flex flex-col gap-0.5">
                            {pct !== null && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black text-white shadow"
                                style={{ background: color }}>
                                {pct}%
                              </span>
                            )}
                            {(rd.categories || []).slice(0, 1).map(cat => (
                              <span key={cat} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow bg-purple-500">
                                {cat.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        );
                      })() : (
                        <span className="w-2 h-2 rounded-full bg-gray-400 block opacity-40" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className={`flex items-center justify-between mb-4 text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="flex items-center gap-2 flex-wrap"><List className="w-3.5 h-3.5" /><span>All Cards ({allCardsFlat.length})</span></div>
              <div>{allCardsFlat.filter(c => c.ownedLang).length} owned</div>
            </div>
            <div className={`grid ${tileGridClass[tileSize]}`}>
              {allCardsFlat.map((card, idx) => (
                <CardTile key={`${card.pokemonId}-${card.id}-${idx}`} card={card} pokemonName={card.pokemonName}
                  onOwnershipClick={handleCardOwnershipClick} onToggleNonConforming={handleToggleNonConforming}
                  onToggleFavorite={handleToggleFavorite} onToggleUnobtainable={handleToggleUnobtainable}
                 
                  onUpdateCard={handleInlineUpdateCard} showOwnershipButtons={showOwnershipButtons} getPriceForCard={getPriceForCard} appMode={appMode} />
              ))}
            </div>
          </div>
        )}

        {filteredData.data.length === 0 && viewMode === 'pokemon' && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">😴</div>
            <div className={`text-lg font-bold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No results found</div>
            {hasActiveFilters && <button onClick={clearFilters} className="text-red-500 hover:text-red-600 font-bold text-sm">Clear filters</button>}
          </div>
        )}
      </div>

      {selectedPokemon && (
        <DetailModal darkMode={darkMode} pokemon={selectedPokemon}
          onToggleNonConforming={handleToggleNonConforming} onToggleFavorite={handleToggleFavorite} onToggleUnobtainable={handleToggleUnobtainable}
         
          onNavigateToPokemon={(name) => { const target = pokemonData.find(p => p.name === name); if (target) setSelectedPokemon(target); }}
          onNavigatePrev={() => { const list = filteredData.data; const idx = list.findIndex(p => p.id === selectedPokemon.id); if (idx > 0) setSelectedPokemon(list[idx - 1]); }}
          onNavigateNext={() => { const list = filteredData.data; const idx = list.findIndex(p => p.id === selectedPokemon.id); if (idx < list.length - 1) setSelectedPokemon(list[idx + 1]); }}
          hasPrev={(() => { const list = filteredData.data; const idx = list.findIndex(p => p.id === selectedPokemon.id); return idx > 0; })()}
          hasNext={(() => { const list = filteredData.data; const idx = list.findIndex(p => p.id === selectedPokemon.id); return idx < filteredData.data.length - 1; })()}
          onClose={() => setSelectedPokemon(null)} onUpdateCard={handleUpdateCard} getPriceForCard={getPriceForCard} coordAppearances={coordAppearances} appMode={appMode} />
      )}

      {languagePickerCard && (
        <LanguagePicker card={languagePickerCard} onConfirm={handleLanguageConfirm} onCancel={() => setLanguagePickerCard(null)} />
      )}

      {showLockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowLockModal(false); setLockInput(''); setLockError(false); }}}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl"><Lock className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <h3 className="font-black text-gray-900 text-base">Unlock Collection</h3>
                <p className="text-xs text-gray-400">Enter password to enable editing</p>
              </div>
            </div>
            <input type="password" autoFocus value={lockInput}
              onChange={(e) => { setLockInput(e.target.value); setLockError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUnlockAttempt(); if (e.key === 'Escape') { setShowLockModal(false); setLockInput(''); setLockError(false); }}}
              placeholder="Password"
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${lockError ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-emerald-400'}`}
            />
            {lockError && <p className="text-xs text-red-500 -mt-2">Incorrect password</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowLockModal(false); setLockInput(''); setLockError(false); }} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-semibold">Cancel</button>
              <button onClick={handleUnlockAttempt} className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">Unlock</button>
            </div>
          </div>
        </div>
      )}
      {reviewCard && (
        <ReviewModal
          card={reviewCard}
          reviewData={reviewData[reviewCard.id] || {}}
          onSave={(data) => { saveReviewData(reviewCard.id, data); }}
          onClose={() => setReviewCard(null)}
          onPrev={() => {
            const idx = allCardsFlat.findIndex(c => c.id === reviewCard.id);
            if (idx > 0) setReviewCard({ ...allCardsFlat[idx - 1], pokemonName: allCardsFlat[idx - 1].pokemonName });
          }}
          onNext={() => {
            const idx = allCardsFlat.findIndex(c => c.id === reviewCard.id);
            if (idx < allCardsFlat.length - 1) setReviewCard({ ...allCardsFlat[idx + 1], pokemonName: allCardsFlat[idx + 1].pokemonName });
          }}
          hasPrev={allCardsFlat.findIndex(c => c.id === reviewCard.id) > 0}
          hasNext={allCardsFlat.findIndex(c => c.id === reviewCard.id) < allCardsFlat.length - 1}
          darkMode={darkMode}
        />
      )}

    </div>
  );
}