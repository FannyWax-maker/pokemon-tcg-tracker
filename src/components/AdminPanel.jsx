import React, { useState } from 'react';
import { X, Plus, Save, Trash2, Edit } from 'lucide-react';

export default function AdminPanel({ pokemonData, onSaveData, onClose }) {
  const [activeTab, setActiveTab] = useState('add-card'); // 'add-card', 'add-set', 'edit-cards'
  const [newCard, setNewCard] = useState({
    pokemon: '',
    cardName: 'Full Art',
    setCode: '',
    number: '',
    price: '',
    artist: '',
    exclusive: '',
    otherPokemon: ''
  });
  const [newSet, setNewSet] = useState({
    code: '',
    name: ''
  });
  const [searchPokemon, setSearchPokemon] = useState('');
  const [editingCard, setEditingCard] = useState(null);
  
  // Get unique Pokemon list
  const allPokemon = pokemonData.map(p => p.name).sort();
  
  // Get all sets from cards
  const allSets = [...new Set(pokemonData.flatMap(p => p.cards.map(c => c.setCode)))].filter(Boolean).sort();
  
  const handleAddCard = () => {
    if (!newCard.pokemon || !newCard.setCode || !newCard.number) {
      alert('Please fill in Pokemon, Set Code, and Number');
      return;
    }
    
    // Find the Pokemon
    const pokemon = pokemonData.find(p => p.name === newCard.pokemon);
    if (!pokemon) {
      alert('Pokemon not found');
      return;
    }
    
    // Create new card
    const card = {
      id: `${pokemon.id}_${pokemon.cards.length}`,
      cardName: newCard.cardName || 'Full Art',
      setCode: newCard.setCode.toUpperCase(),
      number: newCard.number,
      priceGBP: parseFloat(newCard.price) || 0,
      artist: newCard.artist || 'Unknown',
      availableLangs: ['EN'],
      ownedLang: null,
      isPrimary: true,
      isSecondary: false
    };
    
    if (newCard.exclusive) {
      card.exclusive = newCard.exclusive;
    }
    
    if (newCard.otherPokemon) {
      card.otherPokemon = newCard.otherPokemon.split(',').map(p => p.trim());
    }
    
    // Add card to Pokemon
    const updatedData = pokemonData.map(p => {
      if (p.name === newCard.pokemon) {
        return {
          ...p,
          cards: [...p.cards, card]
        };
      }
      return p;
    });
    
    onSaveData(updatedData);
    
    // Reset form
    setNewCard({
      pokemon: '',
      cardName: 'Full Art',
      setCode: '',
      number: '',
      price: '',
      artist: '',
      exclusive: '',
      otherPokemon: ''
    });
    
    alert('✅ Card added!\n\nChanges saved to browser. When done editing, click "Download All Changes" to get the JSON file.');
  };
  
  const handleDeleteCard = (pokemonId, cardId) => {
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    const updatedData = pokemonData.map(p => {
      if (p.id === pokemonId) {
        return {
          ...p,
          cards: p.cards.filter(c => c.id !== cardId)
        };
      }
      return p;
    });
    
    onSaveData(updatedData);
    alert('✅ Card deleted!\n\nChange saved to browser. Click "Download All Changes" when done editing.');
  };
  
  const handleUpdateCard = (pokemonId, cardId, updatedCard) => {
    const updatedData = pokemonData.map(p => {
      if (p.id === pokemonId) {
        return {
          ...p,
          cards: p.cards.map(c => c.id === cardId ? { ...c, ...updatedCard } : c)
        };
      }
      return p;
    });
    
    onSaveData(updatedData);
    setEditingCard(null);
    alert('Card updated!');
  };
  
  const filteredPokemon = searchPokemon
    ? pokemonData.filter(p => p.name.toLowerCase().includes(searchPokemon.toLowerCase()))
    : pokemonData.slice(0, 20); // Show first 20 by default
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-purple-500 text-white">
          <div>
            <h2 className="text-2xl font-bold">Admin Panel</h2>
            <p className="text-sm opacity-90">Manage cards and sets</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('add-card')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'add-card'
                ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Card
          </button>
          <button
            onClick={() => setActiveTab('edit-cards')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'edit-cards'
                ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Edit className="w-4 h-4 inline mr-2" />
            Edit Cards
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'add-card' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Add New Card</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Pokemon Select */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pokemon *
                  </label>
                  <select
                    value={newCard.pokemon}
                    onChange={(e) => setNewCard({ ...newCard, pokemon: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Pokemon...</option>
                    {allPokemon.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Card Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Card Name
                  </label>
                  <input
                    type="text"
                    value={newCard.cardName}
                    onChange={(e) => setNewCard({ ...newCard, cardName: e.target.value })}
                    placeholder="Full Art, V, VMAX, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                {/* Set Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Set Code *
                  </label>
                  <input
                    type="text"
                    value={newCard.setCode}
                    onChange={(e) => setNewCard({ ...newCard, setCode: e.target.value.toUpperCase() })}
                    placeholder="MEG, MEW, SCR, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Existing: {allSets.join(', ')}</p>
                </div>
                
                {/* Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Card Number *
                  </label>
                  <input
                    type="text"
                    value={newCard.number}
                    onChange={(e) => setNewCard({ ...newCard, number: e.target.value })}
                    placeholder="151/132, TG005/30, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                {/* Price */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price (GBP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCard.price}
                    onChange={(e) => setNewCard({ ...newCard, price: e.target.value })}
                    placeholder="19.99"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                {/* Artist */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Artist
                  </label>
                  <input
                    type="text"
                    value={newCard.artist}
                    onChange={(e) => setNewCard({ ...newCard, artist: e.target.value })}
                    placeholder="Artist name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                {/* Exclusive */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Exclusive
                  </label>
                  <select
                    value={newCard.exclusive}
                    onChange={(e) => setNewCard({ ...newCard, exclusive: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">None</option>
                    <option value="JP">JP Exclusive</option>
                    <option value="CN">CN Exclusive</option>
                  </select>
                </div>
                
                {/* Other Pokemon */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Other Pokemon (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newCard.otherPokemon}
                    onChange={(e) => setNewCard({ ...newCard, otherPokemon: e.target.value })}
                    placeholder="Pikachu, Eevee, Charizard"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">For multi-Pokemon cards</p>
                </div>
              </div>
              
              <button
                onClick={handleAddCard}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Card
              </button>
            </div>
          )}
          
          {activeTab === 'edit-cards' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Pokemon
                </label>
                <input
                  type="text"
                  value={searchPokemon}
                  onChange={(e) => setSearchPokemon(e.target.value)}
                  placeholder="Type Pokemon name..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredPokemon.map(pokemon => (
                  <div key={pokemon.id} className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-bold text-lg mb-2">
                      #{pokemon.id.toString().padStart(4, '0')} {pokemon.name}
                    </h4>
                    <div className="space-y-2">
                      {pokemon.cards.filter(c => c.isPrimary !== false && !c.isSecondary).map(card => (
                        <div key={card.id} className="bg-white p-3 rounded border flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">{card.cardName}</div>
                            <div className="text-sm text-gray-600">
                              {card.setCode} {card.number} • £{card.priceGBP} • {card.artist}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteCard(pokemon.id, card.id)}
                            className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {pokemon.cards.filter(c => c.isPrimary !== false && !c.isSecondary).length === 0 && (
                        <p className="text-sm text-gray-500 italic">No cards</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={() => {
              const dataStr = JSON.stringify(pokemonData, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'pokemon_data.json';
              link.click();
              URL.revokeObjectURL(url);
              alert('📥 Downloaded pokemon_data.json!\n\nReplace the file in src/data/ to make changes permanent.');
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Download All Changes
          </button>
          <p className="text-center text-xs text-gray-600 mt-2">
            Changes save to browser instantly. Download to make permanent.
          </p>
        </div>
      </div>
    </div>
  );
}
