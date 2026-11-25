/**
 * Default stylesheet. Every visual is driven by CSS custom properties with fallbacks, so you can
 * theme guidecursor by setting variables on `:root` (or any ancestor) without touching this file:
 *
 *   --gc-accent, --gc-accent-fg, --gc-bg, --gc-fg, --gc-muted, --gc-border, --gc-radius,
 *   --gc-font, --gc-shadow, --gc-z, --gc-ring, --gc-cursor-fill, --gc-cursor-stroke,
 *   --gc-popover-width
 */
export const guidecursorCss = `
.gc-root,.gc-menu{--_accent:var(--gc-accent,#6d28d9);--_accent-fg:var(--gc-accent-fg,#fff);--_bg:var(--gc-bg,#fff);--_fg:var(--gc-fg,#18181b);--_muted:var(--gc-muted,#71717a);--_border:var(--gc-border,rgba(24,24,27,.1));--_radius:var(--gc-radius,14px);--_font:var(--gc-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);--_shadow:var(--gc-shadow,0 12px 32px -8px rgba(24,24,27,.25),0 2px 6px rgba(24,24,27,.08))}
.gc-root{position:fixed;inset:0;pointer-events:none;z-index:var(--gc-z,2147483000);font-family:var(--_font)}
.gc-root *,.gc-menu *{box-sizing:border-box}
.gc-cursor{position:fixed;top:0;left:0;width:24px;height:24px;opacity:0;will-change:transform;transition:opacity .25s ease;pointer-events:none;z-index:3}
.gc-cursor.gc-visible{opacity:1}
.gc-cursor-svg{display:block;overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))}
.gc-cursor-svg path{fill:var(--gc-cursor-fill,var(--_accent));stroke:var(--gc-cursor-stroke,#fff);stroke-width:1.5}
.gc-cursor-label{position:absolute;left:18px;top:20px;white-space:nowrap;padding:2px 8px;border-radius:999px;background:var(--gc-cursor-fill,var(--_accent));color:var(--_accent-fg);font:600 11px/16px var(--_font);box-shadow:0 2px 6px rgba(0,0,0,.18)}
.gc-cursor-label[hidden]{display:none}
.gc-cursor-ripple{position:absolute;left:-14px;top:-15px;width:36px;height:36px;border-radius:50%;background:var(--gc-cursor-fill,var(--_accent));opacity:0;transform:scale(.2)}
.gc-cursor-ripple.gc-pulse{animation:gc-ripple .55s ease-out}
@keyframes gc-ripple{0%{opacity:.35;transform:scale(.2)}100%{opacity:0;transform:scale(1.25)}}
.gc-ring{position:fixed;top:0;left:0;border-radius:10px;opacity:0;pointer-events:none;z-index:1;box-shadow:0 0 0 2px var(--gc-ring,var(--_accent)),0 0 0 6px color-mix(in srgb,var(--gc-ring,var(--_accent)) 18%,transparent);transition:opacity .25s ease,transform .3s cubic-bezier(.2,.8,.2,1),width .3s cubic-bezier(.2,.8,.2,1),height .3s cubic-bezier(.2,.8,.2,1)}
.gc-ring.gc-visible{opacity:1}
.gc-popover{position:fixed;top:0;left:0;width:min(var(--gc-popover-width,320px),calc(100vw - 16px));padding:16px 16px 12px;background:var(--_bg);color:var(--_fg);border:1px solid var(--_border);border-radius:var(--_radius);box-shadow:var(--_shadow);pointer-events:auto;z-index:2;opacity:0;visibility:hidden;transition:opacity .2s ease,translate .2s ease,visibility 0s linear .2s;translate:0 4px;font:14px/1.5 var(--_font);outline:none}
.gc-popover.gc-visible{opacity:1;visibility:visible;translate:0 0;transition:opacity .2s ease,translate .2s ease,visibility 0s}
.gc-popover:focus-visible{box-shadow:var(--_shadow),0 0 0 3px color-mix(in srgb,var(--_accent) 35%,transparent)}
.gc-progress{margin:0 28px 4px 0;font-size:12px;font-weight:500;color:var(--_muted)}
.gc-title{margin:0 28px 4px 0;font-size:15px;font-weight:650;line-height:1.35}
.gc-body{margin:0;color:var(--_fg)}
.gc-body:empty{display:none}
.gc-footer{display:flex;align-items:center;gap:8px;margin-top:14px}
.gc-spacer{flex:1}
.gc-btn{appearance:none;border:1px solid var(--_border);background:transparent;color:var(--_fg);font:500 13px/1 var(--_font);padding:8px 12px;border-radius:calc(var(--_radius) - 6px);cursor:pointer}
.gc-btn:hover{background:color-mix(in srgb,var(--_fg) 6%,transparent)}
.gc-btn:focus-visible,.gc-close:focus-visible,.gc-link:focus-visible,.gc-menu-trigger:focus-visible,.gc-menu-item:focus-visible{outline:2px solid var(--_accent);outline-offset:2px}
.gc-btn[hidden]{display:none}
.gc-primary{background:var(--_accent);border-color:var(--_accent);color:var(--_accent-fg)}
.gc-primary:hover{background:color-mix(in srgb,var(--_accent) 88%,#000)}
.gc-link{appearance:none;border:0;background:none;padding:4px 0;color:var(--_muted);font:500 12px/1 var(--_font);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.gc-link[hidden]{display:none}
.gc-close{position:absolute;top:10px;right:10px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--_muted);cursor:pointer;font-size:18px;line-height:1}
.gc-close:hover{background:color-mix(in srgb,var(--_fg) 6%,transparent);color:var(--_fg)}
.gc-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.gc-reduced .gc-cursor,.gc-reduced .gc-ring,.gc-reduced .gc-popover{transition:none!important}
.gc-reduced .gc-cursor-ripple{animation:none!important}
@media (prefers-reduced-motion:reduce){.gc-cursor,.gc-ring,.gc-popover{transition:none!important}.gc-cursor-ripple{animation:none!important}}
.gc-menu{position:relative;display:inline-block;font-family:var(--_font)}
.gc-menu-trigger{display:inline-flex;align-items:center;gap:6px;appearance:none;border:1px solid var(--_border);background:var(--_bg);color:var(--_fg);font:500 13px/1 var(--_font);padding:8px 12px;border-radius:999px;cursor:pointer}
.gc-menu-trigger:hover{background:color-mix(in srgb,var(--_fg) 5%,var(--_bg))}
.gc-menu-dot{width:7px;height:7px;border-radius:50%;background:var(--_accent)}
.gc-menu-panel{position:absolute;top:calc(100% + 8px);min-width:280px;max-width:min(360px,calc(100vw - 16px));padding:6px;background:var(--_bg);color:var(--_fg);border:1px solid var(--_border);border-radius:var(--_radius);box-shadow:var(--_shadow);z-index:var(--gc-z,2147483000);list-style:none;margin:0}
.gc-menu-panel[data-align=end]{right:0}
.gc-menu-panel[data-align=start]{left:0}
.gc-menu-heading{padding:8px 10px 6px;font-size:12px;font-weight:600;color:var(--_muted);text-transform:uppercase;letter-spacing:.04em}
.gc-menu-item{display:flex;width:100%;align-items:flex-start;gap:10px;appearance:none;border:0;background:transparent;color:inherit;text-align:left;padding:9px 10px;border-radius:calc(var(--_radius) - 6px);cursor:pointer;font:inherit}
.gc-menu-item:hover,.gc-menu-item:focus{background:color-mix(in srgb,var(--_accent) 8%,transparent);outline:none}
.gc-menu-text{flex:1;min-width:0}
.gc-menu-title{display:block;font-size:14px;font-weight:550;line-height:1.3}
.gc-menu-desc{display:block;margin-top:2px;font-size:12px;color:var(--_muted);line-height:1.35}
.gc-menu-status{flex:none;font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--_fg) 6%,transparent);color:var(--_muted);white-space:nowrap}
.gc-menu-status[data-status=new]{background:color-mix(in srgb,var(--_accent) 12%,transparent);color:var(--_accent)}
.gc-menu-status[data-status=completed]{background:color-mix(in srgb,#16a34a 12%,transparent);color:#15803d}
.gc-menu-empty{padding:12px 10px;font-size:13px;color:var(--_muted)}
`;

const STYLE_ID = "guidecursor-styles";

/** Inserts the default stylesheet once per document. Safe to call repeatedly. */
export function injectStyles(doc: Document = document, nonce?: string): void {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  if (nonce) style.nonce = nonce;
  style.textContent = guidecursorCss;
  doc.head.prepend(style);
}
