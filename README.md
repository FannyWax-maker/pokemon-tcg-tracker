# Pokémon TCG Full-Art Collection Tracker

A beautiful, modern web application to track your Pokémon Trading Card Game full-art card collection across multiple languages.

## Features

- **Visual Pokédex Grid**: Browse all 1,043 Pokémon with type-accurate gradient backgrounds
- **Detailed Card View**: See all cards for each Pokémon with prices, artists, and set information
- **Language Tracking**: Track ownership across 4 languages (EN, JP, CN, KR) with permanent language locking
- **Progress Tracking**: Visual indicators showing completion status for each Pokémon
- **Search Functionality**: Quickly find Pokémon by name or Pokédex number
- **Exclusive Cards**: Special badges for Japanese and Chinese exclusive cards
- **Responsive Design**: Works beautifully on desktop, tablet, and mobile

## Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icon library

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone or download this project

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
pokemon-tcg-tracker/
├── src/
│   ├── components/
│   │   ├── PokemonCard.jsx      # Grid tile component
│   │   ├── CardTile.jsx         # Individual card in detail view
│   │   ├── DetailModal.jsx      # Pokemon detail modal
│   │   └── LanguagePicker.jsx   # Language selection modal
│   ├── data/
│   │   └── pokemon_data.json    # Full collection data (1,749 cards)
│   ├── utils/
│   │   └── typeGradients.js     # Pokemon type color mappings
│   ├── App.jsx                  # Main application component
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles + Tailwind
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Data Structure

### Pokemon Object
```javascript
{
  id: 1,              // Pokédex number
  gen: 1,             // Generation (1-9)
  name: "Bulbasaur",
  cards: [...]        // Array of cards
}
```

### Card Object
```javascript
{
  id: "1_0",                    // Unique identifier
  setCode: "MEW",               // Set abbreviation
  number: "166/165",            // Card number in set
  cardName: "V",                // Card type (V, VMAX, EX, GX, ex)
  artist: "Yoriyuki Ikegami",  // Card artist
  priceGBP: 35.0,              // Price in GBP
  availableLangs: ["EN", "JP", "CN", "KR"],  // Available languages
  ownedLang: "EN",             // Owned language (null if not owned)
  exclusive: null              // "JP" or "CN" for exclusives
}
```

## Customization

### Adding Your Own Data

Replace `src/data/pokemon_data.json` with your collection data following the structure above.

### Changing Colors

Type gradients are defined in `src/utils/typeGradients.js`. Modify the gradient values to customize colors.

### Styling

All styles use Tailwind CSS. Modify `tailwind.config.js` to customize the theme.

## Features Roadmap

- [ ] Data persistence (localStorage or database)
- [ ] Export collection to CSV/Excel
- [ ] Collection statistics dashboard
- [ ] Price tracking over time
- [ ] Card condition tracking
- [ ] Multiple collection support
- [ ] Dark mode

## License

This project is for personal use. Pokémon and TCG card data are property of their respective owners.

## Acknowledgments

- Pokémon sprites from [PokeAPI](https://pokeapi.co/)
- Card data structure based on official Pokémon TCG sets
- Built with love for Pokémon TCG collectors ❤️
