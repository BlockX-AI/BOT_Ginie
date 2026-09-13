"""
Theme System for DApp Generation
Provides multiple visual themes that users can select at generation time.
Each theme is CSS-only and works with the existing neo-brutalist shell structure.
"""

# Theme registry: each theme has a unique ID, name, description, and CSS
THEMES = {
    "neo-brutalist": {
        "name": "Neo-Brutalist (Default)",
        "description": "Paper texture, thick ink borders, hard shadows, yellow ticker",
        "css_vars": """
  --paper: #F9F7F1;
  --ink: #0A0908;
  --grey: #5E5E5E;
  --line: #D4D0C8;
  --yellow: #F4E04D;
  --blue: #4169E1;
  --violet: #7B68EE;
  --green: #2E7D32;
  --coral: #FF6B6B;
  --display: 'Archivo Black', Impact, sans-serif;
  --body: 'Archivo', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', 'Courier New', monospace;
""",
        "imports": "@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');",
        "color_scheme": "light"
    },
    
    "orbit-dark": {
        "name": "Orbit Dark",
        "description": "Dark minimal with electric lime accents, modern sans-serif",
        "css_vars": """
  --paper: #0b0e11;
  --ink: #f4f6f1;
  --grey: #99a29e;
  --line: #2a3032;
  --yellow: #d3f985;
  --blue: #397cca;
  --violet: #c9d4ff;
  --green: #6d8841;
  --coral: #ffbaaa;
  --display: 'Inter', 'Segoe UI', Arial, sans-serif;
  --body: 'Inter', 'Segoe UI', Arial, sans-serif;
  --mono: 'SFMono-Regular', Consolas, monospace;
""",
        "imports": "",
        "color_scheme": "dark"
    },
    
    "porcelain-light": {
        "name": "Porcelain Light",
        "description": "Soft rounded light theme with cobalt accents, warm tones",
        "css_vars": """
  --paper: #F4F3EF;
  --ink: #191C1A;
  --grey: #6B726D;
  --line: #E7E9E3;
  --yellow: #E9E15C;
  --blue: #2F4BE0;
  --violet: #7B68EE;
  --green: #2E7D32;
  --coral: #FF6B6B;
  --display: 'Bricolage Grotesque', system-ui, sans-serif;
  --body: 'Karla', system-ui, sans-serif;
  --mono: 'SFMono-Regular', Consolas, monospace;
""",
        "imports": "@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Karla:wght@300;400;500&display=swap');",
        "color_scheme": "light"
    },
    
    "noir-minimal": {
        "name": "Noir Minimal",
        "description": "Dark elegant with serif headlines, hairline borders, muted palette",
        "css_vars": """
  --paper: #0b0e11;
  --ink: #EFE9E1;
  --grey: #8C837A;
  --line: #2C2724;
  --yellow: #C2A67D;
  --blue: #6B8CAE;
  --violet: #9B8BA8;
  --green: #7A9B76;
  --coral: #C89B8C;
  --display: 'Instrument Serif', Georgia, serif;
  --body: 'Jost', system-ui, sans-serif;
  --mono: 'SFMono-Regular', Consolas, monospace;
""",
        "imports": "@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Jost:wght@300;400;500&display=swap');",
        "color_scheme": "dark"
    }
}


def get_theme_css(theme_id: str = "neo-brutalist") -> str:
    """
    Get the complete CSS for a theme, including imports and variables.
    Falls back to neo-brutalist if theme_id is invalid.
    """
    theme = THEMES.get(theme_id, THEMES["neo-brutalist"])
    
    css = "@import \"tailwindcss\";\n\n"
    
    if theme["imports"]:
        css += theme["imports"] + "\n\n"
    
    css += f"""/* ============================================================
   {theme['name'].upper()} THEME
   {theme['description']}
   ============================================================ */

:root {{
  color-scheme: {theme['color_scheme']};
{theme['css_vars']}
}}

/* ============================================================
   SHARED DESIGN TOKENS (theme-agnostic)
   ============================================================ */

body {{
  background: var(--paper);
  color: var(--ink);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}}

/* Typography */
.nb-display {{ font-family: var(--display); font-weight: 700; }}
.nb-mono {{ font-family: var(--mono); }}
.nb-hl {{
  background: var(--yellow);
  color: var(--ink);
  padding: 0 0.35rem;
  border-radius: 6px;
}}

/* Layout */
.nb-wrap {{
  max-width: 1200px;
  margin: 0 auto;
  padding-inline: clamp(1.25rem, 4vw, 2.5rem);
}}

.nb-section {{
  background: var(--paper);
  padding: clamp(3.5rem, 8vh, 6rem) 0;
}}

/* Components */
.nb-btn {{
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 3px solid var(--ink);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-family: var(--body);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}}

.nb-btn:hover {{
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--ink);
}}

.nb-btn-primary {{
  background: var(--yellow);
  border-color: var(--ink);
}}

.nb-btn-lg {{
  padding: 1rem 2rem;
  font-size: 1.05rem;
}}

.nb-card {{
  background: var(--paper);
  border: 3px solid var(--ink);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 6px 6px 0 var(--ink);
}}

.nb-card-sm {{
  background: var(--paper);
  border: 2px solid var(--line);
  border-radius: 10px;
  padding: 1.25rem;
}}

.nb-field {{
  width: 100%;
  padding: 0.85rem 1rem;
  border: 2px solid var(--ink);
  border-radius: 6px;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--body);
  font-size: 0.95rem;
}}

.nb-field:focus {{
  outline: none;
  box-shadow: 0 0 0 3px var(--yellow);
}}

.nb-badge {{
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background: var(--ink);
  color: var(--paper);
  border-radius: 999px;
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}}

.nb-ticker {{
  background: var(--yellow);
  border-bottom: 3px solid var(--ink);
  overflow: hidden;
  position: relative;
}}

.p-6 {{ padding: 1.5rem; }}
.p-5 {{ padding: 1.25rem; }}

/* Utility classes */
.mono {{ font-family: var(--mono); }}

@media (prefers-reduced-motion: reduce) {{
  * {{
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }}
}}
"""
    
    return css


def get_theme_list():
    """Get list of available themes for frontend display"""
    return [
        {
            "id": theme_id,
            "name": theme["name"],
            "description": theme["description"],
            "colorScheme": theme["color_scheme"]
        }
        for theme_id, theme in THEMES.items()
    ]


def get_default_theme():
    """Get the default theme ID"""
    return "neo-brutalist"
