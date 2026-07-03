import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const KEY = 'yotori-theme';

function readTheme() {
  if (typeof document === 'undefined') return 'light';
  // La préférence STOCKÉE prime sur l'attribut DOM : l'attribut peut être un
  // état transitoire (ancienne landing qui forçait data-theme="dark" — le
  // lire ici puis le réécrire dans localStorage transformait ce forçage en
  // choix permanent de l'utilisateur, qui se retrouvait en dark sans jamais
  // l'avoir demandé).
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  // Défaut = clair (charte « Forêt »). On NE suit PAS la préférence
  // système : un téléphone en mode sombre tombait sur l'ancien thème dark
  // (non aligné sur la charte) → rendu "immonde". Le dark reste dispo via le
  // toggle pour qui le choisit explicitement.
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);
  return [theme, setTheme];
}

export function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className={`ds-icon-btn ${className}`}
      onClick={() => setTheme(next)}
      title={`Passer en mode ${next === 'dark' ? 'sombre' : 'clair'}`}
      aria-label="Basculer le thème"
    >
      {theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}
    </button>
  );
}
