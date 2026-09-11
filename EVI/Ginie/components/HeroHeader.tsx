"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { CreditCard, FolderKanban, LogOut, Menu, User, X, MessageSquare } from 'lucide-react'

import { useAuth } from '@/components/auth/AuthProvider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false)
    const [isScrolled, setIsScrolled] = React.useState(false)
    const { user, isAuthenticated, signOut, mounted } = useAuth()
    const pathname = usePathname() || '/'

    const getInitials = (name: string) => {
        if (!name) return 'U'
        const parts = name.trim().split(' ')
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
        return name.slice(0, 2).toUpperCase()
    }

    const displayName = user?.display_name || user?.name || user?.email?.split('@')[0] || 'User'

    const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

    // Get avatar URL from profile.avatar_url (where backend stores it)
    const rawAvatarUrl = user?.profile?.avatar_url || user?.avatar || user?.picture || '';

    // Use proxy for relative URLs (handles cookies/auth), direct for absolute URLs
    const avatarUrl = React.useMemo(() => {
        if (!rawAvatarUrl) return '';

        // If already a data URL, use directly
        if (rawAvatarUrl.startsWith('data:')) return rawAvatarUrl;

        // If already absolute URL, use as-is
        if (/^https?:\/\//i.test(rawAvatarUrl)) return rawAvatarUrl;

        // For relative URLs like /u/user/avatar/{id}, use proxy (handles auth correctly)
        const path = rawAvatarUrl.startsWith('/') ? rawAvatarUrl : `/${rawAvatarUrl}`;
        return `/api/proxy${path}`;
    }, [rawAvatarUrl]);

    const handleAvatarError = React.useCallback(() => {
        console.log('[Header Avatar] Load failed for:', avatarUrl);
        setAvatarLoadFailed(true);
    }, [avatarUrl]);

    // Reset avatar load failed state when avatar URL changes
    React.useEffect(() => {
        setAvatarLoadFailed(false);
    }, [rawAvatarUrl]);

    React.useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    React.useEffect(() => {
        setMenuState(false)
    }, [pathname])

    return (
        <header>
            <nav className="fixed top-8 z-40 w-full px-2">
                <div
                    className={cn(
                        'mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12',
                        isScrolled &&
                            'bg-white/8 dark:bg-black/20 max-w-5xl rounded-2xl backdrop-blur-md lg:px-5'
                    )}
                >
                    <div className="relative flex items-center justify-between gap-4 py-2">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <Link
                                href="/"
                                aria-label="home"
                                className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-white/6 transition-colors duration-200"
                            >
                                <span className="font-playfair italic font-light text-xl sm:text-3xl md:text-4xl lg:text-4xl gradient-text">
                                    Ginie.
                                </span>
                            </Link>
                        </div>

                        {/* Right side: auth */}
                        <div className="flex items-center gap-2">
                            {/* Desktop auth buttons - only render after mount to prevent hydration mismatch */}
                            <div className="hidden lg:flex items-center gap-2">
                                {!mounted ? (
                                    // Placeholder during SSR/hydration
                                    <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                                ) : isAuthenticated ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/10 transition-colors duration-200 cursor-pointer outline-none">
                                                <Avatar className="h-8 w-8">
                                                    {avatarUrl && !avatarLoadFailed && (
                                                        <AvatarImage
                                                            src={avatarUrl}
                                                            alt={displayName}
                                                            onError={handleAvatarError}
                                                        />
                                                    )}
                                                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-medium">
                                                        {getInitials(displayName)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 profile-popover">
                                            <DropdownMenuLabel className="font-normal">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-sm font-medium leading-none">
                                                        {displayName}
                                                    </p>
                                                    <p className="text-xs leading-none text-muted-foreground">
                                                        {user?.email}
                                                    </p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/profile" className="flex items-center">
                                                    <User className="mr-2 h-4 w-4" />
                                                    <span>Profile</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/subscription" className="flex items-center">
                                                    <CreditCard className="mr-2 h-4 w-4" />
                                                    <span>Subscription</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/projects" className="flex items-center">
                                                    <FolderKanban className="mr-2 h-4 w-4" />
                                                    <span>My Projects</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/chat" className="flex items-center">
                                                    <MessageSquare className="mr-2 h-4 w-4" />
                                                    <span>Chat</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => signOut()}
                                                className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                <span>Logout</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <>
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="border-white/20 bg-transparent hover:bg-white/10 whitespace-nowrap"
                                        >
                                            <Link href="/signin">Sign In</Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="sm"
                                            className="bg-white text-black hover:bg-slate-100 force-black whitespace-nowrap"
                                        >
                                            <Link href="/signup">Sign Up</Link>
                                        </Button>
                                    </>
                                )}
                            </div>

                            {/* Mobile: no nav links; only hamburger wrapping auth buttons (unauthenticated) */}
                            <div className="flex lg:hidden items-center gap-2">
                                {!mounted ? (
                                    <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                                ) : isAuthenticated ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/10 transition-colors duration-200 cursor-pointer outline-none">
                                                <Avatar className="h-8 w-8">
                                                    {avatarUrl && !avatarLoadFailed && (
                                                        <AvatarImage
                                                            src={avatarUrl}
                                                            alt={displayName}
                                                            onError={handleAvatarError}
                                                        />
                                                    )}
                                                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-medium">
                                                        {getInitials(displayName)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 profile-popover">
                                            <DropdownMenuLabel className="font-normal">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-sm font-medium leading-none">
                                                        {displayName}
                                                    </p>
                                                    <p className="text-xs leading-none text-muted-foreground">
                                                        {user?.email}
                                                    </p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/profile" className="flex items-center">
                                                    <User className="mr-2 h-4 w-4" />
                                                    <span>Profile</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/subscription" className="flex items-center">
                                                    <CreditCard className="mr-2 h-4 w-4" />
                                                    <span>Subscription</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/projects" className="flex items-center">
                                                        <FolderKanban className="mr-2 h-4 w-4" />
                                                        <span>My Projects</span>
                                                </Link>
                                            </DropdownMenuItem>
                                                <DropdownMenuItem asChild className="cursor-pointer">
                                                    <Link href="/chat" className="flex items-center">
                                                        <MessageSquare className="mr-2 h-4 w-4" />
                                                        <span>Chat</span>
                                                    </Link>
                                                </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => signOut()}
                                                className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                <span>Logout</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setMenuState((v) => !v)}
                                            aria-label={menuState ? 'Close menu' : 'Open menu'}
                                            aria-expanded={menuState}
                                            className="relative z-50 rounded-full p-2 hover:bg-white/10 transition-colors"
                                        >
                                            {menuState ? (
                                                <X className="h-6 w-6" />
                                            ) : (
                                                <Menu className="h-6 w-6" />
                                            )}
                                        </button>

                                        {menuState && (
                                            <div className="absolute right-0 top-12 w-56 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-3 shadow-xl">
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        className="border-white/20 bg-transparent hover:bg-white/10 w-full"
                                                        onClick={() => setMenuState(false)}
                                                    >
                                                        <Link href="/signin">Sign In</Link>
                                                    </Button>
                                                    <Button
                                                        asChild
                                                        className="bg-white text-black hover:bg-slate-100 force-black w-full"
                                                        onClick={() => setMenuState(false)}
                                                    >
                                                        <Link href="/signup">Sign Up</Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}

export default HeroHeader
