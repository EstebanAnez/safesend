'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ColorScheme } from '@coinbase/cds-common';
import { ThemeProvider } from '@coinbase/cds-web';
import { PortalProvider } from '@coinbase/cds-web/overlays';
import { MediaQueryProvider } from '@coinbase/cds-web/system';
import { defaultTheme } from '@coinbase/cds-web/themes/defaultTheme';
import { MotionConfig } from 'framer-motion';

interface ColorSchemeContextValue {
  colorScheme: ColorScheme;
  toggleColorScheme: () => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function useColorScheme(): ColorSchemeContextValue {
  const value = useContext(ColorSchemeContext);
  if (!value) throw new Error('useColorScheme must be used inside <AppProviders>');
  return value;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');

  // Follow the OS preference on first load; the user can override with the toggle.
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) setColorScheme('dark');
  }, []);

  // No icon renders on first paint (D20), so the 275 KB icon font is not on the critical path.
  // Fetch it once the page is idle, so banner icons are ready by the time a decision shows.
  useEffect(() => {
    const warm = () => void document.fonts.load('16px CoinbaseIcons').catch(() => undefined);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 1500);
    return () => clearTimeout(id);
  }, []);

  const toggleColorScheme = useCallback(
    () => setColorScheme((s) => (s === 'light' ? 'dark' : 'light')),
    [],
  );
  const value = useMemo(
    () => ({ colorScheme, toggleColorScheme }),
    [colorScheme, toggleColorScheme],
  );

  return (
    // reducedMotion="user": CDS animations (framer-motion) follow prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <MediaQueryProvider>
        <ThemeProvider theme={defaultTheme} activeColorScheme={colorScheme}>
          <PortalProvider>
            <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>
          </PortalProvider>
        </ThemeProvider>
      </MediaQueryProvider>
    </MotionConfig>
  );
}
