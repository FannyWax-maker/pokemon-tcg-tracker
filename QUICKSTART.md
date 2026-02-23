# 🚀 Quick Start Guide

## Option 1: Run Locally (Recommended)

### Step 1: Install Dependencies
Open a terminal in the `pokemon-tcg-tracker` folder and run:
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Open in Browser
The terminal will show a URL (usually `http://localhost:5173`). Open it in your browser!

---

## Option 2: Build for Production

If you want to deploy this app or run it without a dev server:

```bash
npm run build
```

This creates a `dist/` folder with production-ready files. You can:
- Upload the `dist/` folder to any web hosting service
- Open `dist/index.html` directly in your browser (may have limitations)

---

## Troubleshooting

### "npm: command not found"
You need to install Node.js first:
1. Go to https://nodejs.org/
2. Download and install the LTS version
3. Restart your terminal
4. Try again

### Port already in use
If port 5173 is busy, Vite will automatically try the next available port (5174, 5175, etc.)

### Changes not showing up
1. Make sure the dev server is running (`npm run dev`)
2. Refresh your browser (Ctrl+R or Cmd+R)
3. Check the terminal for errors

---

## What to Do Next

1. **Add your own data**: Replace `src/data/pokemon_data.json` with your collection
2. **Customize colors**: Edit `src/utils/typeGradients.js`
3. **Modify styles**: Update Tailwind classes in component files
4. **Add features**: Check `README.md` for the roadmap!

---

## Need Help?

- **Vite docs**: https://vitejs.dev/
- **React docs**: https://react.dev/
- **Tailwind docs**: https://tailwindcss.com/

Enjoy tracking your collection! 🎴✨
