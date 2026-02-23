import { useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import CardTile from './CardTile';
import LanguagePicker from './LanguagePicker';

const LANGUAGES = {
  EN: 'English',
  JP: 'Japanese', 
  CN: 'Chinese',
  KR: 'Korean'
};

export default function DetailModal({ pokemon, onClose, onUpdateCard, onToggleNonConforming, onNavigateToPokemon, darkMode }) {
  const [languagePickerCard, setLanguagePickerCard] = useState(null);
  
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
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40 p-4 overflow-y-auto"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">#{String(pokemon.id).padStart(4, '0')} · Gen {pokemon.gen}</span>
                  <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    ownedCards === totalCards && totalCards > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : ownedCards > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {ownedCards === totalCards && totalCards > 0 ? '✓ Complete' : `${ownedCards} / ${totalCards}`}
                  </span>
                  {secondaryCards.length > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      ref {ownedSecondary}/{secondaryCards.length}
                    </span>
                  )}
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{pokemon.name}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${ownedCards === totalCards && totalCards > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${totalCards > 0 ? (ownedCards / totalCards) * 100 : 0}%` }}
            />
          </div>
          
          {/* Cards Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pokemon.cards.map(card => (
                <CardTile
                  key={card.id}
                  card={card}
                  pokemonName={pokemon.name}
                  onOwnershipClick={handleOwnershipClick}
                  onToggleNonConforming={(pokemonId, cardId, current) => onToggleNonConforming && onToggleNonConforming(pokemon.id, cardId, current)}
                  onNavigateToPokemon={onNavigateToPokemon}
                />
              ))}
            </div>
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
