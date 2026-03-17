'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  PlusCircle, 
  Library, 
  Star, 
  BarChart3, 
  Settings,
  LogOut,
  Sparkles,
  Lock,
  User
} from 'lucide-react'
import { authApi } from '@/lib/api'

interface UserData {
  id: string
  email: string | null
  username: string
  avatar_url: string | null
  auth_provider: string
  soundcloud_connected: boolean
  stripe_customer_id: string | null
}

interface SidebarProps {
  isLoggedIn?: boolean
}

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Request New Track', href: '/request', icon: PlusCircle },
  { name: 'My Crate', href: '/crate', icon: Library },
  { name: 'Recommended', href: '/recommended', icon: Star },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar({ isLoggedIn: initialLoggedIn = false }: SidebarProps) {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn)
  const [user, setUser] = useState<UserData | null>(null)
  const [showLockedMessage, setShowLockedMessage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const response = await authApi.getMe()
          setUser(response.data)
          setIsLoggedIn(true)
        } catch (error) {
          // Token invalid or expired
          localStorage.removeItem('token')
          setIsLoggedIn(false)
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const handleNewSongClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      setShowLockedMessage(true)
      setTimeout(() => setShowLockedMessage(false), 3000)
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('token')
    setIsLoggedIn(false)
    setUser(null)
    router.push('/')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (isLoading) {
    return (
      <aside className="w-64 bg-beatscout-panel border-r border-beatscout-border flex flex-col h-screen fixed left-0 top-0">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-beatscout-mint border-t-transparent rounded-full animate-spin" />
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-beatscout-panel border-r border-beatscout-border flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-beatscout-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1 h-6 bg-beatscout-mint rounded-full" />
            <div className="w-1 h-4 bg-beatscout-mint rounded-full" />
            <div className="w-1 h-8 bg-beatscout-mint rounded-full" />
          </div>
          <span className="text-xl font-bold text-white">BeatScout</span>
        </Link>
      </div>

      {/* New Song Button */}
      <div className="p-4">
        <Link
          href="/request"
          onClick={handleNewSongClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
            isLoggedIn
              ? 'bg-beatscout-mint text-beatscout-bg hover:bg-beatscout-mint-dark'
              : 'bg-beatscout-mint/20 text-beatscout-mint border border-beatscout-mint cursor-pointer'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span>New Song</span>
          {!isLoggedIn && <Lock className="w-4 h-4 ml-auto" />}
        </Link>
        
        {showLockedMessage && (
          <div className="mt-2 p-3 bg-beatscout-bg border border-beatscout-border rounded-lg text-sm">
            <p className="text-beatscout-text-secondary">
              <Lock className="w-4 h-4 inline mr-1" />
              Login or upgrade to analyze new songs
            </p>
            <Link 
              href="/auth/login" 
              className="text-beatscout-mint hover:underline mt-1 block"
            >
              Sign In →
            </Link>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-beatscout-text-secondary hover:bg-beatscout-border hover:text-white transition-colors"
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      {isLoggedIn && user ? (
        <div className="p-4 border-t border-beatscout-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-beatscout-border/50">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-beatscout-mint to-beatscout-blue flex items-center justify-center">
                <span className="text-beatscout-bg font-bold text-sm">
                  {getInitials(user.username)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
              <p className="text-xs text-beatscout-text-secondary truncate">
                {user.email || user.auth_provider}
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-beatscout-text-secondary hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          
          {!user.soundcloud_connected && (
            <Link
              href="/settings"
              className="mt-2 flex items-center gap-2 px-4 py-2 text-xs text-beatscout-mint hover:text-beatscout-mint-dark transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.269-2.154c-.009-.06-.052-.1-.085-.1z" />
              </svg>
              Link SoundCloud for API access
            </Link>
          )}
        </div>
      ) : (
        <div className="p-4 border-t border-beatscout-border space-y-2">
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-beatscout-mint text-beatscout-bg font-semibold hover:bg-beatscout-mint-dark transition-colors"
          >
            <User className="w-4 h-4" />
            Sign In
          </Link>
          <Link
            href="/plans"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-beatscout-border text-beatscout-text-secondary hover:border-beatscout-mint hover:text-beatscout-mint transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Get a Plan
          </Link>
        </div>
      )}
    </aside>
  )
}
