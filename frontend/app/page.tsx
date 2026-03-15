'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play, Music, Sparkles, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import axios from 'axios'

export default function LandingPage() {
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
    <main className="min-h-screen bg-beatscout-bg text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-beatscout-mint/5 via-transparent to-beatscout-blue/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-beatscout-mint/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-beatscout-blue/10 rounded-full blur-3xl animate-pulse delay-1000" />
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
        
        <div className="flex items-center gap-4">
          <Link 
            href="/plans"
            className="px-5 py-2 text-beatscout-text-secondary hover:text-white border border-beatscout-border rounded-full hover:border-beatscout-mint transition-colors"
          >
            Get a Plan
          </Link>
          <a 
            href="/api/auth/soundcloud/login"
            className="px-6 py-2.5 bg-beatscout-mint text-beatscout-bg font-semibold rounded-full hover:bg-beatscout-mint-dark transition-colors"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center px-4 pt-12 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-beatscout-border/50 border border-beatscout-border"
          >
            <Sparkles className="w-4 h-4 text-beatscout-mint" />
            <span className="text-sm text-beatscout-text-secondary">SoundCloud Integration</span>
          </motion.div>

          {/* Main Heading */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-white via-beatscout-mint to-white bg-clip-text text-transparent">
              BeatScout
            </span>
          </h1>

          <p className="text-2xl md:text-3xl text-beatscout-text-secondary mb-6 font-light">
            Discover Edits Like Never Before
          </p>

          <p className="text-lg text-beatscout-text-secondary/80 max-w-2xl mx-auto mb-4">
            Discover unique edits, remixes, and bootlegs through intelligent audio analysis. 
            Navigate a galaxy of tracks in immersive 3D space.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href="/explorer"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-beatscout-mint text-beatscout-bg font-semibold rounded-full hover:bg-beatscout-mint-dark transition-all hover:scale-105"
            >
              Enter the Explorer
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-8 py-4 border border-beatscout-border rounded-full hover:border-beatscout-mint hover:text-beatscout-mint transition-colors"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </a>
          </div>

          {/* Sign Up Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="max-w-md mx-auto"
          >
            {submitted ? (
              <div className="px-6 py-4 bg-beatscout-mint/20 border border-beatscout-mint rounded-full">
                <p className="text-beatscout-mint font-medium">You&apos;re on the list! We&apos;ll notify you when we launch.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-5 py-3 bg-beatscout-panel border border-beatscout-border rounded-full text-white placeholder-beatscout-text-secondary focus:outline-none focus:border-beatscout-mint"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-beatscout-mint text-beatscout-bg font-semibold rounded-full hover:bg-beatscout-mint-dark transition-colors whitespace-nowrap"
                  >
                    Notify Me
                  </button>
                </div>
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}
              </form>
            )}
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-12 grid grid-cols-3 gap-12 text-center"
        >
          <div>
            <div className="text-4xl font-bold text-white">10M+</div>
            <div className="text-beatscout-text-secondary mt-2">Tracks Analyzed</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white">50K+</div>
            <div className="text-beatscout-text-secondary mt-2">Active DJs</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-beatscout-mint">99.9%</div>
            <div className="text-beatscout-text-secondary mt-2">Uptime</div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-4 py-16 bg-beatscout-panel/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why <span className="text-beatscout-mint">BeatScout</span>?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Music,
                title: "3D Track Explorer",
                description: "Navigate edits in immersive 3D space. Filter by tempo, energy, and temperament."
              },
              {
                icon: Sparkles,
                title: "Intelligent Analysis",
                description: "Proprietary audio analysis extracts production quality, danceability, and vibe."
              },
              {
                icon: Play,
                title: "Direct Preview",
                description: "Stream tracks directly from SoundCloud with seamless integration."
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                className="p-8 rounded-2xl bg-beatscout-bg border border-beatscout-border hover:border-beatscout-mint/50 transition-colors"
              >
                <feature.icon className="w-10 h-10 text-beatscout-mint mb-4" />
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-beatscout-text-secondary">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-sm text-beatscout-text-secondary/60">
        <div className="max-w-6xl mx-auto px-4">
          <span>BeatScout - Edit Discovery</span>
        </div>
      </footer>
    </main>
  )
}