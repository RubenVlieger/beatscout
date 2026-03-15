'use client'

import Link from 'next/link'
import { useState } from 'react'
import { 
  LayoutDashboard, 
  PlusCircle, 
  Library, 
  Star, 
  BarChart3, 
  Settings,
  LogOut,
  Sparkles,
  Lock
} from 'lucide-react'

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

export default function Sidebar({ isLoggedIn = false }: SidebarProps) {
  const [showLockedMessage, setShowLockedMessage] = useState(false)

  const handleNewSongClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      setShowLockedMessage(true)
      setTimeout(() => setShowLockedMessage(false), 3000)
    }
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
              href="/plans" 
              className="text-beatscout-mint hover:underline mt-1 block"
            >
              Get a Plan →
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
      {isLoggedIn ? (
        <div className="p-4 border-t border-beatscout-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-beatscout-border/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-beatscout-mint to-beatscout-blue flex items-center justify-center">
              <span className="text-beatscout-bg font-bold text-sm">DJ</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">DJ Name</p>
              <p className="text-xs text-beatscout-text-secondary truncate">'Ctrl_Alt_Dance'</p>
            </div>
            <button className="text-beatscout-text-secondary hover:text-white">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-beatscout-border">
          <Link
            href="/plans"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-beatscout-mint text-beatscout-bg font-semibold hover:bg-beatscout-mint-dark transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Get a Plan
          </Link>
        </div>
      )}
    </aside>
  )
}