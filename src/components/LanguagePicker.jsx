const LANG_CONFIG = {
  EN: { label: 'English', flag: '🇬🇧', color: 'bg-blue-500' },
  JP: { label: 'Japanese', flag: '🇯🇵', color: 'bg-red-500' },
  CN: { label: 'Chinese', flag: '🇨🇳', color: 'bg-yellow-500' },
  KR: { label: 'Korean', flag: '🇰🇷', color: 'bg-indigo-500' },
};

export default function LanguagePicker({ card, onConfirm, onCancel }) {
  const isOwned = !!card.ownedLang;

  // Which langs to show: availableLangs + KR (unless JP or CN exclusive)
  const isJpExclusive = card.exclusive === 'JP';
  const isCnExclusive = card.exclusive === 'CN';
  const showKR = !isJpExclusive && !isCnExclusive;

  const langs = [
    ...( card.availableLangs || []),
    ...(showKR && !(card.availableLangs || []).includes('KR') ? ['KR'] : []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const handleSingleClick = (lang) => {
    // If already selected (second click = double click equivalent), confirm
    // But we use explicit double-click for that. Single click just highlights.
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {isOwned ? `Owned as ${card.ownedLang}` : card.cardName || 'Full Art'}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{card.setCode} {card.number} · Double-click to confirm</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {langs.map(lang => {
            const cfg = LANG_CONFIG[lang] || { label: lang, flag: '', color: 'bg-gray-500' };
            const isCurrentLang = card.ownedLang === lang;
            return (
              <button
                key={lang}
                onDoubleClick={() => onConfirm(lang)}
                onClick={(e) => e.currentTarget.focus()}
                className={`py-4 px-3 rounded-xl font-semibold transition-all duration-150 border-2 text-center
                  focus:outline-none focus:ring-4 focus:ring-offset-1
                  ${isCurrentLang
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 focus:ring-emerald-300'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400 hover:bg-gray-100 focus:ring-gray-300'
                  }`}
              >
                <div className="text-2xl mb-1">{cfg.flag}</div>
                <div className="text-sm font-bold">{lang}</div>
                <div className="text-xs opacity-75">{cfg.label}</div>
                {isCurrentLang && <div className="text-xs text-emerald-600 font-bold mt-1">✓ Current</div>}
              </button>
            );
          })}
        </div>

        {/* Unmark option if currently owned */}
        {isOwned && (
          <button
            onDoubleClick={() => onConfirm(null)}
            onClick={(e) => e.currentTarget.focus()}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 hover:border-red-400 transition-colors focus:outline-none focus:ring-4 focus:ring-red-200"
          >
            🗑 Double-click to unmark as owned
          </button>
        )}

        <button
          onClick={onCancel}
          className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
