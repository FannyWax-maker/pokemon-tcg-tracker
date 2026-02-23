import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Grid, List, Moon, Sun } from 'lucide-react';
import PokemonCard from './components/PokemonCard';
import CardTile from './components/CardTile';
import DetailModal from './components/DetailModal';
import LanguagePicker from './components/LanguagePicker';
import pokemonDataImport from './data/pokemon_data.json';
import setNamesImport from './data/set_names.json';

export default function App() {
  const [pokemonData, setPokemonData] = useState(pokemonDataImport);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [filterExclusive, setFilterExclusive] = useState('all');
  const [filterSet, setFilterSet] = useState('all');
  const [filterCardType, setFilterCardType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [languagePickerCard, setLanguagePickerCard] = useState(null);
  const [viewMode, setViewMode] = useState('pokemon');
  const [filterMissingImages, setFilterMissingImages] = useState(false);
  const [filterChinese, setFilterChinese] = useState('all'); // 'all', 'has_cn', 'no_cn'
  const [sortBy, setSortBy] = useState('default'); // 'default', 'featured_desc', 'featured_asc'
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterHideNoCards, setFilterHideNoCards] = useState(false);
  const [filterHideNonConforming, setFilterHideNonConforming] = useState(false);
  const [filterOwned, setFilterOwned] = useState('all'); // 'all', 'owned', 'unowned'
  const [artistSortBy, setArtistSortBy] = useState('card_count'); // 'alpha', 'card_count'
  const [darkMode, setDarkMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  
  const setNames = setNamesImport;
  
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyNHSpdwlW_WVu6zvkg_piGyrqNzJfrLCI6Z0OJ6S_wPrwP7-TvXX3aT3HvGGPHj5ENSw/exec';

  useEffect(() => {
    const loadOwnership = async () => {
      const cached = localStorage.getItem('pokemon_ownership_cache');
      if (cached) {
        const ownership = JSON.parse(cached);
        setPokemonData(prev => prev.map(pokemon => ({
          ...pokemon,
          cards: pokemon.cards.map(card => ({
            ...card,
            ownedLang: ownership[card.id] !== undefined ? ownership[card.id] : card.ownedLang
          }))
        })));
      }
      try {
        const res = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now());
        const data = await res.json();
        // Support both old format {cardId: lang} and new format {ownership:{...}, nonConforming:{...}}
        const ownership = data.ownership || data;
        const nonConforming = data.nonConforming || {};
        localStorage.setItem('pokemon_ownership_cache', JSON.stringify(ownership));
        localStorage.setItem('pokemon_nonconforming_cache', JSON.stringify(nonConforming));
        setPokemonData(prev => prev.map(pokemon => ({
          ...pokemon,
          cards: pokemon.cards.map(card => ({
            ...card,
            ownedLang: ownership[card.id] !== undefined ? ownership[card.id] : card.ownedLang,
            nonConforming: nonConforming[card.id] === true ? true : card.nonConforming || false,
          }))
        })));
      } catch (e) {
        console.warn('Could not reach Google Sheets, using cached data');
        // Load nonConforming from localStorage cache
        const ncCached = localStorage.getItem('pokemon_nonconforming_cache');
        if (ncCached) {
          const nonConforming = JSON.parse(ncCached);
          setPokemonData(prev => prev.map(pokemon => ({
            ...pokemon,
            cards: pokemon.cards.map(card => ({
              ...card,
              nonConforming: nonConforming[card.id] === true ? true : card.nonConforming || false,
            }))
          })));
        }
      }
    };
    loadOwnership();
  }, []);

  const saveOwnership = async (cardId, ownedLang) => {
    setSyncStatus('saving');
    const cached = localStorage.getItem('pokemon_ownership_cache');
    const ownership = cached ? JSON.parse(cached) : {};
    if (ownedLang) ownership[cardId] = ownedLang;
    else delete ownership[cardId];
    localStorage.setItem('pokemon_ownership_cache', JSON.stringify(ownership));
    try {
      const url = `${APPS_SCRIPT_URL}?action=set&cardId=${encodeURIComponent(cardId)}&ownedLang=${encodeURIComponent(ownedLang || '')}`;
      await fetch(url);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus(''), 2000);
    } catch (e) {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };
  
  const saveNonConforming = async (cardId, isNonConforming) => {
    setSyncStatus('saving');
    const cached = localStorage.getItem('pokemon_nonconforming_cache');
    const nonConforming = cached ? JSON.parse(cached) : {};
    if (isNonConforming) nonConforming[cardId] = true;
    else delete nonConforming[cardId];
    localStorage.setItem('pokemon_nonconforming_cache', JSON.stringify(nonConforming));
    try {
      const url = `${APPS_SCRIPT_URL}?action=setConforming&cardId=${encodeURIComponent(cardId)}&nonConforming=${isNonConforming ? 'true' : ''}`;
      await fetch(url);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus(''), 2000);
    } catch (e) {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  // Get all unique sets
  const allSets = useMemo(() => {
    const sets = new Set();
    pokemonData.forEach(p => {
      p.cards.forEach(c => {
        if (c.setCode) sets.add(c.setCode);
      });
    });
    return Array.from(sets).sort();
  }, [pokemonData]);
  
  // Pre-compute filter option counts
  const filterCounts = useMemo(() => {
    const primary = pokemonData.flatMap(p => p.cards.filter(c => !c.isSecondary && c.isPrimary !== false));
    const jpCount = primary.filter(c => c.exclusive === 'JP').length;
    const cnExclCount = primary.filter(c => c.exclusive === 'CN').length;
    const noneCount = primary.filter(c => !c.exclusive).length;
    const hasCN = primary.filter(c => (c.availableLangs || []).includes('CN')).length;
    const noCN = primary.length - hasCN;
    const typeCount = (type) => {
      return primary.filter(c => {
        const n = (c.cardName || '').toUpperCase();
        if (type === 'trainer') return n.includes('TRAINER');
        if (type === 'vmax') return n.includes('VMAX');
        if (type === 'vstar') return n.includes('VSTAR');
        if (type === 'v') return (n.endsWith(' V') || n.includes(' V ')) && !n.includes('VMAX') && !n.includes('VSTAR');
        if (type === 'gx') return n.includes('GX');
        if (type === 'mega') return n.includes('MEGA');
        if (type === 'ex') return n.includes('EX');
        return false;
      }).length;
    };
    const setCounts = {};
    primary.forEach(c => { if (c.setCode) setCounts[c.setCode] = (setCounts[c.setCode] || 0) + 1; });
    // Artist counts
    const artistCounts = {};
    primary.forEach(c => {
      if (c.artist) artistCounts[c.artist] = (artistCounts[c.artist] || 0) + 1;
    });
    return { jpCount, cnExclCount, noneCount, hasCN, noCN, typeCount, setCounts, artistCounts };
  }, [pokemonData]);

  const sortedArtists = useMemo(() => {
    const entries = Object.entries(filterCounts.artistCounts || {});
    if (artistSortBy === 'alpha') return entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries.sort((a, b) => b[1] - a[1]); // card_count desc
  }, [filterCounts.artistCounts, artistSortBy]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const allCards = pokemonData.flatMap(p => p.cards.filter(c => !c.isSecondary && c.isPrimary !== false));
    const totalCards = allCards.length;
    const ownedCards = allCards.filter(c => c.ownedLang).length;
    const completionPercent = totalCards > 0 ? (ownedCards / totalCards) * 100 : 0;
    
    const langStats = {
      EN: allCards.filter(c => c.ownedLang === 'EN').length,
      JP: allCards.filter(c => c.ownedLang === 'JP').length,
      CN: allCards.filter(c => c.ownedLang === 'CN').length,
      KR: allCards.filter(c => c.ownedLang === 'KR').length,
    };
    
    return { totalCards, ownedCards, completionPercent, langStats };
  }, [pokemonData]);
  
  const hasActiveFilters = filterExclusive !== 'all' || filterSet !== 'all' || filterCardType !== 'all' || filterMissingImages || filterChinese !== 'all' || filterArtist !== 'all' || filterHideNoCards || filterHideNonConforming || filterOwned !== 'all';
  
  const activeFilterCount = [
    filterExclusive !== 'all',
    filterSet !== 'all',
    filterCardType !== 'all',
    filterMissingImages,
    filterChinese !== 'all',
    filterArtist !== 'all',
    filterHideNoCards,
    filterHideNonConforming,
    filterOwned !== 'all',
  ].filter(Boolean).length;
  
  const filteredData = useMemo(() => {
    let filtered = pokemonData;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        String(p.id).includes(query)
      );
    }

    // Owned/unowned filter
    if (filterOwned === 'owned') {
      filtered = filtered.filter(p => p.cards.some(c => c.isPrimary !== false && !c.isSecondary && c.ownedLang));
    } else if (filterOwned === 'unowned') {
      filtered = filtered.filter(p => p.cards.some(c => c.isPrimary !== false && !c.isSecondary && !c.ownedLang));
    }

    // Hide pokemon with no cards and no refs
    if (filterHideNoCards) {
      filtered = filtered.filter(p => p.cards.length > 0);
    }

    // Hide non-conforming cards (filter out pokemon where ALL primary cards are non-conforming)
    if (filterHideNonConforming) {
      filtered = filtered.map(p => ({
        ...p,
        cards: p.cards.filter(c => !c.nonConforming)
      })).filter(p => p.cards.some(c => !c.isSecondary && c.isPrimary !== false));
    }

    // Artist filter - keep pokemon with at least one primary card by this artist
    if (filterArtist !== 'all') {
      filtered = filtered.filter(p =>
        p.cards.some(c => !c.isSecondary && c.isPrimary !== false && c.artist === filterArtist)
      );
    }

    // Card-level filters — keep pokemon that have at least one matching primary card
    const cardFilterActive = filterChinese !== 'all' || filterExclusive !== 'all' ||
      filterSet !== 'all' || filterCardType !== 'all';

    if (cardFilterActive) {
      filtered = filtered.filter(pokemon => {
        return pokemon.cards.some(card => {
          if (card.isSecondary || card.isPrimary === false) return false;
          if (filterChinese !== 'all') {
            const hasCN = (card.availableLangs || []).includes('CN');
            if (filterChinese === 'has_cn' && !hasCN) return false;
            if (filterChinese === 'no_cn' && hasCN) return false;
          }
          if (filterExclusive !== 'all') {
            if (filterExclusive === 'jp' && card.exclusive !== 'JP') return false;
            if (filterExclusive === 'cn' && card.exclusive !== 'CN') return false;
            if (filterExclusive === 'none' && card.exclusive) return false;
          }
          if (filterSet !== 'all' && card.setCode !== filterSet) return false;
          if (filterCardType !== 'all') {
            const cn = String(card.cardName || '').trim();
            const cu = cn.toUpperCase();
            if (filterCardType === 'trainer' && !cu.includes('TRAINER')) return false;
            if (filterCardType === 'vmax' && !cu.includes('VMAX')) return false;
            if (filterCardType === 'vstar' && !cu.includes('VSTAR')) return false;
            if (filterCardType === 'v' && !(cn.endsWith(' V') || cn === 'V') || cu.includes('VMAX') || cu.includes('VSTAR')) {
              if (filterCardType === 'v') return false;
            }
            if (filterCardType === 'gx' && !cu.includes('GX')) return false;
            if (filterCardType === 'mega' && !cu.includes('MEGA')) return false;
            if (filterCardType === 'ex') {
              if (!(cu.includes(' EX') || cn.includes(' ex')) || cu.includes('EXCLUSIVE')) return false;
            }
          }
          return true;
        });
      });
    }

    // Missing images — mark flag on cards (handled in CardTile)
    if (filterMissingImages) {
      filtered = filtered.map(p => ({
        ...p,
        cards: p.cards.map(c => ({ ...c, _filterMissingImages: true }))
      }));
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      const aPrimary = a.cards.filter(c => !c.isSecondary && c.isPrimary !== false).length;
      const bPrimary = b.cards.filter(c => !c.isSecondary && c.isPrimary !== false).length;
      // In default dex order, keep no-card pokemon in place; for other sorts push to end
      const pushToEnd = sortBy !== 'default';
      if (pushToEnd) {
        if (aPrimary === 0 && bPrimary === 0) return a.id - b.id;
        if (aPrimary === 0) return 1;
        if (bPrimary === 0) return -1;
      }

      if (sortBy === 'alpha_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'alpha_desc') return b.name.localeCompare(a.name);
      // featured sort only applies to cards view
      return a.id - b.id; // default: dex order
    });

    return { type: 'pokemon', data: filtered };
  }, [searchQuery, pokemonData, filterExclusive, filterSet, filterCardType, filterMissingImages, filterChinese, filterArtist, filterHideNoCards, filterHideNonConforming, sortBy, filterOwned]);
  
  // Flatten all cards for "All Cards View"
  const allCardsFlat = useMemo(() => {
    const cards = [];
    filteredData.data.forEach(pokemon => {
      pokemon.cards
        .filter(c => !c.isSecondary && c.isPrimary !== false)
        .forEach(card => {
          // Apply card-level filters for cards view
          if (filterChinese !== 'all') {
            const hasCN = (card.availableLangs || []).includes('CN');
            if (filterChinese === 'has_cn' && !hasCN) return;
            if (filterChinese === 'no_cn' && hasCN) return;
          }
          if (filterExclusive !== 'all') {
            if (filterExclusive === 'jp' && card.exclusive !== 'JP') return;
            if (filterExclusive === 'cn' && card.exclusive !== 'CN') return;
            if (filterExclusive === 'none' && card.exclusive) return;
          }
          if (filterSet !== 'all' && card.setCode !== filterSet) return;
          if (filterCardType !== 'all') {
            const cn = String(card.cardName || '').trim();
            const cu = cn.toUpperCase();
            let matches = false;
            if (filterCardType === 'trainer') matches = cu.includes('TRAINER');
            else if (filterCardType === 'vmax') matches = cu.includes('VMAX');
            else if (filterCardType === 'vstar') matches = cu.includes('VSTAR');
            else if (filterCardType === 'v') matches = (cn.endsWith(' V') || cn === 'V') && !cu.includes('VMAX') && !cu.includes('VSTAR');
            else if (filterCardType === 'gx') matches = cu.includes('GX');
            else if (filterCardType === 'mega') matches = cu.includes('MEGA');
            else if (filterCardType === 'ex') matches = (cu.includes(' EX') || cn.includes(' ex')) && !cu.includes('EXCLUSIVE');
            if (!matches) return;
          }
          // Artist filter in cards view - skip cards not by this artist
          if (filterArtist !== 'all' && card.artist !== filterArtist) return;
          cards.push({ ...card, pokemonName: pokemon.name, pokemonId: pokemon.id });
        });
    });
    // Sort cards view by featured pokemon count
    if (sortBy === 'featured_desc') {
      cards.sort((a, b) => (b.otherPokemon || []).length - (a.otherPokemon || []).length);
    } else if (sortBy === 'featured_asc') {
      cards.sort((a, b) => (a.otherPokemon || []).length - (b.otherPokemon || []).length);
    }
    return cards;
  }, [filteredData, filterChinese, filterExclusive, filterSet, filterCardType, sortBy]);
  
  // INLINE EDIT - Update card directly
  const handleInlineUpdateCard = (pokemonId, cardId, updates) => {
    const updatedData = pokemonData.map(pokemon => {
      if (pokemon.id === pokemonId) {
        return {
          ...pokemon,
          cards: pokemon.cards.map(card => 
            card.id === cardId ? { ...card, ...updates } : card
          )
        };
      }
      return pokemon;
    });
    
    setPokemonData(updatedData);
    
    
    console.log('âœ… Card updated and saved to browser');
  };
  
  const handleUpdateCard = (pokemonId, cardId, language) => {
    setPokemonData(prev => prev.map(pokemon => {
      if (pokemon.id === pokemonId) {
        return {
          ...pokemon,
          cards: pokemon.cards.map(card =>
            card.id === cardId ? { ...card, ownedLang: language } : card
          )
        };
      }
      return pokemon;
    }));
    if (selectedPokemon && selectedPokemon.id === pokemonId) {
      setSelectedPokemon(prev => ({
        ...prev,
        cards: prev.cards.map(card =>
          card.id === cardId ? { ...card, ownedLang: language } : card
        )
      }));
    }
    saveOwnership(cardId, language);
  };
  
  const handleCardOwnershipClick = (card) => {
    if (card._directLang) {
      handleUpdateCard(card.pokemonId, card.id, card._directLang);
    } else if (card._action === 'unmark') {
      handleUpdateCard(card.pokemonId, card.id, null);
    } else if (card.ownedLang) {
      // Clicking owned pill = unmark
      handleUpdateCard(card.pokemonId, card.id, null);
    } else {
      setLanguagePickerCard(card);
    }
  };
  
  const handleLanguageConfirm = (language) => {
    if (languagePickerCard) {
      handleUpdateCard(languagePickerCard.pokemonId, languagePickerCard.id, language);
      setLanguagePickerCard(null);
    }
  };
  
  const handleToggleNonConforming = (pokemonId, cardId, currentValue) => {
    const newValue = !currentValue;
    setPokemonData(prev => prev.map(pokemon => {
      if (pokemon.id !== pokemonId) return pokemon;
      return {
        ...pokemon,
        cards: pokemon.cards.map(card =>
          card.id === cardId ? { ...card, nonConforming: newValue } : card
        )
      };
    }));
    saveNonConforming(cardId, newValue);
  };

  const clearFilters = () => {
    setFilterExclusive('all');
    setFilterSet('all');
    setFilterCardType('all');
    setFilterMissingImages(false);
    setFilterChinese('all');
    setFilterArtist('all');
    setFilterHideNoCards(false);
    setFilterHideNonConforming(false);
    setFilterOwned('all');
  };
  
  // Download current data
  const handleDownloadData = () => {
    const dataStr = JSON.stringify(pokemonData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pokemon_data.json';
    link.click();
    URL.revokeObjectURL(url);
    alert('ðŸ“¥ Downloaded pokemon_data.json!\n\nReplace the file in src/data/ to make changes permanent.');
  };
  
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      {/* Header */}
      <div className={`shadow-sm sticky top-0 z-30 ${darkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-3 py-1.5 flex items-center gap-2">
          <h1 className={`text-sm font-bold shrink-0 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pokémon TCG</h1>
          <div className="flex items-center gap-1 bg-emerald-500 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0">
            <span>{overallStats.ownedCards}/{overallStats.totalCards}</span>
            <span className="opacity-60">·</span>
            <span>{Math.round(overallStats.completionPercent)}%</span>
          </div>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Pokémon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 rounded-full border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-200 text-gray-700 bg-gray-50'}`}
            />
          </div>
          <div className={`flex items-center rounded-full p-0.5 text-xs font-semibold shrink-0 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <button onClick={() => setViewMode('pokemon')} className={`px-2.5 py-1 rounded-full transition-colors ${viewMode === 'pokemon' ? 'bg-blue-500 text-white' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Grid</button>
            <button onClick={() => setViewMode('cards')} className={`px-2.5 py-1 rounded-full transition-colors ${viewMode === 'cards' ? 'bg-blue-500 text-white' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Cards</button>
          </div>
          {syncStatus && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${syncStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' : syncStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {syncStatus === 'saving' ? '⏳' : syncStatus === 'saved' ? '✓' : '⚠'}
            </span>
          )}
          <button onClick={() => setDarkMode(!darkMode)} className={`p-1.5 rounded-lg transition-colors shrink-0 ${darkMode ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${hasActiveFilters ? 'bg-emerald-500 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Filter className="w-3.5 h-3.5" />
            {hasActiveFilters ? activeFilterCount : 'Filters'}
          </button>

        </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="px-3 pb-3 border-t border-gray-100">
              <div className="pt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                <select value={filterExclusive} onChange={(e) => setFilterExclusive(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="all">All Exclusives</option>
                  <option value="jp">JP Exclusive Only ({filterCounts.jpCount})</option>
                  <option value="cn">CN Exclusive Only ({filterCounts.cnExclCount})</option>
                  <option value="none">Non-Exclusive Only ({filterCounts.noneCount})</option>
                </select>
                <select value={filterChinese} onChange={(e) => setFilterChinese(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="all">All CN Status</option>
                  <option value="has_cn">Released in Chinese ({filterCounts.hasCN})</option>
                  <option value="no_cn">Not in Chinese ({filterCounts.noCN})</option>
                </select>
                <select value={filterCardType} onChange={(e) => setFilterCardType(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="all">All Types</option>
                  <option value="trainer">Trainer ({filterCounts.typeCount('trainer')})</option>
                  <option value="v">V ({filterCounts.typeCount('v')})</option>
                  <option value="vmax">VMAX ({filterCounts.typeCount('vmax')})</option>
                  <option value="vstar">VSTAR ({filterCounts.typeCount('vstar')})</option>
                  <option value="gx">GX ({filterCounts.typeCount('gx')})</option>
                  <option value="mega">Mega ({filterCounts.typeCount('mega')})</option>
                  <option value="ex">EX / ex ({filterCounts.typeCount('ex')})</option>
                </select>
                <select value={filterSet} onChange={(e) => setFilterSet(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="all">All Sets</option>
                  {allSets.map(set => (
                    <option key={set} value={set}>{set} - {setNames[set] || 'Unknown'} ({filterCounts.setCounts[set] || 0})</option>
                  ))}
                </select>
                <div className="col-span-2 md:col-span-1 flex gap-1">
                  <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="all">All Artists</option>
                    {sortedArtists.map(([artist, count]) => (
                      <option key={artist} value={artist}>{artist} ({count})</option>
                    ))}
                  </select>
                  <select value={artistSortBy} onChange={(e) => setArtistSortBy(e.target.value)} className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="card_count">By count</option>
                    <option value="alpha">A → Z</option>
                  </select>
                </div>
              </div>
              <div className="mt-2">
                <select value={filterOwned} onChange={(e) => setFilterOwned(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="all">All (Owned & Unowned)</option>
                  <option value="owned">Owned only</option>
                  <option value="unowned">Unowned only</option>
                </select>
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                  <input type="checkbox" checked={filterHideNoCards} onChange={(e) => setFilterHideNoCards(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                  Hide Pokémon with no cards
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                  <input type="checkbox" checked={filterHideNonConforming} onChange={(e) => setFilterHideNonConforming(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                  Hide non-conforming cards
                </label>
                <div className="flex items-center gap-3">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="default">Sort: Dex Order</option>
                    <option value="alpha_asc">Sort: A → Z</option>
                    <option value="alpha_desc">Sort: Z → A</option>
                    <option value="featured_desc">Sort: Most featured first</option>
                    <option value="featured_asc">Sort: Fewest featured first</option>
                  </select>
                  {(hasActiveFilters || sortBy !== 'default') && (
                    <button onClick={() => { clearFilters(); setSortBy('default'); }} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">Clear all</button>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4 text-sm text-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {filteredData.type === 'pokemon' ? (
              <>
                <Grid className="w-4 h-4" />
                <span>Showing {filteredData.data.length} Pokémon</span>
              </>
            ) : (
              <>
                <List className="w-4 h-4" />
                <span>Showing {filteredData.data.length} Cards</span>
              </>
            )}
          </div>
          {hasActiveFilters && (
            <span className="text-emerald-600 font-semibold text-xs">
              {filterExclusive !== 'all' && `${filterExclusive.toUpperCase()} Exclusive`}
              {filterExclusive !== 'all' && (filterSet !== 'all' || filterCardType !== 'all') && ' â€¢ '}
              {filterCardType !== 'all' && `${filterCardType.toUpperCase()}`}
              {filterCardType !== 'all' && filterSet !== 'all' && ' â€¢ '}
              {filterSet !== 'all' && `${filterSet}`}
            </span>
          )}
        </div>
        
        {viewMode === 'pokemon' ? (
          /* POKEMON VIEW */
          <>
            {filteredData.type === 'pokemon' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredData.data.map(pokemon => (
                  <PokemonCard
                    key={pokemon.id}
                    pokemon={pokemon}
                    onClick={() => setSelectedPokemon(pokemon)}
                  />
                ))}
              </div>
            )}
            
            {filteredData.type === 'cards' && (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                {filteredData.data.map(card => (
                  <CardTile
                    key={card.id}
                    card={card}
                    pokemonName={card.pokemonName}
                    onOwnershipClick={handleCardOwnershipClick}
                    onToggleNonConforming={handleToggleNonConforming}
                    onUpdateCard={handleInlineUpdateCard}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ALL CARDS VIEW */
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4" />
                <span className="text-sm text-gray-600">
                  All Cards ({allCardsFlat.length})
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {allCardsFlat.filter(c => c.ownedLang).length} owned
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {allCardsFlat.map((card, idx) => (
                <CardTile
                  key={`${card.pokemonId}-${card.id}-${idx}`}
                  card={card}
                  pokemonName={card.pokemonName}
                  onOwnershipClick={handleCardOwnershipClick}
                  onToggleNonConforming={handleToggleNonConforming}
                  onUpdateCard={handleInlineUpdateCard}
                />
              ))}
            </div>
          </div>
        )}
        
        {filteredData.data.length === 0 && viewMode === 'pokemon' && (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg mb-2">No results found</div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Detail Modal */}
      {selectedPokemon && (
        <DetailModal
          darkMode={darkMode}
          pokemon={selectedPokemon}
          onToggleNonConforming={handleToggleNonConforming}
          onNavigateToPokemon={(name) => {
            const target = pokemonData.find(p => p.name === name);
            if (target) setSelectedPokemon(target);
          }}
          onClose={() => setSelectedPokemon(null)}
          onUpdateCard={handleUpdateCard}
        />
      )}
      
      {/* Language Picker */}
      {languagePickerCard && (
        <LanguagePicker
          card={languagePickerCard}
          onConfirm={handleLanguageConfirm}
          onCancel={() => setLanguagePickerCard(null)}
        />
      )}
    </div>
  );
}
