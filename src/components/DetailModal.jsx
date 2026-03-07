import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import CardTile from './CardTile';
import LanguagePicker from './LanguagePicker';

const LANGUAGES = {
  EN: 'English',
  JP: 'Japanese', 
  CN: 'Chinese',
  KR: 'Korean'
};

export default function DetailModal({ pokemon, onClose, onUpdateCard, onToggleNonConforming, onToggleFavorite, onToggleUnobtainable, onNavigateToPokemon, onNavigatePrev, onNavigateNext, hasPrev, hasNext, darkMode }) {
  const [languagePickerCard, setLanguagePickerCard] = useState(null);
  const scrollRef = useRef(null);
  
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev) onNavigatePrev && onNavigatePrev();
      if (e.key === 'ArrowRight' && hasNext) onNavigateNext && onNavigateNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPrev, hasNext, onNavigatePrev, onNavigateNext, onClose]);
  
  const primaryCards = pokemon.cards.filter(c => !c.isSecondary && c.isPrimary !== false);
  // Dedupe secondary cards by id (data sometimes has duplicates)
  const seenIds = new Set();
  const secondaryCards = pokemon.cards.filter(c => {
    if (!c.isSecondary && c.isPrimary !== false) return false;
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });
  const totalCards = primaryCards.length;
  const ownedCards = primaryCards.filter(c => c.ownedLang).length;
  const ownedSecondary = secondaryCards.filter(c => c.ownedLang).length;
  
  // Count by language
  const langCounts = {};
  Object.keys(LANGUAGES).forEach(lang => {
    const owned = primaryCards.filter(c => c.ownedLang === lang).length;
    const total = primaryCards.filter(c => (c.availableLangs || []).includes(lang)).length;
    langCounts[lang] = { owned, total };
  });
  
  const handleOwnershipClick = (card) => {
    if (card._directLang) {
      // Direct lang button click - confirm immediately
      onUpdateCard(pokemon.id, card.id, card._directLang);
    } else if (card._action === 'unmark') {
      onUpdateCard(pokemon.id, card.id, null);
    } else {
      // Open language picker
      setLanguagePickerCard(card);
    }
  };

  const handleLanguageConfirm = (language) => {
    onUpdateCard(pokemon.id, languagePickerCard.id, language);
    setLanguagePickerCard(null);
  };
  
  // Handle click on backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 flex items-center justify-center"
        style={{padding: '1.5rem'}}
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-3xl shadow-2xl w-full mx-auto flex flex-col" style={{maxWidth: '80rem', height: '88vh'}}>
          {/* Header */}
          <div className="sticky top-0 z-10 rounded-t-3xl overflow-hidden">
            {/* Gradient banner */}
            <div style={{
              background: ownedCards === totalCards && totalCards > 0
                ? 'linear-gradient(135deg, #065f46 0%, #059669 50%, #34d399 100%)'
                : ownedCards > 0
                  ? 'linear-gradient(135deg, #92400e 0%, #d97706 50%, #fbbf24 100%)'
                  : 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #6366f1 100%)',
              padding: '1px'
            }}>
              <div style={{background: 'rgba(255,255,255,0.97)', borderRadius: '0.75rem 0.75rem 0 0'}}>
                <div className="px-6 py-4 flex items-center justify-between">
                  {/* Left: nav + info */}
                  <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" title="Close">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={onNavigatePrev}
                        disabled={!hasPrev}
                        className={`px-2.5 py-1.5 text-base font-bold transition-colors ${hasPrev ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Previous (←)"
                      >‹</button>
                      <span className="text-gray-300 text-sm">|</span>
                      <button
                        onClick={onNavigateNext}
                        disabled={!hasNext}
                        className={`px-2.5 py-1.5 text-base font-bold transition-colors ${hasNext ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Next (→)"
                      >›</button>
                    </div>
                    <div className="ml-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400 tracking-widest">#{String(pokemon.id).padStart(4, '0')}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">Gen {pokemon.gen}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          ownedCards === totalCards && totalCards > 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : ownedCards > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {ownedCards === totalCards && totalCards > 0 ? '★ Complete' : `${ownedCards} / ${totalCards}`}
                        </span>
                        {secondaryCards.length > 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            ref {ownedSecondary}/{secondaryCards.length}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">{pokemon.name}</h2>
                    </div>
                  </div>
                  {/* Right: progress + close */}
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-400 mb-1">Collection progress</div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${ownedCards === totalCards && totalCards > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${totalCards > 0 ? (ownedCards / totalCards) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500">
                          {totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Coloured progress strip */}
            <div className="w-full h-1" style={{background: '#e5e7eb'}}>
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${totalCards > 0 ? (ownedCards / totalCards) * 100 : 0}%`,
                  background: ownedCards === totalCards && totalCards > 0
                    ? 'linear-gradient(90deg, #059669, #34d399)'
                    : 'linear-gradient(90deg, #d97706, #fbbf24)'
                }}
              />
            </div>
          </div>
          
          {/* Cards Grid - scrollable independently so header stays fixed */}
          <div ref={scrollRef} className="p-6 overflow-y-auto flex-1">
            {(() => {
              const hasRealCards = primaryCards.some(c => c.setCode || c.jpSetCode || c.cnSetCode);
              return !hasRealCards;
            })() ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div style={{fontSize: '4rem', marginBottom: '1rem', filter: 'grayscale(1) opacity(0.4)'}}>🃏</div>
                <h3 className="text-xl font-bold text-gray-400 mb-2">No cards released yet</h3>
                <p className="text-sm text-gray-400 max-w-xs">This Pokémon hasn't appeared on any TCG cards in the tracked sets.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pokemon.cards.map(card => (
                  <CardTile
                    key={card.id}
                    card={card}
                    pokemonName={pokemon.name}
                    onOwnershipClick={handleOwnershipClick}
                    onToggleNonConforming={(pokemonId, cardId, current) => onToggleNonConforming && onToggleNonConforming(pokemon.id, cardId, current)}
                    onToggleFavorite={onToggleFavorite}
                    onToggleUnobtainable={onToggleUnobtainable}
                    onNavigateToPokemon={onNavigateToPokemon}
                    showOwnershipButtons={true}
                  scrollRoot={scrollRef.current}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {languagePickerCard && (
        <LanguagePicker
          card={languagePickerCard}
          onConfirm={handleLanguageConfirm}
          onCancel={() => setLanguagePickerCard(null)}
        />
      )}
    </>
  );
}
