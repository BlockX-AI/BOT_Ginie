"""
Modern Component Registry
==========================
Pre-built, production-ready UI components following shadcn/ui patterns.
These components are used by AI builders to rapidly assemble premium interfaces.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class ComponentCategory(Enum):
    """Categories of UI components"""
    LAYOUT = "layout"
    NAVIGATION = "navigation"
    DATA_DISPLAY = "data_display"
    DATA_INPUT = "data_input"
    FEEDBACK = "feedback"
    OVERLAY = "overlay"
    TYPOGRAPHY = "typography"
    MEDIA = "media"


@dataclass
class ComponentSpec:
    """Specification for a UI component"""
    name: str
    category: ComponentCategory
    description: str
    dependencies: List[str]
    props: Dict[str, Any]
    code: str
    variants: List[str] = field(default_factory=list)
    accessibility: Dict[str, str] = field(default_factory=dict)


# ============================================================================
# BUTTON COMPONENTS
# ============================================================================

BUTTON_COMPONENT = '''
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const buttonVariants = {
  primary: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90',
  secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700',
  outline: 'border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800',
  ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  link: 'text-purple-600 underline-offset-4 hover:underline',
};

const buttonSizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
};

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  disabled = false,
  className = '',
  ...props 
}, ref) => {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-purple-500 focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        ${buttonVariants[variant]}
        ${buttonSizes[size]}
        ${className}
      `}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </motion.button>
  );
});

Button.displayName = 'Button';

export default Button;
'''

# ============================================================================
# CARD COMPONENTS
# ============================================================================

CARD_COMPONENT = '''
import { motion } from 'framer-motion';

const Card = ({ children, className = '', hover = true, ...props }) => {
  return (
    <motion.div
      whileHover={hover ? { y: -5, boxShadow: "0 20px 40px -15px rgba(0,0,0,0.1)" } : {}}
      transition={{ duration: 0.2 }}
      className={`
        bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700
        shadow-sm overflow-hidden
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
};

const CardHeader = ({ children, className = '' }) => (
  <div className={`p-6 pb-0 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-xl font-semibold text-slate-900 dark:text-white ${className}`}>
    {children}
  </h3>
);

const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-slate-600 dark:text-slate-400 mt-1 ${className}`}>
    {children}
  </p>
);

const CardContent = ({ children, className = '' }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const CardFooter = ({ children, className = '' }) => (
  <div className={`p-6 pt-0 flex items-center gap-2 ${className}`}>{children}</div>
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;
'''

# ============================================================================
# INPUT COMPONENTS
# ============================================================================

INPUT_COMPONENT = '''
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = forwardRef(({ 
  label,
  error,
  type = 'text',
  className = '',
  ...props 
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          type={isPassword && showPassword ? 'text' : type}
          className={`
            w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 
            border border-slate-200 dark:border-slate-700
            text-slate-900 dark:text-white placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
            transition-all duration-200
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${isPassword ? 'pr-12' : ''}
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
'''

# ============================================================================
# BADGE COMPONENT
# ============================================================================

BADGE_COMPONENT = '''
const badgeVariants = {
  default: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white',
  primary: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  outline: 'border border-slate-200 dark:border-slate-700',
};

const Badge = ({ children, variant = 'default', className = '' }) => {
  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      ${badgeVariants[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
};

export default Badge;
'''

# ============================================================================
# AVATAR COMPONENT
# ============================================================================

AVATAR_COMPONENT = '''
import { useState } from 'react';

const Avatar = ({ 
  src, 
  alt = '', 
  fallback,
  size = 'md',
  className = '' 
}) => {
  const [error, setError] = useState(false);
  
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const initials = fallback || alt?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`
      relative rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500
      flex items-center justify-center font-medium text-white
      ${sizes[size]}
      ${className}
    `}>
      {src && !error ? (
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export default Avatar;
'''

# ============================================================================
# MODAL/DIALOG COMPONENT
# ============================================================================

MODAL_COMPONENT = '''
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const Modal = ({ 
  isOpen, 
  onClose, 
  children, 
  title,
  size = 'md',
  className = '' 
}) => {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`
              relative w-full ${sizes[size]} bg-white dark:bg-slate-900 
              rounded-2xl shadow-2xl overflow-hidden
              ${className}
            `}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            )}
            
            {/* Content */}
            <div className="p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
'''

# ============================================================================
# TOAST/NOTIFICATION COMPONENT
# ============================================================================

TOAST_COMPONENT = '''
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
};

const Toast = ({ 
  message, 
  type = 'info', 
  duration = 5000, 
  onClose,
  action 
}) => {
  const Icon = icons[type];
  
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg
        ${colors[type]}
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      {action && (
        <button 
          onClick={action.onClick}
          className="text-sm font-semibold hover:underline"
        >
          {action.label}
        </button>
      )}
      <button onClick={onClose} className="p-1 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// Toast container for stacking
const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export { Toast, ToastContainer };
export default Toast;
'''

# ============================================================================
# SKELETON LOADER COMPONENT
# ============================================================================

SKELETON_COMPONENT = '''
import { motion } from 'framer-motion';

const Skeleton = ({ className = '', variant = 'rectangular' }) => {
  const variants = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  return (
    <div className={`relative overflow-hidden bg-slate-200 dark:bg-slate-700 ${variants[variant]} ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
};

// Pre-built skeleton patterns
const SkeletonCard = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-48 w-full" />
    <Skeleton variant="text" className="w-3/4" />
    <Skeleton variant="text" className="w-1/2" />
    <div className="flex gap-2">
      <Skeleton variant="circular" className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="text" className="w-1/4" />
      </div>
    </div>
  </div>
);

const SkeletonList = ({ count = 3 }) => (
  <div className="space-y-4">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton variant="circular" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/2" />
          <Skeleton variant="text" className="w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

export { Skeleton, SkeletonCard, SkeletonList };
export default Skeleton;
'''

# ============================================================================
# TABS COMPONENT
# ============================================================================

TABS_COMPONENT = '''
import { useState } from 'react';
import { motion } from 'framer-motion';

const Tabs = ({ tabs, defaultTab = 0, onChange, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (index) => {
    setActiveTab(index);
    onChange?.(index);
  };

  return (
    <div className={className}>
      {/* Tab List */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            onClick={() => handleTabChange(index)}
            className={`
              relative flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeTab === index 
                ? 'text-slate-900 dark:text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}
            `}
          >
            {activeTab === index && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
            </span>
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-4"
      >
        {tabs[activeTab]?.content}
      </motion.div>
    </div>
  );
};

export default Tabs;
'''

# ============================================================================
# DROPDOWN/SELECT COMPONENT
# ============================================================================

DROPDOWN_COMPONENT = '''
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

const Dropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Select...', 
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  
  const selected = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between px-4 py-3 rounded-xl
          bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700
          text-left transition-all duration-200
          ${isOpen ? 'ring-2 ring-purple-500 border-transparent' : ''}
        `}
      >
        <span className={selected ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2 text-left
                  hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                  ${value === option.value ? 'text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'}
                `}
              >
                <span>{option.label}</span>
                {value === option.value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;
'''

# ============================================================================
# PROGRESS BAR COMPONENT
# ============================================================================

PROGRESS_COMPONENT = '''
import { motion } from 'framer-motion';

const Progress = ({ 
  value = 0, 
  max = 100, 
  showLabel = false,
  size = 'md',
  variant = 'default',
  className = '' 
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  const variants = {
    default: 'bg-purple-600',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    gradient: 'bg-gradient-to-r from-purple-500 to-pink-500',
  };

  return (
    <div className={className}>
      <div className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${sizes[size]}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${variants[variant]}`}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-sm text-slate-600 dark:text-slate-400">
          <span>{value} / {max}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  );
};

export default Progress;
'''

# ============================================================================
# COMPONENT REGISTRY
# ============================================================================

COMPONENT_REGISTRY: Dict[str, Dict[str, Any]] = {
    "Button": {
        "category": ComponentCategory.DATA_INPUT,
        "description": "Versatile button with multiple variants and loading state",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": BUTTON_COMPONENT,
        "variants": ["primary", "secondary", "outline", "ghost", "destructive", "link"],
        "sizes": ["sm", "md", "lg", "icon"],
    },
    "Card": {
        "category": ComponentCategory.DATA_DISPLAY,
        "description": "Container card with header, content, and footer sections",
        "dependencies": ["framer-motion"],
        "code": CARD_COMPONENT,
    },
    "Input": {
        "category": ComponentCategory.DATA_INPUT,
        "description": "Text input with label, error state, and password toggle",
        "dependencies": ["lucide-react"],
        "code": INPUT_COMPONENT,
    },
    "Badge": {
        "category": ComponentCategory.DATA_DISPLAY,
        "description": "Small status indicator",
        "dependencies": [],
        "code": BADGE_COMPONENT,
        "variants": ["default", "primary", "success", "warning", "error", "outline"],
    },
    "Avatar": {
        "category": ComponentCategory.DATA_DISPLAY,
        "description": "User avatar with fallback initials",
        "dependencies": [],
        "code": AVATAR_COMPONENT,
        "sizes": ["sm", "md", "lg", "xl"],
    },
    "Modal": {
        "category": ComponentCategory.OVERLAY,
        "description": "Animated modal dialog",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": MODAL_COMPONENT,
        "sizes": ["sm", "md", "lg", "xl", "full"],
    },
    "Toast": {
        "category": ComponentCategory.FEEDBACK,
        "description": "Toast notification system",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": TOAST_COMPONENT,
        "variants": ["success", "error", "warning", "info"],
    },
    "Skeleton": {
        "category": ComponentCategory.FEEDBACK,
        "description": "Loading skeleton placeholder",
        "dependencies": ["framer-motion"],
        "code": SKELETON_COMPONENT,
        "variants": ["rectangular", "circular", "text"],
    },
    "Tabs": {
        "category": ComponentCategory.NAVIGATION,
        "description": "Animated tab navigation",
        "dependencies": ["framer-motion"],
        "code": TABS_COMPONENT,
    },
    "Dropdown": {
        "category": ComponentCategory.DATA_INPUT,
        "description": "Select dropdown with search",
        "dependencies": ["framer-motion", "lucide-react"],
        "code": DROPDOWN_COMPONENT,
    },
    "Progress": {
        "category": ComponentCategory.FEEDBACK,
        "description": "Animated progress bar",
        "dependencies": ["framer-motion"],
        "code": PROGRESS_COMPONENT,
        "variants": ["default", "success", "warning", "error", "gradient"],
    },
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_component(name: str) -> Optional[Dict[str, Any]]:
    """Get a component spec by name"""
    return COMPONENT_REGISTRY.get(name)


def get_component_code(name: str) -> str:
    """Get just the code for a component"""
    component = get_component(name)
    return component.get("code", "") if component else ""


def get_components_by_category(category: ComponentCategory) -> List[str]:
    """Get all component names in a category"""
    return [
        name for name, spec in COMPONENT_REGISTRY.items()
        if spec.get("category") == category
    ]


def get_all_dependencies() -> List[str]:
    """Get all unique dependencies across all components"""
    deps = set()
    for spec in COMPONENT_REGISTRY.values():
        deps.update(spec.get("dependencies", []))
    return list(deps)


def get_component_dependencies(names: List[str]) -> List[str]:
    """Get all dependencies for a list of components"""
    deps = set()
    for name in names:
        component = get_component(name)
        if component:
            deps.update(component.get("dependencies", []))
    return list(deps)


def suggest_components_for_app(app_type: str) -> List[str]:
    """Suggest components based on app type"""
    suggestions = {
        "landing": ["Button", "Card", "Badge", "Modal", "Toast"],
        "dashboard": ["Button", "Card", "Avatar", "Badge", "Tabs", "Progress", "Dropdown", "Skeleton"],
        "ecommerce": ["Button", "Card", "Badge", "Modal", "Toast", "Input", "Dropdown"],
        "blog": ["Card", "Avatar", "Badge", "Skeleton"],
        "portfolio": ["Button", "Card", "Badge", "Modal", "Tabs"],
        "form": ["Button", "Input", "Dropdown", "Toast", "Progress"],
        "social": ["Avatar", "Card", "Button", "Badge", "Modal", "Toast", "Input"],
    }
    return suggestions.get(app_type.lower(), ["Button", "Card", "Input", "Toast"])


# Export all
__all__ = [
    'ComponentCategory',
    'ComponentSpec',
    'COMPONENT_REGISTRY',
    'get_component',
    'get_component_code',
    'get_components_by_category',
    'get_all_dependencies',
    'get_component_dependencies',
    'suggest_components_for_app',
]
