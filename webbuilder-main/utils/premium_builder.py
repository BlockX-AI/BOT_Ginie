"""
Premium Builder Enhancement System
====================================
Unified module that integrates all enhancement systems:
- Design Patterns
- Animation Presets
- Component Registry
- Project Modes
- UI Guidelines

This module provides the enhanced prompt generation for premium UI/UX.
"""

from typing import Dict, List, Any, Optional
import json

from utils.design_patterns import (
    suggest_template_for_prompt,
    get_page_template,
    get_required_dependencies,
    get_color_palette,
    SECTION_TEMPLATES,
    COLOR_PALETTES,
)
from utils.animation_presets import (
    suggest_animations_for_component,
    get_all_presets,
    ENTRANCE_PRESETS,
    HOVER_PRESETS,
)
from utils.component_registry import (
    suggest_components_for_app,
    get_component_dependencies,
    COMPONENT_REGISTRY,
)
from utils.project_modes import (
    detect_project_mode,
    get_mode_config,
    get_mode_prompt,
    get_complete_mode_context,
    NON_NEGOTIABLE_RULES,
    FAILURE_RECOVERY_RULES,
    ProjectMode,
)
from utils.premium_ui_guidelines import (
    PREMIUM_UI_GUIDELINES,
    COMPONENT_RECIPES,
    ANIMATION_PRINCIPLES,
)


# ============================================================================
# ENHANCED PROMPT BUILDER
# ============================================================================

class PremiumPromptBuilder:
    """Builds enhanced prompts with premium UI/UX context"""
    
    def __init__(self, user_prompt: str):
        self.user_prompt = user_prompt
        self.mode_context = get_complete_mode_context(user_prompt)
        self.mode = ProjectMode(self.mode_context["mode"])
        self.config = get_mode_config(self.mode)
        
    def get_suggested_template(self) -> str:
        """Get the best matching page template"""
        return suggest_template_for_prompt(self.user_prompt)
    
    def get_recommended_components(self) -> List[str]:
        """Get recommended components for this app type"""
        app_type = self._detect_app_type()
        return suggest_components_for_app(app_type)
    
    def get_all_dependencies(self) -> List[str]:
        """Get all recommended dependencies"""
        base_deps = self.config.recommended_libraries
        components = self.get_recommended_components()
        component_deps = get_component_dependencies(components)
        
        # Merge and deduplicate
        all_deps = list(set(base_deps + component_deps))
        return sorted(all_deps)
    
    def _detect_app_type(self) -> str:
        """Detect app type from prompt"""
        prompt_lower = self.user_prompt.lower()
        
        if any(kw in prompt_lower for kw in ['dashboard', 'admin', 'analytics']):
            return 'dashboard'
        elif any(kw in prompt_lower for kw in ['ecommerce', 'shop', 'store', 'product']):
            return 'ecommerce'
        elif any(kw in prompt_lower for kw in ['blog', 'article', 'post']):
            return 'blog'
        elif any(kw in prompt_lower for kw in ['portfolio', 'personal', 'resume']):
            return 'portfolio'
        elif any(kw in prompt_lower for kw in ['form', 'contact', 'signup', 'login']):
            return 'form'
        elif any(kw in prompt_lower for kw in ['social', 'chat', 'message', 'feed']):
            return 'social'
        else:
            return 'landing'
    
    def build_enhanced_system_prompt(self) -> str:
        """Build the complete enhanced system prompt"""
        
        mode_prompt = get_mode_prompt(self.mode)
        template_name = self.get_suggested_template()
        template = get_page_template(template_name)
        components = self.get_recommended_components()
        dependencies = self.get_all_dependencies()
        
        # Build sections info
        sections_info = ""
        if template:
            sections_info = f"""
RECOMMENDED TEMPLATE: {template.get('name', template_name)}
SECTIONS TO INCLUDE: {', '.join(template.get('sections', []))}
COLOR PALETTE: {template.get('color_palette', 'modern_dark')}
"""
        
        # Build component recommendations
        component_info = f"""
RECOMMENDED COMPONENTS: {', '.join(components)}
These components are pre-built with animations and premium styling.
"""
        
        # Build dependency list
        deps_info = f"""
INSTALL THESE PACKAGES:
npm install {' '.join(dependencies)}
"""
        
        return f"""
{mode_prompt}

{NON_NEGOTIABLE_RULES}

{FAILURE_RECOVERY_RULES}

{sections_info}

{component_info}

{deps_info}

{PREMIUM_UI_STYLING_GUIDE}
"""
    
    def get_animation_suggestions(self, component_types: List[str]) -> Dict[str, List[str]]:
        """Get animation suggestions for component types"""
        suggestions = {}
        for comp_type in component_types:
            suggestions[comp_type] = suggest_animations_for_component(comp_type)
        return suggestions


# ============================================================================
# PREMIUM UI STYLING GUIDE (Condensed for prompts)
# ============================================================================

PREMIUM_UI_STYLING_GUIDE = """
🎨 PREMIUM UI STYLING RULES:

**TYPOGRAPHY:**
- Hero: text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight
- Section: text-3xl md:text-5xl font-bold
- Body: text-base md:text-lg text-slate-600 dark:text-slate-400

**SPACING:**
- Sections: py-16 md:py-24
- Cards in grid: gap-4 md:gap-6 lg:gap-8
- Container: max-w-6xl mx-auto px-4 md:px-6

**COLORS (Modern Dark):**
- Primary: purple-600 / purple-500
- Accent: pink-500 / cyan-400
- Background: slate-900 / slate-950
- Text: white / slate-300 / slate-400

**EFFECTS:**
- Gradients: bg-gradient-to-r from-purple-600 to-pink-600
- Glass: bg-white/10 backdrop-blur-lg border border-white/20
- Shadows: shadow-xl shadow-purple-500/20

**ANIMATIONS (Framer Motion):**
- Entrance: initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
- Hover: whileHover={{ scale: 1.02, y: -5 }}
- Tap: whileTap={{ scale: 0.98 }}
- Stagger: transition={{ staggerChildren: 0.1 }}

**COMPONENTS:**
- Buttons: rounded-xl with gradient, hover:opacity-90
- Cards: rounded-2xl border shadow-sm hover:shadow-xl
- Inputs: rounded-xl bg-slate-50 focus:ring-2 focus:ring-purple-500

**RESPONSIVE:**
- Mobile-first: base styles, then md: lg: xl: overrides
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Stack: flex flex-col md:flex-row
"""


# ============================================================================
# SECTION CODE SNIPPETS (Ready to use)
# ============================================================================

QUICK_SECTIONS = {
    "hero_simple": '''
// Hero Section with gradient
<section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
  <div className="text-center max-w-4xl">
    <motion.h1 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-4xl md:text-6xl font-bold text-white mb-6"
    >
      Your Amazing <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Product</span>
    </motion.h1>
    <motion.p 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="text-xl text-slate-300 mb-8"
    >
      Build something incredible with modern technology.
    </motion.p>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity">
        Get Started
      </button>
    </motion.div>
  </div>
</section>
''',

    "features_grid": '''
// Features Grid Section
<section className="py-24 px-4 bg-slate-50 dark:bg-slate-900">
  <div className="max-w-6xl mx-auto">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center mb-16"
    >
      <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">Features</h2>
      <p className="text-slate-600 dark:text-slate-400 text-lg">Everything you need to succeed</p>
    </motion.div>
    
    <div className="grid md:grid-cols-3 gap-8">
      {features.map((feature, i) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          whileHover={{ y: -5 }}
          className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
            <feature.icon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
          <p className="text-slate-600 dark:text-slate-400">{feature.description}</p>
        </motion.div>
      ))}
    </div>
  </div>
</section>
''',

    "cta_simple": '''
// CTA Section
<section className="py-24 px-4">
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    className="max-w-4xl mx-auto text-center p-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl"
  >
    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to get started?</h2>
    <p className="text-white/80 mb-8">Join thousands of satisfied users today.</p>
    <button className="px-8 py-4 bg-white text-purple-600 rounded-xl font-semibold hover:bg-white/90 transition-colors">
      Start Free Trial
    </button>
  </motion.div>
</section>
''',
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def build_premium_prompt(user_prompt: str) -> str:
    """Build a complete premium-enhanced prompt"""
    builder = PremiumPromptBuilder(user_prompt)
    return builder.build_enhanced_system_prompt()


def get_mode_for_prompt(user_prompt: str) -> Dict[str, Any]:
    """Get detected mode and configuration"""
    return get_complete_mode_context(user_prompt)


def get_quick_section(section_name: str) -> str:
    """Get a quick section code snippet"""
    return QUICK_SECTIONS.get(section_name, "")


def get_all_quick_sections() -> Dict[str, str]:
    """Get all quick section snippets"""
    return QUICK_SECTIONS


def get_component_code_for_prompt(component_names: List[str]) -> str:
    """Get component code snippets for the prompt"""
    from utils.component_registry import get_component_code
    
    codes = []
    for name in component_names:
        code = get_component_code(name)
        if code:
            codes.append(f"// {name} Component\n{code}")
    return "\n\n".join(codes)


# ============================================================================
# SMOKE TEST / SELF-CHECK (From handwritten notes)
# ============================================================================

SMOKE_TEST_CHECKLIST = """
🧪 SMOKE TEST CHECKLIST (Run before marking complete):

□ All imports resolve (no "Cannot find module" errors)
□ No JSX syntax errors
□ Tailwind classes render correctly
□ index.css has @import "tailwindcss";
□ Dev server starts on port 5173
□ No console errors in browser
□ Responsive layout works (resize window)
□ Interactive elements respond to clicks
□ Animations play smoothly
□ Dark mode toggle works (if implemented)

AUTOMATED CHECK:
Call test_build() tool to verify:
- npm install succeeds
- npm run dev starts without errors
- Build output is clean
"""


def get_smoke_test_checklist() -> str:
    """Get the smoke test checklist"""
    return SMOKE_TEST_CHECKLIST


# Export all
__all__ = [
    'PremiumPromptBuilder',
    'PREMIUM_UI_STYLING_GUIDE',
    'QUICK_SECTIONS',
    'SMOKE_TEST_CHECKLIST',
    'build_premium_prompt',
    'get_mode_for_prompt',
    'get_quick_section',
    'get_all_quick_sections',
    'get_component_code_for_prompt',
    'get_smoke_test_checklist',
]
