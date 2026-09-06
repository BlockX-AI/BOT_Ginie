"""
Framer Motion Animation Presets
================================
Ready-to-use animation configurations for premium UI effects.
These presets create the polished, fluid animations seen on v0, Lovable, and similar tools.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class AnimationType(Enum):
    """Categories of animations"""
    ENTRANCE = "entrance"
    EXIT = "exit"
    HOVER = "hover"
    TAP = "tap"
    SCROLL = "scroll"
    STAGGER = "stagger"
    GESTURE = "gesture"
    LOOP = "loop"


@dataclass
class AnimationPreset:
    """A complete animation configuration"""
    name: str
    description: str
    type: AnimationType
    initial: Dict[str, Any]
    animate: Dict[str, Any]
    exit: Dict[str, Any] = None
    transition: Dict[str, Any] = None
    whileHover: Dict[str, Any] = None
    whileTap: Dict[str, Any] = None
    viewport: Dict[str, Any] = None


# ============================================================================
# ENTRANCE ANIMATIONS
# ============================================================================

ENTRANCE_PRESETS: Dict[str, Dict[str, Any]] = {
    "fade_in": {
        "name": "Fade In",
        "description": "Simple fade in animation",
        "initial": {"opacity": 0},
        "animate": {"opacity": 1},
        "transition": {"duration": 0.5},
        "code": '''
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>
'''
    },
    
    "fade_up": {
        "name": "Fade Up",
        "description": "Fade in while sliding up",
        "initial": {"opacity": 0, "y": 20},
        "animate": {"opacity": 1, "y": 0},
        "transition": {"duration": 0.6, "ease": [0.25, 0.1, 0, 1]},
        "code": '''
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.25, 0.1, 0, 1] }}
>
  Content
</motion.div>
'''
    },
    
    "fade_down": {
        "name": "Fade Down",
        "description": "Fade in while sliding down",
        "initial": {"opacity": 0, "y": -20},
        "animate": {"opacity": 1, "y": 0},
        "transition": {"duration": 0.6, "ease": [0.25, 0.1, 0, 1]},
        "code": '''
<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.25, 0.1, 0, 1] }}
>
  Content
</motion.div>
'''
    },
    
    "fade_left": {
        "name": "Fade Left",
        "description": "Fade in while sliding from right",
        "initial": {"opacity": 0, "x": 30},
        "animate": {"opacity": 1, "x": 0},
        "transition": {"duration": 0.6, "ease": "easeOut"},
        "code": '''
<motion.div
  initial={{ opacity: 0, x: 30 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.6, ease: "easeOut" }}
>
  Content
</motion.div>
'''
    },
    
    "fade_right": {
        "name": "Fade Right",
        "description": "Fade in while sliding from left",
        "initial": {"opacity": 0, "x": -30},
        "animate": {"opacity": 1, "x": 0},
        "transition": {"duration": 0.6, "ease": "easeOut"},
        "code": '''
<motion.div
  initial={{ opacity: 0, x: -30 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.6, ease: "easeOut" }}
>
  Content
</motion.div>
'''
    },
    
    "scale_in": {
        "name": "Scale In",
        "description": "Scale up from smaller size",
        "initial": {"opacity": 0, "scale": 0.9},
        "animate": {"opacity": 1, "scale": 1},
        "transition": {"duration": 0.5, "ease": [0, 0.55, 0.45, 1]},
        "code": '''
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.5, ease: [0, 0.55, 0.45, 1] }}
>
  Content
</motion.div>
'''
    },
    
    "scale_bounce": {
        "name": "Scale Bounce",
        "description": "Scale up with spring bounce effect",
        "initial": {"opacity": 0, "scale": 0.8},
        "animate": {"opacity": 1, "scale": 1},
        "transition": {"type": "spring", "stiffness": 200, "damping": 15},
        "code": '''
<motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ type: "spring", stiffness: 200, damping: 15 }}
>
  Content
</motion.div>
'''
    },
    
    "blur_in": {
        "name": "Blur In",
        "description": "Fade in with blur effect (requires filter support)",
        "initial": {"opacity": 0, "filter": "blur(10px)"},
        "animate": {"opacity": 1, "filter": "blur(0px)"},
        "transition": {"duration": 0.6},
        "code": '''
<motion.div
  initial={{ opacity: 0, filter: "blur(10px)" }}
  animate={{ opacity: 1, filter: "blur(0px)" }}
  transition={{ duration: 0.6 }}
>
  Content
</motion.div>
'''
    },
    
    "rotate_in": {
        "name": "Rotate In",
        "description": "Slight rotation while fading in",
        "initial": {"opacity": 0, "rotate": -5, "y": 10},
        "animate": {"opacity": 1, "rotate": 0, "y": 0},
        "transition": {"duration": 0.5, "ease": "easeOut"},
        "code": '''
<motion.div
  initial={{ opacity: 0, rotate: -5, y: 10 }}
  animate={{ opacity: 1, rotate: 0, y: 0 }}
  transition={{ duration: 0.5, ease: "easeOut" }}
>
  Content
</motion.div>
'''
    },
}


# ============================================================================
# SCROLL-TRIGGERED ANIMATIONS
# ============================================================================

SCROLL_PRESETS: Dict[str, Dict[str, Any]] = {
    "scroll_fade_up": {
        "name": "Scroll Fade Up",
        "description": "Fade up when element enters viewport",
        "initial": {"opacity": 0, "y": 50},
        "whileInView": {"opacity": 1, "y": 0},
        "viewport": {"once": True, "margin": "-100px"},
        "transition": {"duration": 0.8, "ease": [0.25, 0.1, 0, 1]},
        "code": '''
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
  transition={{ duration: 0.8, ease: [0.25, 0.1, 0, 1] }}
>
  Content
</motion.div>
'''
    },
    
    "scroll_scale": {
        "name": "Scroll Scale",
        "description": "Scale up when scrolled into view",
        "initial": {"opacity": 0, "scale": 0.9},
        "whileInView": {"opacity": 1, "scale": 1},
        "viewport": {"once": True},
        "transition": {"duration": 0.6},
        "code": '''
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  whileInView={{ opacity: 1, scale: 1 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
>
  Content
</motion.div>
'''
    },
    
    "parallax_slow": {
        "name": "Parallax Slow",
        "description": "Moves slower than scroll for depth effect",
        "style": {"y": "useTransform(scrollYProgress, [0, 1], [0, -50])"},
        "code": '''
// In component:
const { scrollYProgress } = useScroll();
const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

<motion.div style={{ y }}>
  Content
</motion.div>
'''
    },
}


# ============================================================================
# STAGGER ANIMATIONS (for lists/grids)
# ============================================================================

STAGGER_PRESETS: Dict[str, Dict[str, Any]] = {
    "stagger_children": {
        "name": "Stagger Children",
        "description": "Animate children one after another",
        "container": {
            "initial": "hidden",
            "animate": "visible",
            "variants": {
                "hidden": {"opacity": 0},
                "visible": {
                    "opacity": 1,
                    "transition": {"staggerChildren": 0.1}
                }
            }
        },
        "item": {
            "variants": {
                "hidden": {"opacity": 0, "y": 20},
                "visible": {"opacity": 1, "y": 0}
            }
        },
        "code": '''
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

<motion.ul variants={containerVariants} initial="hidden" animate="visible">
  {items.map((item, i) => (
    <motion.li key={i} variants={itemVariants}>
      {item}
    </motion.li>
  ))}
</motion.ul>
'''
    },
    
    "stagger_scale": {
        "name": "Stagger Scale",
        "description": "Stagger children with scale effect",
        "container": {
            "variants": {
                "hidden": {"opacity": 0},
                "visible": {
                    "opacity": 1,
                    "transition": {"staggerChildren": 0.08, "delayChildren": 0.2}
                }
            }
        },
        "item": {
            "variants": {
                "hidden": {"opacity": 0, "scale": 0.8},
                "visible": {"opacity": 1, "scale": 1}
            }
        },
        "code": '''
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { type: "spring", stiffness: 200, damping: 20 }
  }
};
'''
    },
    
    "stagger_from_center": {
        "name": "Stagger From Center",
        "description": "Animate from center outward",
        "code": '''
// Calculate stagger based on distance from center
const getDelay = (index, total) => {
  const center = Math.floor(total / 2);
  const distance = Math.abs(index - center);
  return distance * 0.05;
};

{items.map((item, i) => (
  <motion.div
    key={i}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: getDelay(i, items.length) }}
  >
    {item}
  </motion.div>
))}
'''
    },
}


# ============================================================================
# HOVER ANIMATIONS
# ============================================================================

HOVER_PRESETS: Dict[str, Dict[str, Any]] = {
    "hover_scale": {
        "name": "Hover Scale",
        "description": "Scale up on hover",
        "whileHover": {"scale": 1.05},
        "transition": {"type": "spring", "stiffness": 400, "damping": 17},
        "code": '''
<motion.div
  whileHover={{ scale: 1.05 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Hover me
</motion.div>
'''
    },
    
    "hover_lift": {
        "name": "Hover Lift",
        "description": "Lift up with shadow on hover",
        "whileHover": {"y": -5, "boxShadow": "0 20px 40px -15px rgba(0,0,0,0.3)"},
        "transition": {"duration": 0.2},
        "code": '''
<motion.div
  whileHover={{ 
    y: -5, 
    boxShadow: "0 20px 40px -15px rgba(0,0,0,0.3)" 
  }}
  transition={{ duration: 0.2 }}
  className="cursor-pointer"
>
  Hover me
</motion.div>
'''
    },
    
    "hover_glow": {
        "name": "Hover Glow",
        "description": "Add glow effect on hover",
        "whileHover": {"boxShadow": "0 0 30px rgba(139, 92, 246, 0.5)"},
        "transition": {"duration": 0.3},
        "code": '''
<motion.div
  whileHover={{ boxShadow: "0 0 30px rgba(139, 92, 246, 0.5)" }}
  transition={{ duration: 0.3 }}
>
  Hover me
</motion.div>
'''
    },
    
    "hover_rotate": {
        "name": "Hover Rotate",
        "description": "Slight rotation on hover",
        "whileHover": {"rotate": 3, "scale": 1.02},
        "transition": {"type": "spring", "stiffness": 300},
        "code": '''
<motion.div
  whileHover={{ rotate: 3, scale: 1.02 }}
  transition={{ type: "spring", stiffness: 300 }}
>
  Hover me
</motion.div>
'''
    },
    
    "hover_underline": {
        "name": "Hover Underline",
        "description": "Animated underline on hover",
        "code": '''
// CSS approach with Framer Motion trigger
<motion.a
  href="#"
  className="relative"
  whileHover="hover"
>
  Link Text
  <motion.span
    className="absolute bottom-0 left-0 h-0.5 bg-purple-500"
    initial={{ width: 0 }}
    variants={{
      hover: { width: "100%" }
    }}
    transition={{ duration: 0.3 }}
  />
</motion.a>
'''
    },
}


# ============================================================================
# BUTTON & TAP ANIMATIONS
# ============================================================================

TAP_PRESETS: Dict[str, Dict[str, Any]] = {
    "tap_scale": {
        "name": "Tap Scale",
        "description": "Scale down on tap/click",
        "whileTap": {"scale": 0.95},
        "code": '''
<motion.button
  whileTap={{ scale: 0.95 }}
  className="px-6 py-3 bg-purple-600 text-white rounded-lg"
>
  Click me
</motion.button>
'''
    },
    
    "tap_bounce": {
        "name": "Tap Bounce",
        "description": "Bouncy tap effect",
        "whileTap": {"scale": 0.9},
        "transition": {"type": "spring", "stiffness": 400, "damping": 10},
        "code": '''
<motion.button
  whileTap={{ scale: 0.9 }}
  transition={{ type: "spring", stiffness: 400, damping: 10 }}
>
  Click me
</motion.button>
'''
    },
    
    "button_complete": {
        "name": "Complete Button",
        "description": "Full button with hover and tap states",
        "whileHover": {"scale": 1.02, "backgroundColor": "#7C3AED"},
        "whileTap": {"scale": 0.98},
        "transition": {"type": "spring", "stiffness": 400, "damping": 17},
        "code": '''
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium"
>
  Click me
</motion.button>
'''
    },
}


# ============================================================================
# CONTINUOUS/LOOP ANIMATIONS
# ============================================================================

LOOP_PRESETS: Dict[str, Dict[str, Any]] = {
    "pulse": {
        "name": "Pulse",
        "description": "Continuous pulsing effect",
        "animate": {"scale": [1, 1.05, 1]},
        "transition": {"duration": 2, "repeat": "Infinity", "ease": "easeInOut"},
        "code": '''
<motion.div
  animate={{ scale: [1, 1.05, 1] }}
  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
>
  Pulsing
</motion.div>
'''
    },
    
    "float": {
        "name": "Float",
        "description": "Gentle floating motion",
        "animate": {"y": [0, -10, 0]},
        "transition": {"duration": 3, "repeat": "Infinity", "ease": "easeInOut"},
        "code": '''
<motion.div
  animate={{ y: [0, -10, 0] }}
  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
>
  Floating
</motion.div>
'''
    },
    
    "spin": {
        "name": "Spin",
        "description": "Continuous rotation",
        "animate": {"rotate": 360},
        "transition": {"duration": 2, "repeat": "Infinity", "ease": "linear"},
        "code": '''
<motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
>
  🔄
</motion.div>
'''
    },
    
    "shimmer": {
        "name": "Shimmer",
        "description": "Loading shimmer effect",
        "code": '''
// CSS-based shimmer with motion trigger
<motion.div
  className="relative overflow-hidden bg-slate-200 rounded-lg"
  initial={{ opacity: 0.5 }}
  animate={{ opacity: 1 }}
>
  <motion.div
    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
    animate={{ x: ["-100%", "100%"] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
  />
</motion.div>
'''
    },
    
    "gradient_shift": {
        "name": "Gradient Shift",
        "description": "Animated gradient background",
        "code": '''
<motion.div
  className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-[length:200%_200%]"
  animate={{
    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
  }}
  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
>
  Animated Gradient
</motion.div>
'''
    },
}


# ============================================================================
# PAGE TRANSITION ANIMATIONS
# ============================================================================

PAGE_TRANSITIONS: Dict[str, Dict[str, Any]] = {
    "fade": {
        "name": "Fade Transition",
        "description": "Simple fade between pages",
        "initial": {"opacity": 0},
        "animate": {"opacity": 1},
        "exit": {"opacity": 0},
        "transition": {"duration": 0.3},
        "code": '''
// Wrap routes with AnimatePresence
import { AnimatePresence, motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
'''
    },
    
    "slide_up": {
        "name": "Slide Up Transition",
        "description": "Slide up with fade",
        "initial": {"opacity": 0, "y": 20},
        "animate": {"opacity": 1, "y": 0},
        "exit": {"opacity": 0, "y": -20},
        "transition": {"duration": 0.4, "ease": [0.25, 0.1, 0, 1]},
        "code": '''
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const pageTransition = {
  duration: 0.4,
  ease: [0.25, 0.1, 0, 1]
};
'''
    },
    
    "slide_horizontal": {
        "name": "Slide Horizontal",
        "description": "Slide left/right between pages",
        "initial": {"opacity": 0, "x": 100},
        "animate": {"opacity": 1, "x": 0},
        "exit": {"opacity": 0, "x": -100},
        "transition": {"duration": 0.4, "ease": "easeInOut"},
        "code": '''
const pageVariants = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 }
};
'''
    },
}


# ============================================================================
# TAILWIND CSS ANIMATION CLASSES (for when Framer isn't needed)
# ============================================================================

TAILWIND_ANIMATIONS = {
    "blob": '''
/* Add to tailwind.config.js */
animation: {
  blob: "blob 7s infinite",
},
keyframes: {
  blob: {
    "0%": { transform: "translate(0px, 0px) scale(1)" },
    "33%": { transform: "translate(30px, -50px) scale(1.1)" },
    "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
    "100%": { transform: "translate(0px, 0px) scale(1)" },
  },
},

/* Usage */
<div className="animate-blob animation-delay-2000" />
''',
    
    "gradient_x": '''
/* Horizontal gradient animation */
animation: {
  "gradient-x": "gradient-x 3s ease infinite",
},
keyframes: {
  "gradient-x": {
    "0%, 100%": { "background-position": "0% 50%" },
    "50%": { "background-position": "100% 50%" },
  },
},

/* Usage */
<div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-[length:200%_200%] animate-gradient-x" />
''',
    
    "float": '''
animation: {
  float: "float 3s ease-in-out infinite",
},
keyframes: {
  float: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-10px)" },
  },
},
''',
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_entrance_preset(preset_name: str) -> Dict[str, Any]:
    """Get an entrance animation preset"""
    return ENTRANCE_PRESETS.get(preset_name, {})


def get_hover_preset(preset_name: str) -> Dict[str, Any]:
    """Get a hover animation preset"""
    return HOVER_PRESETS.get(preset_name, {})


def get_scroll_preset(preset_name: str) -> Dict[str, Any]:
    """Get a scroll animation preset"""
    return SCROLL_PRESETS.get(preset_name, {})


def get_stagger_preset(preset_name: str) -> Dict[str, Any]:
    """Get a stagger animation preset"""
    return STAGGER_PRESETS.get(preset_name, {})


def get_all_presets() -> Dict[str, Dict[str, Any]]:
    """Get all animation presets organized by category"""
    return {
        "entrance": ENTRANCE_PRESETS,
        "scroll": SCROLL_PRESETS,
        "stagger": STAGGER_PRESETS,
        "hover": HOVER_PRESETS,
        "tap": TAP_PRESETS,
        "loop": LOOP_PRESETS,
        "page_transitions": PAGE_TRANSITIONS,
    }


def generate_animation_imports() -> str:
    """Generate standard Framer Motion imports"""
    return '''import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion';'''


def suggest_animations_for_component(component_type: str) -> List[str]:
    """Suggest appropriate animations for a component type"""
    suggestions = {
        "hero": ["fade_up", "scale_in", "stagger_children"],
        "card": ["hover_lift", "scroll_fade_up", "tap_scale"],
        "button": ["button_complete", "hover_scale", "tap_bounce"],
        "list": ["stagger_children", "stagger_scale"],
        "modal": ["scale_bounce", "fade"],
        "navbar": ["fade_down"],
        "section": ["scroll_fade_up", "scroll_scale"],
        "image": ["blur_in", "scale_in"],
        "text": ["fade_up", "fade_in"],
        "icon": ["hover_rotate", "pulse", "float"],
        "loading": ["shimmer", "spin", "pulse"],
    }
    return suggestions.get(component_type.lower(), ["fade_up", "hover_scale"])


# Export all
__all__ = [
    'AnimationType',
    'AnimationPreset',
    'ENTRANCE_PRESETS',
    'SCROLL_PRESETS',
    'STAGGER_PRESETS',
    'HOVER_PRESETS',
    'TAP_PRESETS',
    'LOOP_PRESETS',
    'PAGE_TRANSITIONS',
    'TAILWIND_ANIMATIONS',
    'get_entrance_preset',
    'get_hover_preset',
    'get_scroll_preset',
    'get_stagger_preset',
    'get_all_presets',
    'generate_animation_imports',
    'suggest_animations_for_component',
]
