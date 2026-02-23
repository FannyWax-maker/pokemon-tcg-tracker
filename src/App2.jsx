import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Grid, List, Save } from 'lucide-react';
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
  
  const setNames = setNamesImport;
  
  // Load custom data from localStorage
  useEffect(() => {
    const customData = localStorage.getItem('pokemon_data_custom');
    if (customData) {
      try {
        const parsed = JSON.parse(customData);
        setPokemonData(parsed);
        console.log('âœ… Loaded custom Pokemon data');
      } catch (e) {
        console.error('Failed to load custom data:', e);
      }
    }
  }, []);
  
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
  
  // Calculate overall stats
  const overallStats = useMemo(() => {
    const allCards = pokemonData.flatMap(p => p.cards);
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
  
  const hasActiveFilters = filterExclusive !== 'all' || filterSet !== 'all' || filterCardType !== 'all' || filterMissingImages;
  
  const activeFilterCount = [
    filterExclusive !== 'all',
    filterSet !== 'all',
    filterCardType !== 'all',
    filterMissingImages
  ].filter(Boolean).length;
  
  const filteredData = useMemo(() => {
    let filtered = pokemonData;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        String(p.id).includes(query)
      );
    }
    
    if (hasActiveFilters) {
      const cards = [];
      
      filtered.forEach(pokemon => {
        pokemon.cards.forEach(card => {
          // Skip secondary cards
          if (card.isSecondary || card.isPrimary === false) return;
          
          // Apply exclusive filter
          if (filterExclusive !== 'all') {
            if (filterExclusive === 'jp' && card.exclusive !== 'JP') return;
            if (filterExclusive === 'cn' && card.exclusive !== 'CN') return;
            if (filterExclusive === 'none' && card.exclusive) return;
          }
          
          // Apply set filter
          if (filterSet !== 'all' && card.setCode !== filterSet) return;
          
          // Apply card type filter - FIXED VERSION
          if (filterCardType !== 'all') {
            const cardName = String(card.cardName || '').trim();
            const cardUpper = cardName.toUpperCase();
            
            // Check based on filter type
            let matches = false;
            if (filterCardType === 'trainer' && cardUpper.includes('TRAINER')) matches = true;
            else if (filterCardType === 'v') {
              // Match cards ending with " V" but NOT "VMAX" or "VSTAR"
              if ((cardName.endsWith(' V') || cardName === 'V') && 
                  !cardUpper.includes('VMAX') && !cardUpper.includes('VSTAR')) {
                matches = true;
              }
            }
            else if (filterCardType === 'vmax' && cardUpper.includes('VMAX')) matches = true;
            else if (filterCardType === 'vstar' && cardUpper.includes('VSTAR')) matches = true;
            else if (filterCardType === 'gx' && cardUpper.includes('GX')) matches = true;
            else if (filterCardType === 'ex') {
              if ((cardUpper.includes(' EX') || cardName.includes(' ex') || cardName.endsWith(' EX') || cardName.endsWith(' ex')) && !cardUpper.includes('EXCLUSIVE')) {
                matches = true;
              }
            }
            
            if (!matches) return;
          }
          
          // Apply missing images filter
          if (filterMissingImages) {
            card._filterMissingImages = true;
          }
          
          cards.push({
            ...card,
            pokemonName: pokemon.name,
            pokemonId: pokemon.id
          });
        });
      });
      
      return { type: 'cards', data: cards };
    }
    
    return { type: 'pokemon', data: filtered };
  }, [searchQuery, pokemonData, filterExclusive, filterSet, filterCardType, filterMissingImages, hasActiveFilters]);
  
  // Flatten all cards for "All Cards View"
  const allCardsFlat = useMemo(() => {
    const cards = [];
    const dataSource = filteredData.type === 'cards' ? 
      filteredData.data.map(c => ({
        id: c.pokemonId,
        name: c.pokemonName,
        cards: [c]
      })) : filteredData.data;
    
    dataSource.forEach(pokemon => {
      const cardsToProcess = filteredData.type === 'cards' ? pokemon.cards : 
        pokemon.cards.filter(c => c.isPrimary !== false && !c.isSecondary);
      
      cardsToProcess.forEach(card => {
        // Apply all filters
        if (filterExclusive !== 'all') {
          if (filterExclusive === 'jp' && card.exclusive !== 'JP') return;
          if (filterExclusive === 'cn' && card.exclusive !== 'CN') return;
          if (filterExclusive === 'none' && card.exclusive) return;
        }
        
        if (filterSet !== 'all' && card.setCode !== filterSet) return;
        
        if (filterCardType !== 'all') {
          const cardName = String(card.cardName || '').trim();
          const cardUpper = cardName.toUpperCase();
          
          let matches = false;
          if (filterCardType === 'trainer' && cardUpper.includes('TRAINER')) matches = true;
          else if (filterCardType === 'v') {
            // Match cards ending with " V" but NOT "VMAX" or "VSTAR"
            if ((cardName.endsWith(' V') || cardName === 'V') && 
                !cardUpper.includes('VMAX') && !cardUpper.includes('VSTAR')) {
              matches = true;
            }
          }
          else if (filterCardType === 'vmax' && cardUpper.includes('VMAX')) matches = true;
          else if (filterCardType === 'vstar' && cardUpper.includes('VSTAR')) matches = true;
          else if (filterCardType === 'gx' && cardUpper.includes('GX')) matches = true;
          else if (filterCardType === 'ex') {
            if ((cardUpper.includes(' EX') || cardName.includes(' ex') || cardName.endsWith(' EX') || cardName.endsWith(' ex')) && !cardUpper.includes('EXCLUSIVE')) {
              matches = true;
            }
          }
          
          if (!matches) return;
        }
        
        cards.push({
          ...card,
          pokemonId: pokemon.id,
          pokemonName: pokemon.name,
          pokemonGen: pokemon.gen,
          _filterMissingImages: filterMissingImages
        });
      });
    });
    
    return cards.sort((a, b) => a.pokemonId - b.pokemonId);
  }, [filteredData, pokemonData, filterExclusive, filterSet, filterCardType, filterMissingImages]);
  
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
    
    // Save to localStorage immediately
    localStorage.setItem('pokemon_data_custom', JSON.stringify(updatedData));
    
    console.log('âœ… Card updated and saved to browser');
  };
  
  const handleUpdateCard = (pokemonId, cardId, language) => {
    setPokemonData(prev => prev.map(pokemon => {
      if (pokemon.id === pokemonId) {
        return {
          ...pokemon,
          cards: pokemon.cards.map(card => 
            card.id === cardId 
              ? { ...card, ownedLang: language }
              : card
          )
        };
      }
      return pokemon;
    }));
    
    if (selectedPokemon && selectedPokemon.id === pokemonId) {
      setSelectedPokemon(prev => ({
        ...prev,
        cards: prev.cards.map(card => 
          card.id === cardId 
            ? { ...card, ownedLang: language }
            : card
        )
      }));
    }
  };
  
  const handleCardOwnershipClick = (card) => {
    if (card.ownedLang) return;
    setLanguagePickerCard(card);
  };
  
  const handleLanguageConfirm = (language) => {
    if (languagePickerCard) {
      handleUpdateCard(languagePickerCard.pokemonId, languagePickerCard.id, language);
      setLanguagePickerCard(null);
    }
  };
  
  const clearFilters = () => {
    setFilterExclusive('all');
    setFilterSet('all');
    setFilterCardType('all');
    setFilterMissingImages(false);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-900">
              Pokémon TCG Collection
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadData}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                title="Download current data"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm transition-colors ${
                  hasActiveFilters 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters {hasActiveFilters && `(${activeFilterCount})`}
              </button>
            </div>
          </div>
          
          {/* Overall Stats Bar - COMPACT */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg p-2 mb-2 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs opacity-90">Progress: </span>
                  <span className="text-sm font-bold">
                    {overallStats.ownedCards}/{overallStats.totalCards}
                  </span>
                </div>
                <div className="text-lg font-bold">
                  {Math.round(overallStats.completionPercent)}%
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span>EN:{overallStats.langStats.EN}</span>
                <span>JP:{overallStats.langStats.JP}</span>
                <span>CN:{overallStats.langStats.CN}</span>
                <span>KR:{overallStats.langStats.KR}</span>
              </div>
            </div>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center justify-center gap-3 mb-3 pb-3 border-b">
            <span className={`text-sm font-semibold transition-colors ${
              viewMode === 'pokemon' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              🎲 Pokemon Grid
            </span>
            
            <button
              onClick={() => setViewMode(viewMode === 'pokemon' ? 'cards' : 'pokemon')}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md ${
                viewMode === 'cards' ? 'bg-gradient-to-r from-blue-600 to-blue-500' : 'bg-gray-300'
              }`}
              title={`Switch to ${viewMode === 'pokemon' ? 'All Cards' : 'Pokemon'} view`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                  viewMode === 'cards' ? 'translate-x-9' : 'translate-x-1'
                }`}
              />
            </button>
            
            <span className={`text-sm font-semibold transition-colors ${
              viewMode === 'cards' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              🃏 All Cards
            </span>
          </div>
          
          {/* Filter Panel */}
          {showFilters && (
            <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Exclusive Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Exclusive Cards
                  </label>
                  <select
                    value={filterExclusive}
                    onChange={(e) => setFilterExclusive(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Cards</option>
                    <option value="jp">JP Exclusive Only</option>
                    <option value="cn">CN Exclusive Only</option>
                    <option value="none">Non-Exclusive Only</option>
                  </select>
                </div>
                
                {/* Card Type Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Card Type
                  </label>
                  <select
                    value={filterCardType}
                    onChange={(e) => setFilterCardType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Types</option>
                    <option value="trainer">Trainer</option>
                    <option value="v">V</option>
                    <option value="vmax">VMAX</option>
                    <option value="vstar">VSTAR</option>
                    <option value="gx">GX</option>
                    <option value="ex">EX / ex</option>
                  </select>
                </div>
                
                {/* Set Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Filter by Set
                  </label>
                  <select
                    value={filterSet}
                    onChange={(e) => setFilterSet(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Sets</option>
                    {allSets.map(set => (
                      <option key={set} value={set}>
                        {set} - {setNames[set] || 'Unknown Set'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Missing Images Filter */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterMissingImages}
                    onChange={(e) => setFilterMissingImages(e.target.checked)}
                    className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    🖼️ Show only cards with missing images
                  </span>
                </label>
                {filterMissingImages && (
                  <p className="mt-2 text-xs text-gray-600 ml-7">
                    Displaying cards without images. Use "All Cards" view for best results.
                  </p>
                )}
              </div>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by Pokémon name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
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
          pokemon={selectedPokemon}
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
