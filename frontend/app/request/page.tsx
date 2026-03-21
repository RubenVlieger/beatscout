'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function RequestTrackPage() {
  const [trackName, setTrackName] = useState('')
  const [artist, setArtist] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // TODO: Call API
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
    alert('Analysis request submitted!')
  }

  return (
    <div className="flex min-h-screen bg-beatscout-bg">
      <Sidebar isLoggedIn={false} />
      
      <main className="flex-1 ml-20 p-8">
        <h1 className="text-3xl font-bold mb-8">Request New Track</h1>
        
        <div className="max-w-2xl bg-beatscout-panel border border-beatscout-border rounded-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-beatscout-text-secondary mb-2">
                Track Name
              </label>
              <input
                type="text"
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                className="w-full px-4 py-3 bg-beatscout-bg border border-beatscout-border rounded-sm text-white focus:outline-none focus:border-beatscout-mint"
                placeholder="e.g., It Goes Like Nanana"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-beatscout-text-secondary mb-2">
                Artist (Optional)
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-4 py-3 bg-beatscout-bg border border-beatscout-border rounded-sm text-white focus:outline-none focus:border-beatscout-mint"
                placeholder="e.g., Peggy Gou"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-beatscout-mint text-beatscout-bg font-semibold rounded-sm hover:bg-beatscout-mint-dark transition-colors disabled:opacity-50 uppercase tracking-wide"
            >
              {loading ? 'Submitting...' : 'Start Analysis'}
            </button>
          </form>
          
          <div className="mt-8 p-4 bg-beatscout-bg rounded-sm text-sm text-beatscout-text-secondary border border-beatscout-border">
            <p className="mb-2 uppercase tracking-wide text-xs">What happens next?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>We search SoundCloud for edits and remixes</li>
              <li>AI analyzes each track for quality and vibe</li>
              <li>Results appear in your Explorer within minutes</li>
              <li>Pro users get priority processing</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
