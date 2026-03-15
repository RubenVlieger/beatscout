'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Check, Mail } from 'lucide-react'
import { useState } from 'react'
import axios from 'axios'

export default function PlansPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    
    try {
      const response = await axios.post('/api/waitlist/waitlist', { email })
      setSubmitted(true)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-beatscout-bg text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-beatscout-mint/5 via-transparent to-beatscout-blue/10" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-beatscout-mint/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-beatscout-blue/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1 h-6 bg-beatscout-mint rounded-full" />
            <div className="w-1 h-4 bg-beatscout-mint rounded-full" />
            <div className="w-1 h-8 bg-beatscout-mint rounded-full" />
          </div>
          <span className="text-2xl font-bold">BeatScout</span>
        </Link>
        
        <Link 
          href="/"
          className="text-beatscout-text-secondary hover:text-white transition-colors"
        >
          Back to Home
        </Link>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl w-full mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-beatscout-mint/10 border border-beatscout-mint/30"
          >
            <Sparkles className="w-4 h-4 text-beatscout-mint" />
            <span className="text-sm text-beatscout-mint">Coming Soon</span>
          </motion.div>

          {/* Heading */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Unlock the Full
            <span className="text-beatscout-mint"> BeatScout</span> Experience
          </h1>

          <p className="text-xl text-beatscout-text-secondary mb-12 max-w-xl mx-auto">
            Get early access to analyze unlimited tracks, save custom crates, and discover hidden edits before anyone else.
          </p>

          {/* Email Signup Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="max-w-md mx-auto"
          >
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 bg-beatscout-mint/10 border border-beatscout-mint/30 rounded-2xl"
              >
                <div className="w-16 h-16 bg-beatscout-mint/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-beatscout-mint" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">You&apos;re on the list!</h3>
                <p className="text-beatscout-text-secondary">
                  We&apos;ll notify you as soon as we launch. Keep an eye on your inbox.
                </p>
              </motion.div>
            ) : (
              <div className="bg-beatscout-panel border border-beatscout-border rounded-2xl p-8">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Mail className="w-5 h-5 text-beatscout-mint" />
                  <span className="text-lg font-semibold">Join the Waitlist</span>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-5 py-4 bg-beatscout-bg border border-beatscout-border rounded-xl text-white placeholder-beatscout-text-secondary focus:outline-none focus:border-beatscout-mint transition-colors"
                    />
                  </div>
                  
                  {error && (
                    <p className="text-red-400 text-sm">{error}</p>
                  )}
                  
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-beatscout-mint text-beatscout-bg font-semibold rounded-xl hover:bg-beatscout-mint-dark transition-colors"
                  >
                    Notify Me
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </form>

                <p className="text-sm text-beatscout-text-secondary mt-4">
                  No spam. Unsubscribe anytime.
                </p>
              </div>
            )}
          </motion.div>

          {/* Features Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-16 grid grid-cols-3 gap-8 text-center"
          >
            <div>
              <div className="text-3xl font-bold text-beatscout-mint mb-2">∞</div>
              <div className="text-beatscout-text-secondary">Unlimited Tracks</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-beatscout-mint mb-2">3D</div>
              <div className="text-beatscout-text-secondary">Visual Explorer</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-beatscout-mint mb-2">⚡</div>
              <div className="text-beatscout-text-secondary">Priority Analysis</div>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-sm text-beatscout-text-secondary/60">
        <div className="max-w-6xl mx-auto px-4">
          <span>BeatScout - Edit Discovery</span>
        </div>
      </footer>
    </div>
  )
}