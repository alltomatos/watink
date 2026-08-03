import {
  appleLight,
  appleDark,
  whatsappLight,
  whatsappDark,
  googleLight,
  googleDark,
  saasLight,
  saasDark,
} from './tokens/semantic';
import { componentTokens } from './tokens/components';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark';
export type AppTheme = 'apple' | 'whatsapp' | 'saas' | 'google';
type TokenMap = Record<string, string>;

export interface BrandOverrides {
  primary?: string;
  primaryHover?: string;
  sidebarBg?: string;
}

export interface ApplyThemeOptions {
  /** Dark mode toggle */
  mode?: ThemeMode;
  /** Visual family */
  appTheme?: AppTheme;
  /** Runtime brand overrides (legacy white-label compat) */
  brand?: BrandOverrides;
}

interface ThemePreset {
  light: TokenMap;
  dark: TokenMap;
}

// ──────────────────────────────────────────────
// Theme preset registry
// ──────────────────────────────────────────────
const presets: Record<AppTheme, ThemePreset> = {
  apple:     { light: appleLight,    dark: appleDark },
  google:    { light: googleLight,   dark: googleDark },
  whatsapp:  { light: whatsappLight, dark: whatsappDark },
  saas:      { light: saasLight,     dark: saasDark },
};

const resolvePreset = (appTheme: AppTheme = 'apple', mode: ThemeMode = 'light'): TokenMap => {
  const family = presets[appTheme] || presets.apple;
  return family[mode] || family.light;
};

// ──────────────────────────────────────────────
// CSS Variable injection
// ──────────────────────────────────────────────
const hexToHslRaw = (hex: string): string => {
  if (typeof hex !== 'string') return hex;
  const match = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return hex;

  let color = match[1];
  if (color.length === 3) {
    color = color.split('').map(char => char + char).join('');
  }

  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const setCssVars = (tokens: TokenMap): void => {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, hexToHslRaw(value));
  });
};

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
/**
 * Apply design tokens to the document root.
 */
export const applyThemeTokens = ({
  mode = 'light',
  appTheme = 'apple',
  brand = {},
}: ApplyThemeOptions = {}): void => {
  // 1. Semantic tokens from preset
  const semanticTokens = resolvePreset(appTheme, mode);
  setCssVars(semanticTokens);

  // 2. Component tokens (always the same — they reference semantic vars)
  setCssVars(componentTokens);

  // 3. Brand overrides (runtime white-label, takes precedence)
  if (brand.primary) {
    document.documentElement.style.setProperty('--action-primary', hexToHslRaw(brand.primary));
  }
  if (brand.primaryHover) {
    document.documentElement.style.setProperty('--action-primary-hover', hexToHslRaw(brand.primaryHover));
  }
  if (brand.sidebarBg) {
    document.documentElement.style.setProperty('--bg-sidebar', hexToHslRaw(brand.sidebarBg));
  }

  // 4. Data attributes for CSS selectors
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.appTheme = appTheme;

  // 5. `.dark` class so Tailwind `dark:` variants (which key off a class,
  //    not `data-theme`) also react to theme changes.
  document.documentElement.classList.toggle('dark', mode === 'dark');
};

export default applyThemeTokens;
