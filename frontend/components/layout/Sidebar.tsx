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
      <aside className="w-20 bg-beatscout-panel border-r border-beatscout-border flex flex-col h-screen fixed left-0 top-0">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-beatscout-mint border-t-transparent rounded-sm animate-spin" />
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-20 bg-beatscout-panel border-r border-beatscout-border flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-4 border-b border-beatscout-border flex justify-center">
        <Link href="/" className="flex items-center gap-1" title="BeatScout">
          <div className="w-1 h-5 bg-beatscout-mint rounded-sm" />
          <div className="w-1 h-3 bg-beatscout-mint rounded-sm" />
          <div className="w-1 h-6 bg-beatscout-mint rounded-sm" />
        </Link>
      </div>

      {/* New Song Button */}
      <div className="p-3">
        <Link
          href="/request"
          onClick={handleNewSongClick}
          className={`flex items-center justify-center w-10 h-10 rounded-sm transition-colors group relative ${
            isLoggedIn
              ? 'bg-beatscout-mint text-beatscout-bg hover:bg-beatscout-mint-dark'
              : 'bg-beatscout-mint/20 text-beatscout-mint border border-beatscout-mint cursor-pointer'
          }`}
          title={isLoggedIn ? "New Song" : "Login required"}
        >
          <PlusCircle className="w-5 h-5" />
          {/* Tooltip */}
          <span className="absolute left-full ml-3 px-2 py-1 bg-beatscout-bg border border-beatscout-border text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 rounded-sm">
            {isLoggedIn ? "New Song" : "Login required"}
          </span>
        </Link>
        
        {showLockedMessage && (
          <div className="mt-2 p-2 bg-beatscout-bg border border-beatscout-border rounded-sm text-xs">
            <p className="text-beatscout-text-secondary">
              <Lock className="w-3 h-3 inline mr-1" />
              Login required
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
      <nav className="flex-1 py-2 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center justify-center w-10 h-10 rounded-sm text-beatscout-text-secondary hover:text-white hover:bg-beatscout-border hover:border-l-2 hover:border-l-beatscout-mint transition-all group relative"
              title={item.name}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-beatscout-bg border border-beatscout-border text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 rounded-sm">
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      {isLoggedIn && user ? (
        <div className="p-3 border-t border-beatscout-border space-y-2">
          <div className="flex flex-col items-center gap-2">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.username}
                className="w-10 h-10 rounded-sm object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-sm bg-beatscout-mint flex items-center justify-center">
                <span className="text-beatscout-bg font-bold text-sm">
                  {getInitials(user.username)}
                </span>
              </div>
            )}
            <button 
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center text-beatscout-text-secondary hover:text-white transition-colors rounded-sm hover:bg-beatscout-border group relative"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-beatscout-bg border border-beatscout-border text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 rounded-sm">
                Sign out
              </span>
            </button>
          </div>
          
          {!user.soundcloud_connected && (
            <button
              onClick={() => authApi.loginWithSoundCloud()}
              className="flex items-center justify-center w-8 h-8 text-beatscout-mint hover:text-beatscout-mint-dark transition-colors rounded-sm hover:bg-beatscout-border group relative mx-auto"
              title="Link SoundCloud"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.269-2.154c-.009-.06-.052-.1-.085-.1z" />
              </svg>
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-beatscout-bg border border-beatscout-border text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 rounded-sm">
                Link SoundCloud
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="p-3 border-t border-beatscout-border space-y-2">
          <Link
            href="/auth/login"
            className="flex items-center justify-center w-10 h-10 rounded-sm bg-beatscout-mint text-beatscout-bg font-semibold hover:bg-beatscout-mint-dark transition-colors group relative mx-auto"
            title="Sign In"
          >
            <User className="w-5 h-5" />
            {/* Tooltip */}
            <span className="absolute left-full ml-3 px-2 py-1 bg-beatscout-bg border border-beatscout-border text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 rounded-sm">
              Sign In
            </span>
          </Link>
          <Link
            href="/plans"
            className="flex items-center justify-center w-10 h-10 rounded-sm border border-beatscout-border text-beatscout-text-secondary hover:border-beatscout-mint hover:text-beatscout-mint transition-colors group relative mx-auto"
            title="Get a Plan"
          >
            <Sparkles className="w-5 h-5" />
            {/* Tooltip */}
            <span className="absolute left-full ml-3 px-2 py-1 bg-beatscout-bg border border-beatscout-border text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 rounded-sm">
              Get a Plan
            </span>
          </Link>
        </div>
      )}
    </aside>
  )
}
