# Premium UI/UX Enhancement System

A comprehensive system for generating modern, animated, and professional frontend interfaces - similar to what v0, Lovable, and similar AI tools produce.

## 📁 Files Created

| File | Purpose |
|------|---------|
| `utils/design_patterns.py` | Predefined UI section templates (Hero, Features, Pricing, etc.) |
| `utils/animation_presets.py` | Framer Motion animation configurations |
| `utils/component_registry.py` | Modern UI components (Button, Card, Modal, Toast, etc.) |
| `utils/project_modes.py` | Project complexity modes (Simple, Standard, Complex, Web3) |
| `utils/premium_ui_guidelines.py` | Design system constants and styling recipes |
| `utils/premium_builder.py` | Unified integration module |
| `agent/premium_prompts.py` | Enhanced prompt templates |

---

## 🚀 Quick Start

### Using Premium Prompts

```python
# In graph_nodes.py, replace:
from agent.prompts import INITPROMPT, PROMPT_ENHANCER_SYSTEM

# With:
from agent.premium_prompts import PREMIUM_INITPROMPT, PREMIUM_PROMPT_ENHANCER_SYSTEM
```

### Dynamic Mode Detection

```python
from utils.project_modes import detect_project_mode, get_mode_config

# Automatically detect project complexity
mode = detect_project_mode("Build a simple todo app")
# Returns: ProjectMode.SIMPLE

mode = detect_project_mode("Create a DeFi swap platform")
# Returns: ProjectMode.WEB3_DAPP

# Get mode-specific configuration
config = get_mode_config(mode)
print(config.max_files)  # 10 for simple, 60 for complex
print(config.tool_call_budget)  # 50 for simple, 150 for complex
```

---

## 🎨 Design Patterns

### Available Section Templates

```python
from utils.design_patterns import SECTION_TEMPLATES, get_section_template

# Get a specific section
hero = get_section_template("hero_gradient")
print(hero["code"])  # Complete React component code

# Available sections:
# - hero_gradient (Full-screen gradient hero)
# - hero_minimal (Clean minimal hero)
# - features_bento (Bento grid features)
# - pricing_cards (Three-tier pricing)
# - testimonials_carousel (Customer reviews)
# - cta_gradient (Call-to-action banner)
# - navbar_glass (Glassmorphism navbar)
# - footer_modern (Multi-column footer)
# - stats_animated (Counting stats)
```

### Page Templates

```python
from utils.design_patterns import PAGE_TEMPLATES, suggest_template_for_prompt

# Auto-suggest template based on prompt
template = suggest_template_for_prompt("Create a portfolio website")
# Returns: "portfolio"

# Get full template configuration
from utils.design_patterns import get_page_template
config = get_page_template("landing_page")
print(config["sections"])  # List of sections to include
print(config["color_palette"])  # Recommended colors
```

---

## 🎬 Animation Presets

### Using Animation Presets

```python
from utils.animation_presets import (
    ENTRANCE_PRESETS,
    HOVER_PRESETS,
    SCROLL_PRESETS,
    suggest_animations_for_component
)

# Get animation code
fade_up = ENTRANCE_PRESETS["fade_up"]
print(fade_up["code"])

# Get suggestions for component types
anims = suggest_animations_for_component("card")
# Returns: ["hover_lift", "scroll_fade_up", "tap_scale"]
```

### Available Presets

**Entrance:**
- `fade_in`, `fade_up`, `fade_down`, `fade_left`, `fade_right`
- `scale_in`, `scale_bounce`, `blur_in`, `rotate_in`

**Scroll:**
- `scroll_fade_up`, `scroll_scale`, `parallax_slow`

**Hover:**
- `hover_scale`, `hover_lift`, `hover_glow`, `hover_rotate`

**Loop:**
- `pulse`, `float`, `spin`, `shimmer`, `gradient_shift`

---

## 🧩 Component Registry

### Using Pre-built Components

```python
from utils.component_registry import (
    get_component_code,
    suggest_components_for_app,
    get_component_dependencies
)

# Get component code
button_code = get_component_code("Button")

# Suggest components for app type
components = suggest_components_for_app("dashboard")
# Returns: ["Button", "Card", "Avatar", "Badge", "Tabs", "Progress", "Dropdown", "Skeleton"]

# Get dependencies
deps = get_component_dependencies(["Button", "Modal", "Toast"])
# Returns: ["framer-motion", "lucide-react"]
```

### Available Components

| Component | Category | Description |
|-----------|----------|-------------|
| Button | Input | Multi-variant button with loading state |
| Card | Display | Container with header/content/footer |
| Input | Input | Text input with label and validation |
| Badge | Display | Status indicator |
| Avatar | Display | User avatar with fallback |
| Modal | Overlay | Animated dialog |
| Toast | Feedback | Notification system |
| Skeleton | Feedback | Loading placeholder |
| Tabs | Navigation | Animated tabs |
| Dropdown | Input | Select dropdown |
| Progress | Feedback | Animated progress bar |

---

## 📊 Project Modes

### Mode Detection & Configuration

| Mode | Max Files | Max Components | Tool Budget | Use Case |
|------|-----------|----------------|-------------|----------|
| SIMPLE | 10 | 5 | 50 | Todo, Calculator |
| STANDARD | 30 | 15 | 100 | Landing pages, Portfolios |
| COMPLEX | 60 | 30 | 150 | SaaS, E-commerce |
| WEB3_GAME | 40 | 20 | 120 | Blockchain games |
| WEB3_DAPP | 50 | 25 | 140 | DeFi, NFT platforms |

### Mode-Specific Guardrails

```python
from utils.project_modes import get_mode_config, ProjectMode

config = get_mode_config(ProjectMode.SIMPLE)
print(config.guardrails)
# {
#   "no_router": True,
#   "single_page": True,
#   "inline_styles_ok": True,
#   "skip_tests": True
# }

config = get_mode_config(ProjectMode.WEB3_GAME)
print(config.guardrails)
# {
#   "require_wallet_connection": True,
#   "require_contract_integration": True,
#   "deploy_contract_first": True
# }
```

---

## 🎨 Premium UI Guidelines

### Spacing System (8px base)

```css
/* Tailwind classes */
gap-4   /* 16px - between cards */
py-16   /* 64px - section padding */
mb-8    /* 32px - heading margin */
```

### Typography Hierarchy

```jsx
// Hero heading
<h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight">

// Section heading
<h2 className="text-3xl md:text-5xl font-bold">

// Body text
<p className="text-base md:text-lg text-slate-600 dark:text-slate-400">
```

### Color Palettes

```python
from utils.design_patterns import COLOR_PALETTES, get_color_palette

# Available palettes:
# - modern_dark (Purple/Pink on dark)
# - clean_light (Blue/Emerald on white)
# - gradient_sunset (Orange/Pink on dark)
# - nature_green (Green/Teal on light)
# - corporate_blue (Blue/Indigo on white)
# - web3_neon (Purple/Cyan neon on black)

palette = get_color_palette("modern_dark")
print(palette.primary)  # #8B5CF6
print(palette.to_tailwind_config())
```

### Premium Effects

```jsx
// Glassmorphism
className="bg-white/10 backdrop-blur-lg border border-white/20"

// Gradient text
className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"

// Hover lift
className="hover:shadow-xl hover:-translate-y-1 transition-all"

// Gradient button
className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
```

---

## ✅ Smoke Test Checklist

Before marking a project complete:

```
□ All imports resolve (no module errors)
□ No JSX syntax errors
□ Tailwind classes render correctly
□ index.css has @import "tailwindcss";
□ Dev server starts on port 5173
□ No console errors in browser
□ Responsive layout works
□ Interactive elements respond
□ Animations play at 60fps
□ Dark mode works (if implemented)
```

---

## 🔧 Integration with graph_nodes.py

```python
# In builder_node(), add mode detection:
from utils.project_modes import detect_project_mode, get_mode_config
from agent.premium_prompts import build_dynamic_init_prompt

# Detect mode from user prompt
mode = detect_project_mode(user_prompt)
config = get_mode_config(mode)

# Use dynamic prompt
init_prompt = build_dynamic_init_prompt(user_prompt)

# Apply mode-specific limits
max_iterations = config.tool_call_budget
```

---

## 📦 Recommended Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.300.0",
    "sonner": "^1.3.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

For Web3 projects, add:
```json
{
  "wagmi": "^2.5.0",
  "viem": "^2.0.0",
  "@rainbow-me/rainbowkit": "^2.0.0",
  "@tanstack/react-query": "^5.0.0"
}
```

---

## 🎯 Summary

This system provides:

1. **Predefined Design Patterns** - Battle-tested section templates
2. **Component-Based Architecture** - 11 production-ready components
3. **Tailwind CSS Styling** - Consistent design system
4. **Framer Motion Animations** - 20+ animation presets
5. **Project Modes** - Optimized for different complexity levels
6. **Failure Recovery** - Clear rules for handling errors
7. **Smoke Testing** - Checklist for quality assurance

The result: AI-generated UIs that look like they came from professional design tools.
