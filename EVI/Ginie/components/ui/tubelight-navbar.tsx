"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Menu, X, DivideIcon as LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: typeof LucideIcon
}

interface NavItemProps {
  item: NavItem
  isActive: boolean
  onClick: () => void
  isMobile: boolean
}

const NavItem = ({ item, isActive, onClick, isMobile }: NavItemProps) => {
  return (
    <Link
      href={item.url}
      onClick={onClick}
      className={cn(
        "relative cursor-pointer font-medium rounded-full transition-all duration-200",
        "flex items-center justify-center",
        isMobile 
          ? "px-5 py-3 text-sm text-foreground/90 hover:bg-muted/50 active:bg-muted/70" 
          : "px-4 sm:px-5 py-2 text-sm sm:text-[0.95rem] text-foreground/80 hover:text-primary hover:bg-muted/30",
        isActive && (isMobile ? "bg-muted/30 text-primary" : "text-primary")
      )}
      style={{
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span className="whitespace-nowrap">{item.name}</span>
      {!isMobile && isActive && (
        <motion.div
          layoutId="lamp"
          className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
          initial={false}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
            <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
            <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
            <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
          </div>
        </motion.div>
      )}
    </Link>
  )
}

interface NavBarProps {
  items: NavItem[]
  className?: string
  brand?: React.ReactNode
  idleHide?: boolean
  idleMs?: number
}

export function NavBar({ items, className, brand, idleHide = true, idleMs = 1200 }: NavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0].name)
  const [isMobile, setIsMobile] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const brandRef = useRef<HTMLDivElement | null>(null)
  const [brandWidth, setBrandWidth] = useState(0)
  const navRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 1024
      setIsMobile(isMobileView)
      if (!isMobileView) {
        setIsMenuOpen(false)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    if (!idleHide) return

    const bump = () => {
      setVisible(true)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setVisible(false), idleMs)
    }

    // show initially then start idle timer
    bump()

    const onScroll = () => bump()
    const onMove = () => bump()
    const onKey = () => bump()

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("mousemove", onMove)
    window.addEventListener("touchmove", onMove, { passive: true })
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("keydown", onKey)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [idleHide, idleMs])

  useEffect(() => {
    const measure = () => {
      if (brandRef.current) {
        const rect = brandRef.current.getBoundingClientRect()
        setBrandWidth(rect.width)
      } else {
        setBrandWidth(0)
      }
    }
    measure()
    const onResize = () => measure()
    window.addEventListener("resize", onResize)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && brandRef.current) {
      ro = new ResizeObserver(() => measure())
      ro.observe(brandRef.current)
    }
    // re-measure after fonts load
    const fontReady = (document as any).fonts?.ready as Promise<any> | undefined
    if (fontReady) {
      fontReady.then(() => measure())
    }
    return () => {
      window.removeEventListener("resize", onResize)
      if (ro && brandRef.current) ro.disconnect()
    }
  }, [brand])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <>
      <motion.div
        ref={navRef}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-auto",
          className,
        )}
        initial={{ y: 0, opacity: 1 }}
        animate={idleHide ? { y: visible ? 0 : -24, opacity: visible ? 1 : 0 } : { y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <div className="w-full max-w-7xl mx-3 sm:mx-4 lg:mx-6 xl:mx-auto">
          {/* Transparent overlapping container */}
          <div className="relative flex items-center justify-between py-2 px-4 sm:py-2.5 rounded-full shadow-none bg-transparent border-0 text-white">
            {/* Brand/Logo - Now part of the flex container */}
            {brand && (
              <div
                ref={brandRef}
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
              >
                {brand}
              </div>
            )}

            {/* Mobile Menu Button - Moved to the right */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 -mr-1 text-foreground/80 hover:text-primary active:bg-muted/30 rounded-full transition-all"
                aria-label="Toggle menu"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center justify-center w-full px-4">
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                {items.map((item) => (
                  <NavItem
                    key={item.name}
                    item={item}
                    isActive={activeTab === item.name}
                    onClick={() => setActiveTab(item.name)}
                    isMobile={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobile && isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
            transition={{ 
              type: "spring",
              damping: 25,
              stiffness: 300,
              mass: 0.5
            }}
            className="fixed top-16 left-4 right-4 z-40 bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-2 overflow-hidden"
          >
            <div className="flex flex-col gap-0.5">
              {items.map((item) => (
                <NavItem
                  key={item.name}
                  item={item}
                  isActive={activeTab === item.name}
                  onClick={() => {
                    setActiveTab(item.name)
                    setIsMenuOpen(false)
                  }}
                  isMobile={true}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}