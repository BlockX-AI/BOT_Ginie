"""
Premium UI/UX Guidelines
=========================
Comprehensive guidelines for generating modern, premium interfaces.
This module provides the "secret sauce" that makes AI-generated UIs look professional.
"""

from typing import Dict, List, Any


# ============================================================================
# DESIGN SYSTEM CONSTANTS
# ============================================================================

SPACING_SYSTEM = {
    "description": "8px base unit spacing system",
    "values": {
        "0": "0px",
        "1": "4px",    # 0.5 unit
        "2": "8px",    # 1 unit
        "3": "12px",   # 1.5 units
        "4": "16px",   # 2 units
        "5": "20px",   # 2.5 units
        "6": "24px",   # 3 units
        "8": "32px",   # 4 units
        "10": "40px",  # 5 units
        "12": "48px",  # 6 units
        "16": "64px",  # 8 units
        "20": "80px",  # 10 units
        "24": "96px",  # 12 units
    },
    "tailwind_usage": """
/* Section padding */
py-16 md:py-24  /* Vertical section spacing */
px-4 md:px-6 lg:px-8  /* Horizontal padding */

/* Component spacing */
gap-4  /* Between cards in grid */
space-y-6  /* Between form fields */
mb-8  /* Between heading and content */
"""
}

TYPOGRAPHY_SYSTEM = {
    "font_families": {
        "heading": "font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
        "body": "font-family: 'Inter', system-ui, sans-serif",
        "mono": "font-family: 'JetBrains Mono', 'Fira Code', monospace",
    },
    "scale": {
        "xs": "text-xs (12px)",
        "sm": "text-sm (14px)",
        "base": "text-base (16px)",
        "lg": "text-lg (18px)",
        "xl": "text-xl (20px)",
        "2xl": "text-2xl (24px)",
        "3xl": "text-3xl (30px)",
        "4xl": "text-4xl (36px)",
        "5xl": "text-5xl (48px)",
        "6xl": "text-6xl (60px)",
        "7xl": "text-7xl (72px)",
    },
    "hierarchy": """
/* Hero heading */
text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight

/* Section heading */
text-3xl md:text-4xl lg:text-5xl font-bold

/* Card title */
text-xl md:text-2xl font-semibold

/* Body text */
text-base md:text-lg text-slate-600 dark:text-slate-400

/* Small text / captions */
text-sm text-slate-500
"""
}

BORDER_RADIUS_SYSTEM = {
    "none": "rounded-none (0px)",
    "sm": "rounded-sm (2px)",
    "default": "rounded (4px)",
    "md": "rounded-md (6px)",
    "lg": "rounded-lg (8px)",
    "xl": "rounded-xl (12px)",
    "2xl": "rounded-2xl (16px)",
    "3xl": "rounded-3xl (24px)",
    "full": "rounded-full (9999px)",
    "recommendation": """
/* Modern trend: Larger border radius */
Cards: rounded-2xl or rounded-3xl
Buttons: rounded-lg or rounded-xl
Inputs: rounded-xl
Modals: rounded-2xl or rounded-3xl
Badges: rounded-full
"""
}


# ============================================================================
# PREMIUM UI PATTERNS
# ============================================================================

GLASSMORPHISM = """
/* Glassmorphism effect */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Tailwind implementation */
bg-white/10 backdrop-blur-lg border border-white/20

/* Dark mode variant */
bg-slate-900/50 backdrop-blur-lg border border-slate-700/50
"""

NEUMORPHISM = """
/* Soft UI / Neumorphism */
.neumorphic {
  background: #e0e5ec;
  box-shadow: 
    20px 20px 60px #bec3c9,
    -20px -20px 60px #ffffff;
}

/* Tailwind approximation */
bg-slate-100 shadow-[20px_20px_60px_#bec3c9,-20px_-20px_60px_#ffffff]
"""

GRADIENT_PATTERNS = """
/* Text gradient */
bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent

/* Background gradients */
bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900  /* Dark dramatic */
bg-gradient-to-r from-purple-500 to-pink-500  /* CTA buttons */
bg-gradient-to-b from-white to-slate-50  /* Subtle section */

/* Animated gradient */
bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-[length:200%_200%] animate-gradient

/* Mesh gradient (CSS) */
background: 
  radial-gradient(at 40% 20%, hsla(280, 100%, 70%, 0.3) 0px, transparent 50%),
  radial-gradient(at 80% 0%, hsla(330, 100%, 70%, 0.3) 0px, transparent 50%),
  radial-gradient(at 0% 50%, hsla(220, 100%, 70%, 0.3) 0px, transparent 50%);
"""

SHADOW_SYSTEM = """
/* Elevation system */
shadow-sm     /* Subtle, cards at rest */
shadow        /* Default elevation */
shadow-md     /* Dropdown menus */
shadow-lg     /* Modals, popovers */
shadow-xl     /* Prominent cards */
shadow-2xl    /* Hero elements */

/* Colored shadows (premium feel) */
shadow-purple-500/20  /* Tinted shadow */
shadow-xl shadow-purple-500/25  /* Combined */

/* Hover shadow transition */
hover:shadow-xl hover:shadow-purple-500/10 transition-shadow
"""


# ============================================================================
# ANIMATION GUIDELINES
# ============================================================================

ANIMATION_PRINCIPLES = """
🎬 ANIMATION PRINCIPLES FOR PREMIUM FEEL:

1. **TIMING** (Most Important)
   - Quick interactions: 150-200ms
   - UI transitions: 200-300ms
   - Page transitions: 300-500ms
   - Complex animations: 500-800ms
   - Never exceed 1000ms for UI

2. **EASING**
   - Enter animations: ease-out (decelerate)
   - Exit animations: ease-in (accelerate)
   - UI movements: ease-in-out or custom bezier
   - Spring: For playful, bouncy feel
   
   Custom bezier recommendations:
   - Smooth: [0.25, 0.1, 0.25, 1]
   - Snappy: [0.4, 0, 0.2, 1]
   - Bouncy: type: "spring", stiffness: 300, damping: 20

3. **WHAT TO ANIMATE**
   ✅ DO animate:
   - Page/route transitions
   - Modal/dropdown open/close
   - Button hover/tap states
   - Card hover effects
   - Loading states
   - List item additions/removals
   - Scroll-triggered reveals
   
   ❌ DON'T animate:
   - Critical information
   - Form submissions (except loading)
   - Error states (should be instant)
   - Continuous loops without purpose

4. **STAGGER PATTERNS**
   - List items: 50-100ms stagger
   - Grid items: 30-50ms stagger
   - Maximum 10 items before stopping stagger
   
5. **SCROLL ANIMATIONS**
   - Trigger at 80% viewport intersection
   - Use once: true for performance
   - Keep animations subtle (y: 20-50px max)
"""


# ============================================================================
# RESPONSIVE DESIGN
# ============================================================================

RESPONSIVE_BREAKPOINTS = """
📱 TAILWIND BREAKPOINTS (Mobile-First):

sm: 640px   /* Large phones, small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */

COMMON PATTERNS:

/* Text scaling */
text-3xl md:text-4xl lg:text-5xl xl:text-6xl

/* Grid layouts */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4

/* Padding */
px-4 md:px-6 lg:px-8

/* Container */
max-w-7xl mx-auto px-4 sm:px-6 lg:px-8

/* Stack to row */
flex flex-col md:flex-row

/* Hide/show */
hidden md:block  /* Show on tablet+ */
md:hidden        /* Hide on tablet+ */
"""


# ============================================================================
# COMPONENT STYLING RECIPES
# ============================================================================

COMPONENT_RECIPES = {
    "premium_button": """
/* Primary button with all states */
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  className="
    px-6 py-3 
    bg-gradient-to-r from-purple-600 to-pink-600 
    text-white font-medium 
    rounded-xl 
    shadow-lg shadow-purple-500/25
    hover:shadow-xl hover:shadow-purple-500/30
    transition-shadow duration-200
    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  "
>
  Get Started
</motion.button>
""",
    
    "premium_card": """
/* Card with hover effect */
<motion.div
  whileHover={{ y: -5 }}
  className="
    p-6 
    bg-white dark:bg-slate-800 
    rounded-2xl 
    border border-slate-200 dark:border-slate-700
    shadow-sm hover:shadow-xl
    transition-shadow duration-300
  "
>
  {content}
</motion.div>
""",
    
    "premium_input": """
/* Input with focus ring */
<input
  className="
    w-full px-4 py-3
    bg-slate-50 dark:bg-slate-800
    border border-slate-200 dark:border-slate-700
    rounded-xl
    text-slate-900 dark:text-white
    placeholder:text-slate-400
    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
    transition-all duration-200
  "
  placeholder="Enter text..."
/>
""",
    
    "premium_badge": """
/* Gradient badge */
<span className="
  inline-flex items-center gap-1.5
  px-3 py-1
  bg-gradient-to-r from-purple-500/10 to-pink-500/10
  border border-purple-500/20
  rounded-full
  text-sm font-medium text-purple-600 dark:text-purple-400
">
  <Sparkles className="w-3.5 h-3.5" />
  New Feature
</span>
""",
    
    "premium_section": """
/* Section with gradient background */
<section className="
  relative py-24 px-4
  bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950
  overflow-hidden
">
  {/* Decorative elements */}
  <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
  <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
  
  <div className="relative z-10 max-w-6xl mx-auto">
    {content}
  </div>
</section>
""",
}


# ============================================================================
# ACCESSIBILITY GUIDELINES
# ============================================================================

ACCESSIBILITY_CHECKLIST = """
♿ ACCESSIBILITY REQUIREMENTS (WCAG 2.1):

1. **COLOR CONTRAST**
   - Normal text: 4.5:1 minimum
   - Large text (18px+): 3:1 minimum
   - Interactive elements: 3:1 minimum
   
2. **KEYBOARD NAVIGATION**
   - All interactive elements focusable
   - Visible focus indicators (focus:ring-2)
   - Logical tab order
   - Escape closes modals
   
3. **SEMANTIC HTML**
   - Use proper heading hierarchy (h1 > h2 > h3)
   - Use <button> for actions, <a> for navigation
   - Use <nav>, <main>, <footer>, <section>
   - Use <ul>/<ol> for lists
   
4. **ARIA LABELS**
   - aria-label for icon-only buttons
   - aria-expanded for dropdowns
   - aria-hidden for decorative elements
   - role="dialog" for modals
   
5. **FORM ACCESSIBILITY**
   - Labels for all inputs
   - Error messages linked with aria-describedby
   - Required fields marked
   - Clear validation feedback

CODE EXAMPLES:

/* Icon button */
<button aria-label="Close menu">
  <X className="w-5 h-5" />
</button>

/* Form field */
<div>
  <label htmlFor="email">Email</label>
  <input 
    id="email" 
    type="email"
    aria-describedby="email-error"
    aria-invalid={hasError}
  />
  {hasError && <p id="email-error">Please enter valid email</p>}
</div>

/* Modal */
<div 
  role="dialog" 
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Modal Title</h2>
</div>
"""


# ============================================================================
# DARK MODE IMPLEMENTATION
# ============================================================================

DARK_MODE_GUIDE = """
🌙 DARK MODE IMPLEMENTATION:

1. **TAILWIND SETUP**
   // tailwind.config.js
   module.exports = {
     darkMode: 'class', // or 'media' for system preference
   }

2. **COLOR MAPPING**
   Light → Dark:
   - white → slate-900
   - slate-50 → slate-800
   - slate-100 → slate-700
   - slate-200 → slate-600
   - slate-900 → white
   - slate-600 → slate-400

3. **COMMON PATTERNS**
   /* Backgrounds */
   bg-white dark:bg-slate-900
   bg-slate-50 dark:bg-slate-800
   
   /* Text */
   text-slate-900 dark:text-white
   text-slate-600 dark:text-slate-400
   
   /* Borders */
   border-slate-200 dark:border-slate-700
   
   /* Shadows (reduce in dark mode) */
   shadow-lg dark:shadow-none
   shadow-lg dark:shadow-slate-900/50

4. **TOGGLE COMPONENT**
   const ThemeToggle = () => {
     const [dark, setDark] = useState(false);
     
     useEffect(() => {
       document.documentElement.classList.toggle('dark', dark);
     }, [dark]);
     
     return (
       <button onClick={() => setDark(!dark)}>
         {dark ? <Sun /> : <Moon />}
       </button>
     );
   };
"""


# ============================================================================
# COMPLETE GUIDELINES STRING FOR PROMPTS
# ============================================================================

PREMIUM_UI_GUIDELINES = f"""
🎨 PREMIUM UI/UX GUIDELINES

{TYPOGRAPHY_SYSTEM['hierarchy']}

{RESPONSIVE_BREAKPOINTS}

{ANIMATION_PRINCIPLES}

**VISUAL EFFECTS:**
{GLASSMORPHISM}

{GRADIENT_PATTERNS}

{SHADOW_SYSTEM}

**COMPONENT STYLING:**
{COMPONENT_RECIPES['premium_button']}

{COMPONENT_RECIPES['premium_card']}

**DARK MODE:**
{DARK_MODE_GUIDE}

**ACCESSIBILITY:**
{ACCESSIBILITY_CHECKLIST}
"""


def get_styling_recipe(component_type: str) -> str:
    """Get styling recipe for a component type"""
    return COMPONENT_RECIPES.get(component_type, "")


def get_complete_guidelines() -> str:
    """Get all UI guidelines as a single string"""
    return PREMIUM_UI_GUIDELINES


# Export all
__all__ = [
    'SPACING_SYSTEM',
    'TYPOGRAPHY_SYSTEM',
    'BORDER_RADIUS_SYSTEM',
    'GLASSMORPHISM',
    'NEUMORPHISM',
    'GRADIENT_PATTERNS',
    'SHADOW_SYSTEM',
    'ANIMATION_PRINCIPLES',
    'RESPONSIVE_BREAKPOINTS',
    'COMPONENT_RECIPES',
    'ACCESSIBILITY_CHECKLIST',
    'DARK_MODE_GUIDE',
    'PREMIUM_UI_GUIDELINES',
    'get_styling_recipe',
    'get_complete_guidelines',
]
