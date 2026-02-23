import React from 'react';
import { Edit2, Save, X } from 'lucide-react';

export default function CardTile({ card, pokemonName, onOwnershipClick, onUpdateCard }) {
  const isOwned = !!card.ownedLang;
  const hasOtherPokemon = card.otherPokemon && card.otherPokemon.length > 0;
  const isSecondary = card.isSecondary || !card.isPrimary;
  const [showZoom, setShowZoom] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedCard, setEditedCard] = React.useState({});
  
  const handleStartEdit = (e) => {
    e.stopPropagation();
    setEditedCard({
      setCode: card.setCode || '',
      number: card.number || '',
      cardName: card.cardName || '',
      artist: card.artist || '',
      priceGBP: card.priceGBP || 0,
      exclusive: card.exclusive || ''
    });
    setIsEditing(true);
  };
  
  const handleSaveEdit = (e) => {
    e.stopPropagation();
    if (onUpdateCard) {
      onUpdateCard(card.pokemonId, card.id, editedCard);
    }
    setIsEditing(false);
  };
  
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setIsEditing(false);
  };
  
  // Generate possible image filenames
  const generateImagePaths = () => {
    const displayPokemon = isSecondary && card.primaryPokemon ? card.primaryPokemon : pokemonName;
    const setCode = (card.setCode || '').toLowerCase();
    const pokemon = displayPokemon.toLowerCase().replace(/\s+/g, '_').replace(/[.']/g, '');
    const number = (card.number || '').toLowerCase();
    const numberWithDash = number.replace(/\//g, '-');
    const numberOnly = number.split('/')[0];
    
    // Check if number already contains the set code
    const numberAlreadyHasSet = numberOnly.toLowerCase().startsWith(setCode);
    
    const paths = [];
    
    if (numberAlreadyHasSet) {
      // Number like "swsh102" - just use dot prefix
      paths.push(`.${numberWithDash}.${pokemon}_`);
      paths.push(`.${numberOnly}.${pokemon}_`);
      paths.push(`.${numberWithDash}.${pokemon}`);
      paths.push(`.${numberOnly}.${pokemon}`);
    } else {
      // Number like "201/173" - use set code prefix
      paths.push(`${setCode}.${numberWithDash}.${pokemon}_`);
      paths.push(`${setCode}.${numberOnly}.${pokemon}_`);
      paths.push(`${setCode}.${numberWithDash}.${pokemon}`);
      paths.push(`${setCode}.${numberOnly}.${pokemon}`);
      // Also try dot prefix format
      paths.push(`.${numberWithDash}.${pokemon}_`);
      paths.push(`.${numberOnly}.${pokemon}_`);
    }
    
    // Legacy format
    paths.push(`${setCode.toUpperCase()}_${numberOnly}_R_EN_LG`);
    
    return [...new Set(paths)];
  };
  
  const imagePaths = generateImagePaths();
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageSrc, setImageSrc] = React.useState(null);
  const [shouldHide, setShouldHide] = React.useState(false);
  
  React.useEffect(() => {
    let mounted = true;
    
    const tryLoadImage = async () => {
      for (const path of imagePaths) {
        try {
          const pngPath = `/card-images/${path}.png`;
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = pngPath;
          });
          if (mounted) {
            setImageSrc(pngPath);
            setImageLoaded(true);
            if (card._filterMissingImages) {
              setShouldHide(true);
            }
            return;
          }
        } catch (e) {
          try {
            const jpgPath = `/card-images/${path}.jpg`;
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = jpgPath;
            });
            if (mounted) {
              setImageSrc(jpgPath);
              setImageLoaded(true);
              if (card._filterMissingImages) {
                setShouldHide(true);
              }
              return;
            }
          } catch (e2) {}
        }
      }
    };
    
    tryLoadImage();
    return () => { mounted = false; };
  }, []);
  
  if (shouldHide) {
    return null;
  }
  
  return (
    <>
      <div className={`flex flex-col bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 ${
        isSecondary ? 'opacity-75 ring-2 ring-purple-300' : ''
      }`}>
        {/* Card Image */}
        <div 
          className="h-64 relative overflow-hidden flex items-center justify-center cursor-pointer"
          style={{
            background: isOwned 
              ? 'linear-gradient(135deg, #D4AF37 0%, #F4E5B7 100%)'
              : 'linear-gradient(135deg, #E5E5E5 0%, #CCCCCC 100%)'
          }}
          onClick={() => imageLoaded && setShowZoom(true)}
        >
          {imageLoaded && imageSrc ? (
            <img 
              src={imageSrc}
              alt={`${pokemonName} ${card.cardName}`}
              className="h-full w-auto object-contain"
              style={{ maxWidth: '100%' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center h-full">
              <div className="text-5xl mb-2 opacity-20">🃏</div>
              <div className="text-white/90 font-bold text-xs mb-1">{card.cardName}</div>
              <div className="text-white/60 text-xs mb-3">{card.setCode} {card.number}</div>
              <div className="px-3 py-1 bg-red-600 rounded text-white text-xs font-bold mb-3">
                IMAGE MISSING
              </div>
              <div className="w-full">
                <div className="text-white/50 text-[9px] mb-1">Expected filename:</div>
                <div 
                  className="bg-black/40 px-2 py-1.5 rounded text-white font-mono text-[10px] leading-tight break-all select-all cursor-text hover:bg-black/60 transition-colors mb-2"
                  title="Click to select, then Ctrl+C to copy"
                >
                  {imagePaths[0]}.png
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const filename = imagePaths[0] + '.png';
                    navigator.clipboard.writeText(filename).then(() => {
                      alert('Copied: ' + filename);
                    });
                  }}
                  className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                >
                  ðŸ“‹ Copy Filename
                </button>
              </div>
            </div>
          )}
          
          {/* Edit Button */}
          {!isSecondary && (
            <button
              onClick={handleStartEdit}
              className="absolute top-2 left-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg z-20 transition-colors"
              title="Edit card details"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
          
          {/* Exclusive Badge */}
          {card.exclusive && (
            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold shadow-lg z-10 text-white ${
              card.exclusive === 'JP' ? 'bg-red-500' : card.exclusive === 'CN' ? 'bg-yellow-500' : 'bg-purple-500'
            }`}>
              {card.exclusive === 'JP' ? '🇯🇵 JP' : card.exclusive === 'CN' ? '🇨🇳 CN' : card.exclusive}
            </div>
          )}
        </div>
        
        {/* Ownership Status */}
        <div 
          onClick={() => !isSecondary && !isOwned && onOwnershipClick(card)}
          className={`py-3 text-center font-bold text-sm ${
            isSecondary
              ? 'bg-purple-100 text-purple-700 cursor-not-allowed'
              : isOwned 
                ? 'bg-emerald-500 text-white cursor-default' 
                : 'bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200'
          }`}
        >
          {isSecondary ? 'Referenced Card' : isOwned ? `âœ“ ${card.ownedLang}` : '+ Add'}
        </div>
        
        {/* Card Details */}
        <div className="p-4 space-y-2 text-sm">
          <div>
            <div className="font-bold text-lg text-gray-900">{pokemonName}</div>
            <div className="text-sm text-gray-600">
              {/* Remove exclusive markers from display */}
              {card.cardName
                .replace(', Japanese Exclusive', '')
                .replace('Japanese Exclusive', '')
                .replace(', Chinese Exclusive', '')
                .replace('Chinese Exclusive', '')
                .trim() || 'Full Art'}
            </div>
            {hasOtherPokemon && (
              <div className="text-xs text-blue-600 mt-1 font-medium">
                with {card.otherPokemon.join(', ')}
              </div>
            )}
            {isSecondary && card.primaryPokemon && (
              <div className="text-xs text-purple-600 mt-1 font-medium">
                Primary: {card.primaryPokemon}
              </div>
            )}
          </div>
          <div className="font-mono text-gray-600 text-xs">{card.setCode} {card.number}</div>
          <div className="text-2xl font-bold text-emerald-600">Â£{card.priceGBP.toFixed(2)}</div>
          <div className="text-gray-500 text-xs">
            <span className="font-semibold">Artist:</span> {card.artist}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCancelEdit}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Card</h3>
              <button
                onClick={handleCancelEdit}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Set Code
                </label>
                <input
                  type="text"
                  value={editedCard.setCode}
                  onChange={(e) => setEditedCard({...editedCard, setCode: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MEG, SCR, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Number
                </label>
                <input
                  type="text"
                  value={editedCard.number}
                  onChange={(e) => setEditedCard({...editedCard, number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="151/132"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Card Name
                </label>
                <input
                  type="text"
                  value={editedCard.cardName}
                  onChange={(e) => setEditedCard({...editedCard, cardName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="V, VMAX, Full Art, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Artist
                </label>
                <input
                  type="text"
                  value={editedCard.artist}
                  onChange={(e) => setEditedCard({...editedCard, artist: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Price (GBP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editedCard.priceGBP}
                  onChange={(e) => setEditedCard({...editedCard, priceGBP: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Exclusive
                </label>
                <select
                  value={editedCard.exclusive}
                  onChange={(e) => setEditedCard({...editedCard, exclusive: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  <option value="JP">JP Exclusive</option>
                  <option value="CN">CN Exclusive</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Modal */}
      {showZoom && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowZoom(false)}
        >
          <div className="max-w-2xl max-h-[90vh] relative">
            <img 
              src={imageSrc}
              alt={`${pokemonName} ${card.cardName}`}
              className="w-full h-full object-contain"
            />
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
