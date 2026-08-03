import { primitives as p } from './primitives';

// ──────────────────────────────────────────────
// BASE — Tokens universais (independentes de tema)
// ──────────────────────────────────────────────
const base = {
  // Brand colors (sempre disponíveis para FlowBuilder etc.)
  'brand-blue': p.blue[500],
  'brand-green': p.emerald[500],
  'brand-orange': p.amber[500],
  'brand-indigo': p.indigo[500],
  'brand-purple': p.purple[500],

  // Status — text/icon (universais)
  'status-success': p.emerald[500],
  'status-error': p.red[500],
  'status-warning': p.amber[500],
  'status-info': p.blue[500],

  // WhatsApp brand (sempre acessível)
  'whatsapp-brand': '142 70% 49%',
  'whatsapp-bg': '32 28% 90%',
  'whatsapp-bubble-right': '94 78% 87%',
  'whatsapp-bubble-left': '0 0% 100%',

  // Status opaques (universais)
  'status-success-10': 'rgba(16, 185, 129, 0.1)',
  'status-error-10': 'rgba(239, 68, 68, 0.1)',
  'status-info-4': 'rgba(33, 150, 243, 0.04)',
  'status-info-8': 'rgba(33, 150, 243, 0.08)',
  'status-info-15': 'rgba(33, 150, 243, 0.15)',
  'status-info-30': 'rgba(33, 150, 243, 0.3)',
  'status-info-40': 'rgba(33, 150, 243, 0.4)',

  // Motion (universais)
  'ease-out': p.easing.easeOut,
  'duration-normal': p.duration.normal,
};

// ──────────────────────────────────────────────
// APPLE (default) — Blue-centric, clean
// ──────────────────────────────────────────────
export const appleLight = {
  ...base,
  // APPLE (default) — Blue-centric, clean iOS-like
  'bg-default': '240 24% 96%',    // iOS system background
  'bg-surface': '0 0% 100%',    // iOS card white
  'bg-surface-alt': '240 11% 91%', // iOS secondary
  'bg-sidebar': '240 11% 96%',    // iOS sidebar light grey
  'bg-appbar': '240 11% 96%',     // transparent blur-like
  
  'text-primary': '0 0% 0%',
  'text-secondary': '240 2% 57%', // iOS secondary text
  'text-muted': '240 5% 79%',
  'text-inverse': '0 0% 100%',
  'text-sidebar': '240 2% 23%',

  // Corporate blue (mesmo tom do preset 'saas') — menos "iOS consumer app",
  // mais adequado a um painel operacional B2B. Epic #504 do redesign
  // corporativo; ver docs/frontend/design-system.md.
  'action-primary': '221 83% 53%', // #2563EB
  'action-primary-hover': '224 76% 48%', // #1D4ED8
  'action-primary-bg': '214 100% 97%',
  'action-primary-active': '226 71% 40%',

  // Nav Icon Themes (Google-style)
  'nav-icon-blue': '214 82% 51%',
  'nav-icon-purple': '256 100% 65%',
  'nav-icon-green': '137 65% 34%',
  'nav-icon-orange': '28 92% 47%',
  'nav-icon-red': '4 71% 50%',
  'nav-icon-teal': '174 100% 27%',
  'nav-icon-yellow': '41 100% 49%',
  'nav-icon-pink': '325 79% 45%',

  // Status — chip backgrounds (light)
  'status-success-bg': '152 73% 90%',
  'status-success-text': '146 100% 27%',
  'status-error-bg': '5 79% 95%',
  'status-error-text': '354 100% 42%',
  'status-warning-bg': '42 100% 92%',
  'status-warning-text': '31 100% 45%',
  'status-info-bg': '212 100% 95%',
  'status-info-text': '211 100% 50%',
  'status-default-bg': '240 11% 91%',
  'status-default-text': '240 2% 57%',

  // Border/Shadow
  'border-default': '240 6% 83%', // iOS default border
  'border-sidebar': '240 6% 83%',
  'border-appbar': '240 6% 83%',
  'border-divider': 'rgba(0, 0, 0, 0.1)',
  'border-subtle': 'rgba(0, 0, 0, 0.05)',
  'border-weak': 'rgba(0, 0, 0, 0.03)',

  // Shadow patterns (iOS-style soft shadows)
  'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.12)',
  'shadow-md': '0 3px 6px rgba(0, 0, 0, 0.16)',
  'shadow-lg': '0 6px 12px rgba(0, 0, 0, 0.2)',
  'shadow-xl': '0 10px 20px rgba(0, 0, 0, 0.25)',
  'shadow-sidebar-glow': 'none', // iOS sidebar no glow
  'shadow-appbar': 'none', // iOS appbar no shadow
  'shadow-light': '0 1px 2px rgba(0, 0, 0, 0.08)',
  'shadow-medium': '0 2px 4px rgba(0, 0, 0, 0.12)',
  'shadow-strong': '0 4px 8px rgba(0, 0, 0, 0.16)',

  // Layout
  'bg-content': '240 24% 96%',
  'text-appbar': '0 0% 0%',
  'border-logo-divider': 'rgba(0, 0, 0, 0.08)',

  // Message bubbles
  'message-left-bg': '0 0% 100%',
  'message-right-bg': '216 100% 95%', // Apple blue tint
  'message-left-text': '0 0% 0%',
  'message-right-text': '0 0% 0%',
  'message-quote-bg': '240 11% 96%',
  'message-quote-text': '240 2% 57%',
  'message-quote-border': '240 6% 83%',
  'message-quote-side-left': '211 100% 50%',
  'message-quote-side-right': '135 59% 49%', // Green
  'message-timestamp-text': '240 2% 57%',
  'message-daily-bg': '240 11% 96%',
  'message-daily-text': '240 2% 57%',
  'message-reaction-bg': '0 0% 100%',
  'message-reaction-border': '240 6% 83%',
  'message-error-text': '3 100% 59%',
  'message-ack-text': '240 2% 57%',

  // SaaS mode
  'message-saas-bg': '211 100% 50%',
  'message-saas-text': '0 0% 100%',
  'message-saas-bg-alt': '240 11% 96%',
};

export const appleDark = {
 ...base,
 // APPLE DARK — iOS Dark Mode palette
 'bg-default': '0 0% 0%',
 'bg-surface': '240 3% 11%',
 'bg-surface-alt': '240 2% 18%',
 'bg-sidebar': '240 3% 11%',
 'bg-appbar': '240 3% 11%',

 'text-primary': '0 0% 100%',
 'text-secondary': '240 2% 61%', // iOS dark secondary
 'text-muted': '240 1% 39%',
 'text-inverse': '0 0% 0%',
 'text-sidebar': '240 11% 91%',

 // Corporate blue dark variant (mesmo tom do preset 'saas' dark)
 'action-primary': '213 94% 68%', // #60A5FA
 'action-primary-hover': '212 96% 78%',
 'action-primary-bg': '224 64% 33%',
 'action-primary-active': '213 97% 87%',

 // WhatsApp brand (dark variant)
 'whatsapp-brand': '140 78% 60%',

 // Nav Icon Themes (dark)
 'nav-icon-blue': '210 100% 52%',
 'nav-icon-purple': '280 85% 65%', // iOS Purple
 'nav-icon-green': '135 64% 50%', // iOS Green
 'nav-icon-orange': '36 100% 52%', // iOS Orange
 'nav-icon-red': '3 100% 61%', // iOS Red
 'nav-icon-teal': '197 100% 70%', // iOS Teal
 'nav-icon-yellow': '50 100% 52%', // iOS Yellow
 'nav-icon-pink': '348 100% 61%', // iOS Pink

 // Status — chip backgrounds (dark)
 'status-success-bg': '141 36% 17%',
 'status-success-text': '135 64% 50%',
 'status-error-bg': '0 36% 17%',
 'status-error-text': '3 100% 61%',
 'status-warning-bg': '37 36% 17%',
 'status-warning-text': '36 100% 52%',
 'status-info-bg': '211 36% 17%',
 'status-info-text': '210 100% 52%',
 'status-default-bg': '240 2% 18%',
 'status-default-text': '240 2% 61%',

 // Border/Shadow
 'border-default': '240 2% 22%',
 'border-sidebar': '240 2% 22%',
 'border-appbar': '240 2% 22%',
 'border-divider': 'rgba(255, 255, 255, 0.08)',
 'border-subtle': 'rgba(255, 255, 255, 0.04)',
 'border-weak': 'rgba(255, 255, 255, 0.02)',

 // Shadow patterns (iOS dark — subtle)
 'shadow-sm': '0 1px 3px rgba(0,0,0,0.4)',
 'shadow-md': '0 3px 6px rgba(0,0,0,0.5)',
 'shadow-lg': '0 6px 12px rgba(0,0,0,0.6)',
 'shadow-xl': '0 10px 20px rgba(0,0,0,0.7)',
 'shadow-sidebar-glow': 'none',
 'shadow-appbar': 'none',
 'shadow-light': '0 1px 2px rgba(0,0,0,0.3)',
 'shadow-medium': '0 2px 4px rgba(0,0,0,0.4)',
 'shadow-strong': '0 4px 8px rgba(0,0,0,0.5)',

 // Layout
 'bg-content': '0 0% 0%',
 'text-appbar': '0 0% 100%',
 'border-logo-divider': 'rgba(255,255,255,0.06)',

 // Message bubbles
 'message-left-bg': '240 3% 11%',
 'message-right-bg': '212 53% 24%',
 'message-left-text': '0 0% 100%',
 'message-right-text': '0 0% 100%',
 'message-quote-bg': '240 2% 18%',
 'message-quote-text': '240 2% 61%',
 'message-quote-border': '240 2% 22%',
 'message-quote-side-left': '210 100% 52%',
 'message-quote-side-right': '135 64% 50%',
 'message-timestamp-text': '240 1% 39%',
 'message-daily-bg': '240 2% 18%',
 'message-daily-text': '240 2% 61%',
 'message-reaction-bg': '240 3% 11%',
 'message-reaction-border': '240 2% 22%',
 'message-error-text': '3 100% 61%',
 'message-ack-text': '240 1% 39%',

 // SaaS mode
 'message-saas-bg': '210 100% 52%',
 'message-saas-text': '0 0% 100%',
 'message-saas-bg-alt': '240 2% 18%',
};

// ──────────────────────────────────────────────
// WHATSAPP — Paleta clássica WhatsApp Web
// ──────────────────────────────────────────────
export const whatsappLight = {
  ...base,
  // Backgrounds — WhatsApp chat wallpaper tone
  'bg-default': '32 28% 90%',
  'bg-surface': '0 0% 100%',
  'bg-surface-alt': '0 0% 94%',
  'bg-sidebar': '0 0% 100%',
  'bg-appbar': '173 86% 20%',

  // Text — high contrast on light beige
  'text-primary': '148 19% 13%',
  'text-secondary': '202 12% 45%',
  'text-muted': '203 12% 58%',
  'text-inverse': '0 0% 100%',
  'text-sidebar': '148 19% 13%',

  // Action — WhatsApp teal (#075E54 = header, #25D366 = brand accent)
  'action-primary': '142 70% 49%',
  'action-primary-hover': '142 71% 39%',
  'action-primary-bg': '94 78% 87%',
  'action-primary-active': '142 77% 31%',

  // Nav Icons — WhatsApp mono-teal palette
  'nav-icon-blue': '173 86% 20%',
  'nav-icon-purple': '173 86% 20%',
  'nav-icon-green': '142 70% 49%',
  'nav-icon-orange': '173 86% 20%',
  'nav-icon-red': '5 81% 56%',
  'nav-icon-teal': '173 86% 20%',
  'nav-icon-yellow': '41 100% 49%',
  'nav-icon-pink': '173 86% 20%',

  // Status — chip backgrounds
  'status-success-bg': '94 78% 87%',
  'status-success-text': '173 86% 20%',
  'status-error-bg': '6 83% 95%',
  'status-error-text': '0 65% 51%',
  'status-warning-bg': '46 100% 90%',
  'status-warning-text': '45 94% 27%',
  'status-info-bg': '198 76% 93%',
  'status-info-text': '173 86% 20%',
  'status-default-bg': '0 0% 94%',
  'status-default-text': '202 12% 45%',

  // Border/Shadow — WhatsApp subtle dividers
  'border-default': '0 0% 88%',
  'border-sidebar': '0 0% 88%',
  'border-appbar': 'rgba(255,255,255,0.15)',
  'border-divider': 'rgba(0, 0, 0, 0.08)',
  'border-subtle': 'rgba(0, 0, 0, 0.04)',
  'border-weak': 'rgba(0, 0, 0, 0.02)',

  // Overlay
  'overlay-light': 'rgba(255, 255, 255, 0.3)',
  'overlay-medium': 'rgba(255, 255, 255, 0.7)',
  'overlay-strong': 'rgba(255, 255, 255, 0.95)',
  'overlay-dark': 'rgba(0, 0, 0, 0.2)',
  'overlay-dark-medium': 'rgba(0, 0, 0, 0.5)',
  'overlay-dark-strong': 'rgba(0, 0, 0, 0.7)',
  'overlay-weak': 'rgba(0, 0, 0, 0.05)',

  // Shadow — WhatsApp flat/elevated
  'shadow-sm': '0 1px 1px rgba(0,0,0,0.06)',
  'shadow-md': '0 2px 8px rgba(0,0,0,0.08)',
  'shadow-lg': '0 4px 12px rgba(0,0,0,0.1)',
  'shadow-xl': '0 8px 24px rgba(0,0,0,0.12)',
  'shadow-sidebar-glow': 'none',
  'shadow-appbar': '0 1px 3px rgba(0,0,0,0.08)',
  'shadow-light': '0 1px 2px rgba(0,0,0,0.04)',
  'shadow-medium': '0 2px 8px rgba(0,0,0,0.08)',
  'shadow-strong': '0 4px 16px rgba(0,0,0,0.12)',

  // Layout
  'bg-content': '32 28% 90%',
  'text-appbar': '0 0% 100%',
  'border-logo-divider': 'rgba(0,0,0,0.06)',

  // Message bubbles — WhatsApp classic
  'message-left-bg': '0 0% 100%',
  'message-right-bg': '94 78% 87%',
  'message-left-text': '148 19% 13%',
  'message-right-text': '148 19% 13%',
  'message-quote-bg': '0 0% 94%',
  'message-quote-text': '202 12% 45%',
  'message-quote-border': '0 0% 88%',
  'message-quote-side-left': '173 86% 20%',
  'message-quote-side-right': '142 70% 49%',
  'message-timestamp-text': '203 12% 58%',
  'message-daily-bg': '0 0% 100%',
  'message-daily-text': '202 12% 45%',
  'message-reaction-bg': '0 0% 100%',
  'message-reaction-border': '0 0% 88%',
  'message-error-text': '0 65% 51%',
  'message-ack-text': '203 12% 58%',

  // SaaS mode (whatsapp variant)
  'message-saas-bg': '142 70% 49%',
  'message-saas-text': '0 0% 100%',
  'message-saas-bg-alt': '0 0% 94%',
};

export const whatsappDark = {
  ...base,
  // Backgrounds — WhatsApp dark mode
  'bg-default': '204 41% 7%',
  'bg-surface': '203 25% 16%',
  'bg-surface-alt': '202 32% 10%',
  'bg-sidebar': '202 32% 10%',
  'bg-appbar': '203 25% 16%',

  // Text
  'text-primary': '200 16% 93%',
  'text-secondary': '203 12% 58%',
  'text-muted': '202 12% 45%',
  'text-inverse': '148 19% 13%',
  'text-sidebar': '200 16% 93%',

  // Action
  'action-primary': '142 70% 49%',
  'action-primary-hover': '142 71% 39%',
  'action-primary-bg': '203 25% 16%',
  'action-primary-active': '142 77% 31%',

  // WhatsApp brand (dark variant)
  'whatsapp-brand': '140 78% 60%',
  'whatsapp-bg': '204 41% 7%',
  'whatsapp-bubble-right': '169 100% 18%',
  'whatsapp-bubble-left': '203 25% 16%',

  // Nav Icons
  'nav-icon-blue': '142 70% 49%',
  'nav-icon-purple': '203 12% 58%',
  'nav-icon-green': '142 70% 49%',
  'nav-icon-orange': '203 12% 58%',
  'nav-icon-red': '5 81% 56%',
  'nav-icon-teal': '142 70% 49%',
  'nav-icon-yellow': '41 100% 49%',
  'nav-icon-pink': '203 12% 58%',

  // Status — chip backgrounds (dark)
  'status-success-bg': '169 100% 18%',
  'status-success-text': '94 78% 87%',
  'status-error-bg': '0 36% 17%',
  'status-error-text': '5 81% 73%',
  'status-warning-bg': '37 36% 17%',
  'status-warning-text': '45 97% 69%',
  'status-info-bg': '202 65% 12%',
  'status-info-text': '217 89% 76%',
  'status-default-bg': '203 25% 16%',
  'status-default-text': '203 12% 58%',

  // Border/Shadow
  'border-default': '202 22% 21%',
  'border-sidebar': '202 22% 21%',
  'border-appbar': '202 22% 21%',
  'border-divider': 'rgba(255, 255, 255, 0.06)',
  'border-subtle': 'rgba(255, 255, 255, 0.03)',
  'border-weak': 'rgba(255, 255, 255, 0.02)',

  // Overlay
  'overlay-light': 'rgba(0, 0, 0, 0.3)',
  'overlay-medium': 'rgba(0, 0, 0, 0.5)',
  'overlay-strong': 'rgba(0, 0, 0, 0.8)',
  'overlay-dark': 'rgba(255, 255, 255, 0.1)',
  'overlay-dark-medium': 'rgba(255, 255, 255, 0.5)',
  'overlay-dark-strong': 'rgba(255, 255, 255, 0.7)',
  'overlay-weak': 'rgba(255, 255, 255, 0.05)',

  // Shadow
  'shadow-sm': '0 1px 2px rgba(0,0,0,0.3)',
  'shadow-md': '0 2px 8px rgba(0,0,0,0.3)',
  'shadow-lg': '0 4px 12px rgba(0,0,0,0.4)',
  'shadow-xl': '0 8px 24px rgba(0,0,0,0.5)',
  'shadow-sidebar-glow': 'none',
  'shadow-appbar': '0 1px 3px rgba(0,0,0,0.3)',
  'shadow-light': '0 1px 2px rgba(0,0,0,0.2)',
  'shadow-medium': '0 2px 8px rgba(0,0,0,0.3)',
  'shadow-strong': '0 4px 16px rgba(0,0,0,0.4)',

  // Layout
  'bg-content': '204 41% 7%',
  'text-appbar': '200 16% 93%',
  'border-logo-divider': 'rgba(255,255,255,0.04)',

  // Message bubbles — WhatsApp dark
  'message-left-bg': '203 25% 16%',
  'message-right-bg': '169 100% 18%',
  'message-left-text': '200 16% 93%',
  'message-right-text': '200 16% 93%',
  'message-quote-bg': '206 31% 15%',
  'message-quote-text': '203 12% 58%',
  'message-quote-border': '202 22% 21%',
  'message-quote-side-left': '203 12% 58%',
  'message-quote-side-right': '142 70% 49%',
  'message-timestamp-text': '202 12% 45%',
  'message-daily-bg': '203 25% 16%',
  'message-daily-text': '203 12% 58%',
  'message-reaction-bg': '203 25% 16%',
  'message-reaction-border': '202 22% 21%',
  'message-error-text': '5 81% 73%',
  'message-ack-text': '202 12% 45%',

  // SaaS mode (whatsapp dark)
  'message-saas-bg': '142 70% 49%',
  'message-saas-text': '0 0% 100%',
  'message-saas-bg-alt': '202 32% 10%',
  };

  export const googleLight = {
  ...base,
  'bg-default': '210 17% 98%', 'bg-surface': '0 0% 100%', 'bg-surface-alt': '200 12% 95%', 'bg-sidebar': '0 0% 100%', 'bg-appbar': '0 0% 100%',
  'text-primary': '225 6% 13%', 'text-secondary': '213 5% 39%', 'text-muted': '207 5% 52%', 'text-inverse': '0 0% 100%', 'text-sidebar': '225 6% 13%',
  'action-primary': '214 82% 51%', 'action-primary-hover': '214 79% 39%', 'action-primary-bg': '218 92% 95%', 'action-primary-active': '217 76% 37%',
  'nav-icon-blue': '214 82% 51%', 'nav-icon-purple': '256 100% 65%', 'nav-icon-green': '137 65% 34%', 'nav-icon-orange': '28 92% 47%', 'nav-icon-red': '4 71% 50%', 'nav-icon-teal': '174 100% 27%', 'nav-icon-yellow': '41 100% 49%', 'nav-icon-pink': '325 79% 45%',
  'status-success-bg': '137 39% 93%', 'status-success-text': '140 72% 26%', 'status-error-bg': '5 79% 95%', 'status-error-text': '1 73% 45%', 'status-warning-bg': '46 94% 94%', 'status-warning-text': '31 100% 45%', 'status-info-bg': '218 92% 95%', 'status-info-text': '215 79% 46%', 'status-default-bg': '200 12% 95%', 'status-default-text': '213 5% 39%',
  'border-default': '220 9% 87%', 'border-sidebar': '216 12% 92%', 'border-appbar': '220 9% 87%', 'border-divider': 'rgba(0,0,0,0.1)', 'border-subtle': 'rgba(0,0,0,0.05)', 'border-weak': 'rgba(0,0,0,0.03)',
  'overlay-light': 'rgba(255,255,255,0.3)', 'overlay-medium': 'rgba(255,255,255,0.7)', 'overlay-strong': 'rgba(255,255,255,0.95)', 'overlay-dark': 'rgba(0,0,0,0.2)', 'overlay-dark-medium': 'rgba(0,0,0,0.5)', 'overlay-dark-strong': 'rgba(0,0,0,0.7)', 'overlay-weak': 'rgba(0,0,0,0.05)',
  'shadow-sm': '0 1px 2px 0 rgba(60,64,67,0.1)', 'shadow-md': '0 1px 3px 0 rgba(60,64,67,0.15)', 'shadow-lg': '0 1px 6px 0 rgba(60,64,67,0.2)', 'shadow-xl': '0 2px 10px 0 rgba(60,64,67,0.25)', 'shadow-sidebar-glow': '0 1px 3px rgba(60,64,67,0.1)', 'shadow-appbar': '0 1px 2px 0 rgba(60,64,67,0.1)', 'shadow-light': '0 1px 1px rgba(60,64,67,0.05)', 'shadow-medium': '0 2px 6px rgba(60,64,67,0.1)', 'shadow-strong': '0 4px 12px rgba(60,64,67,0.2)',
  'bg-content': '210 17% 98%', 'text-appbar': '225 6% 13%', 'border-logo-divider': 'rgba(0,0,0,0.06)',
  'message-left-bg': '0 0% 100%', 'message-right-bg': '137 39% 93%', 'message-left-text': '225 6% 13%', 'message-right-text': '225 6% 13%', 'message-quote-bg': '200 12% 95%', 'message-quote-text': '213 5% 39%', 'message-quote-border': '220 9% 87%', 'message-quote-side-left': '214 82% 51%', 'message-quote-side-right': '137 65% 34%', 'message-timestamp-text': '207 5% 52%', 'message-daily-bg': '218 92% 95%', 'message-daily-text': '213 5% 39%', 'message-reaction-bg': '0 0% 100%', 'message-reaction-border': '220 9% 87%', 'message-error-text': '4 71% 50%', 'message-ack-text': '207 5% 52%',
  'message-saas-bg': '214 82% 51%', 'message-saas-text': '0 0% 100%', 'message-saas-bg-alt': '200 12% 95%',
  };

  export const googleDark = {
  ...base,
  'bg-default': '225 6% 13%', 'bg-surface': '220 3% 18%', 'bg-surface-alt': '220 4% 15%', 'bg-sidebar': '225 6% 13%', 'bg-appbar': '220 3% 18%',
  'text-primary': '216 12% 92%', 'text-secondary': '210 6% 63%', 'text-muted': '207 5% 52%', 'text-inverse': '225 6% 13%', 'text-sidebar': '216 12% 92%',
  'action-primary': '217 89% 76%', 'action-primary-hover': '217 89% 82%', 'action-primary-bg': '211 56% 23%', 'action-primary-active': '217 91% 91%',
  'nav-icon-blue': '217 89% 76%', 'nav-icon-purple': '262 100% 77%', 'nav-icon-green': '137 40% 65%', 'nav-icon-orange': '26 96% 71%', 'nav-icon-red': '5 81% 73%', 'nav-icon-teal': '165 56% 66%', 'nav-icon-yellow': '45 97% 69%', 'nav-icon-pink': '340 82% 76%',
  'status-success-bg': '144 33% 16%', 'status-success-text': '137 40% 65%', 'status-error-bg': '0 36% 17%', 'status-error-text': '5 81% 73%', 'status-warning-bg': '37 36% 17%', 'status-warning-text': '26 96% 71%', 'status-info-bg': '211 56% 23%', 'status-info-text': '217 89% 76%', 'status-default-bg': '220 3% 18%', 'status-default-text': '210 6% 63%',
  'border-default': '206 6% 25%', 'border-sidebar': '206 6% 25%', 'border-appbar': '206 6% 25%', 'border-divider': 'rgba(255,255,255,0.12)', 'border-subtle': 'rgba(255,255,255,0.06)', 'border-weak': 'rgba(255,255,255,0.03)',
  'overlay-light': 'rgba(0,0,0,0.3)', 'overlay-medium': 'rgba(0,0,0,0.5)', 'overlay-strong': 'rgba(0,0,0,0.8)', 'overlay-dark': 'rgba(255,255,255,0.1)', 'overlay-dark-medium': 'rgba(255,255,255,0.5)', 'overlay-dark-strong': 'rgba(255,255,255,0.7)', 'overlay-weak': 'rgba(255,255,255,0.05)',
  'shadow-sm': '0 1px 3px rgba(0,0,0,0.3)', 'shadow-md': '0 2px 6px rgba(0,0,0,0.3)', 'shadow-lg': '0 4px 12px rgba(0,0,0,0.4)', 'shadow-xl': '0 8px 24px rgba(0,0,0,0.5)', 'shadow-sidebar-glow': 'none', 'shadow-appbar': '0 1px 3px rgba(0,0,0,0.3)', 'shadow-light': '0 1px 2px rgba(0,0,0,0.2)', 'shadow-medium': '0 2px 8px rgba(0,0,0,0.3)', 'shadow-strong': '0 4px 16px rgba(0,0,0,0.4)',
  'bg-content': '225 6% 13%', 'text-appbar': '216 12% 92%', 'border-logo-divider': 'rgba(255,255,255,0.06)',
  'message-left-bg': '220 3% 18%', 'message-right-bg': '170 100% 15%', 'message-left-text': '216 12% 92%', 'message-right-text': '216 12% 92%', 'message-quote-bg': '220 4% 15%', 'message-quote-text': '210 6% 63%', 'message-quote-border': '206 6% 25%', 'message-quote-side-left': '217 89% 76%', 'message-quote-side-right': '137 40% 65%', 'message-timestamp-text': '207 5% 52%', 'message-daily-bg': '220 3% 18%', 'message-daily-text': '210 6% 63%', 'message-reaction-bg': '220 3% 18%', 'message-reaction-border': '206 6% 25%', 'message-error-text': '5 81% 73%', 'message-ack-text': '207 5% 52%',
  'message-saas-bg': '217 89% 76%', 'message-saas-text': '225 6% 13%', 'message-saas-bg-alt': '220 4% 15%',
  };

  export const saasLight = {
  ...base,
  'bg-default': '210 40% 96%', 'bg-surface': '0 0% 100%', 'bg-surface-alt': '214 32% 91%', 'bg-sidebar': '222 47% 11%', 'bg-appbar': '0 0% 100%',
  'text-primary': '0 0% 9%', 'text-secondary': '215 16% 47%', 'text-muted': '215 20% 65%', 'text-inverse': '0 0% 100%', 'text-sidebar': '213 27% 84%',
  'action-primary': '221 83% 53%', 'action-primary-hover': '224 76% 48%', 'action-primary-bg': '214 100% 97%', 'action-primary-active': '226 71% 40%',
  'nav-icon-blue': '221 83% 53%', 'nav-icon-purple': '221 83% 53%', 'nav-icon-green': '160 84% 39%', 'nav-icon-orange': '38 92% 50%', 'nav-icon-red': '0 84% 60%', 'nav-icon-teal': '221 83% 53%', 'nav-icon-yellow': '43 96% 56%', 'nav-icon-pink': '221 83% 53%',
  'status-success-bg': '137 39% 93%', 'status-success-text': '140 72% 26%', 'status-error-bg': '5 79% 95%', 'status-error-text': '1 73% 45%', 'status-warning-bg': '46 94% 94%', 'status-warning-text': '31 100% 45%', 'status-info-bg': '218 92% 95%', 'status-info-text': '215 79% 46%', 'status-default-bg': '200 12% 95%', 'status-default-text': '213 5% 39%',
  'border-default': '214 32% 91%', 'border-sidebar': '217 33% 17%', 'border-appbar': '214 32% 91%', 'border-divider': 'rgba(0,0,0,0.12)', 'border-subtle': 'rgba(0,0,0,0.05)', 'border-weak': 'rgba(0,0,0,0.03)',
  'overlay-light': 'rgba(255,255,255,0.3)', 'overlay-medium': 'rgba(255,255,255,0.7)', 'overlay-strong': 'rgba(255,255,255,0.95)', 'overlay-dark': 'rgba(0,0,0,0.2)', 'overlay-dark-medium': 'rgba(0,0,0,0.5)', 'overlay-dark-strong': 'rgba(0,0,0,0.7)', 'overlay-weak': 'rgba(0,0,0,0.05)',
  'shadow-sm': '0 1px 2px 0 rgba(60,64,67,0.1)', 'shadow-md': '0 1px 3px 0 rgba(60,64,67,0.15)', 'shadow-lg': '0 1px 6px 0 rgba(60,64,67,0.2)', 'shadow-xl': '0 2px 10px 0 rgba(60,64,67,0.25)', 'shadow-sidebar-glow': '0 1px 3px rgba(60,64,67,0.1)', 'shadow-appbar': '0 1px 2px 0 rgba(60,64,67,0.1)', 'shadow-light': '0 1px 1px rgba(60,64,67,0.05)', 'shadow-medium': '0 2px 6px rgba(60,64,67,0.1)', 'shadow-strong': '0 4px 12px rgba(60,64,67,0.2)',
  'bg-content': '210 40% 96%', 'text-appbar': '217 33% 17%', 'border-logo-divider': 'rgba(0,0,0,0.05)',
  'message-left-bg': '0 0% 100%', 'message-right-bg': '137 39% 93%', 'message-left-text': '225 6% 13%', 'message-right-text': '225 6% 13%', 'message-quote-bg': '200 12% 95%', 'message-quote-text': '213 5% 39%', 'message-quote-border': '200 9% 87%', 'message-quote-side-left': '214 82% 51%', 'message-quote-side-right': '137 65% 34%', 'message-timestamp-text': '207 5% 52%', 'message-daily-bg': '218 92% 95%', 'message-daily-text': '213 5% 39%', 'message-reaction-bg': '0 0% 100%', 'message-reaction-border': '200 9% 87%', 'message-error-text': '4 71% 50%', 'message-ack-text': '207 5% 52%',
  'message-saas-bg': '221 83% 53%', 'message-saas-text': '0 0% 100%', 'message-saas-bg-alt': '214 32% 91%',
  };

  export const saasDark = {
  ...base,
  'bg-default': '222 47% 11%', 'bg-surface': '217 33% 17%', 'bg-surface-alt': '218 29% 15%', 'bg-sidebar': '222 47% 11%', 'bg-appbar': '217 33% 17%',
  'text-primary': '210 40% 96%', 'text-secondary': '215 20% 65%', 'text-muted': '215 16% 47%', 'text-inverse': '0 0% 9%', 'text-sidebar': '213 27% 84%',
  'action-primary': '213 94% 68%', 'action-primary-hover': '212 96% 78%', 'action-primary-bg': '224 64% 33%', 'action-primary-active': '213 97% 87%',
  'nav-icon-blue': '213 94% 68%', 'nav-icon-purple': '213 94% 68%', 'nav-icon-green': '158 64% 52%', 'nav-icon-orange': '43 96% 56%', 'nav-icon-red': '0 91% 71%', 'nav-icon-teal': '213 94% 68%', 'nav-icon-yellow': '43 96% 56%', 'nav-icon-pink': '213 94% 68%',
  'status-success-bg': '144 33% 16%', 'status-success-text': '137 40% 65%', 'status-error-bg': '0 36% 17%', 'status-error-text': '5 81% 73%', 'status-warning-bg': '37 36% 17%', 'status-warning-text': '26 96% 71%', 'status-info-bg': '211 56% 23%', 'status-info-text': '217 89% 76%', 'status-default-bg': '220 3% 18%', 'status-default-text': '210 6% 63%',
  'border-default': '215 25% 27%', 'border-sidebar': '215 25% 27%', 'border-appbar': '215 25% 27%', 'border-divider': 'rgba(255,255,255,0.12)', 'border-subtle': 'rgba(255,255,255,0.05)', 'border-weak': 'rgba(255,255,255,0.03)',
  'overlay-light': 'rgba(0,0,0,0.3)', 'overlay-medium': 'rgba(0,0,0,0.5)', 'overlay-strong': 'rgba(0,0,0,0.8)', 'overlay-dark': 'rgba(255,255,255,0.1)', 'overlay-dark-medium': 'rgba(255,255,255,0.5)', 'overlay-dark-strong': 'rgba(255,255,255,0.7)', 'overlay-weak': 'rgba(255,255,255,0.05)',
  'shadow-sm': '0 1px 3px rgba(0,0,0,0.3)', 'shadow-md': '0 2px 6px rgba(0,0,0,0.3)', 'shadow-lg': '0 4px 12px rgba(0,0,0,0.4)', 'shadow-xl': '0 8px 24px rgba(0,0,0,0.5)', 'shadow-sidebar-glow': 'none', 'shadow-appbar': '0 1px 3px rgba(0,0,0,0.3)', 'shadow-light': '0 1px 2px rgba(0,0,0,0.2)', 'shadow-medium': '0 2px 8px rgba(0,0,0,0.3)', 'shadow-strong': '0 4px 16px rgba(0,0,0,0.4)',
  'bg-content': '222 47% 11%', 'text-appbar': '210 40% 96%', 'border-logo-divider': 'rgba(255,255,255,0.05)',
  'message-left-bg': '217 33% 17%', 'message-right-bg': '170 100% 15%', 'message-left-text': '210 40% 96%', 'message-right-text': '210 40% 96%', 'message-quote-bg': '217 33% 17%', 'message-quote-text': '215 20% 65%', 'message-quote-border': '215 25% 27%', 'message-quote-side-left': '213 94% 68%', 'message-quote-side-right': '158 64% 52%', 'message-timestamp-text': '207 5% 52%', 'message-daily-bg': '217 33% 17%', 'message-daily-text': '215 20% 65%', 'message-reaction-bg': '217 33% 17%', 'message-reaction-border': '215 25% 27%', 'message-error-text': '0 91% 71%', 'message-ack-text': '207 5% 52%',
  'message-saas-bg': '213 94% 68%', 'message-saas-text': '0 0% 9%', 'message-saas-bg-alt': '0 0% 15%',
  };

  // ──────────────────────────────────────────────
  // Backward-compatible aliases
  // ──────────────────────────────────────────────
  export const light = appleLight;
  export const dark = appleDark;
