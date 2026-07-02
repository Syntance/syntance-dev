"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";

export type Theme = "dark" | "light" | "earth" | "auto";

const STORAGE_KEY = "strategy-hub-theme";
const DEFAULT_THEME: Theme = "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Motyw trzymamy w localStorage jako zewnętrznym źródle (external store), czytanym
 * przez `useSyncExternalStore` — dzięki temu nie ustawiamy stanu w efekcie
 * (React 19: `set-state-in-effect`). `storage` łapie zmiany między kartami,
 * a `emitThemeChange` — zmiany w tej samej karcie.
 */
const themeListeners = new Set<() => void>();

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    themeListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readTheme(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_THEME);

  // Zapis do DOM = synchronizacja z systemem zewnętrznym, dozwolona w efekcie.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    themeListeners.forEach((l) => l());
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Inline script umieszczony w <head> — zapobiega flashowi przy pierwszym renderze.
 * Czyta localStorage zanim React się załaduje i ustawia data-theme na <html>.
 */
export function ThemeScript() {
  const script = `
(function(){
  try{
    var t=localStorage.getItem('strategy-hub-theme')||'dark';
    document.documentElement.setAttribute('data-theme',t);
  }catch(e){}
})();
`.trim();

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
