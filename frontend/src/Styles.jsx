// ============================================================================
// Wealthly — global CSS-in-JS
//
// One <style> tag with the full design system. Theme tokens are inlined
// per render so the dark/light branch stays in sync (currently dark only,
// but the light branch is kept dormant in case the user revisits it).
//
// Pairs with src/index.css which exposes the same tokens as Tailwind theme
// vars (--color-w-*) for the parts of the UI that use Tailwind utilities.
// Keep both in sync when changing palette.
// ============================================================================
export function Styles({ theme }) {
  const dark = theme === 'dark';
  const css = `
/* Wealthly v3 - Claude Design handoff tokens.
   Le :root canonique vit dans index.css. Ici on remappe les alias herites
   utilises par les ~1500 lignes de CSS-in-JS qui suivent.
   Theme: ${dark ? 'dark' : 'light'} (informatif). */
.app {
  --num-positive: var(--positive);
  --num-negative: var(--negative);
  --border-light: var(--border);
  --info: var(--accent);
  --info-soft: var(--accent-soft);
  --purple: var(--d4);
  --purple-soft: var(--accent-soft);
  --shadow-xl: var(--shadow-pop);
  --shadow-lg: var(--shadow-pop);
  --gradient-hero: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  --gradient-success: linear-gradient(135deg, var(--positive) 0%, var(--positive) 100%);
  --gradient-mesh: none;
}
* { box-sizing: border-box; }
.app {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  background: var(--bg-page);
  background-image: var(--gradient-mesh);
  background-attachment: fixed;
  color: var(--text-primary);
  min-height: 100vh;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
/* Tabular numerals for every monetary value. We keep them in sans (Inter Tight)
   for consistency — Inter Tight has full tnum support. */
.w-num, .nw-current-value, .kpi-card-value, .subview-hero-value, .ws-value, .wk-value, .mk-value, .summary-num, .cashflow-kpi-value, .merchant-total, .rest-hero-value, .rest-stat-value, .nw-current-delta, .alloc-pct, .alloc-val, .td-amount, .td-date, .ratio-card-amount, .ratio-card-pct {
  font-family: 'Geist', -apple-system, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  letter-spacing: -0.015em;
}

.loading-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: var(--bg-page); color: var(--text-secondary); }
.spinner { width: 32px; height: 32px; border: 2.5px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
.spin { animation: spin 1s linear infinite; }

/* DEMO MODE banner */
.demo-banner { display: flex; align-items: center; gap: 12px; padding: 9px 18px; background: var(--primary-soft); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); flex-wrap: wrap; }
.demo-banner-pill { display: inline-flex; align-items: center; padding: 2px 8px; background: var(--primary); color: ${dark ? '#0c0d10' : '#ffffff'}; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; border-radius: 4px; }
.demo-banner-text { flex: 1; min-width: 0; }
.demo-banner-text-short { display: none; }
.demo-banner-text-long { display: inline; }
.demo-banner-action { padding: 5px 12px; background: transparent; border: 1px solid var(--border-strong); border-radius: 4px; color: var(--text-primary); font-size: 11px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .15s, border-color .15s; flex-shrink: 0; }
.demo-banner-action:hover { background: var(--bg-card); border-color: var(--text-tertiary); }
@media (max-width: 640px) {
  .demo-banner { padding: 6px 12px; font-size: 11px; gap: 8px; flex-wrap: nowrap; }
  .demo-banner-text { font-size: 11px; }
  .demo-banner-text-long { display: none; }
  .demo-banner-text-short { display: inline; }
}
@keyframes spin { to { transform: rotate(360deg); } }

/* HEADER */
.app-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); background: ${dark ? 'rgba(21, 25, 38, 0.75)' : 'rgba(255, 255, 255, 0.75)'}; gap: 12px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.brand:hover { opacity: 0.85; }
.brand-mark {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: var(--gradient-hero);
  border: 1px solid rgba(255, 255, 255, 0.10);
  display: flex; align-items: center; justify-content: center;
  color: white;
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -0.04em;
  box-shadow: 0 4px 14px rgba(59, 111, 224, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.20);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-name {
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 19px; font-weight: 700;
  letter-spacing: -0.025em;
}
.brand-tagline {
  font-size: 10px; color: var(--text-tertiary);
  font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; margin-top: 1px;
}
.main-nav { display: flex; gap: 2px; background: var(--bg-subtle); padding: 4px; border-radius: 10px; overflow-x: auto; border: 1px solid var(--border-light); }
.main-nav button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; background: transparent; color: var(--text-secondary); font-size: 13px; font-weight: 500; border-radius: 7px; cursor: pointer; transition: color 0.18s, background 0.18s; font-family: inherit; white-space: nowrap; letter-spacing: -0.01em; }
.main-nav button svg { color: var(--text-tertiary); transition: color 0.18s; }
.main-nav button:hover { background: var(--bg-card); color: var(--text-primary); }
.main-nav button:hover svg { color: var(--text-secondary); }
.main-nav button.active { background: var(--bg-card); color: var(--primary); box-shadow: 0 1px 0 0 var(--border-light), inset 0 0 0 1px var(--border); font-weight: 600; }
.main-nav button.active svg { color: var(--primary); }
.nav-alert-dot { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 5px; margin-left: 4px; border-radius: 8px; background: var(--danger); color: white; font-size: 10px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: var(--bg-subtle); border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.icon-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.icon-btn-sm { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: transparent; border: 1px solid transparent; color: var(--text-tertiary); cursor: pointer; transition: all 0.15s; }
.icon-btn-sm:hover { background: var(--bg-subtle); color: var(--text-primary); }

.primary-btn, .primary-btn-large, .secondary-btn, .danger-btn, .danger-btn-sm { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s; border: 1px solid transparent; font-family: inherit; letter-spacing: -0.005em; }
.primary-btn {
  background: linear-gradient(135deg, var(--primary-hover), var(--primary));
  color: #ffffff;
  height: 36px; padding: 0 16px;
  box-shadow: 0 4px 14px rgba(59,111,224,0.30), inset 0 1px 0 rgba(255,255,255,0.15);
  font-weight: 600;
}
.primary-btn:hover {
  background: linear-gradient(135deg, var(--primary-hover), var(--primary-hover));
  box-shadow: 0 6px 20px rgba(59,111,224,0.40), inset 0 1px 0 rgba(255,255,255,0.18);
}
.primary-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.primary-btn-large {
  background: linear-gradient(135deg, var(--primary-hover), var(--primary));
  color: #ffffff;
  height: 44px; padding: 0 22px;
  font-size: 14px; font-weight: 600;
  box-shadow: 0 4px 14px rgba(59,111,224,0.30), inset 0 1px 0 rgba(255,255,255,0.15);
}
.primary-btn-large:hover {
  box-shadow: 0 6px 20px rgba(59,111,224,0.40), inset 0 1px 0 rgba(255,255,255,0.18);
}
.secondary-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  height: 36px; padding: 0 16px;
  font-weight: 500;
}
.secondary-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-strong);
}
.danger-btn { background: var(--danger-soft); color: var(--danger-text); border: 1px solid transparent; height: 36px; padding: 0 14px; }
.danger-btn:hover { background: var(--danger); color: white; }
.danger-btn-sm { padding: 5px 9px; background: var(--danger-soft); color: var(--danger-text); font-size: 12px; border-radius: 6px; }
.link-btn { background: transparent; border: none; color: var(--primary); font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; padding: 4px 8px; border-radius: 4px; }
.link-btn:hover { background: var(--primary-soft); }

.member-bar { padding: 14px 24px 0; background: var(--bg-page); border-bottom: 1px solid var(--border); }
.member-tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.member-tabs::-webkit-scrollbar { display: none; }
.member-tab { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; background: transparent; border: 1px solid transparent; border-radius: 999px; font-size: 12.5px; font-weight: 500; color: var(--text-tertiary); cursor: pointer; transition: color .15s, background .15s, border-color .15s; flex-shrink: 0; font-family: inherit; letter-spacing: -0.005em; }
.member-tab:hover { color: var(--text-primary); }
.member-tab.active { color: var(--text-primary); background: var(--bg-card); border-color: var(--border); box-shadow: none; }
.member-avatar { width: 18px; height: 18px; border-radius: 50%; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 700; flex-shrink: 0; letter-spacing: 0; }
.member-avatar.large { width: 36px; height: 36px; font-size: 14px; }
.role-badge { font-size: 9px; font-weight: 600; padding: 1px 6px; background: var(--bg-subtle); color: var(--text-tertiary); border: 1px solid var(--border-light); border-radius: 4px; text-transform: uppercase; letter-spacing: 0.06em; }
.member-context { padding: 10px 0; font-size: 12px; color: var(--text-tertiary); }
.member-context strong { color: var(--text-secondary); }

/* ============================================================================
 * APP SHELL — desktop sidebar + main column
 * ============================================================================ */
.app-shell { display: flex; align-items: stretch; min-height: 100vh; }
.app-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.app-sidebar {
  width: 244px; flex-shrink: 0; height: 100vh;
  position: sticky; top: 0;
  border-right: 1px solid var(--border);
  background: ${dark ? 'rgba(21, 25, 38, 0.65)' : 'rgba(255, 255, 255, 0.70)'};
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  padding: 22px 14px 18px;
  display: flex; flex-direction: column; gap: 6px;
  z-index: 50;
  overflow-y: auto; scrollbar-width: thin;
}
.sidebar-brand { display: flex; align-items: center; gap: 11px; cursor: pointer; padding: 4px 8px 18px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
.sidebar-brand:hover { opacity: 0.92; }
.sidebar-brand .brand-mark {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--gradient-hero);
  border: 1px solid rgba(255, 255, 255, 0.10);
  display: grid; place-items: center;
  color: white;
  font-weight: 800; font-size: 17px; letter-spacing: -0.04em;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(59,111,224,0.35), inset 0 1px 0 rgba(255,255,255,0.20);
}
.sidebar-brand .brand-text { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
.sidebar-brand .brand-name { font-family: 'Geist', system-ui, sans-serif; font-size: 18px; font-weight: 700; letter-spacing: -0.025em; color: var(--text-primary); }
.sidebar-brand .brand-tagline { font-size: 10px; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 1px; }

.sidebar-nav { display: flex; flex-direction: column; gap: 1px; flex: 1; }
.sidebar-section {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--text-muted);
  padding: 14px 12px 6px;
  margin-top: 4px;
}
.sidebar-section:first-child { margin-top: 0; padding-top: 8px; }
.sidebar-nav button { position: relative; display: inline-flex; align-items: center; gap: 11px; width: 100%; padding: 9px 12px; border: none; background: transparent; color: var(--text-secondary); font-size: 13.5px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: color .15s, background .15s; font-family: inherit; letter-spacing: -0.005em; text-align: left; overflow: hidden; }
.sidebar-nav button svg { color: var(--text-tertiary); transition: color .15s; flex-shrink: 0; }
.sidebar-nav button:hover { color: var(--text-primary); background: var(--bg-subtle); }
.sidebar-nav button:hover svg { color: var(--text-secondary); }
.sidebar-nav button.active { background: var(--primary-soft); color: var(--primary-text); font-weight: 600; }
.sidebar-nav button.active svg { color: var(--primary-text); }
.sidebar-nav button.active::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; background: var(--primary); border-radius: 0 3px 3px 0; box-shadow: 0 0 8px var(--primary); }
.sidebar-nav button .nav-alert-dot { margin-left: auto; }

.sidebar-footer {
  position: relative;
  display: flex; flex-direction: column; gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
  margin-top: auto;
}
.sidebar-member-switcher {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 9px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: background .15s, border-color .15s;
  font-family: inherit;
  text-align: left;
  color: var(--text-primary);
}
.sidebar-member-switcher:hover { background: var(--bg-subtle); border-color: var(--border-light); }
.sidebar-user-avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a78bfa, #5285ee);
  border: 1px solid rgba(255,255,255,0.10);
  color: white;
  font-size: 12px; font-weight: 700;
  display: grid; place-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.30);
  letter-spacing: 0;
}
.sidebar-user-info { flex: 1; min-width: 0; line-height: 1.2; }
.sidebar-user-name { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
.sidebar-user-email { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.sidebar-user-chevron { color: var(--text-tertiary); flex-shrink: 0; }
.sidebar-popover {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 12px 40px -8px rgba(0,0,0,0.5);
  z-index: 60;
  animation: pop-in 120ms ease-out;
}
@keyframes pop-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.sidebar-popover button, .sidebar-popover .sidebar-popover-row {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 9px 11px;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 13px; font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background .12s;
}
.sidebar-popover button:hover { background: var(--bg-subtle); }
.sidebar-popover button svg { color: var(--text-tertiary); flex-shrink: 0; }
.sidebar-popover-danger { color: var(--danger) !important; }
.sidebar-popover-danger svg { color: var(--danger) !important; }
.sidebar-popover-danger:hover { background: var(--danger-soft) !important; }

/* Mobile nav drawer */
.nav-drawer-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
}
.nav-drawer {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 272px;
  background: var(--bg-page);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: 0;
  animation: drawerSlideIn .22s cubic-bezier(.22,1,.36,1);
  overflow-y: auto;
}
@keyframes drawerSlideIn {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
.nav-drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 14px 14px;
  border-bottom: 1px solid var(--border-light);
}
.nav-drawer .sidebar-nav { padding: 10px 12px; gap: 2px; }
.nav-drawer-footer {
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border-light);
  margin-top: auto;
}
.hamburger-btn { color: var(--text-secondary) !important; }

/* Mobile-only top header — hidden on desktop, shown <768px */
.app-header-mobile { display: none; }

/* Mobile bottom nav — hidden on desktop, shown <768px */
.bottom-nav { display: none; }

/* ── Tablet (768–1023px): sidebar collapsed to icons only ── */
@media (min-width: 768px) and (max-width: 1023px) {
  .app-sidebar { width: 64px; padding: 18px 10px 14px; gap: 12px; align-items: center; }
  .sidebar-brand { padding: 4px 0 14px; justify-content: center; border-bottom: none; margin-bottom: 0; }
  .sidebar-brand .brand-text { display: none; }
  .sidebar-nav { width: 100%; align-items: center; gap: 2px; }
  .sidebar-section { display: none; }
  .sidebar-nav button { padding: 10px; justify-content: center; gap: 0; border-radius: 10px; width: 44px; height: 44px; }
  .sidebar-nav button span:not(.nav-alert-dot) { display: none; }
  .sidebar-nav button svg { width: 18px; height: 18px; }
  .sidebar-nav button.active::before { top: 5px; bottom: 5px; }
  .sidebar-nav button .nav-alert-dot { position: absolute; top: 6px; right: 6px; min-width: 12px; height: 12px; padding: 0 3px; font-size: 8px; }
  .sidebar-footer { width: 100%; align-items: center; padding-top: 10px; }
  .sidebar-member-switcher { padding: 8px; justify-content: center; gap: 0; }
  .sidebar-member-switcher .sidebar-user-info,
  .sidebar-member-switcher .sidebar-user-chevron { display: none; }
}

/* ── Mobile (<768px): hide sidebar, show top header + bottom nav ── */
@media (max-width: 767px) {
  .app-sidebar { display: none; }
  .app-header-mobile {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; gap: 8px; flex-wrap: nowrap;
    background: ${dark ? 'rgba(15, 14, 12, 0.78)' : 'rgba(247, 246, 242, 0.78)'};
    backdrop-filter: blur(14px) saturate(150%); -webkit-backdrop-filter: blur(14px) saturate(150%);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
  }
  .app-header-mobile .brand { display: flex; align-items: center; gap: 10px; cursor: pointer; min-width: 0; }
  .app-header-mobile .brand-mark { width: 32px; height: 32px; border-radius: 6px; background: var(--primary-soft); border: 1px solid ${dark ? 'rgba(91,141,239,0.32)' : 'rgba(40,85,200,0.20)'}; display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
  .app-header-mobile .brand-name { font-size: 15px; font-weight: 600; letter-spacing: -0.025em; }
  .app-header-mobile .header-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .app-header-mobile .icon-btn { width: 32px; height: 32px; }
  .app-header-mobile .primary-btn span { display: none; }
  .app-header-mobile .primary-btn { padding: 0 10px; height: 32px; }

  .bottom-nav {
    display: flex;
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 90;
    justify-content: space-around;
    background: ${dark ? 'rgba(15, 14, 12, 0.92)' : 'rgba(247, 246, 242, 0.92)'};
    backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%);
    border-top: 1px solid var(--border);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
    gap: 0;
  }
  .bottom-nav button {
    flex: 1; position: relative;
    display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    padding: 6px 4px; border: none; background: transparent;
    color: var(--text-tertiary); font-size: 10px; font-weight: 500; line-height: 1.1;
    border-radius: 6px; cursor: pointer; font-family: inherit; transition: color .15s;
    min-width: 0;
  }
  .bottom-nav button svg { color: var(--text-tertiary); transition: color .15s; }
  .bottom-nav button:hover { color: var(--text-secondary); }
  .bottom-nav button.active { color: var(--primary); }
  .bottom-nav button.active svg { color: var(--primary); }
  .bottom-nav button .nav-alert-dot { position: absolute; top: 4px; right: 16px; min-width: 14px; height: 14px; padding: 0 4px; font-size: 9px; }
}

.content { padding: 28px 32px 60px; max-width: 1280px; margin: 0 auto; min-height: calc(100vh - 140px); width: 100%; }
@media (max-width: 767px) {
  .content { padding: 16px 14px calc(96px + env(safe-area-inset-bottom, 0px)); max-width: none; }
}

/* Monthly hub — groups Mensuel + Cashflow + Budgets + Impôts under one nav slot */
.monthly-hub { display: flex; flex-direction: column; gap: 24px; }
.hub-tabs { display: inline-flex; gap: 2px; padding: 3px; background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: 10px; align-self: flex-start; overflow-x: auto; max-width: 100%; scrollbar-width: none; }
.hub-tabs::-webkit-scrollbar { display: none; }
.hub-tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: 12.5px; font-weight: 500; border-radius: 7px; cursor: pointer; transition: color .15s, background .15s, border-color .15s; font-family: inherit; white-space: nowrap; letter-spacing: -0.005em; }
.hub-tabs button svg { color: var(--text-tertiary); transition: color .15s; }
.hub-tabs button:hover { color: var(--text-primary); }
.hub-tabs button.active { background: var(--bg-card); color: var(--primary); border-color: var(--border); }
.hub-tabs button.active svg { color: var(--primary); }
@media (max-width: 760px) { .hub-tabs { width: 100%; align-self: stretch; } .hub-tabs button { flex: 1; justify-content: center; } }
.page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
.page-header h1, .page-title {
  font-family: 'Geist', system-ui, -apple-system, sans-serif;
  font-size: 32px; font-weight: 500; margin: 0 0 8px;
  letter-spacing: -0.025em; line-height: 1.05;
  color: var(--text-primary);
}
.page-header h1 em, .page-title em {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic; font-weight: 400; color: var(--text-secondary);
  letter-spacing: -0.035em;
}
.page-header p, .page-subtitle { font-size: 13px; color: var(--text-tertiary); margin: 0; max-width: 580px; line-height: 1.5; }
@media (max-width: 760px) { .page-header h1, .page-title { font-size: 24px; letter-spacing: -0.022em; } }

input, select, textarea { font-family: inherit; font-size: 13px; padding: 9px 12px; border-radius: 6px; border: 1px solid var(--border); background: ${dark ? 'var(--bg-subtle)' : 'var(--bg-card)'}; color: var(--text-primary); transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; letter-spacing: -0.01em; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-secondary); font-weight: 600; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field-help { font-size: 11px; color: var(--text-tertiary); margin-top: -4px; }
.hint { font-weight: 400; color: var(--text-tertiary); }

/* ONBOARDING */
.onboarding { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-page); padding: 32px 16px; color: var(--text-primary); position: relative; overflow: hidden; }
.onboarding-bg-mesh { position: absolute; inset: 0; background: radial-gradient(circle at 15% 20%, ${dark ? 'rgba(91,141,239,0.08)' : 'rgba(40,85,200,0.05)'}, transparent 50%), radial-gradient(circle at 85% 80%, ${dark ? 'rgba(91,141,239,0.04)' : 'rgba(40,85,200,0.03)'}, transparent 50%); pointer-events: none; }
.onboarding-card { background: var(--bg-card); border-radius: 14px; padding: 36px; max-width: 680px; width: 100%; box-shadow: var(--shadow-lg); border: 1px solid var(--border); position: relative; z-index: 1; }
.onboarding-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 32px; }
.progress-step { display: flex; align-items: center; gap: 8px; color: var(--text-tertiary); font-size: 12px; font-weight: 600; }
.progress-step.active { color: var(--primary); }
.progress-step.done { color: var(--success); }
.progress-dot { width: 24px; height: 24px; border-radius: 50%; background: var(--bg-subtle); border: 1px solid var(--border-strong); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }
.progress-step.active .progress-dot { background: var(--primary); color: ${dark ? '#0c0d10' : '#ffffff'}; border-color: var(--primary); }
.progress-step.done .progress-dot { background: var(--primary-soft); color: var(--primary); border-color: var(--primary); }
.progress-line { flex: 1; height: 2px; background: var(--border); border-radius: 1px; }
.onboarding-step-content h1 { font-family: 'Geist', system-ui, sans-serif; font-size: 38px; font-weight: 500; margin: 0 0 10px; letter-spacing: -0.025em; line-height: 1.05; color: var(--text-primary); }
.onboarding-step-content h1 em { font-family: 'Newsreader', Georgia, serif; font-style: italic; color: var(--text-secondary); font-weight: 400; letter-spacing: -0.035em; }
.onboarding-step-content h2 { font-family: 'Geist', system-ui, sans-serif; font-size: 28px; font-weight: 500; margin: 0 0 8px; letter-spacing: -0.025em; line-height: 1.1; color: var(--text-primary); }
.onboarding-step-content h2 em { font-family: 'Newsreader', Georgia, serif; font-style: italic; color: var(--text-secondary); font-weight: 400; letter-spacing: -0.035em; }
.onboarding-lead { font-size: 15px; color: var(--text-secondary); margin: 0 0 28px; line-height: 1.6; max-width: 460px; letter-spacing: -0.005em; }
.onboarding-hero { text-align: center; margin-bottom: 32px; }
.ob-mark-large { width: 64px; height: 64px; border-radius: 8px; background: var(--primary-soft); border: 1px solid ${dark ? 'rgba(91,141,239,0.32)' : 'rgba(40,85,200,0.18)'}; display: inline-flex; align-items: center; justify-content: center; color: var(--primary); margin-bottom: 20px; }
.onboarding-features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
.ob-feature-card { display: flex; gap: 12px; padding: 16px; background: var(--bg-subtle); border-radius: 12px; border: 1px solid var(--border-light); transition: border-color 0.18s, background 0.18s; }
.ob-feature-card:hover { border-color: var(--border-strong); background: var(--bg-card-hover); }
.ob-feature-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ob-feature-text { display: flex; flex-direction: column; gap: 2px; }
.ob-feature-text strong { font-size: 13px; }
.ob-feature-text span { font-size: 12px; color: var(--text-tertiary); line-height: 1.4; font-weight: 400; }
.member-preview-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.member-preview { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--bg-subtle); border-radius: 12px; border: 1px solid var(--border); }
.member-preview-info { flex: 1; }
.member-preview-name { font-size: 14px; font-weight: 600; }
.member-preview-role { font-size: 11px; color: var(--text-tertiary); }
.add-member-form { display: flex; gap: 8px; margin-bottom: 16px; }
.add-member-form input { flex: 1; }
.add-member-form select { width: 110px; }
.ob-tip { display: flex; gap: 10px; padding: 12px 14px; background: var(--warning-soft); color: var(--warning-text); border-radius: 10px; font-size: 12px; line-height: 1.5; margin-bottom: 24px; }
.ob-tip svg { flex-shrink: 0; margin-top: 2px; }
.ready-icon { width: 56px; height: 56px; border-radius: 8px; background: var(--primary-soft); border: 1px solid ${dark ? 'rgba(91,141,239,0.32)' : 'rgba(40,85,200,0.18)'}; display: inline-flex; align-items: center; justify-content: center; color: var(--primary); margin-bottom: 18px; }
.onboarding-summary { padding: 20px; background: var(--bg-subtle); border-radius: 14px; margin-bottom: 20px; }
.summary-stat { text-align: center; margin-bottom: 16px; }
.summary-num { font-size: 36px; font-weight: 800; color: var(--primary); line-height: 1; }
.summary-label { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }
.summary-list { display: flex; flex-direction: column; gap: 6px; padding-top: 16px; border-top: 1px solid var(--border); }
.summary-member { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dimmed { color: var(--text-tertiary); }
.ob-next-steps { background: var(--primary-soft); padding: 16px; border-radius: 12px; margin-bottom: 24px; font-size: 13px; }
.ob-next-steps strong { color: var(--primary-text); display: block; margin-bottom: 12px; }
.next-step-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.step-num { width: 22px; height: 22px; border-radius: 50%; background: var(--bg-card); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.onboarding-actions { display: flex; gap: 12px; justify-content: space-between; }

/* EMPTY */
.empty-state { padding: 80px 20px; text-align: left; max-width: 560px; margin: 0 auto; }
.empty-illustration { margin-bottom: 20px; }
.empty-circle { display: none; }
.empty-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--primary); font-weight: 500; margin-bottom: 14px; }
.empty-state h1 { font-size: clamp(30px, 4vw, 42px); font-weight: 500; margin: 0 0 12px; letter-spacing: -0.035em; line-height: 1.1; }
.empty-lead { font-size: 14px; color: var(--text-secondary); margin: 0 0 28px; line-height: 1.6; max-width: 440px; }
.empty-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.empty-mini { padding: 36px 24px; text-align: center; color: var(--text-tertiary); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.empty-mini p { margin: 0; font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 14px; max-width: 360px; line-height: 1.55; color: var(--text-secondary); letter-spacing: -0.005em; }
.empty-mini svg { color: var(--primary); opacity: 0.55; }

/* DASHBOARD */
.dashboard { display: flex; flex-direction: column; gap: 24px; }
.dashboard-greeting { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 4px 0 8px; }
.dashboard-greeting h1 { font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.025em; }
.streak-badge { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; background: var(--warning-soft); color: var(--warning-text); border-radius: 20px; font-size: 12px; font-weight: 700; }

/* HERO KPIs — Finary/Bunq style: 4 airy cards in a row */
.hero-kpis { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 14px; }
@media (max-width: 1000px) { .hero-kpis { grid-template-columns: 1fr 1fr; } }
@media (max-width: 580px) { .hero-kpis { grid-template-columns: 1fr; } }

.kpi-card { position: relative; padding: 22px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; gap: 6px; }
.kpi-card-label { font-size: 11px; color: var(--text-tertiary); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; }
.kpi-card-value { font-size: 28px; font-weight: 600; line-height: 1.1; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; margin: 6px 0 4px; color: var(--text-primary); }
.kpi-card-sub { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; }
.kpi-card-sub-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); font-weight: 400; font-variant-numeric: tabular-nums; }
.kpi-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.kpi-card-icon { position: absolute; top: 20px; right: 20px; width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.kpi-card-icon--income { background: var(--success-soft); color: var(--success-text); }
.kpi-card-icon--expense { background: var(--danger-soft); color: var(--danger-text); }

/* Primary card: subtle gold accent rail on the left */
.kpi-card--primary { background: var(--bg-card); }
.kpi-card--primary::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--primary); }
.kpi-card--primary .kpi-card-value { font-size: 36px; }

/* Net card accent colors */
.kpi-card--positive .kpi-card-value { color: var(--success); }
.kpi-card--positive .kpi-card-icon { background: var(--success-soft); color: var(--success-text); }
.kpi-card--negative .kpi-card-value { color: var(--danger); }
.kpi-card--negative .kpi-card-icon { background: var(--danger-soft); color: var(--danger-text); }

/* CARDS */
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; transition: border-color .2s; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px dotted var(--border); flex-wrap: wrap; }
.card-header h3 { font-size: 10.5px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 7px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--primary); }
.card-header h3 svg { color: var(--primary); opacity: 0.75; }
.card-header .card-meta { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 13px; color: var(--text-tertiary); letter-spacing: 0; text-transform: none; }

/* HealthScore card — gauge on the left, breakdown on the right. */
.health-score-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px 22px; transition: border-color .2s; }
.health-score-card:hover { border-color: var(--border-strong); }
.health-score-body { display: grid; grid-template-columns: 220px 1fr; gap: 26px; align-items: center; margin-top: 6px; }
.health-gauge-wrap { position: relative; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; }
.health-gauge { width: 100%; height: 100%; display: block; }
.health-gauge-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.health-score-value { font-family: 'DM Mono', ui-monospace, monospace; font-size: 56px; font-weight: 500; line-height: 1; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.health-score-suffix { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; letter-spacing: 0.06em; }
.health-score-rating { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.16em; margin-top: 10px; }

.health-criteria { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.health-criteria li { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 8px; cursor: help; transition: background .15s; }
.health-criteria li:hover { background: var(--bg-subtle); }
.health-criteria-icon { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; }
.health-criteria-icon.ok { background: var(--success-soft); color: var(--success); }
.health-criteria-icon.ko { background: var(--danger-soft); color: var(--danger); }
.health-criteria-label { font-size: 13px; color: var(--text-primary); font-weight: 500; }
.health-criteria-value { font-size: 12px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.health-criteria-pts { font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; }
@media (max-width: 760px) {
  .health-score-body { grid-template-columns: 1fr; gap: 16px; }
  .health-gauge-wrap { width: 180px; height: 180px; margin: 0 auto; }
  .health-score-value { font-size: 48px; }
  .health-criteria li { padding: 6px 8px; gap: 8px; }
}
.card-meta { font-size: 11px; color: var(--text-tertiary); font-weight: 400; }
.chart-card { padding: 22px 16px 16px 8px; }
.chart-empty { padding: 60px 20px; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 12px; font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 14px; letter-spacing: -0.005em; }
.chart-empty svg { color: var(--primary); opacity: 0.5; }
.alert-card { border-color: var(--warning); border-left: 2px solid var(--warning); background: ${dark ? 'rgba(212, 165, 84, 0.04)' : 'rgba(181, 135, 44, 0.04)'}; }
.anomalies-list { display: flex; flex-direction: column; gap: 8px; }
.anomaly-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg-card); border-radius: 10px; }
.anomaly-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.anomaly-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.anomaly-text span { font-size: 12px; color: var(--text-tertiary); font-weight: 400; }
.anomaly-ratio { font-size: 14px; font-weight: 700; color: var(--danger); padding: 4px 8px; background: var(--danger-soft); border-radius: 8px; }

.dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
.composition-row { display: flex; align-items: center; }
.legend-list { display: flex; flex-direction: column; gap: 12px; flex: 1; padding-left: 8px; }
.legend-item { display: flex; align-items: center; gap: 10px; }
.legend-dot { width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0; }
.legend-name { font-size: 12px; color: var(--text-tertiary); }
.legend-value { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }

.cat-breakdown { display: flex; flex-direction: column; gap: 12px; }
.cat-row { display: flex; flex-direction: column; gap: 6px; }
.cat-info { display: flex; align-items: center; gap: 10px; }
.cat-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.cat-name { flex: 1; font-size: 13px; font-weight: 500; }
.cat-amounts { display: flex; align-items: center; gap: 8px; }
.cat-amount { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.cat-change { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
.cat-change.up { background: var(--danger-soft); color: var(--danger-text); }
.cat-change.down { background: var(--success-soft); color: var(--success-text); }
.cat-bar { height: 4px; background: var(--bg-subtle); border-radius: 2px; overflow: hidden; }
.cat-bar-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }

.accounts-list, .recent-tx { display: flex; flex-direction: column; gap: 8px; }
.account-row { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; transition: background 0.15s; }
.account-row:hover { background: var(--bg-subtle); }
.acc-icon { width: 36px; height: 36px; border-radius: 10px; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.acc-info { flex: 1; min-width: 0; }
.acc-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acc-bank { font-size: 11px; color: var(--text-tertiary); }
.acc-balance { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.acc-balance.negative { color: var(--danger); }

.tx-row-mini { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; transition: background 0.15s; }
.tx-row-mini:hover { background: var(--bg-subtle); }
.tx-cat-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.tx-mini-info { flex: 1; min-width: 0; }
.tx-mini-label { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx-mini-meta { font-size: 10px; color: var(--text-tertiary); }
.tx-mini-amount { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.tx-mini-amount.positive { color: var(--success); }

/* MONTHLY */
.monthly-view { display: flex; flex-direction: column; gap: 20px; }
.monthly-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.monthly-header h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.02em; }
.month-selector { padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-card); font-size: 13px; font-weight: 600; cursor: pointer; }
.monthly-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); grid-auto-rows: 1fr; gap: 12px; align-items: stretch; }

/* Reste à vivre — hero */
.rest-hero { display: flex; flex-direction: column; gap: 18px; }
.rest-hero-top { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
.rest-hero-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); margin-bottom: 6px; }
.rest-hero-value { font-size: 38px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.rest-hero-value.positive { color: var(--success); }
.rest-hero-value.negative { color: var(--danger); }
.rest-hero-formula { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.rest-hero-stats { display: flex; flex-direction: column; gap: 8px; min-width: 220px; align-items: flex-end; }
.rest-stat { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.rest-stat-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
.rest-stat-value { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
.rest-stat-value.positive { color: var(--success); }
.rest-stat-value.negative { color: var(--danger); }
.rest-bar { height: 10px; background: var(--bg-subtle); border-radius: 999px; overflow: hidden; }
.rest-bar-fill { height: 100%; background: var(--success); border-radius: 999px; transition: width 0.5s ease; }
.rest-bar-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); }
.rest-bar-meta .positive { color: var(--success); }
.rest-bar-meta .negative { color: var(--danger); }

/* Mes charges fixes — par catégorie */
.fixed-by-cat { display: flex; flex-direction: column; gap: 18px; }
.fixed-cat-group { display: flex; flex-direction: column; gap: 8px; }
.fixed-cat-header { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-light); }
.fixed-cat-icon { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.fixed-cat-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.fixed-cat-total { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
.fixed-cat-items { display: flex; flex-direction: column; gap: 4px; }
.fixed-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: var(--bg-subtle); border: 1px solid transparent; }
.fixed-item:hover { border-color: var(--border); }
.fixed-item-day { width: 38px; font-size: 11px; color: var(--text-tertiary); font-weight: 600; text-align: center; flex-shrink: 0; }
.fixed-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fixed-item-info strong { font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fixed-item-meta { font-size: 11px; color: var(--text-tertiary); }
.fixed-item-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary); }

/* Abonnements spotlight */
.subs-list { display: flex; flex-direction: column; gap: 6px; }
.subs-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; background: var(--bg-subtle); border: 1px solid var(--border-light); }
.subs-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary); }
.subs-amount { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.subs-amount > span:first-child { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.subs-yearly { font-size: 11px; color: var(--text-tertiary); }

.mk-card { display: flex; align-items: center; gap: 12px; padding: 16px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-sm); }
.mk-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mk-card.income .mk-icon { background: var(--success-soft); color: var(--success-text); }
.mk-card.fixed .mk-icon { background: var(--purple-soft); color: var(--purple); }
.mk-card.variable .mk-icon { background: var(--warning-soft); color: var(--warning-text); }
.mk-card.net.positive .mk-icon { background: var(--success-soft); color: var(--success-text); }
.mk-card.net.negative .mk-icon { background: var(--danger-soft); color: var(--danger-text); }
.mk-info { flex: 1; min-width: 0; }
.mk-label { font-size: 11px; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.mk-value { font-size: 21px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.2; margin-top: 2px; }
.mk-yoy { font-size: 10.5px; font-weight: 500; font-variant-numeric: tabular-nums; margin-top: 4px; color: var(--text-tertiary); cursor: help; }
.mk-yoy.positive { color: var(--num-positive); }
.mk-yoy.negative { color: var(--num-negative); }
.mk-yoy-label { color: var(--text-tertiary); font-weight: 400; margin-left: 2px; }
.mk-meta { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }
.mk-card.net.positive .mk-value { color: var(--success); }
.mk-card.net.negative .mk-value { color: var(--danger); }
.mk-card.savings-rate.positive .mk-icon { background: var(--success-soft); color: var(--success-text); }
.mk-card.savings-rate.neutral .mk-icon { background: var(--warning-soft); color: var(--warning-text); }
.mk-card.savings-rate.negative .mk-icon { background: var(--danger-soft); color: var(--danger-text); }
.mk-card.savings-rate.positive .mk-value { color: var(--success); }
.mk-card.savings-rate.neutral .mk-value { color: var(--warning); }
.mk-card.savings-rate.negative .mk-value { color: var(--danger); }

.analyse-section-header { display: flex; align-items: center; gap: 10px; padding: 12px 4px 0; border-top: 1px solid var(--border); margin-top: 8px; }
.analyse-section-header h2 { font-size: 18px; font-weight: 700; margin: 0; }
.analyse-section-header svg { color: var(--text-tertiary); }
.analyse-section-subtitle { font-size: 12px; color: var(--text-tertiary); font-weight: 500; margin-left: auto; }

.projection-card { background: linear-gradient(135deg, var(--bg-card) 0%, var(--primary-soft) 100%); }
.projection-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.proj-item { padding: 12px; border-radius: 10px; background: var(--bg-card); }
.proj-item.highlight { border: 2px solid var(--primary); }
.proj-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; }
.proj-value { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; margin-top: 4px; }
.proj-value.positive { color: var(--success); }
.proj-value.negative { color: var(--danger); }
.proj-bar { height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; margin-top: 14px; }
.proj-bar-fill { height: 100%; background: var(--gradient-hero); border-radius: 3px; transition: width 0.6s ease; }

.monthly-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 900px) { .monthly-grid { grid-template-columns: 1.2fr 1fr; } }
.recurring-list-detailed { display: flex; flex-direction: column; gap: 8px; }
.recurring-detailed-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; background: var(--bg-subtle); transition: background 0.15s; border: 1px solid var(--border); }
.recurring-detailed-item:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }
.rec-day-badge { display: flex; flex-direction: column; align-items: center; padding: 8px 10px; background: var(--purple-soft); border-radius: 10px; flex-shrink: 0; min-width: 56px; }
.rec-day-num { font-size: 20px; font-weight: 800; color: var(--purple); line-height: 1; }
.rec-day-suffix { font-size: 9px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; margin-top: 2px; }
.rec-detailed-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rec-detailed-label { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.rec-detailed-label strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rec-icon-mini { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
.rec-detailed-meta { font-size: 11px; color: var(--text-tertiary); display: flex; gap: 6px; }
.rec-amount-large { font-size: 16px; font-weight: 800; color: var(--danger); font-variant-numeric: tabular-nums; }
.recurring-more { padding: 12px; text-align: center; font-size: 12px; color: var(--text-tertiary); }

.calendar-strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 8px 0; }
.cal-day { position: relative; aspect-ratio: 1; border-radius: 8px; background: var(--bg-subtle); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 4px; }
.cal-day.has-items { background: var(--primary-soft); }
.cal-day.has-items:hover { background: var(--primary); }
.cal-day.has-items:hover .cal-day-num { color: white; }
.cal-day.has-items:hover .cal-day-dot { background: white; }
.cal-day-num { font-size: 11px; font-weight: 700; color: var(--text-secondary); }
.cal-day-dot { width: 4px; min-height: 4px; max-height: 24px; background: var(--primary); border-radius: 2px; margin-top: 2px; }
.cal-day-tooltip { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: var(--text-primary); color: var(--bg-card); padding: 8px 12px; border-radius: 8px; font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.15s; z-index: 10; box-shadow: var(--shadow-lg); }
.cal-day:hover .cal-day-tooltip { opacity: 1; }
.cal-tooltip-item { padding: 2px 0; }
.cal-tooltip-more { font-style: italic; opacity: 0.7; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.2); }
.calendar-legend { font-size: 11px; color: var(--text-tertiary); text-align: center; margin-top: 8px; }

.month-comparison { display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; }
.comp-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; }
.comp-row:hover { background: var(--bg-subtle); }
.comp-icon { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.comp-info { flex: 1; min-width: 0; }
.comp-name { font-size: 13px; font-weight: 600; }
.comp-amounts { font-size: 11px; color: var(--text-tertiary); }
.comp-current { font-weight: 700; color: var(--text-primary); margin-right: 6px; font-variant-numeric: tabular-nums; }
.comp-change { display: inline-flex; align-items: center; gap: 3px; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; }
.comp-change.up { background: var(--danger-soft); color: var(--danger-text); }
.comp-change.down { background: var(--success-soft); color: var(--success-text); }
.comp-change.stable { background: var(--bg-subtle); color: var(--text-tertiary); }

/* BUDGETS */
.budgets-view { display: flex; flex-direction: column; gap: 20px; }
.budget-50-30-20 .ratio-display { display: flex; flex-direction: column; gap: 16px; }
.ratio-bar-large { display: flex; height: 44px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.ratio-segment { display: flex; align-items: center; justify-content: center; transition: flex 0.6s ease; min-width: 0; }
.ratio-segment.needs { background: var(--info); }
.ratio-segment.wants { background: var(--primary); }
.ratio-segment.savings { background: var(--success); }
.ratio-pct { font-size: 14px; font-weight: 600; color: ${dark ? '#0c0d10' : '#ffffff'}; font-variant-numeric: tabular-nums; }
.ratio-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.ratio-card { padding: 16px; border-radius: 8px; background: var(--bg-subtle); border: 1px solid var(--border); border-left-width: 2px; }
.ratio-card.needs { border-left-color: var(--info); }
.ratio-card.wants { border-left-color: var(--primary); }
.ratio-card.savings { border-left-color: var(--success); }
.ratio-card-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.ratio-card-pct { font-size: 24px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.ratio-card.needs .ratio-card-pct { color: var(--info); }
.ratio-card.wants .ratio-card-pct { color: var(--primary); }
.ratio-card.savings .ratio-card-pct { color: var(--success); }
.ratio-card-target { font-size: 11px; color: var(--text-tertiary); font-weight: 700; }
.ratio-card-name { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.ratio-card-amount { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ratio-card-target-amount { font-size: 11px; color: var(--text-tertiary); margin-top: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.status { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
.status.ok { background: var(--success-soft); color: var(--success-text); }
.status.over { background: var(--danger-soft); color: var(--danger-text); }
.status.under { background: var(--warning-soft); color: var(--warning-text); }
.ratio-help { display: flex; gap: 10px; padding: 12px 14px; background: var(--bg-subtle); border-radius: 10px; font-size: 12px; line-height: 1.5; color: var(--text-secondary); margin-top: 16px; font-weight: 400; }
.ratio-help svg { flex-shrink: 0; margin-top: 2px; color: var(--warning); }

.rest-to-live .rest-grid { display: grid; grid-template-columns: 1fr auto 1fr auto 1.4fr; gap: 12px; align-items: center; }
@media (max-width: 700px) { .rest-to-live .rest-grid { grid-template-columns: 1fr; } .rest-arrow { display: none; } }
.rest-item { padding: 12px 14px; border-radius: 10px; background: var(--bg-subtle); }
.rest-item.highlight { background: var(--primary-soft); border: 2px solid var(--primary); }
.rest-arrow { font-size: 24px; font-weight: 700; color: var(--text-tertiary); text-align: center; }
.rest-label { font-size: 11px; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.rest-value { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; margin-top: 4px; }
.rest-item.highlight .rest-value { color: var(--primary); }
.rest-meta { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; font-weight: 600; }

.budget-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.bs-card { padding: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-sm); }
.bs-card.respected { border-color: var(--success); }
.bs-card.over { border-color: var(--danger); }
.bs-num { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.bs-card.respected .bs-num { color: var(--success); }
.bs-card.over .bs-num { color: var(--danger); }
.bs-card.total .bs-num { color: var(--primary); }
.bs-label { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }

.budget-list { display: flex; flex-direction: column; gap: 10px; }
.budget-item-v2 { padding: 14px; background: var(--bg-subtle); border-radius: 12px; transition: all 0.15s; }
.budget-item-v2:hover { background: var(--bg-card-hover); }
.budget-item-v2.over { background: var(--danger-soft); }
.budget-item-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.budget-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.budget-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.budget-info-text { display: flex; flex-direction: column; }
.budget-name { font-size: 14px; font-weight: 700; }
.budget-kind { font-size: 10px; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.budget-amounts { display: flex; align-items: center; gap: 4px; }
.budget-spent { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.budget-divider { font-size: 14px; color: var(--text-tertiary); margin: 0 4px; }
.budget-input { width: 80px; text-align: right; }
.budget-currency { font-size: 12px; color: var(--text-tertiary); margin-left: 2px; }
.budget-bar { position: relative; height: 8px; background: var(--bg-card); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
.budget-fill { height: 100%; transition: width 0.6s ease; border-radius: 4px; }
.budget-bar.ok .budget-fill { background: var(--success); }
.budget-bar.warning .budget-fill { background: var(--warning); }
.budget-bar.danger .budget-fill { background: var(--danger); }
.budget-projection-marker { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--text-primary); border-radius: 1px; }
.budget-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; color: var(--text-tertiary); flex-wrap: wrap; }
.budget-warning { display: inline-flex; align-items: center; padding: 1px 8px; background: var(--warning-soft); color: var(--warning-text); font-size: 10.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px; }
.goal-complete { display: inline-flex; align-items: center; padding: 1px 8px; background: var(--success-soft); color: var(--success); font-size: 10.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px; }
.budget-danger { color: var(--danger-text); font-weight: 700; }
.suggestion-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: var(--primary-soft); color: var(--primary-text); border: none; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
.suggestion-btn:hover { background: var(--primary); color: white; }
.quick-set-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; background: transparent; color: var(--primary); border: 1px dashed var(--primary); border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 4px; }
.quick-set-btn:hover { background: var(--primary-soft); }

/* WEALTH */
.wealth-view { display: flex; flex-direction: column; gap: 20px; }
.wealth-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.wk-card { padding: 18px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; box-shadow: none; transition: border-color .2s; }
.wk-card:hover { border-color: var(--border-strong); }
.wk-card.warn { border-color: var(--warning); background: var(--bg-card); }
.wk-label { font-size: 10px; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.16em; }
.wk-value { font-size: 26px; font-weight: 500; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; margin-top: 8px; line-height: 1.05; color: var(--text-primary); }
.wk-meta { font-size: 11.5px; color: var(--text-tertiary); margin-top: 4px; }
.allocation-card .card-header { border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px; }
.allocation-body { display: flex; align-items: center; gap: 32px; flex-wrap: wrap; }
.allocation-legend { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 8px; }
.alloc-row { display: flex; align-items: center; gap: 10px; }
.alloc-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.alloc-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.alloc-pct { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary); min-width: 42px; text-align: right; }
.alloc-val { font-size: 13px; font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text-tertiary); min-width: 90px; text-align: right; }
.wealth-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.wealth-summary-net { margin-bottom: 14px; }
.wsn-card { padding: 22px 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; display: flex; flex-direction: column; gap: 4px; }
.wsn-label { font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 500; letter-spacing: 0.16em; }
.wsn-value { font-size: 36px; font-weight: 500; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.1; color: var(--text-primary); margin-top: 2px; }
.wsn-debt-mini { font-size: 12px; color: var(--ink-3, var(--text-tertiary)); margin-top: 4px; letter-spacing: 0.02em; }
.ws-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; transition: border-color .2s; }
.ws-card:hover { border-color: var(--border-strong); }
.ws-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ws-card.positive .ws-icon { background: var(--success-soft); color: var(--success); }
.ws-card.negative .ws-icon { background: var(--danger-soft); color: var(--danger); }
.ws-card.net .ws-icon { background: var(--primary-soft); color: var(--primary); }
.ws-content { flex: 1; min-width: 0; }
.ws-label { font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 500; letter-spacing: 0.16em; }
.ws-value { font-size: 24px; font-weight: 500; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; line-height: 1.1; margin-top: 4px; color: var(--text-primary); }
.ws-meta { font-size: 11.5px; color: var(--text-tertiary); margin-top: 3px; }
.wealth-empty { padding: 24px; }
.wealth-empty p { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; font-weight: 400; }
.asset-types-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.asset-type-btn { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: all 0.15s; text-align: left; font-family: inherit; }
.asset-type-btn:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }
.att-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.att-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.att-desc { font-size: 11px; color: var(--text-tertiary); line-height: 1.3; margin-top: 2px; }
.asset-group { margin-bottom: 16px; }
.asset-group-header { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
.agh-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.agh-name { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.agh-count { font-size: 11px; color: var(--text-tertiary); padding: 2px 8px; background: var(--bg-subtle); border-radius: 8px; font-weight: 600; }
.agh-total { margin-left: auto; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.asset-list { display: flex; flex-direction: column; gap: 8px; }
.asset-card-v2 { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-subtle); border-radius: 10px; }
.asset-card-v2:hover { background: var(--bg-card-hover); }
.asset-card-main { flex: 1; min-width: 0; }
.asset-card-name { font-size: 14px; font-weight: 700; }
.asset-card-meta { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }
.asset-card-notes { font-size: 11px; color: var(--text-secondary); margin-top: 4px; font-style: italic; }
.asset-card-value-block { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.asset-card-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.asset-card-pv { font-size: 11.5px; font-weight: 500; cursor: help; }
.asset-card-pv.positive { color: var(--num-positive); }
.asset-card-pv.negative { color: var(--num-negative); }
.asset-card-pv-pct { color: var(--text-tertiary); font-weight: 400; margin-left: 1px; }
.asset-card-actions { display: flex; gap: 4px; }

/* RegulatoryCaps — PEA / Livret A / LDDS / LEP progress vs legal cap. */
.reg-caps-card { padding: 18px 22px; }
.reg-caps-list { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.reg-caps-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid var(--border-light); }
.reg-caps-row:last-child { border-bottom: none; padding-bottom: 0; }
.reg-caps-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.reg-caps-label { font-size: 12.5px; font-weight: 600; color: var(--text-primary); letter-spacing: 0.02em; }
.reg-caps-value { font-size: 13px; font-weight: 500; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.reg-caps-cap { color: var(--text-tertiary); font-weight: 400; }
.reg-caps-bar { height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; }
.reg-caps-bar-fill { height: 100%; background: var(--success); border-radius: 3px; transition: width .3s ease, background .2s; }
.state-warn .reg-caps-bar-fill { background: var(--warning); }
.state-over .reg-caps-bar-fill { background: var(--danger); }
.reg-caps-foot { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }

/* AccountDrawer — slide-in side panel */
.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 999; animation: drawerBackdropIn .15s ease-out; }
@keyframes drawerBackdropIn { from { opacity: 0; } to { opacity: 1; } }
.drawer { position: fixed; top: 0; bottom: 0; width: min(440px, 95vw); background: var(--bg-card); z-index: 1000; box-shadow: -16px 0 48px rgba(0,0,0,0.45); display: flex; flex-direction: column; animation: drawerSlideIn .2s cubic-bezier(0.2, 0.8, 0.2, 1); }
.drawer-right { right: 0; border-left: 1px solid var(--border-strong); }
@keyframes drawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.drawer-header { display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-bottom: 1px solid var(--border-light); }
.drawer-header-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.drawer-header-text { flex: 1; min-width: 0; }
.drawer-title { font-size: 16px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drawer-subtitle { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drawer-body { flex: 1; overflow-y: auto; padding: 18px 22px; display: flex; flex-direction: column; gap: 22px; }
.drawer-balance { padding-bottom: 18px; border-bottom: 1px solid var(--border-light); }
.drawer-balance-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--text-tertiary); font-weight: 500; }
.drawer-balance-value { font-family: 'DM Mono', ui-monospace, monospace; font-size: 36px; font-weight: 500; letter-spacing: -0.035em; color: var(--text-primary); margin-top: 8px; line-height: 1; }
.drawer-balance-value.negative { color: var(--danger); }
.drawer-balance-meta { font-size: 11.5px; color: var(--text-tertiary); margin-top: 6px; font-variant-numeric: tabular-nums; }
.drawer-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--text-tertiary); font-weight: 500; margin-bottom: 8px; }
.drawer-spark { }
.drawer-tx-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
.drawer-tx-row { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border-light); font-size: 12.5px; }
.drawer-tx-row:last-child { border-bottom: none; }
.drawer-tx-date { font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.drawer-tx-label { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drawer-tx-amount { font-variant-numeric: tabular-nums; color: var(--text-secondary); font-weight: 500; }
.drawer-tx-amount.positive { color: var(--num-positive); }
.drawer-empty { font-size: 12.5px; color: var(--text-tertiary); padding: 14px 0; text-align: center; }
.drawer-footer { padding: 14px 22px; border-top: 1px solid var(--border-light); background: var(--bg-subtle); }
.drawer-footer .primary-btn { width: 100%; justify-content: center; }
@media (max-width: 760px) {
  .drawer { width: 100vw; }
  .drawer-right { border-left: none; }
  .drawer-balance-value { font-size: 30px; }
}
.reg-caps-remaining { display: inline-flex; align-items: center; gap: 4px; }
.state-warn .reg-caps-remaining { color: var(--warning-text); }
.state-over .reg-caps-remaining { color: var(--danger-text); font-weight: 600; }

.liability-list { display: flex; flex-direction: column; gap: 12px; }
.liability-card-v2 { padding: 14px; background: var(--bg-subtle); border-radius: 12px; border: 1px solid transparent; }
.lia-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.lia-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lia-name-block { flex: 1; min-width: 0; }
.lia-name { font-size: 14px; font-weight: 700; display: block; }
.lia-type { font-size: 11px; color: var(--text-tertiary); }
.lia-actions { display: flex; gap: 4px; }
.loan-unlink-btn { margin-left: auto; flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; border: none; background: transparent; color: var(--ink-3); cursor: pointer; transition: color .15s, background .15s; }
.loan-unlink-btn:hover { color: var(--negative); background: color-mix(in srgb, var(--negative) 10%, transparent); }
.loan-link-btn { margin-left: auto; flex-shrink: 0; font-size: 12px; font-weight: 500; color: var(--accent); padding: 3px 8px; border-radius: 6px; background: var(--accent-soft); }
.liability-card-v2.loan-available { border: 1px dashed var(--border); background: var(--bg); transition: border-color .15s, background .15s; }
.liability-card-v2.loan-available:hover { border-color: var(--accent); background: var(--accent-soft); }
.liability-card-v2.loan-available .lia-header { margin-bottom: 0; }
.lia-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; padding: 10px; background: var(--bg-card); border-radius: 8px; margin-bottom: 10px; }
.lia-stat { display: flex; flex-direction: column; gap: 2px; }
.lia-label { font-size: 10px; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.lia-value { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.lia-progress-bar { height: 6px; background: var(--bg-card); border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
.lia-progress-fill { height: 100%; background: var(--gradient-success); border-radius: 3px; }
.lia-progress-info { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-tertiary); font-weight: 600; }

/* TRANSACTIONS */
.transactions-view { display: flex; flex-direction: column; gap: 16px; }
.filters-bar { position: relative; display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); flex-wrap: wrap; box-shadow: var(--shadow-sm); }

/* Tx advanced-filter panel — collapsible popover anchored to .filters-bar */
.tx-filter-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px; color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: color .15s, border-color .15s, background .15s; }
.tx-filter-btn:hover { color: var(--text-primary); border-color: var(--border-strong); }
.tx-filter-btn.has-active { color: var(--primary); border-color: var(--primary); background: var(--primary-soft); }
.tx-filter-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; background: var(--primary); color: ${dark ? '#0a0b0e' : '#ffffff'}; font-size: 10.5px; font-weight: 600; border-radius: 9px; font-variant-numeric: tabular-nums; }
.tx-filter-reset { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 10px; background: transparent; border: none; color: var(--text-tertiary); font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; border-radius: 6px; transition: color .15s, background .15s; }
.tx-filter-reset:hover { color: var(--text-primary); background: var(--bg-subtle); }

.tx-filter-panel { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 80; background: var(--bg-card); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: var(--shadow-xl); padding: 18px 20px; display: flex; flex-direction: column; gap: 18px; max-height: 70vh; overflow-y: auto; animation: txFilterIn .15s ease-out; }
@keyframes txFilterIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.tx-filter-panel-header { display: flex; align-items: center; justify-content: space-between; font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--text-tertiary); font-weight: 500; padding-bottom: 4px; border-bottom: 1px solid var(--border-light); }

.tx-filter-section { display: flex; flex-direction: column; gap: 8px; }
.tx-filter-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-tertiary); font-weight: 500; }
.tx-filter-sublabel { font-size: 11px; color: var(--text-tertiary); margin: 6px 0 4px; }

.tx-filter-radio-row { display: flex; gap: 4px; padding: 3px; background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: 8px; align-self: flex-start; }
.tx-filter-pill { padding: 6px 14px; background: transparent; border: 1px solid transparent; color: var(--text-secondary); font-size: 12.5px; font-weight: 500; border-radius: 6px; cursor: pointer; font-family: inherit; transition: color .15s, background .15s, border-color .15s; }
.tx-filter-pill:hover { color: var(--text-primary); }
.tx-filter-pill.active { background: var(--bg-card); color: var(--primary); border-color: var(--border); }

.tx-filter-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.tx-filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.tx-filter-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px 5px 6px; background: var(--bg-subtle); border: 1px solid var(--border); color: var(--text-secondary); font-size: 12px; font-weight: 500; border-radius: 999px; cursor: pointer; font-family: inherit; transition: color .15s, background .15s, border-color .15s; }
.tx-filter-chip:hover { color: var(--text-primary); border-color: var(--border-strong); }
.tx-filter-chip.active { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-strong); }

.tx-filter-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 4px; }
.tx-filter-cat { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: transparent; border: 1px solid transparent; border-radius: 6px; cursor: pointer; font-size: 12.5px; color: var(--text-secondary); transition: color .15s, background .15s, border-color .15s; }
.tx-filter-cat:hover { background: var(--bg-subtle); color: var(--text-primary); }
.tx-filter-cat.active { background: var(--primary-soft); color: var(--text-primary); border-color: var(--primary); }
.tx-filter-cat input { width: 14px; height: 14px; margin: 0; accent-color: var(--primary); cursor: pointer; }
.tx-filter-cat-icon { font-size: 14px; line-height: 1; }
.tx-filter-cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-filter-cat-count { font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }

.tx-filter-panel-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border-light); }
@media (max-width: 760px) { .tx-filter-cat-grid { grid-template-columns: 1fr; } .tx-filter-panel { padding: 14px; } }
.search-box { display: flex; align-items: center; gap: 6px; padding: 0 10px; background: var(--bg-subtle); border-radius: 8px; flex: 1; min-width: 200px; border: 1px solid transparent; }
.search-box svg { color: var(--text-tertiary); flex-shrink: 0; }
.search-box input { border: none; background: transparent; padding: 8px 0; font-size: 13px; flex: 1; color: var(--text-primary); font-family: inherit; }
.search-box input:focus { outline: none; box-shadow: none; }
.result-count { font-size: 11px; color: var(--text-tertiary); margin-left: auto; }
.tx-table { background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow-sm); }
.tx-header, .tx-row { display: grid; grid-template-columns: 90px minmax(240px, 2fr) 140px 140px 130px 110px 50px; gap: 10px; padding: 10px 16px; align-items: center; }
.td-label { min-width: 0; position: relative; }
.td-label-text { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
/* Fintech-style floating tooltip — shows full label on hover, positioned above row.
   We disable the native browser title tooltip by removing it; this CSS one is prettier
   and never causes layout shift. */
.td-label[data-tooltip] { cursor: default; }
.td-label[data-tooltip]::before,
.td-label[data-tooltip]::after { opacity: 0; pointer-events: none; transition: opacity 0.12s ease-out, transform 0.12s ease-out; }
.td-label[data-tooltip]::before {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  max-width: 520px;
  width: max-content;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--ink, #16150F);
  color: var(--bg, #F7F6F2);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.01em;
  line-height: 1.45;
  white-space: normal;
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.35), 0 4px 8px -4px rgba(0,0,0,0.15);
  z-index: 100;
  transform: translateY(2px);
  font-family: inherit;
}
.td-label[data-tooltip]::after {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 14px;
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--ink, #16150F);
  z-index: 100;
}
.td-label[data-tooltip]:hover::before,
.td-label[data-tooltip]:hover::after { opacity: 1; transform: translateY(0); transition-delay: 0.25s; }
.cat-pill-sub { background: var(--bg-subtle, var(--bg-sunk)); color: var(--ink-2); border: 1px solid var(--border); font-size: 11px !important; padding: 3px 8px !important; border-radius: 6px !important; cursor: pointer; font-family: inherit; }
.cat-pill-sub:hover { border-color: var(--accent); color: var(--accent); }
.cat-pill-add-sub { background: transparent; color: var(--ink-3); border: 1px dashed var(--border); font-size: 10px; padding: 3px 8px; border-radius: 6px; cursor: pointer; font-family: inherit; opacity: 0.6; transition: opacity 0.15s, color 0.15s, border-color 0.15s; }
.tx-row:hover .cat-pill-add-sub { opacity: 1; }
.cat-pill-add-sub:hover { color: var(--accent); border-color: var(--accent); }
.cat-pill-empty { color: var(--ink-3); font-size: 12px; opacity: 0.4; padding-left: 4px; }
.subcat-picker { min-width: 240px; }
.subcat-picker-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.08em; background: var(--bg-sunk, var(--bg-subtle)); border-top-left-radius: 8px; border-top-right-radius: 8px; }
.subcat-picker-head strong { color: var(--ink); text-transform: none; font-weight: 500; letter-spacing: 0.01em; font-size: 12px; }
.subcat-picker-icon { font-size: 14px; }
/* Header column filters (fintech-style: small icon next to label → popover) */
.th { position: relative; display: flex; align-items: center; gap: 6px; }
.th.right { justify-content: flex-end; }
.th-filter-wrap { display: inline-flex; align-items: center; position: relative; margin-left: 2px; }
.th-filter-btn { background: transparent; border: none; padding: 3px; color: var(--ink-3); cursor: pointer; border-radius: 4px; opacity: 0.4; transition: opacity 0.15s, color 0.15s, background 0.15s; display: inline-flex; align-items: center; }
.th:hover .th-filter-btn { opacity: 1; }
.th-filter-btn:hover { color: var(--accent); background: var(--accent-soft); }
.th-filter-btn.active { color: var(--accent); opacity: 1; background: var(--accent-soft); }
.th-filter-popover {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 50;
  min-width: 240px;
  max-width: 340px;
  max-height: 360px;
  overflow-y: auto;
  background: var(--bg-elev);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  box-shadow: 0 12px 32px -8px rgba(0,0,0,0.18), 0 4px 8px -4px rgba(0,0,0,0.08);
  padding: 0;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.th-filter-popover-left { left: 0; }
.th-filter-popover-right { right: 0; }
.th-filter-section { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.th-filter-row { display: flex; flex-direction: row; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2); }
.th-filter-row > span { width: 40px; flex-shrink: 0; color: var(--ink-3); font-size: 11px; }
.th-filter-row input { flex: 1; font-size: 12px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--ink); font-family: inherit; }
.th-filter-row input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.th-filter-search { width: 100%; box-sizing: border-box; font-size: 12px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--ink); margin-bottom: 4px; font-family: inherit; }
.th-filter-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.th-filter-chk { display: flex; flex-direction: row; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--ink); font-weight: 400; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.th-filter-chk:hover { background: var(--bg-subtle, var(--bg-sunk)); }
.th-filter-chk.active { background: var(--accent-soft); color: var(--accent); }
.th-filter-chk input { width: 13px; height: 13px; cursor: pointer; flex-shrink: 0; }
.th-filter-chk-icon { font-size: 13px; }
.th-filter-chk-count { margin-left: auto; font-size: 10px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.th-filter-group { font-size: 10px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 8px 2px; font-weight: 500; }
.th-filter-segmented { display: flex; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.th-filter-seg { flex: 1; background: transparent; border: none; padding: 5px 8px; font-size: 11px; color: var(--ink-2); cursor: pointer; font-family: inherit; transition: background 0.15s, color 0.15s; border-right: 1px solid var(--border); }
.th-filter-seg:last-child { border-right: none; }
.th-filter-seg.active { background: var(--accent); color: white; }
.th-filter-foot { border-top: 1px solid var(--border); padding: 6px 10px; }
.th-filter-reset { background: transparent; border: none; color: var(--ink-2); font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 4px; font-family: inherit; }
.th-filter-reset:hover { color: var(--negative); background: var(--negative-soft); }
.ds-btn-badge { background: rgba(255,255,255,0.25); color: inherit; font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 6px; font-variant-numeric: tabular-nums; font-weight: 600; }
.ds-btn.ghost .ds-btn-badge { background: var(--accent-soft); color: var(--accent); }
.tx-header { background: var(--bg-subtle); border-bottom: 1px solid var(--border); font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.tx-header .th { display: flex; align-items: center; gap: 4px; }
.tx-header .th.right { justify-content: flex-end; }
.tx-header .sortable { cursor: pointer; }
.tx-header .sortable:hover { color: var(--text-primary); }
.tx-row { border-bottom: 1px solid var(--border-light); transition: background 0.15s; }
.tx-row:hover { background: var(--bg-subtle); }
.tx-row:last-child { border-bottom: none; }
.tx-row-transfer .td-amount, .tx-row-transfer .td-label > span { opacity: 0.6; }
.tx-transfer-badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--primary); padding: 2px 7px; border: 1px solid var(--primary-soft); background: var(--primary-soft); border-radius: 3px; flex-shrink: 0; cursor: pointer; font-family: inherit; transition: opacity .15s; }
.tx-transfer-badge:hover { opacity: 0.7; }
.tx-transfer-toggle { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; padding: 0; font-size: 11px; color: var(--text-tertiary); background: transparent; border: 1px solid var(--border); border-radius: 3px; cursor: pointer; flex-shrink: 0; opacity: 0; transition: opacity .15s, color .15s, border-color .15s; font-family: inherit; }
.tx-row:hover .tx-transfer-toggle { opacity: 1; }
.tx-transfer-toggle:hover { color: var(--primary); border-color: var(--primary); }
.tx-tags-inline { display: inline-flex; gap: 4px; align-items: center; flex-wrap: wrap; margin-left: 6px; }
.tx-tag-chip { background: var(--accent-soft); color: var(--accent); font-size: 10px; padding: 1px 7px; border-radius: 10px; border: none; cursor: pointer; font-family: inherit; line-height: 1.6; letter-spacing: 0.01em; }
.tx-tag-chip:hover { background: var(--accent); color: white; }
.tx-tag-add { background: transparent; color: var(--ink-3); font-size: 10px; padding: 1px 6px; border: 1px dashed var(--border); border-radius: 10px; cursor: pointer; font-family: inherit; opacity: 0; transition: opacity 0.15s; }
.tx-row:hover .tx-tag-add { opacity: 0.7; }
.tx-tag-add:hover { opacity: 1; color: var(--accent); border-color: var(--accent); }
.tx-tag-input { background: var(--bg-elev); border: 1px solid var(--accent); border-radius: 10px; padding: 1px 6px; font-size: 10px; width: 80px; outline: none; font-family: inherit; color: var(--ink); }
.tx-filter-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tx-filter-tag { background: var(--bg-subtle); color: var(--ink-2); border: 1px solid var(--border); padding: 4px 10px; border-radius: 16px; font-size: 12px; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; }
.tx-filter-tag:hover { border-color: var(--accent); color: var(--accent); }
.tx-filter-tag.active { background: var(--accent); color: white; border-color: var(--accent); }
.tx-filter-tag-count { font-size: 10px; opacity: 0.7; font-variant-numeric: tabular-nums; }
.td { font-size: 13px; }
.td-date { color: var(--text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums; }
.td-label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.td-label > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.recurring-toggle { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text-tertiary); cursor: pointer; flex-shrink: 0; }
.recurring-toggle:hover { background: var(--bg-subtle); color: var(--text-primary); }
.recurring-toggle.active { background: var(--purple-soft); border-color: var(--purple); color: var(--purple); }
.cat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; border: none; cursor: pointer; font-family: inherit; }
.cat-pill:hover { opacity: 0.85; }
.td-acc { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-amount { font-weight: 700; font-variant-numeric: tabular-nums; }
.td-amount.positive { color: var(--success); }
.td-amount.right { text-align: right; }
.td-actions { display: flex; gap: 4px; justify-content: flex-end; }
.tx-more { padding: 14px; text-align: center; font-size: 12px; color: var(--text-tertiary); background: var(--bg-subtle); }

/* ANALYSIS */
.analysis-view { display: flex; flex-direction: column; gap: 20px; }
.merchants-list { display: flex; flex-direction: column; gap: 8px; }
.merchant-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; }
.merchant-row:hover { background: var(--bg-subtle); }
.merchant-rank { font-size: 12px; font-weight: 800; color: var(--text-tertiary); width: 24px; font-variant-numeric: tabular-nums; }
.merchant-info { flex: 1; min-width: 0; }
.merchant-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.merchant-meta { font-size: 10px; color: var(--text-tertiary); }
.merchant-total { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }

/* SETTINGS */
.settings-view { display: flex; flex-direction: column; gap: 20px; }
.member-list { display: flex; flex-direction: column; gap: 8px; }
.member-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-subtle); border-radius: 10px; flex-wrap: wrap; }
.member-card .member-card-info { flex: 1 1 0; min-width: 0; }
.member-card-actions { display: flex; flex-direction: row; align-items: center; gap: 6px; }
.member-card-actions select { font-size: 11.5px; padding: 5px 9px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-elev); color: var(--text-primary); cursor: pointer; font-family: 'Geist Mono', ui-monospace, Menlo, monospace; letter-spacing: 0; transition: border-color .15s; }
.member-card-actions select:hover { border-color: var(--border-strong); }
.member-card-actions select:focus { outline: none; border-color: var(--accent); }
@media (max-width: 640px) {
  .member-card { gap: 10px; padding: 10px; align-items: center !important; }
  .member-card-actions { flex-basis: 100%; order: 3; gap: 6px; }
  .member-card-actions select { flex: 1 1 0; min-width: 0; max-width: none !important; }
}
.member-card:hover { background: var(--bg-card-hover); }
.member-card-info { flex: 1; min-width: 0; }
.member-card-name { font-size: 14px; font-weight: 600; letter-spacing: -0.005em; }
.member-card-role { font-size: 11.5px; color: var(--text-tertiary); margin-top: 3px; font-variant-numeric: tabular-nums; }
.settings-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
/* Sync/connection status banner — semantic, kept distinct from sober footnotes */
.settings-info { display: flex; gap: 10px; padding: 10px 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; line-height: 1.5; color: var(--text-secondary); margin-top: 14px; font-weight: 400; }
.settings-info svg { flex-shrink: 0; margin-top: 2px; }
/* Sober editorial footnote — Newsreader italic on a dotted top rule. Replaces
   the old "💡 tip" boxes for a calmer fintech-grade information density. */
.settings-footnote {
  margin: 14px 0 0;
  padding-top: 12px;
  border-top: 1px dotted var(--border);
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-tertiary);
  letter-spacing: -0.005em;
}
.settings-footnote strong { color: var(--text-secondary); font-weight: 500; font-style: normal; }
.settings-footnote code { font-family: 'Geist Mono', ui-monospace, Menlo, monospace; font-style: normal; font-size: 11.5px; padding: 1px 5px; background: var(--bg-subtle); border-radius: 4px; color: var(--text-secondary); }
.settings-footnote .sep { display: inline-block; padding: 0 6px; color: var(--ink-mute); font-style: normal; }

/* DCA — aligned with the canonical .card / .subview-header system */
.dca-view { display: flex; flex-direction: column; gap: 20px; }

/* Projection hero — la pièce centrale de la vue DCA. Courbe surface cobalt
   (valeur projetée) + ligne pointillée (capital versé) sur un horizon réglable. */
.dca-hero .card-header { align-items: center; }
.dca-horizon { display: inline-flex; gap: 4px; padding: 3px; background: var(--bg-subtle); border-radius: 8px; border: 1px solid var(--border); }
.dca-horizon-tab { padding: 4px 11px; border-radius: 5px; font-size: 11.5px; font-weight: 500; border: none; background: transparent; color: var(--text-tertiary); cursor: pointer; font-family: 'Geist Mono', ui-monospace, Menlo, monospace; letter-spacing: 0; font-variant-numeric: tabular-nums; transition: color .15s, background .15s; }
.dca-horizon-tab:hover { color: var(--text-secondary); }
.dca-horizon-tab.is-active { background: var(--bg-elev); color: var(--accent); box-shadow: 0 1px 0 rgba(0,0,0,.08); }
.dca-chart-wrap { margin: 4px -8px 8px; }
.dca-legend { display: flex; gap: 18px; padding: 0 8px 16px; font-size: 11.5px; color: var(--text-tertiary); }
.dca-legend-item { display: inline-flex; align-items: center; gap: 7px; }
.dca-legend-swatch { display: inline-block; width: 24px; height: 0; border-radius: 2px; }
.dca-legend-swatch.is-accent { height: 8px; background: linear-gradient(180deg, var(--accent) 0%, transparent 100%); opacity: .85; border: 1px solid var(--accent); border-bottom: none; }
.dca-legend-swatch.is-dashed { border-top: 1.5px dashed var(--text-tertiary); height: 1px; }
/* Filter chips — multi-select to include/exclude plans from the projection */
.dca-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 4px 0 14px; }
.dca-filter-label { font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; margin-right: 4px; }
.dca-chip { padding: 5px 11px; border-radius: 6px; font-size: 12px; font-weight: 500; border: 1px solid var(--border); background: transparent; color: var(--text-tertiary); cursor: pointer; font-family: inherit; letter-spacing: -0.005em; transition: color .15s, border-color .15s, background .15s; }
.dca-chip:hover { color: var(--text-secondary); border-color: var(--border-strong); }
.dca-chip.is-active { color: var(--accent); border-color: var(--accent-line, var(--accent)); background: var(--accent-soft); }

/* État actuel + projection — two columns separated by a dotted vertical rule */
.dca-state-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 24px; padding: 4px 0 18px; border-bottom: 1px dotted var(--border); margin-bottom: 14px; }
.dca-state-block + .dca-state-block { border-left: 1px dotted var(--border); padding-left: 24px; }
.dca-state-eyebrow { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 12.5px; color: var(--text-tertiary); margin-bottom: 12px; letter-spacing: -0.005em; }
.dca-state-row { display: flex; flex-wrap: wrap; gap: 24px; }
.dca-state-kpi { min-width: 0; }
.dca-state-kpi-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 5px; white-space: nowrap; }
.dca-state-kpi-value { font-size: 18px; font-weight: 600; letter-spacing: -0.015em; color: var(--ink); font-variant-numeric: tabular-nums; }
.dca-state-kpi-value.is-accent { color: var(--accent); }
.dca-state-kpi-value.is-positive { color: var(--positive); }
.dca-state-kpi-value.is-negative { color: var(--negative); }
@media (max-width: 820px) {
  .dca-state-grid { grid-template-columns: 1fr; gap: 18px; }
  .dca-state-block + .dca-state-block { border-left: none; border-top: 1px dotted var(--border); padding-left: 0; padding-top: 18px; }
}
.dca-next-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.dca-next-card { background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.dca-next-date { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.dca-next-name { font-size: 13px; font-weight: 500; color: var(--ink); letter-spacing: -0.005em; }
.dca-next-amount { font-size: 15px; font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

/* MODAL */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.62); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); animation: modalFadeIn .15s ease-out; }
.modal { background: var(--bg-card); border-radius: 14px; max-width: 540px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-xl); border: 1px solid var(--border-strong); animation: modalSlideIn .18s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes modalSlideIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
.modal--wizard { max-width: 720px; }
.modal--detail { max-width: 1100px; }

/* Wizard layout */
.wizard-body { display: grid; grid-template-columns: 220px 1fr; min-height: 360px; }
.wizard-steps { display: flex; flex-direction: column; gap: 2px; padding: 16px 12px; border-right: 1px solid var(--border); background: var(--bg-subtle); }
.wizard-step { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; background: transparent; cursor: pointer; border-radius: 8px; font-family: inherit; font-size: 13px; color: var(--text-secondary); text-align: left; transition: background 0.15s, color 0.15s; }
.wizard-step:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.wizard-step.active { background: var(--bg-card); color: var(--text-primary); font-weight: 600; box-shadow: var(--shadow-sm); }
.wizard-step.done { color: var(--text-primary); }
.wizard-step-num { width: 22px; height: 22px; border-radius: 50%; background: var(--bg-page); border: 1px solid var(--border); color: var(--text-tertiary); font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.wizard-step.active .wizard-step-num { background: var(--primary); color: var(--bg-page); border-color: var(--primary); }
.wizard-step.done .wizard-step-num { background: var(--primary-soft); color: var(--primary); border-color: var(--primary-soft); }
.wizard-pane { padding: 24px 28px; display: flex; flex-direction: column; gap: 14px; }
.wizard-pane label > span em { font-style: normal; font-weight: 400; color: var(--text-tertiary); margin-left: 6px; font-size: 11px; }
.wizard-footer { gap: 8px; align-items: center; }

/* Loan detail */
.liability-card-v2.clickable { cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.liability-card-v2.clickable:hover { border-color: var(--primary); background: var(--bg-card-hover); }
.loan-detail-body { padding: 24px 28px; display: flex; flex-direction: column; gap: 24px; }
.loan-detail-top { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }
.loan-amort-block { display: flex; flex-direction: column; gap: 4px; }
.loan-amort-period { font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.04em; text-transform: uppercase; }
.loan-amort-value { font-size: 38px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.loan-amort-meta { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }

.loan-monthly-card { background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.loan-monthly-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); }
.loan-monthly-value { font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; }
.loan-monthly-sub { font-size: 12px; color: var(--text-tertiary); margin-top: -6px; }
.loan-monthly-breakdown { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 12px 0; border-top: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light); font-size: 13px; }
.loan-monthly-breakdown div { display: flex; align-items: center; gap: 8px; }
.loan-monthly-breakdown div:nth-child(even) { justify-content: flex-end; font-variant-numeric: tabular-nums; font-weight: 500; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-cap { background: var(--primary); }
.dot-int { background: var(--info); }
.dot-ins { background: var(--purple); }
.loan-monthly-stats { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.loan-monthly-stats > div { display: flex; justify-content: space-between; }
.loan-monthly-stats span { color: var(--text-tertiary); }
.loan-monthly-stats strong { font-variant-numeric: tabular-nums; color: var(--text-primary); }
.loan-pct-pill { font-size: 11px; padding: 8px 12px; border-radius: 999px; background: var(--primary-soft); color: var(--primary-text); text-align: center; border: 1px solid var(--primary-soft); }

.loan-section-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0; }
.loan-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.loan-summary-card { padding: 18px; border-radius: 12px; background: var(--bg-subtle); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.loan-summary-label { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); }
.loan-summary-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.loan-summary-rows { display: flex; flex-direction: column; gap: 4px; font-size: 12px; padding-top: 6px; border-top: 1px solid var(--border-light); }
.loan-summary-rows > div { display: flex; justify-content: space-between; }

/* ============================================================================
 * LiabilityDetail — Finary-style refonte (LoanFinary)
 * ============================================================================ */
.loan-finary { max-width: 1180px; padding: 0; }

.loan-finary-topbar { display: flex; align-items: center; gap: 12px; padding: 14px 26px; border-bottom: 1px solid var(--border-light); }
.loan-finary-back { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text-secondary); cursor: pointer; transition: color .15s, background .15s, border-color .15s; }
.loan-finary-back:hover { color: var(--text-primary); background: var(--bg-card-hover); border-color: var(--border-strong); }
.loan-finary-pagetitle { font-size: 18px; font-weight: 500; letter-spacing: -0.025em; color: var(--text-primary); }
.loan-finary-topbar-actions { margin-left: auto; display: flex; gap: 6px; }

.loan-finary-kpi-strip { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 24px; align-items: end; padding: 24px 28px 18px; }
.loan-finary-title-block { display: flex; flex-direction: column; gap: 6px; }
.loan-finary-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--text-tertiary); font-weight: 500; }
.loan-finary-title { margin: 0; font-size: 26px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; color: var(--text-primary); }

.loan-finary-kpis { display: flex; gap: 36px; align-items: end; }
.loan-finary-kpi { display: flex; flex-direction: column; gap: 8px; min-width: 120px; }
.loan-finary-kpi-label { font-size: 11px; color: var(--text-tertiary); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
.loan-finary-kpi-value { font-family: 'DM Mono', ui-monospace, monospace; font-size: 16px; font-weight: 500; color: var(--text-primary); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.loan-finary-progress { width: 110px; height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; border: 1px solid var(--border); }
.loan-finary-progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary) 0%, var(--primary-hover) 100%); border-radius: 3px; transition: width .3s ease; }

.loan-finary-tabs { display: flex; gap: 24px; padding: 0 28px; border-bottom: 1px solid var(--border); margin-top: 4px; justify-content: flex-end; }
.loan-finary-tabs button { background: none; border: none; padding: 12px 0; color: var(--text-tertiary); font-size: 13.5px; font-weight: 500; cursor: pointer; font-family: inherit; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s, border-color .15s; letter-spacing: -0.005em; }
.loan-finary-tabs button:hover { color: var(--text-primary); }
.loan-finary-tabs button.active { color: var(--text-primary); border-bottom-color: var(--primary); }

.loan-finary-body { padding: 28px; display: flex; flex-direction: column; gap: 24px; }
.loan-finary-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; align-items: start; }

.loan-finary-chart { background: transparent; }

.loan-finary-details { display: flex; flex-direction: column; gap: 22px; }
.loan-finary-detail-block { padding-bottom: 14px; border-bottom: 1px solid var(--border-light); }
.loan-finary-detail-block:last-child { border-bottom: none; padding-bottom: 0; }
.loan-finary-detail-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 8px; }
.loan-finary-detail-head > span:first-child { font-size: 14px; color: var(--text-primary); font-weight: 500; }
.loan-finary-detail-value { font-family: 'DM Mono', ui-monospace, monospace; font-size: 16px; font-weight: 500; color: var(--text-primary); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.loan-finary-sub { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.loan-finary-sub li { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; color: var(--text-tertiary); padding: 2px 0; }
.loan-finary-sub li > span:last-child { color: var(--text-secondary); font-variant-numeric: tabular-nums; }

.loan-finary-linked { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; text-align: left; font-family: inherit; width: 100%; transition: background 120ms cubic-bezier(.2,.6,.2,1), border-color 120ms cubic-bezier(.2,.6,.2,1); }
.loan-finary-linked:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--border-strong); }
.loan-finary-linked:hover:not(:disabled) .loan-finary-linked-chevron { color: var(--accent); transform: translateX(2px); }
.loan-finary-linked:disabled { cursor: default; }
.loan-finary-linked-icon { width: 38px; height: 38px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.loan-finary-linked-text { flex: 1; min-width: 0; }
.loan-finary-linked-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 500; }
.loan-finary-linked-name { font-size: 14px; color: var(--text-primary); font-weight: 500; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.loan-finary-linked-chevron { color: var(--text-tertiary); flex-shrink: 0; transition: transform 120ms cubic-bezier(.2,.6,.2,1), color 120ms cubic-bezier(.2,.6,.2,1); }

.loan-finary-meta { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); padding: 4px 0; }

.loan-finary-table-wrap { overflow-x: auto; max-height: 60vh; border: 1px solid var(--border); border-radius: 10px; }
.loan-finary-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 720px; }
.loan-finary-table th { position: sticky; top: 0; background: var(--bg-card); text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-tertiary); font-size: 10.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; z-index: 1; }
.loan-finary-table th.right { text-align: right; }
.loan-finary-table th.center { text-align: center; }
.loan-finary-table td { padding: 9px 14px; border-bottom: 1px solid var(--border-light); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.loan-finary-table td.right { text-align: right; }
.loan-finary-table td.center { text-align: center; }
.loan-finary-table tr.paid td { color: var(--text-tertiary); }
.loan-finary-table tr.pending td:first-child { color: var(--text-primary); }
.loan-finary-table tr:last-child td { border-bottom: none; }
.loan-finary-status { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
.loan-finary-status.paid { background: var(--success-soft); color: var(--success); }
.loan-finary-status.pending { background: var(--bg-subtle); color: var(--text-tertiary); }

/* Loan — Mensualité panel (right side of synth grid) */
.loan-monthly-panel { display: flex; flex-direction: column; gap: 10px; padding: 22px 22px 20px; background: var(--bg-card, var(--bg-elev)); border: 1px solid var(--border); border-radius: 16px; }
.loan-monthly-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--text-tertiary); font-weight: 500; }
.loan-monthly-amount { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-weight: 400; font-size: 38px; line-height: 1.05; letter-spacing: -0.02em; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.loan-monthly-amount em { font-style: italic; }
.loan-monthly-sub { font-size: 12px; color: var(--text-tertiary); margin-top: -4px; }

.loan-monthly-breakdown { list-style: none; margin: 12px 0 0; padding: 14px 0 0; border-top: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 8px; }
.loan-monthly-breakdown li { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 10px; }
.loan-monthly-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.loan-monthly-label { font-size: 13px; color: var(--text-secondary); }
.loan-monthly-value { font-size: 13px; color: var(--text-primary); font-weight: 500; font-variant-numeric: tabular-nums; }

.loan-monthly-stats { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-light); }
.loan-monthly-stat { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.loan-monthly-stat-label { font-size: 12.5px; color: var(--text-tertiary); }
.loan-monthly-stat-value { font-size: 13px; color: var(--text-primary); font-weight: 500; font-variant-numeric: tabular-nums; text-transform: capitalize; }

.loan-progress-text { margin: 14px 0 0; padding-top: 14px; border-top: 1px solid var(--border-light); font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; }
.loan-progress-text em { font-family: 'Newsreader', Georgia, serif; font-style: italic; color: var(--text-secondary); }
.loan-progress-text strong { color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; }

/* Loan — 3 synth cards horizontaux */
.loan-synth-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.loan-synth-card { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; border-radius: 12px; }
.loan-synth-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--text-tertiary); font-weight: 500; }
.loan-synth-value { font-size: 22px; font-weight: 500; letter-spacing: -0.02em; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.loan-synth-sub { list-style: none; margin: 6px 0 0; padding: 10px 0 0; border-top: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 6px; }
.loan-synth-sub li { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; color: var(--text-tertiary); }
.loan-synth-sub li > span:last-child { color: var(--text-secondary); font-variant-numeric: tabular-nums; }

@media (max-width: 900px) {
  .loan-synth-cards { grid-template-columns: 1fr; }
}

/* RealEstateDetail — Finary-style rich view (mirrors LiabilityDetail polish) */
.re-finary-page { max-width: 1100px; }
.re-kpi-strip {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px;
}
.re-stats { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.re-stat-row {
  display: flex; justify-content: space-between;
  font-size: 13px; color: var(--ink); padding: 4px 0;
}
.re-stat-row span:first-child { color: var(--ink-2); }
@media (max-width: 900px) {
  .re-kpi-strip { grid-template-columns: 1fr; }
}

/* Dot palette swatches for KPI breakdown rows (acquisition cost split) */
.dot-cobalt { background: var(--accent, #2540D9); }
.dot-sage   { background: var(--d2, #6B8E7A); }
.dot-terra  { background: var(--d3, #B0392B); }
.dot-ocre   { background: var(--d7, #8E641A); }
.dot-mauve  { background: var(--d4, #8B6E9E); }

/* Investment allocation donut + list (InvestmentDetail) */
.invest-allocation { margin-top: 24px; }
.invest-allocation-list {
  display: flex; flex-direction: column; gap: 6px;
  margin-top: 12px; font-size: 13px;
}
.invest-allocation-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px dotted var(--border-strong, var(--border));
}
.invest-allocation-row:last-child { border-bottom: none; }
.invest-allocation-dot {
  display: inline-block; width: 10px; height: 10px;
  border-radius: 50%; margin-right: 8px; vertical-align: middle;
}
.crypto-ticker {
  font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px;
  color: var(--ink-3, var(--text-tertiary)); text-transform: uppercase; letter-spacing: .05em;
}

/* Language switcher — small inline FR · EN toggle in sidebar utilities + mobile header */
.lang-btn { display: inline-flex; align-items: center; gap: 4px; height: 36px; padding: 0 10px; border-radius: 10px; background: var(--bg-subtle); border: 1px solid var(--border); color: var(--text-tertiary); font-family: 'DM Mono', ui-monospace, monospace; font-size: 11px; letter-spacing: 0.06em; cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.lang-btn:hover { background: var(--bg-card-hover); border-color: var(--border-strong, var(--border)); }
.lang-btn-side { color: var(--text-tertiary); transition: color .15s; }
.lang-btn-side.on { color: var(--primary); font-weight: 600; }
.lang-btn-sep { color: var(--text-faint, var(--text-tertiary)); opacity: 0.5; }
@media (max-width: 1023px) { .lang-btn { height: 32px; padding: 0 8px; font-size: 10.5px; } }

@media (max-width: 900px) {
  .loan-finary-kpi-strip { grid-template-columns: 1fr; align-items: start; }
  .loan-finary-kpis { gap: 18px; flex-wrap: wrap; }
  .loan-finary-kpi { min-width: 100px; }
  .loan-finary-grid { grid-template-columns: 1fr; }
  .loan-finary-tabs { padding: 0 18px; justify-content: flex-start; }
  .loan-finary-body { padding: 18px; }
}
.loan-summary-rows span:first-child { color: var(--text-tertiary); }
.loan-summary-rows span:last-child { font-variant-numeric: tabular-nums; }

.loan-meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
.loan-meta-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: var(--bg-subtle); border: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); }
.loan-meta-pill strong { color: var(--text-primary); }

/* Net worth chart */
.nw-chart { display: flex; flex-direction: column; gap: 18px; }
.nw-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; flex-wrap: wrap; }
.nw-header-left { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.nw-current-value { font-size: 36px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--text-primary); line-height: 1.1; }
.nw-current-delta { font-size: 13px; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.nw-current-delta.positive { color: var(--success); }
.nw-current-delta.negative { color: var(--danger); }
.nw-pct { opacity: 0.85; }
.nw-period-label { color: var(--text-tertiary); margin-left: 6px; font-weight: 500; }
.nw-toggles { display: flex; align-items: center; gap: 12px; }
.nw-toggle-group { display: inline-flex; padding: 3px; background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: 8px; gap: 2px; }
.nw-toggle-group button { padding: 6px 14px; font-size: 12px; font-weight: 500; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; border-radius: 6px; font-family: inherit; transition: background 0.15s, color 0.15s; }
.nw-toggle-group button:hover { color: var(--text-primary); }
.nw-toggle-group button.active { background: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm); }
.nw-period-bar { display: inline-flex; gap: 4px; padding: 4px 0; align-self: flex-start; }
.nw-period-bar button { font-size: 11.5px; padding: 5px 11px; border-radius: 999px; border: 1px solid transparent; background: transparent; color: var(--text-tertiary); cursor: pointer; font-family: inherit; font-weight: 500; transition: all 0.15s; }
.nw-period-bar button:hover { color: var(--text-primary); background: var(--bg-subtle); }
.nw-period-bar button.active { background: var(--bg-subtle); color: var(--primary); border-color: var(--border); font-weight: 600; }

/* Cashflow */
.cashflow-view { display: flex; flex-direction: column; gap: 16px; }
.cashflow-period { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 4px 0; }
.cashflow-period-nav { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 999px; }
.cashflow-period-label { font-size: 13px; font-weight: 600; color: var(--text-primary); min-width: 140px; text-align: center; text-transform: capitalize; }
.cashflow-grid { display: grid; grid-template-columns: 1fr 360px; gap: 16px; }
@media (max-width: 1100px) { .cashflow-grid { grid-template-columns: 1fr; } }
.cashflow-sankey-card { display: flex; flex-direction: column; gap: 14px; }
.cashflow-distribution-card { position: relative; display: flex; flex-direction: column; }
.cashflow-donut-center { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; padding-bottom: 12px; }
.cashflow-donut-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; }
.cashflow-donut-value { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.cashflow-donut-value.positive { color: var(--success); }
.cashflow-donut-value.negative { color: var(--danger); }
.cashflow-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding-top: 12px; border-top: 1px solid var(--border-light); }
.cashflow-kpi { display: flex; flex-direction: column; gap: 2px; }
.cashflow-kpi-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 6px; }
.cashflow-kpi-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.cashflow-kpi-value.positive { color: var(--success); }
.cashflow-kpi-value.negative { color: var(--danger); }
.cashflow-cats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .cashflow-cats-grid { grid-template-columns: 1fr; } }
.cashflow-cat-list { display: flex; flex-direction: column; gap: 4px; }
.cashflow-cat-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; transition: background 0.15s; }
.cashflow-cat-row:hover { background: var(--bg-subtle); }
.cashflow-cat-icon { width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.cashflow-cat-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cashflow-cat-name { font-size: 13px; color: var(--text-primary); font-weight: 500; }
.cashflow-cat-meta { font-size: 11px; color: var(--text-tertiary); }
.cashflow-cat-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cashflow-cat-amount.positive { color: var(--success); }
.cashflow-cat-amount.negative { color: var(--danger); }

/* Patrimoine sub-nav */
.wealth-subnav { display: flex; gap: 4px; padding: 4px; background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: 10px; overflow-x: auto; }
.wealth-subnav-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: none; background: transparent; color: var(--text-secondary); font-size: 13px; font-weight: 500; border-radius: 7px; cursor: pointer; transition: color 0.18s, background 0.18s; font-family: inherit; white-space: nowrap; letter-spacing: -0.01em; }
.wealth-subnav-btn svg { color: var(--text-tertiary); transition: color 0.18s; }
.wealth-subnav-btn:hover { background: var(--bg-card); color: var(--text-primary); }
.wealth-subnav-btn:hover svg { color: var(--text-secondary); }
.wealth-subnav-btn.active { background: var(--bg-card); color: var(--primary); box-shadow: 0 1px 0 0 var(--border-light), inset 0 0 0 1px var(--border); font-weight: 600; }
.wealth-subnav-btn.active svg { color: var(--primary); }
.wealth-subnav-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; font-size: 10.5px; background: var(--bg-subtle); color: var(--text-tertiary); font-weight: 600; }
.wealth-subnav-btn.active .wealth-subnav-count { background: var(--primary-soft); color: var(--primary); }

.subview-hero { display: flex; align-items: flex-end; justify-content: space-between; padding: 26px 28px; }
.subview-hero-info { display: flex; flex-direction: column; gap: 6px; }
.subview-hero-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--text-tertiary); font-weight: 500; }
.subview-hero-value { font-size: clamp(36px, 6vw, 56px); font-weight: 500; letter-spacing: -0.04em; line-height: 1.05; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.subview-hero-meta { font-size: 12.5px; color: var(--text-tertiary); margin-top: 4px; }

/* Compléter mon patrimoine picker */
.patrimoine-picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; max-height: 420px; overflow-y: auto; padding-right: 4px; }
.patrimoine-picker-card { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; background: var(--bg-subtle); border: 1px solid var(--border); cursor: pointer; text-align: left; font-family: inherit; transition: border-color 0.15s, background 0.15s; }
.patrimoine-picker-card:hover { border-color: var(--primary); background: var(--bg-card-hover); }
.ppc-icon { width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ppc-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ppc-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.ppc-desc { font-size: 11px; color: var(--text-tertiary); }
@media (max-width: 700px) { .patrimoine-picker-grid { grid-template-columns: 1fr; } }




.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 22px 26px 18px; border-bottom: 1px solid var(--border-light); }
.modal-header h2 { font-size: 19px; font-weight: 500; letter-spacing: -0.025em; margin: 0; color: var(--text-primary); }
.modal-body { padding: 22px 26px; display: flex; flex-direction: column; gap: 16px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 26px; border-top: 1px solid var(--border-light); background: var(--bg-subtle); }
.member-checks { display: flex; flex-wrap: wrap; gap: 8px; }
.member-check { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 22px; font-size: 12px; cursor: pointer; transition: all 0.15s; font-weight: 600; }
.member-check:hover { background: var(--bg-card-hover); }
.member-check.active { background: var(--primary-soft); border-color: var(--primary); }
.member-check input { display: none; }
.color-picker { display: flex; gap: 8px; flex-wrap: wrap; }
.color-dot { width: 32px; height: 32px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; transition: all 0.15s; }
.color-dot.active { border-color: var(--text-primary); transform: scale(1.1); }

/* IMPORT */
.import-flow { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; box-shadow: var(--shadow-sm); }
.import-header { margin-bottom: 24px; }
.import-header h2 { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-size: 28px; font-weight: 400; margin: 12px 0 4px; letter-spacing: -0.018em; line-height: 1.1; }
.import-header h2 em { font-style: italic; color: var(--primary); font-weight: 400; }
.import-header p { font-size: 13px; color: var(--text-tertiary); margin: 0; }
.import-progress { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.import-progress .step { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); font-weight: 600; }
.import-progress .step.active { color: var(--primary); }
.import-progress .step.done { color: var(--success); }
.import-progress .step-num { width: 22px; height: 22px; border-radius: 50%; background: var(--bg-subtle); border: 2px solid var(--border); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
.import-progress .step.active .step-num { background: var(--primary); color: white; border-color: var(--primary); }
.import-progress .step.done .step-num { background: var(--success); color: white; border-color: var(--success); }
.upload-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; border: 2px dashed var(--border-strong); border-radius: 14px; cursor: pointer; transition: all 0.2s; gap: 12px; background: var(--bg-subtle); }
.upload-zone:hover { border-color: var(--primary); background: var(--primary-soft); }
.upload-icon { width: 56px; height: 56px; border-radius: 14px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; }
.upload-main { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.upload-sub { font-size: 12px; color: var(--text-tertiary); }
.import-tips { display: flex; gap: 10px; padding: 12px; background: var(--warning-soft); color: var(--warning-text); border-radius: 10px; font-size: 12px; line-height: 1.5; margin-top: 16px; font-weight: 400; }
.import-tips svg { flex-shrink: 0; margin-top: 2px; }
.detection-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--success-soft); color: var(--success-text); border-radius: 8px; font-size: 12px; font-weight: 600; margin-top: 8px; }
.mapping-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px; }
.mapping-field { display: flex; flex-direction: column; gap: 6px; }
.mapping-field.required .mapping-label::after { content: ' *'; color: var(--danger); }
.mapping-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; }
.csv-preview { padding: 12px; background: var(--bg-subtle); border-radius: 10px; margin-bottom: 20px; font-size: 11px; overflow-x: auto; }
.csv-preview strong { display: block; margin-bottom: 8px; }
.csv-preview table { width: 100%; border-collapse: collapse; }
.csv-preview th, .csv-preview td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.csv-preview th { font-weight: 700; color: var(--text-secondary); }
.account-form { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; }
.preview-list { max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; }
.preview-row { display: grid; grid-template-columns: 80px 1fr 130px 100px; gap: 10px; padding: 8px 12px; align-items: center; border-bottom: 1px solid var(--border-light); font-size: 12px; }
.preview-row:last-child { border-bottom: none; }
.ai-badge { display: inline-flex; align-items: center; margin-left: 6px; font-size: 11px; vertical-align: middle; opacity: 0.85; }
.prev-date { color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.prev-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prev-cat { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prev-amount { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.prev-amount.positive { color: var(--success); }
.preview-more { padding: 10px; text-align: center; font-size: 12px; color: var(--text-tertiary); background: var(--bg-subtle); }
.flow-actions { display: flex; justify-content: space-between; gap: 12px; }

/* TOAST */
.toast { position: fixed; top: 20px; right: 20px; z-index: 2000; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); animation: slideIn 0.3s ease-out; max-width: 360px; }
.toast-success { border-color: var(--success); }
.toast-warning { border-color: var(--warning); }
.toast-error { border-color: var(--danger); }
.toast-content { font-size: 13px; font-weight: 600; }
@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

/* ============================================================================
 * MOBILE RESPONSIVE — bottom nav, full-screen modals, table compression
 * Single breakpoint at 760px covers phones + most small tablets in portrait.
 * ============================================================================ */
@media (max-width: 760px) {
  /* Header: compact, single row, hide tagline */
  .app-header { padding: 10px 14px; gap: 8px; flex-wrap: nowrap; }
  .brand { gap: 10px; min-width: 0; }
  .brand-tagline { display: none; }
  .brand-name { font-size: 15px; }
  .brand-mark { width: 32px; height: 32px; }
  .header-actions { gap: 4px; flex-shrink: 0; }
  .icon-btn { width: 32px; height: 32px; }

  /* Page content: extra bottom padding to clear the bottom nav */
  .content { padding: 16px 14px calc(96px + env(safe-area-inset-bottom, 0px)); }
  .page-title { font-size: 22px; }
  .monthly-header h1 { font-size: 22px; }

  /* Member bar shrinks */
  .member-bar { padding: 10px 14px 0; }
  .member-tab { padding: 6px 10px 6px 6px; font-size: 12px; }
  .member-tab .role-badge { display: none; }
  .member-context { font-size: 11px; padding: 8px 0; }

  /* Main nav becomes a fixed bottom tab bar (native-app feel) */
  .main-nav {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 90;
    display: flex;
    justify-content: space-around;
    background: ${dark ? 'rgba(15, 14, 12, 0.92)' : 'rgba(247, 246, 242, 0.92)'};
    backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%);
    border-top: 1px solid var(--border);
    border-radius: 0;
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
    overflow-x: visible;
    gap: 0;
  }
  .main-nav button {
    flex: 1;
    flex-direction: column;
    gap: 3px;
    padding: 6px 4px;
    font-size: 10px;
    font-weight: 500;
    border-radius: 6px;
    color: var(--text-tertiary);
    min-width: 0;
    background: transparent;
  }
  .main-nav button svg { width: 18px; height: 18px; }
  .main-nav button span { font-size: 10px; line-height: 1.1; white-space: nowrap; }
  .main-nav button:hover { background: transparent; color: var(--text-secondary); }
  .main-nav button.active { background: transparent; color: var(--primary); box-shadow: none; }
  .main-nav button { position: relative; }
  .nav-alert-dot {
    position: absolute;
    top: 4px;
    right: 16px;
    margin-left: 0;
    min-width: 14px;
    height: 14px;
    font-size: 9px;
    padding: 0 4px;
  }

  /* Cards: less padding */
  .card { padding: 18px; border-radius: 10px; }
  .kpi-card { padding: 18px; border-radius: 10px; }
  .kpi-card-value { font-size: 24px; }
  .kpi-card--primary .kpi-card-value { font-size: 28px; }
  .card-header { margin-bottom: 14px; }

  /* Hero KPIs already collapse via existing rule. Tighten gaps. */
  .hero-kpis { gap: 10px; }
  .dashboard-grid { grid-template-columns: 1fr; gap: 12px; }
  .dashboard { gap: 16px; }

  /* Trésorerie / Wealth grids stack */
  .monthly-kpis { grid-template-columns: 1fr 1fr; gap: 8px; }
  .mk-card { padding: 12px 14px; gap: 10px; }
  .mk-icon { width: 32px; height: 32px; }
  .mk-value { font-size: 17px; }
  .wealth-kpis { grid-template-columns: 1fr 1fr; }
  .wealth-summary { grid-template-columns: 1fr; }
  .ws-card { padding: 14px 16px; gap: 12px; }
  .ws-value { font-size: 19px; }
  .budget-summary { grid-template-columns: 1fr; }
  .ratio-cards { grid-template-columns: 1fr; }
  .projection-grid { grid-template-columns: 1fr; }

  /* Allocation donut + legend stack */
  .allocation-body { flex-direction: column; gap: 16px; }
  .composition-row { flex-direction: column; gap: 16px; }
  .legend-list { padding-left: 0; width: 100%; }

  /* Modals slide up from the bottom on mobile, full width */
  .modal-backdrop { padding: 0; align-items: flex-end; }
  .modal {
    max-width: 100%;
    max-height: 92vh;
    border-radius: 14px 14px 0 0;
    border-bottom: none;
  }
  .modal-header { padding: 16px 18px; }
  .modal-body { padding: 16px 18px; }
  .modal-footer { padding: 14px 18px; }

  /* Transactions table → card-style rows on mobile */
  .tx-table { border-radius: 10px; }
  .tx-header { display: none; }
  .tx-row {
    grid-template-columns: 1fr auto;
    gap: 4px 10px;
    padding: 12px 14px;
    align-items: start;
  }
  .tx-row .td-date { grid-column: 1 / -1; font-size: 10px; order: 1; margin-bottom: 2px; }
  .tx-row .td-label { grid-column: 1; order: 2; min-width: 0; }
  .tx-row .td-cat, .tx-row .td-acc { grid-column: 1; order: 3; font-size: 11px; }
  .tx-row .td-amount { grid-column: 2; order: 2; font-size: 14px; align-self: center; }
  .tx-row .td-actions { grid-column: 1 / -1; order: 4; justify-content: flex-end; margin-top: 4px; }

  /* Filters bar: stack and smaller */
  .filters-bar { padding: 10px; gap: 6px; }
  .search-box { min-width: 0; flex: 1 1 100%; order: -1; }
  .result-count { display: none; }

  /* Onboarding: tighter padding */
  .onboarding { padding: 16px 12px; }
  .onboarding-card { padding: 24px 20px; border-radius: 14px; }
  .onboarding-step-content h1 { font-size: 22px; }
  .onboarding-step-content h2 { font-size: 19px; }
  .onboarding-features-grid { grid-template-columns: 1fr; }

  /* Import flow: tighter */
  .import-flow { padding: 18px; border-radius: 12px; }
  .upload-zone { padding: 32px 16px; }

  /* Buttons: full-width primary CTAs feel native on mobile */
  .primary-btn-large { width: 100%; justify-content: center; }
  .empty-actions .primary-btn-large { width: auto; }
  .flow-actions { flex-wrap: wrap; }

  /* Toast spans full width minus padding */
  .toast { left: 12px; right: 12px; top: 12px; max-width: none; }

  /* Recent additions — keep 3-col grids from overflowing on phones */
  .loan-summary-grid { grid-template-columns: 1fr; }
  .cashflow-kpi-row { grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .cashflow-period-label { min-width: 0; flex: 1; font-size: 12px; }
  .rest-hero-stats { min-width: 0; align-items: flex-start; }
}

/* Phones — 8 nav items don't fit text labels under ~520px, drop to icons. */
@media (max-width: 520px) {
  .main-nav button span { display: none; }
  .main-nav button svg { width: 20px; height: 20px; }
  .main-nav button { padding: 8px 4px; }
  .nav-alert-dot { top: 2px; right: 8px; }
}

/* Very narrow phones — extra tightening */
@media (max-width: 380px) {
  .monthly-kpis { grid-template-columns: 1fr; }
  .wealth-kpis { grid-template-columns: 1fr; }
  .cashflow-kpi-row { grid-template-columns: 1fr; }
}

/* ============================================================================
   WealthItemRow (v6 unified patrimoine list)
   ============================================================================ */
.wealth-items-list { display: flex; flex-direction: column; }
.wealth-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 8px;
  transition: border-color .15s;
}
.wealth-item-row[role="button"]:hover { border-color: var(--accent); }
.wealth-item-row-left { display: flex; gap: 12px; align-items: center; }
.wealth-item-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg-sunk); color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 13px;
}
.wealth-item-name { font-weight: 600; font-size: 14px; color: var(--ink); }
.wealth-item-meta { font-size: 11px; color: var(--ink-2); margin-top: 2px; display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.wealth-item-meta-muted { color: var(--ink-3); }
.wealth-item-bank { font-weight: 500; color: var(--ink); letter-spacing: 0.01em; }
.wealth-item-bank::after { content: '·'; margin-left: 6px; color: var(--ink-3); }
.badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 500;
  display: inline-block;
}
.badge-synced { background: var(--accent-soft); color: var(--accent); }
.badge-manual { background: var(--bg-sunk); color: var(--ink-2); }
.wealth-item-row-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.wealth-item-value {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  font-size: 18px;
  color: var(--ink);
}
.wealth-item-delta { font-size: 11px; margin-top: 2px; }
.wealth-item-delta.up { color: var(--positive); }
.wealth-item-delta.down { color: var(--negative); }
.wealth-item-delete-btn {
  display: none; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px; border: none;
  background: transparent; color: var(--negative); cursor: pointer;
  margin-top: 2px; opacity: .7; transition: opacity .15s, background .15s;
}
.wealth-item-delete-btn:hover { background: color-mix(in srgb, var(--negative) 10%, transparent); opacity: 1; }
.wealth-item-row:hover .wealth-item-delete-btn { display: flex; }
.wealth-empty-state {
  text-align: center;
  padding: 60px 24px;
  background: var(--bg-elev);
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  margin: 16px 0;
}
.wealth-empty-state p {
  font-family: 'Geist', sans-serif;
  font-size: 14px;
  color: var(--ink-2);
  margin: 0 0 14px;
}
.wealth-empty-state p em {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  color: var(--ink);
}
.wealth-empty-state .primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ---- AddWealthModal wizard (Tasks 10-12) ---- */
.modal-eyebrow {
  font-family: 'Geist Mono', monospace;
  font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
  color: var(--ink-3); margin: 0 0 12px;
}
.cat-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
}
.cat-card {
  text-align: left; padding: 14px; border: 1px solid var(--border);
  background: var(--bg-elev); border-radius: 10px;
  cursor: pointer; display: flex; flex-direction: column; gap: 4px;
  font-family: inherit;
}
.cat-card:hover { border-color: var(--accent); background: var(--bg); }
.cat-card.selected { border-color: var(--accent); background: var(--accent-soft); }
.cat-card-ic {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--bg-sunk); color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 6px;
}
.cat-card.selected .cat-card-ic { background: white; color: var(--accent); }
.cat-card-name { font-weight: 600; font-size: 13.5px; color: var(--ink); }
.cat-card-desc { font-size: 11.5px; color: var(--ink-2); line-height: 1.4; }

.subcat-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
.subcat-chip {
  padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--bg-elev); font-size: 12px; color: var(--ink-2); cursor: pointer;
  font-family: inherit;
}
.subcat-chip.selected {
  background: var(--accent-soft); border-color: var(--accent);
  color: var(--accent); font-weight: 500;
}

.mode-pick { display: flex; flex-direction: column; gap: 8px; }
.mode-row {
  display: flex; gap: 14px; align-items: center;
  padding: 14px 16px; border: 1px solid var(--border);
  border-radius: 10px; cursor: pointer; background: var(--bg-elev);
  text-align: left; width: 100%; font-family: inherit;
}
.mode-row:hover { border-color: var(--accent); }
.mode-row.selected { border-color: var(--accent); background: var(--accent-soft); }
.mode-ic {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg-sunk); color: var(--ink-2);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.mode-row.selected .mode-ic { background: white; color: var(--accent); }
.mode-title { font-weight: 600; font-size: 13.5px; margin-bottom: 2px; color: var(--ink); }
.mode-sub { font-size: 11.5px; color: var(--ink-2); }

.form-row { margin-bottom: 14px; }
.form-row-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 0; }
.form-row-2col > .form-row { margin-bottom: 14px; }
@media (max-width: 540px) { .form-row-2col { grid-template-columns: 1fr; gap: 0; } }
.form-label {
  display: block; font-size: 11.5px; text-transform: uppercase;
  letter-spacing: .04em; color: var(--ink-3); margin-bottom: 4px;
  font-family: 'Geist Mono', monospace;
}
.form-input {
  width: 100%; border: 1px solid var(--border); border-radius: 8px;
  padding: 9px 12px; font-family: inherit; font-size: 13.5px;
  color: var(--ink); background: var(--bg-elev); box-sizing: border-box;
}
.form-input:focus { outline: 2px solid var(--accent-soft); border-color: var(--accent); }
.form-row-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-hint { font-size: 11px; font-family: 'Geist', system-ui; text-transform: none; letter-spacing: 0; color: var(--ink-3); font-weight: 400; }
.form-hint-banner {
  margin-top: 4px; padding: 10px 14px;
  background: var(--accent-soft); color: var(--accent-2);
  border-radius: 10px; font-size: 12.5px; line-height: 1.5;
}
.form-hint-banner strong { font-weight: 600; }
.form-hint-banner em { font-family: 'Newsreader', Georgia, serif; font-style: italic; font-weight: 400; }
.form-error {
  margin: 4px 0 12px;
  padding: 10px 14px;
  background: var(--negative-soft);
  color: var(--negative);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
  font-family: 'Geist', system-ui;
}

.modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 18px; margin-top: 10px; border-top: 1px solid var(--border);
}

.drawer-backdrop {
  position: fixed; inset: 0; background: rgba(22, 21, 15, .35);
  display: flex; justify-content: flex-end; z-index: 100;
}
.drawer-shell {
  width: 100%; max-width: 880px; background: var(--bg);
  height: 100vh; overflow-y: auto;
  box-shadow: -16px 0 48px -16px rgba(22, 21, 15, .15);
}
.drawer-head {
  position: relative;
  padding: 22px 28px; border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.drawer-back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--ink-2); cursor: pointer;
  margin-bottom: 10px; background: none; border: none; padding: 0;
  font-family: inherit;
}
.drawer-close {
  position: absolute; top: 18px; right: 18px;
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: none;
  color: var(--ink-2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.drawer-close:hover { background: var(--bg-sunk); color: var(--ink); }
.drawer-title-row {
  display: flex; align-items: flex-end;
  justify-content: space-between; gap: 16px;
}
.drawer-title {
  font-family: 'Geist', sans-serif; font-weight: 500; font-size: 22px;
  margin: 0; color: var(--ink);
}
.drawer-title em {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic; font-weight: 400;
}
.drawer-meta { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
.drawer-meta-muted { color: var(--ink-3); }
.drawer-total { text-align: right; }
.drawer-total-val {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic; font-size: 26px; color: var(--ink);
}
.drawer-total-delta { font-size: 12px; margin-top: 2px; }
.drawer-total-delta.up   { color: var(--positive); }
.drawer-total-delta.down { color: var(--negative); }

.drawer-kpi-strip {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px; margin-top: 18px;
}
.drawer-kpi {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px;
}
.drawer-kpi-label {
  font-family: 'Geist Mono', monospace; font-size: 10.5px;
  letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3);
}
.drawer-kpi-val {
  font-family: 'Newsreader', Georgia, serif; font-style: italic;
  font-size: 20px; margin-top: 2px; color: var(--ink);
}
.drawer-kpi-val.up   { color: var(--positive); }
.drawer-kpi-val.down { color: var(--negative); }

.drawer-body { padding: 24px 28px; }
.drawer-section { margin-bottom: 28px; }
.drawer-section-head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 12px; padding-bottom: 8px;
  border-bottom: 1px dotted var(--border-strong);
}
.drawer-section-label {
  font-family: 'Geist Mono', monospace; font-size: 11px;
  letter-spacing: .05em; text-transform: uppercase; color: var(--ink-3);
}
.drawer-section-title {
  font-family: 'Geist', sans-serif; font-weight: 500;
  font-size: 15px; margin: 2px 0 0;
}
.drawer-section-title em {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic; font-weight: 400;
}
.drawer-section-meta { font-size: 12px; color: var(--ink-3); }

.positions-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.positions-table th {
  text-align: left; font-family: 'Geist Mono', monospace;
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em;
  color: var(--ink-3); padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.positions-table th.r, .positions-table td.r { text-align: right; }
.positions-table td {
  padding: 12px 10px; border-bottom: 1px solid var(--border);
}
.pos-name-line { font-weight: 500; color: var(--ink); }
.pos-isin {
  font-family: 'Geist Mono', monospace;
  font-size: 11px; color: var(--ink-3);
}
.pl-up   { color: var(--positive); }
.pl-down { color: var(--negative); }
.pos-pl-pct { display: block; font-size: 11px; font-family: 'Geist Mono', monospace; opacity: .8; }

.drawer-empty-inline {
  font-size: 13px; color: var(--ink-2);
  padding: 14px 0;
}
.link-btn {
  background: none; border: none; color: var(--accent);
  cursor: pointer; padding: 0; font-family: inherit; font-size: 13px;
  text-decoration: underline;
}
.link-btn:disabled { color: var(--ink-3); cursor: not-allowed; text-decoration: none; }
.csv-link-disabled {
  font-family: 'Newsreader', Georgia, serif; font-style: italic;
  font-size: 13px; color: var(--ink-3);
}
.csv-drop {
  border: 1px dashed var(--border-strong); border-radius: 12px;
  padding: 36px 24px; text-align: center; color: var(--ink-2);
  cursor: pointer; transition: border-color .15s, background .15s;
}
.csv-drop:hover { border-color: var(--accent); background: var(--bg-sunk); }
.csv-drop p { margin: 10px 0 0; font-size: 13px; }

.re-details { display: flex; flex-direction: column; }
.re-detail-row {
  display: flex; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px dotted var(--border-strong);
  font-size: 13px;
}
.re-detail-row:last-child { border-bottom: none; }
.re-detail-row span:first-child { color: var(--ink-2); }
.re-detail-sep {
  font-family: 'Geist Mono', monospace; font-size: 10.5px;
  text-transform: uppercase; letter-spacing: .04em;
  color: var(--ink-3); padding-top: 14px; border-bottom: none;
}
.re-sub { padding-left: 16px; font-size: 12.5px; }
.re-sub span:first-child { color: var(--ink-3); }
.re-linked-loan {
  margin-top: 14px; padding: 12px 14px;
  background: var(--bg-sunk); border-radius: 8px;
}
.re-linked-eyebrow {
  font-family: 'Geist Mono', monospace; font-size: 10.5px;
  text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3);
}
.re-linked-name { font-weight: 600; font-size: 14px; margin-top: 4px; }
.re-linked-amount { font-size: 12px; color: var(--ink-2); margin-top: 2px; }

.fiscal-insight { padding: 4px 0; }
.fiscal-bar {
  height: 6px; background: var(--bg-sunk);
  border-radius: 3px; overflow: hidden; margin: 10px 0;
}
.fiscal-bar-fill {
  height: 100%; background: var(--accent); transition: width .3s;
}
.fiscal-row {
  display: flex; justify-content: space-between; font-size: 13px;
}
.fiscal-note {
  font-family: 'Newsreader', Georgia, serif; font-style: italic;
  font-size: 12.5px; color: var(--ink-2); margin: 8px 0 0;
}

.config-list { display: flex; flex-direction: column; }
.config-row {
  display: flex; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px dotted var(--border-strong);
  font-size: 13px;
}
.config-row:last-child { border-bottom: none; }
.config-actions {
  display: flex; gap: 8px;
  margin-top: 14px; padding-top: 14px;
  border-top: 1px solid var(--border);
}
.drawer-danger { color: var(--negative); }

.merge-pair {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-top: 12px; margin-bottom: 18px;
}
.merge-card {
  border: 1px solid var(--border); border-radius: 10px;
  padding: 16px; text-align: center; background: var(--bg-elev);
}
.merge-card h4 {
  margin: 10px 0 6px; font-size: 14px; font-weight: 600; color: var(--ink);
}
.merge-card p {
  font-family: 'Newsreader', Georgia, serif; font-style: italic;
  font-size: 20px; margin: 0 0 12px; color: var(--ink);
}
.merge-card .primary-btn { width: 100%; }

.duplicates-banner {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; padding: 10px 16px;
  background: var(--accent-soft); color: var(--accent);
  border-radius: 8px; margin: 12px 16px;
  font-size: 13px;
}
.duplicates-banner strong { font-weight: 600; }
.duplicates-banner > div { display: flex; gap: 8px; align-items: center; }
.duplicates-banner .primary-btn { padding: 6px 14px; font-size: 12px; }
.duplicates-banner .link-btn { color: var(--accent); }

/* ============================================================================
   Settings — Monarch-style multi-section layout with sticky left rail
   ============================================================================ */
.settings-layout {
  display: grid; grid-template-columns: 240px 1fr; gap: 32px;
  align-items: start; padding: 0 0 80px;
}
.settings-rail {
  position: sticky; top: 24px;
  display: flex; flex-direction: column; gap: 2px;
}
.settings-rail-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 6px;
  font-size: 13px; color: var(--ink-2); cursor: pointer;
  background: transparent; border: none; font-family: inherit;
  text-align: left; width: 100%; position: relative;
  transition: background .15s, color .15s;
}
.settings-rail-item:hover { background: var(--bg-sunk); color: var(--ink); }
.settings-rail-item.active {
  background: var(--accent-soft); color: var(--accent); font-weight: 500;
}
.settings-rail-item.active::before {
  content: ''; position: absolute; left: 0; top: 8px; bottom: 8px;
  width: 3px; background: var(--accent); border-radius: 2px;
}
.settings-panel { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.settings-panel h2 {
  font-family: 'Geist', sans-serif; font-weight: 500; font-size: 22px;
  margin: 0 0 4px; color: var(--ink); letter-spacing: -0.01em;
}
.settings-panel h2 em {
  font-family: 'Newsreader', Georgia, serif; font-style: italic; font-weight: 400;
}
.settings-panel-intro {
  font-size: 13px; color: var(--ink-2); margin: 0 0 4px; line-height: 1.55;
}
.settings-profile-card {
  display: flex; align-items: center; gap: 16px;
  padding: 4px 0 4px;
}
.settings-profile-avatar {
  width: 56px; height: 56px; border-radius: 12px;
  background: var(--accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 600;
  font-family: 'Geist', sans-serif;
}
.settings-profile-meta { display: flex; flex-direction: column; gap: 2px; }
.settings-profile-name { font-size: 16px; font-weight: 500; color: var(--ink); }
.settings-profile-email { font-size: 12.5px; color: var(--ink-2); }
.settings-field-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.settings-field-row:last-child { border-bottom: none; }
.settings-field-label { font-size: 13px; color: var(--ink); font-weight: 500; }
.settings-field-hint { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
.settings-field-control { display: flex; align-items: center; gap: 10px; }
.settings-coming-soon-badge {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 8px; border-radius: 4px;
  background: var(--bg-sunk); color: var(--ink-3);
  border: 1px solid var(--border);
}
.settings-danger-zone {
  border: 1px solid var(--negative); border-radius: 12px;
  padding: 18px; background: rgba(176, 57, 43, .04);
  margin-top: 12px;
}
.settings-danger-zone h3 {
  color: var(--negative); margin: 0 0 6px;
  font-size: 14px; font-weight: 600;
}
.settings-danger-zone p {
  font-size: 12.5px; color: var(--ink-2); margin: 0 0 12px; line-height: 1.5;
}
.settings-auth-events {
  display: flex; flex-direction: column; gap: 8px;
  font-size: 12.5px;
}
.settings-auth-event-row {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 8px 12px; border-radius: 6px; background: var(--bg-sunk);
  border: 1px solid var(--border);
}
.settings-auth-event-kind { font-weight: 500; color: var(--ink); }
.settings-auth-event-time { color: var(--ink-3); font-variant-numeric: tabular-nums; }
@media (max-width: 900px) {
  .settings-layout { grid-template-columns: 1fr; gap: 16px; }
  .settings-rail {
    position: static; flex-direction: row; overflow-x: auto; gap: 4px;
    padding-bottom: 8px;
    margin: 0 -20px; padding-left: 20px; padding-right: 20px;
  }
  .settings-rail-item { flex-shrink: 0; padding: 8px 12px; }
  .settings-rail-item.active::before { display: none; }
}

/* ── ChipSelect (Lydia-style pill toggle) ── */
.chip-sel {
  display: inline-flex;
  background: var(--bg-sunk);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.chip-sel-sm { border-radius: 6px; }
.chip-sel-btn {
  font-family: 'Geist', sans-serif;
  font-size: 12.5px; font-weight: 500;
  padding: 6px 13px;
  border-radius: 6px; border: none;
  background: transparent; color: var(--ink-2);
  cursor: pointer; white-space: nowrap;
  display: flex; align-items: center; gap: 5px;
  transition: background .12s, color .12s, box-shadow .12s;
}
.chip-sel-sm .chip-sel-btn { font-size: 12px; padding: 5px 10px; }
.chip-sel-btn:hover { color: var(--ink); }
.chip-sel-btn.active {
  background: var(--bg-elev); color: var(--ink);
  box-shadow: 0 1px 3px rgba(22,21,15,.1);
}
.chip-sel-icon { font-size: 13px; line-height: 1; }

/* ── Combobox (Finary-style grouped dropdown) ── */
.cmb-wrap { position: relative; display: inline-block; width: 100%; }
.cmb-trigger {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: 8px;
  border: 1.5px solid var(--border); background: var(--bg-elev);
  color: var(--ink); font-family: 'Geist', sans-serif; font-size: 13px;
  cursor: pointer; text-align: left;
  transition: border-color .15s, box-shadow .15s;
}
.cmb-trigger:hover:not(.disabled) { border-color: var(--border-strong); }
.cmb-trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-color: var(--accent);
}
.cmb-trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.cmb-trigger.disabled { opacity: .5; cursor: not-allowed; }
.cmb-trigger-ic {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 12px;
}
.cmb-trigger-raw-ic { font-size: 14px; flex-shrink: 0; }
.cmb-trigger-lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmb-trigger-lbl.placeholder { color: var(--ink-3); }
.cmb-chev { color: var(--ink-3); flex-shrink: 0; transition: transform .18s; }
.cmb-chev.open { transform: rotate(180deg); }

/* panel rendered in portal (fixed positioning) — scale-only entry C2 */
.cmb-panel {
  background: var(--bg-elev);
  border: 1.5px solid var(--accent);
  border-radius: 10px;
  box-shadow: 0 12px 32px -4px rgba(22,21,15,.15), 0 4px 12px -4px rgba(22,21,15,.08);
  overflow: hidden;
  min-width: 160px;
  animation: cmbPanelIn 160ms cubic-bezier(.2,.6,.2,1);
  transform-origin: top center;
}
@keyframes cmbPanelIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .cmb-panel { animation: none !important; }
}
.cmb-search-row {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
}
.cmb-si { color: var(--ink-3); flex-shrink: 0; }
.cmb-si-input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: 'Geist', sans-serif; font-size: 13px; color: var(--ink);
}
.cmb-si-input::placeholder { color: var(--ink-3); }
.cmb-si-clear {
  border: none; background: none; cursor: pointer; padding: 1px;
  color: var(--ink-3); display: flex; align-items: center;
  border-radius: 4px; transition: color .1s;
}
.cmb-si-clear:hover { color: var(--ink); }
.cmb-list { max-height: 248px; overflow-y: auto; }
.cmb-list::-webkit-scrollbar { width: 4px; }
.cmb-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }
.cmb-gh {
  font-size: 10px; font-weight: 600;
  font-family: 'Geist Mono', monospace;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink-3); padding: 9px 12px 4px;
  border-top: 1px solid var(--border);
}
.cmb-gh:first-child { border-top: none; }
.cmb-it {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 12px; font-size: 13px; cursor: pointer;
  color: var(--ink); transition: background .1s;
}
.cmb-it:hover { background: var(--bg-sunk); }
.cmb-it.sel { background: var(--accent-soft); color: var(--accent); font-weight: 500; }
.cmb-it-ic {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 12px;
}
.cmb-it-raw-ic { font-size: 14px; flex-shrink: 0; }
/* label + meta empilés verticalement */
.cmb-it-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cmb-it-lbl { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmb-it-meta { font-size: 11px; color: var(--ink-3); font-family: 'Geist Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmb-it.sel .cmb-it-meta { color: var(--accent-2); opacity: .8; }
.cmb-it-chk { color: var(--accent); flex-shrink: 0; }
.cmb-empty { padding: 14px 12px; font-size: 12.5px; color: var(--ink-3); text-align: center; }

/* Spinner — utilisé sur tous les boutons async (import, save…) */
@keyframes _spin { to { transform: rotate(360deg); } }
.spin { animation: _spin .65s linear infinite; display: inline-block; vertical-align: middle; }
.primary-btn:disabled, .secondary-btn:disabled { opacity: .55; cursor: not-allowed; pointer-events: none; }

/* ─── CatPicker inline ─── */
.cat-picker { position: absolute; top: calc(100% + 4px); left: 0; z-index: 200; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px -4px rgba(0,0,0,.12); width: 220px; display: flex; flex-direction: column; overflow: hidden; }
.cat-picker-search { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.cat-picker-search input { flex: 1; border: none; background: transparent; font-family: inherit; font-size: 13px; color: var(--ink); outline: none; }
.cat-picker-list { max-height: 260px; overflow-y: auto; padding: 4px; }
.cat-picker-group { padding: 6px 8px 2px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); font-weight: 600; }
.cat-picker-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: none; background: transparent; border-radius: 6px; font-family: inherit; font-size: 13px; color: var(--ink-2); cursor: pointer; text-align: left; transition: background .1s; }
.cat-picker-item:hover, .cat-picker-item.active { background: var(--accent-soft); color: var(--accent); }
.cat-picker-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
.cat-picker-empty { padding: 14px; font-size: 12px; color: var(--ink-3); text-align: center; }

/* ─── Month filter bar ─── */
.tx-month-bar { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 0 4px; overflow-x: auto; scrollbar-width: none; }
.tx-month-bar::-webkit-scrollbar { display: none; }
.tx-month-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--ink-2); font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: border-color .15s, background .15s, color .15s; font-family: inherit; }
.tx-month-chip:hover { border-color: var(--accent); color: var(--accent); }
.tx-month-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }

/* ─── Active filter chips row ─── */
.tx-active-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 0 2px; }
.tx-active-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .15s, color .15s; white-space: nowrap; }
.tx-active-chip:hover { background: var(--accent); color: #fff; }
.tx-active-chip svg { flex-shrink: 0; opacity: .7; }

/* ─── Category filter search input ─── */
.tx-filter-search-input { width: 100%; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); font-family: inherit; font-size: 13px; color: var(--ink); outline: none; margin-bottom: 8px; }
.tx-filter-search-input:focus { border-color: var(--accent); }
`;
  return <style>{css}</style>;
}
