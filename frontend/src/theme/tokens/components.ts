export const componentTokens = {
  // Radius — mesma escala de src/index.css (@theme) / spacing.css.
  // Não redeclare valores diferentes aqui: o loader injeta este objeto por
  // cima dos tokens de CSS em runtime, e uma divergência aqui volta a
  // quebrar a fonte única de verdade.
  'radius-sm': '6px',
  'radius-md': '8px',
  'radius-lg': '12px',
  'radius-xl': '16px',
  'radius-full': '9999px',

  // Spacing
  'spacing-xs': '4px',
  'spacing-sm': '8px',
  'spacing-md': '16px',
  'spacing-lg': '24px',
  'spacing-xl': '32px',

  // Card
  'card-bg': 'var(--bg-surface)',
  'card-border-radius': 'var(--radius-lg)',
  'card-shadow': 'var(--shadow-md)',
  'card-padding': 'var(--spacing-md)',
  'card-gap': 'var(--spacing-md)',
  'card-hover-transform': 'translateY(-2px)',

  // Button
  'button-primary-bg': 'var(--action-primary)',
  'button-primary-text': 'var(--text-inverse)',
  'button-secondary-bg': 'var(--bg-surface-alt)',
  'button-outline-border': 'var(--border-default)',
  'button-danger-bg': 'var(--status-error)',
  'button-sm-padding': '4px 12px',
  'button-lg-padding': '12px 24px',
  'button-radius': 'var(--radius-md)',

  // Input
  'input-padding': '10px 16px',
  'input-radius': 'var(--radius-md)',
  'input-error-border': 'var(--status-error)',

  // Navigation
  'nav-item-height': '48px',
  'nav-item-radius': 'var(--radius-md)',
  'nav-item-hover-bg': 'var(--bg-surface-alt)',
  'nav-active-bg': 'var(--action-primary-bg)',
  'nav-active-text': 'var(--text-primary)',

  // App Structure — 200px/70px expandido/colapsado (ver MainSidebar, que já
  // usa esses valores hardcoded via className; mantém consistência).
  'sidebar-width': '200px',
  'sidebar-bg': 'var(--bg-sidebar)',
  'appbar-bg': 'var(--bg-appbar)',
  'appbar-height': '64px',
};
