Pokémon TCG Full-Art Collection Tracker
A personal web app to track your Pokémon TCG full-art card collection across multiple languages, with pricing, artwork tagging, and a review/conformance system.
Features

Visual Pokédex Grid — Browse all Pokémon with type-accurate gradient backgrounds; adjustable tile sizes (S/M/L)
Multi-language Tracking — Track ownership across 5 languages: EN, JP, CN, TC (Traditional Chinese), and KR, each with distinct colour coding
Live Pricing — Real-time EN card prices via TCGCSV, converted to GBP via frankfurter.app, with 24-hour local caching
Card Detail Modal — Full card info including set, artist, price, language availability, and card artwork
Review & Conformance System — Score cards on objective conformance criteria; blended with personal 1–10 ratings from Tjay and Steph
Pokémon Coord Tagging — Zoom tool for tagging Pokémon positions on card artwork, stored per card
Advanced Filtering & Sorting — Filter by set, language, artist, generation, ownership, exclusives, conformance, favourites, and more
Search with Autocomplete — Find Pokémon by name or Pokédex number instantly
Dark Mode — Full light/dark theme support
Lock/Unlock System — SHA-256 password-protected write access for ownership and review edits
Google Sheets Sync — Card data synced from Google Sheets via Apps Script to GitHub

Tech Stack

React 18 + Vite — Frontend build
Tailwind CSS — Utility-first styling
Lucide React — Icons
TCGCSV — Free, no-auth EN card pricing
frankfurter.app — Live USD→GBP exchange rate
Google Sheets + Apps Script — Data source and sync pipeline
GitHub Pages — Hosting (fannywax-maker.github.io/pokemon-tcg-tracker)

Project Structure
pokemon-tcg-tracker/
├── src/
│   ├── components/
│   │   ├── PokemonCard.jsx       # Grid tile component
│   │   ├── CardTile.jsx          # Individual card in detail view
│   │   ├── DetailModal.jsx       # Pokémon detail modal
│   │   └── LanguagePicker.jsx    # Language selection modal
│   ├── data/
│   │   ├── pokemon_data.json     # Full collection data
│   │   ├── pokemon_coords.json   # Pokémon artwork position tags
│   │   ├── review_data.json      # Card review/conformance scores
│   │   └── set_names.json        # Set metadata by language
│   ├── hooks/
│   │   └── usePrices.js          # Live pricing hook (TCGCSV + GBP)
│   ├── utils/
│   │   └── typeGradients.js      # Pokémon type colour mappings
│   ├── App.jsx                   # Main application component
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles + Tailwind
├── index.html
├── package.json
└── vite.config.js
Data Structure
Pokémon Object
json{
  "id": 1,
  "gen": 1,
  "name": "Bulbasaur",
  "cards": []
}
Card Object
json{
  "id": "1_0",
  "setCode": "MEW",
  "number": "166/165",
  "cardName": "ex",
  "artist": "Yoriyuki Ikegami",
  "availableLangs": ["EN", "JP", "CN", "TC", "KR"],
  "ownedLang": "EN",
  "exclusive": null,
  "nonConforming": false,
  "unobtainable": false,
  "otherPokemon": ["Ivysaur", "Venusaur"]
}
Language Codes
CodeLanguageColourENEnglishBlueJPJapaneseRedCNChinese SimplifiedAmberTCChinese TraditionalTealKRKoreanPurple

TC sets use JP set codes with an F suffix (e.g. xy2F). KR sets use identical JP set codes with no suffix.

Getting Started
bashnpm install
npm run dev
Open http://localhost:5173.
bashnpm run build   # Production build → dist/
Data & Sync
Card data is maintained in Google Sheets and synced to src/data/pokemon_data.json via Google Apps Script. Review scores and coord tags are edited in-app and manually merged into review_data.json and pokemon_coords.json before pushing to GitHub.
Git workflow:
bashgit stash && git pull --rebase && git stash pop
git add src/data/pokemon_data.json src/App.jsx  # only modified files
git commit -m "..."
git push
Notes

Live pricing requires HTTPS (GitHub Pages). crypto.subtle (used for the lock system) also requires a secure context.
The review/conformance system auto-saves on modal navigation or close; JSON output is manually copied into review_data.json.
Card images are hosted in public/card-images/ and loaded with a concurrent request throttle (max 6) to avoid GitHub Pages rate limiting.


For personal use. Pokémon and all related properties are owned by Nintendo / Creatures Inc. / GAME FREAK inc.
