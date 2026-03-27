import { getPokemonGradient } from '../utils/typeGradients';

const GEN_COLORS = {
  1: '#FF5350',  // Red (Kanto)
  2: '#FFD93D',  // Yellow (Johto)
  3: '#6BCF7F',  // Green (Hoenn)
  4: '#5DADE2',  // Blue (Sinnoh)
  5: '#AF7AC5',  // Purple (Unova)
  6: '#EC7063',  // Pink (Kalos)
  7: '#F39C12',  // Orange (Alola)
  8: '#48C9B0',  // Cyan (Galar)
  9: '#E59866',  // Peach (Paldea)
};

export default function PokemonCard({ pokemon, onClick, coordAppearances = {} }) {
  // Filter to only PRIMARY cards WITH valid set codes
  const primaryCardsWithSets = pokemon.cards.filter(c => 
    c.isPrimary !== false && c.setCode && c.setCode.trim()
  );
  
  // Also check for secondary cards (appears in other cards)
  const secondaryCards = pokemon.cards.filter(c => c.isSecondary || c.isPrimary === false);
  
  const totalPrimaryCards = primaryCardsWithSets.length;
  const ownedPrimaryCards = primaryCardsWithSets.filter(c => c.ownedLang).length;
  const completionPercent = totalPrimaryCards > 0 ? (ownedPrimaryCards / totalPrimaryCards) * 100 : 0;
  
  // Only grey out if NO cards at all (not even secondary)
  const noCardsAtAll = pokemon.cards.length === 0;
  
  // Featured only = has secondary but no primary
  const onlyFeatured = totalPrimaryCards === 0 && secondaryCards.length > 0;
  
  // Check if Pokemon appears in other cards
  const hasSecondaryCards = secondaryCards.length > 0;
  
  const coordData = coordAppearances[(pokemon.name || '').toLowerCase()];
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
  
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-2xl ${
        noCardsAtAll ? 'opacity-50' : ''
      } ${completionPercent === 100 && totalPrimaryCards > 0 ? 'ring-4 ring-offset-2 ring-offset-transparent' : ownedPrimaryCards > 0 ? 'ring-2 ring-emerald-300 ring-offset-1' : ''}`}
      style={{
        background: noCardsAtAll ? '#9CA3AF' : 
                   onlyFeatured ? 'linear-gradient(135deg, #A78BFA 0%, #C4B5FD 100%)' : 
                   getPokemonGradient(pokemon.id),
        aspectRatio: '0.82',
        ...(completionPercent === 100 && totalPrimaryCards > 0 ? { boxShadow: '0 0 0 4px #F59E0B, 0 0 16px 4px rgba(245,158,11,0.5)' } : {})
      }}
    >
      {/* Dex Number */}
      <div className="absolute top-3 left-3 text-white/90 font-semibold text-sm">
        #{String(pokemon.id).padStart(4, '0')}
      </div>
      
      {/* Generation Badge */}
      <div 
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg"
        style={{ backgroundColor: GEN_COLORS[pokemon.gen] || '#888' }}
      >
        {pokemon.gen}
      </div>
      
      {/* Featured Badge removed - count shown in bottom bar instead */}
      
      {/* Pokemon Sprite */}
      <div className="absolute inset-0 flex items-center justify-center pt-4 pb-20">
        <img 
          src={spriteUrl} 
          alt={pokemon.name}
          className={`w-32 h-32 object-contain image-pixelated ${noCardsAtAll ? 'grayscale opacity-60' : ''}`}
          style={{filter: noCardsAtAll ? 'grayscale(1) opacity(0.6)' : 'drop-shadow(0 6px 10px rgba(0,0,0,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))'}}
        />
      </div>
      
      {/* Bottom Section with Name and Progress */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm">
        {/* Pokemon Name */}
        <div className="py-2 text-center">
          <span className="text-white font-semibold text-base tracking-wide">
            {pokemon.name}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="px-3 pb-2">
          {!noCardsAtAll ? (
            <>
              <div className="relative w-full h-4 bg-black/30 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${
                    onlyFeatured ? 'bg-purple-400' : completionPercent === 100 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  }`}
                  style={{ width: `${Math.max(completionPercent, 0)}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold drop-shadow">
                    {completionPercent === 100 ? `★ ${ownedPrimaryCards}/${totalPrimaryCards}` : `${ownedPrimaryCards}/${totalPrimaryCards}`}
                    {hasSecondaryCards && <span className="text-purple-200 ml-1">+{secondaryCards.length}r</span>}
                    {coordData && <span className="text-yellow-200 ml-1">👁{coordData.appearances}</span>}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="relative w-full h-4 bg-black/30 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white/50 text-[10px]">no cards</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
