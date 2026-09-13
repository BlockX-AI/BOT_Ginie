"""
Ginie Strict Frontend Design System
====================================
A "neo-brutalist" design language extracted from the reference template
(Evi_Contract_Engine/index-refeerance.html).

Every generated DApp frontend MUST follow this system so all frontends share the
same distinctive look & feel: paper background with dotted grid, thick 3px ink
borders, hard offset box-shadows, Archivo Black display type, IBM Plex Mono for
code/addresses, a scrolling ticker, and bold color-blocked sections.

`STRICT_DESIGN_SYSTEM` is injected verbatim into the frontend build prompt.
`INDEX_CSS_TEMPLATE` is the exact CSS the builder must place in src/index.css.
"""

# The exact CSS the builder should write to src/index.css (after the tailwind import).
INDEX_CSS_TEMPLATE = r"""@import "tailwindcss";

/* ============================================================
   GINIE NEO-BRUTALIST DESIGN SYSTEM  (do not remove)
   ============================================================ */
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root{
  --paper:#EFEEE9;
  --ink:#0A0A0A;
  --blue:#2B6FE8;
  --yellow:#FFD91C;
  --coral:#FF5C4D;
  --green:#12A150;
  --violet:#7C5CFF;
  --card:#FFFFFF;
  --grey:#5C5C58;
  --sans:'Archivo',system-ui,sans-serif;
  --display:'Archivo Black',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
  --bd:3px solid var(--ink);
  --pop:6px 6px 0 var(--ink);
  --pop-sm:4px 4px 0 var(--ink);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  background-color:var(--paper);
  background-image:radial-gradient(var(--ink) 1px,transparent 1px);
  background-size:22px 22px;
  color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
}
body::before{content:'';position:fixed;inset:0;background:rgba(239,238,233,.88);z-index:-1}
:focus-visible{outline:3px solid var(--blue);outline-offset:3px}

.nb-display{font-family:var(--display);letter-spacing:-.02em}
.nb-mono{font-family:var(--mono)}
.nb-hl{background:var(--yellow);padding:0 .12em;box-decoration-break:clone;-webkit-box-decoration-break:clone}

/* card / panel */
.nb-card{background:var(--card);border:var(--bd);border-radius:12px;box-shadow:var(--pop)}
.nb-card-sm{background:var(--card);border:var(--bd);border-radius:10px;box-shadow:var(--pop-sm)}

/* buttons */
.nb-btn{
  font-family:var(--sans);font-size:14.5px;font-weight:700;
  padding:.6rem 1.1rem;border:var(--bd);border-radius:9px;cursor:pointer;
  background:var(--card);color:var(--ink);box-shadow:var(--pop-sm);
  transition:transform .1s,box-shadow .1s;display:inline-flex;align-items:center;gap:.5rem;
}
.nb-btn:hover{transform:translate(1px,1px);box-shadow:3px 3px 0 var(--ink)}
.nb-btn:active{transform:translate(4px,4px);box-shadow:0 0 0 var(--ink)}
.nb-btn-primary{background:var(--blue);color:#fff}
.nb-btn-yellow{background:var(--yellow)}
.nb-btn-lg{padding:.85rem 1.6rem;font-size:16px;box-shadow:var(--pop)}
.nb-btn-lg:hover{box-shadow:4px 4px 0 var(--ink)}
.nb-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:var(--pop-sm)}

/* form fields */
.nb-field{
  width:100%;background:var(--paper);border:var(--bd);border-radius:9px;
  padding:.8rem .95rem;color:var(--ink);font-family:var(--sans);font-size:15.5px;font-weight:600;
}
.nb-field::placeholder{color:#9A9A94;font-weight:400}
.nb-field:focus{outline:none;background:#fff;box-shadow:var(--pop-sm)}
.nb-field.mono{font-family:var(--mono)}

/* ticker */
.nb-ticker{background:var(--yellow);border-bottom:var(--bd);overflow:hidden;white-space:nowrap;padding:.5rem 0}
.nb-ticker-track{display:inline-flex;gap:2.5rem;padding-left:100%;animation:nb-slide 34s linear infinite}
.nb-ticker span{font-family:var(--display);font-size:12.5px;letter-spacing:.02em;display:inline-flex;align-items:center;gap:2.5rem}
.nb-ticker i{font-style:normal;color:var(--blue)}
@keyframes nb-slide{to{transform:translateX(-100%)}}
@media (prefers-reduced-motion:reduce){.nb-ticker-track{animation:none;padding-left:1rem}}

/* section helpers */
.nb-wrap{width:min(1140px,100% - 2.5rem);margin-inline:auto}
.nb-section{padding:4rem 0;border-top:var(--bd)}
.nb-badge{font-family:var(--mono);font-size:11px;font-weight:600;border:2px solid var(--ink);border-radius:999px;padding:.15rem .6rem;background:var(--card)}
"""

STRICT_DESIGN_SYSTEM = r"""
================================================================================
🎨 MANDATORY STRICT DESIGN SYSTEM — "GINIE NEO-BRUTALIST" (NON-NEGOTIABLE)
================================================================================
EVERY frontend you generate MUST use this EXACT visual language. Do NOT invent a
different theme, do NOT use dark glassmorphism, do NOT use purple/blue gradient
SaaS styling. This is a light "paper" neo-brutalist look. Match it faithfully.

--- COLOR TOKENS (use these exact hex values via the CSS variables) ---
  --paper  #EFEEE9  (page background)
  --ink    #0A0A0A  (text, borders, shadows)
  --blue   #2B6FE8  (primary actions / links)
  --yellow #FFD91C  (highlights, ticker, secondary CTA)
  --coral  #FF5C4D  (errors / destructive / "blocked")
  --green  #12A150  (success / "running")
  --violet #7C5CFF  (accent bar)
  --card   #FFFFFF  (cards/panels)
  --grey   #5C5C58  (muted text)

--- TYPOGRAPHY ---
  Display/headings: 'Archivo Black'  (class: nb-display)
  Body:             'Archivo'
  Code/addresses/hashes/numbers: 'IBM Plex Mono' (class: nb-mono)

--- SIGNATURE VISUAL RULES (ALWAYS APPLY) ---
  1. Page background = --paper WITH a subtle dotted radial-grid (already in body CSS).
  2. Borders are THICK: 3px solid --ink on every card, button, field, section.
  3. Shadows are HARD offsets (no blur): box-shadow 6px 6px 0 --ink (cards),
     4px 4px 0 --ink (small). Buttons translate on hover so the shadow "presses".
  4. Big bold Archivo Black headlines with tight letter-spacing. Use the yellow
     highlight (nb-hl) on key words in the H1.
  5. A scrolling YELLOW TICKER bar at the very top (nb-ticker) with 4-6 short
     ALL-CAPS phrases about the dapp, separated by ★.
  6. A thin VIOLET status/token bar under the ticker (contract address + network).
  7. Color-blocked sections separated by 3px --ink top borders.
  8. Rounded corners are small (9-14px), never pill-soft except badges.

--- REQUIRED CSS ---
Write src/index.css EXACTLY using the provided INDEX_CSS_TEMPLATE (it defines the
CSS variables and helper classes: nb-card, nb-btn, nb-field, nb-ticker, nb-wrap,
nb-section, nb-badge, nb-display, nb-mono, nb-hl). You may add Tailwind utility
classes on top, but the neo-brutalist tokens/classes above MUST be present and used.

--- COMPONENT STYLING CHEATSHEET ---
  • Primary button:   class="nb-btn nb-btn-primary nb-btn-lg"
  • Secondary button: class="nb-btn nb-btn-yellow"
  • Card/panel:       class="nb-card p-6"
  • Input:            class="nb-field"  (addresses/amounts add "mono")
  • Section wrapper:  <section class="nb-section"><div class="nb-wrap">…</div></section>
  • Success verdict:  background --green, white text, thick border
  • Error verdict:    background --coral, white text, thick border
  • Contract address / tx hash: always render in nb-mono, truncated (0x1234…abcd)
    with a copy button.

Do NOT use Framer Motion glass cards or neon glows. Keep it flat, bold, printed-poster.
================================================================================
"""


def get_index_css_template() -> str:
    """Return the exact CSS the builder should place in src/index.css."""
    return INDEX_CSS_TEMPLATE


def get_strict_design_system() -> str:
    """Return the strict design-system instructions to inject into the build prompt."""
    return STRICT_DESIGN_SYSTEM


__all__ = [
    "STRICT_DESIGN_SYSTEM",
    "INDEX_CSS_TEMPLATE",
    "get_strict_design_system",
    "get_index_css_template",
]
