'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play, Sparkles, ArrowRight } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import axios from 'axios'
import dynamic from 'next/dynamic'
import { CAMERA_INITIAL_POSITION } from '@/components/three/camera-config'

// Dynamic imports for Three.js components
const Canvas = dynamic(
  () => import('@react-three/fiber').then(mod => ({ default: mod.Canvas })),
  { ssr: false }
)

const NeuralScene = dynamic(
  () => import('@/components/three/NeuralScene').then(mod => ({ default: mod.NeuralScene })),
  { ssr: false }
)

// Type for SongData
type SongData = {
  id: string
  title: string
  artist: string
  filename: string
  tempo: number
  danceability: number
  temperament: number
  production_quality: number
  genre: string
  key: string
  url: string
}

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [songs, setSongs] = useState<SongData[]>([])
  const [anchorSongId, setAnchorSongId] = useState<string>('')
  const [bgOpacity, setBgOpacity] = useState(0)
  const [canvasReady, setCanvasReady] = useState(false)
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)

  // Check for screenshot mode (client-side only to avoid hydration mismatch)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isScreenshot = params.has('screenshot')
    setIsScreenshotMode(isScreenshot)
    if (isScreenshot) {
      setBgOpacity(1) // Show immediately in screenshot mode
    }
  }, [])

  // Fetch example data and preload Three.js
  useEffect(() => {
    // Fetch the example data
    const fetchData = async () => {
      try {
        const response = await fetch('/example_data.json')
        const data = await response.json()

        // Transform data to match SongData type
        const transformedSongs: SongData[] = data.songs.map((song: any, index: number) => ({
          id: `song-${index}`,
          title: song.filename.replace(/\.mp3$/i, ''),
          artist: 'Various Artists',
          filename: song.filename,
          tempo: song.tempo || 130, // Use tempo from JSON data
          danceability: song.normalized_scores?.danceability || 50,
          temperament: song.normalized_scores?.temperament || 50,
          production_quality: song.normalized_scores?.production_quality || 50,
          genre: 'House',
          key: 'Am',
          url: song.url || ''
        }))

        setSongs(transformedSongs)
        if (transformedSongs.length > 0) {
          setAnchorSongId(transformedSongs[0].id)
        }
        // Note: Fade-in is now controlled by Canvas onCreated callback
      } catch (err) {
        console.error('Failed to load example data:', err)
      }
    }

    fetchData()

    // Start preloading Three.js libraries in the background
    const preloadThree = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          Promise.all([
            import('@react-three/fiber'),
            import('three'),
            import('@react-three/drei'),
            import('@react-three/postprocessing')
          ]).catch(() => {
            // Silently fail - will load normally when user navigates to explorer
          })
        }, { timeout: 5000 })
      } else {
        // Fallback for Safari
        setTimeout(() => {
          Promise.all([
            import('@react-three/fiber'),
            import('three'),
            import('@react-three/drei'),
            import('@react-three/postprocessing')
          ]).catch(() => {
            // Silently fail
          })
        }, 1000)
      }
    }

    preloadThree()
  }, [])

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
      {/* Layer 1: Static screenshot background (shows while loading, hidden in screenshot mode) */}
      {!isScreenshotMode && (
        <div
          className={`absolute top-0 left-0 w-full h-screen flex items-center justify-center z-20 overflow-hidden transition-opacity duration-1000 ease-in-out ${canvasReady ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={{ backgroundColor: '#050505' }}
        >
          <img
            src="/landing-bg.png"
            alt="Loading Neural Web"
            className="h-full w-auto max-w-none"
          />
          {!isScreenshotMode && <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />}
        </div>
      )}

      {/* Layer 2: Neural Web Canvas - Optimized for battery/heat savings */}
      <div
        className={`absolute inset-0 z-10`}
      >
        {songs.length > 0 ? (
          <Suspense fallback={<div className="w-full h-full bg-[#050505]" />}>
            <Canvas
              dpr={[1, 1.5]}
              // Uses shared CAMERA_INITIAL_POSITION from camera-config.ts
              // Change starting position in camera-config.ts to update everywhere
              camera={{ position: CAMERA_INITIAL_POSITION, fov: 70 }}
              gl={{
                antialias: false,
                alpha: true
              }}
              style={{ width: '100vw', height: '100vh', position: 'absolute', inset: 0 }}
            >
              <color attach="background" args={['#050505']} />
              <NeuralScene
                data={songs}
                onPointClick={() => { }}
                anchorSongId={anchorSongId}
                preview={true}
                screenshotMode={isScreenshotMode}
                onSceneReady={() => {
                  console.log('Scene is fully painted - triggering crossfade')
                  setCanvasReady(true)
                }}
              />
            </Canvas>
          </Suspense>
        ) : (
          <div className="w-full h-full bg-[#050505]" />
        )}
        {!isScreenshotMode && <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />}
      </div>

      {/* Navigation - hidden in screenshot mode */}
      <nav className={`relative z-30 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto ${isScreenshotMode ? 'hidden' : ''}`}>
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1 h-6 bg-beatscout-mint rounded-sm" />
            <div className="w-1 h-4 bg-beatscout-mint rounded-sm" />
            <div className="w-1 h-8 bg-beatscout-mint rounded-sm" />
          </div>
          <span className="text-2xl font-bold font-mono tracking-tight">BeatScout</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/plans"
            className="px-5 py-2 text-beatscout-text-secondary hover:text-white border border-beatscout-border rounded-sm hover:border-beatscout-mint transition-colors"
          >
            Get a Plan
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-2.5 bg-beatscout-mint text-beatscout-bg font-semibold rounded-sm hover:bg-beatscout-mint-dark transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section - hidden in screenshot mode */}
      <section className={`relative z-30 flex flex-col items-center justify-center px-4 text-center h-[calc(100vh-80px)] overflow-hidden ${isScreenshotMode ? 'hidden' : ''}`}>
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
            className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-sm bg-beatscout-border/50 border border-beatscout-border"
          >
            <Sparkles className="w-4 h-4 text-beatscout-mint" />
            <span className="text-sm text-beatscout-text-secondary">SoundCloud Integration</span>
          </motion.div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight max-w-4xl mx-auto leading-tight">
            Stop Digging Through Trash.
            <br />
            <span className="text-beatscout-mint">Find Club-Ready Edits Instantly.</span>
          </h1>

          <p className="text-lg text-beatscout-text-secondary/80 max-w-2xl mx-auto mb-8">
            BeatScout analyzes thousands of SoundCloud tracks to filter out bedroom rips and characterizes them by exact audio features.
            Find the exact vibe, energy level and danceability in minutes instead of hours.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              href="/explorer"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-beatscout-mint text-beatscout-bg font-semibold rounded-sm hover:bg-beatscout-mint-dark transition-all hover:scale-105"
            >
              Enter the Explorer
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#workflow"
              className="inline-flex items-center gap-2 px-6 py-3 border border-beatscout-border rounded-sm hover:border-beatscout-mint hover:text-beatscout-mint transition-colors"
            >
              <Play className="w-5 h-5" />
              See How It Works
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
              <div className="px-6 py-4 bg-beatscout-mint/20 border border-beatscout-mint rounded-sm">
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
                    className="flex-1 px-5 py-3 bg-beatscout-panel border border-beatscout-border rounded-sm text-white placeholder-beatscout-text-secondary focus:outline-none focus:border-beatscout-mint"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-beatscout-mint text-beatscout-bg font-semibold rounded-sm hover:bg-beatscout-mint-dark transition-colors whitespace-nowrap"
                  >
                    Request Beta Access
                  </button>
                </div>
                <p className="text-xs text-beatscout-text-secondary/60 text-center mt-2">
                  Strictly limited private beta.
                </p>
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}
              </form>
            )}
          </motion.div>
        </motion.div>

      </section>

      {/* The Workflow Section - hidden in screenshot mode */}
      <section id="workflow" className={`relative z-30 px-4 py-20 bg-beatscout-panel/50 ${isScreenshotMode ? 'hidden' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            The <span className="text-beatscout-mint">Workflow</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="p-8 rounded-sm bg-beatscout-bg border border-red-900/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 bg-red-500 rounded-sm" />
                <h3 className="text-xl font-bold text-red-400">The Old Way</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-2xl text-beatscout-text-secondary">3hrs</span>
                  <span className="text-beatscout-text-secondary">of manual digging</span>
                </div>
                <div className="h-px bg-red-900/30" />
                <div className="flex items-center gap-4">
                  <span className="font-mono text-2xl text-beatscout-text-secondary">50</span>
                  <span className="text-beatscout-text-secondary">terrible rips listened to, creativity wasted.</span>
                </div>
                <div className="h-px bg-red-900/30" />
                <div className="flex items-center gap-4">
                  <span className="font-mono text-2xl text-red-400">2</span>
                  <span className="text-red-400">playable tracks found</span>
                </div>
              </div>
            </motion.div>

            {/* The BeatScout Way */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="p-8 rounded-sm bg-beatscout-bg border border-beatscout-mint/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 bg-beatscout-mint rounded-sm" />
                <h3 className="text-xl font-bold text-beatscout-mint">The BeatScout Way</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-2xl text-beatscout-mint">30s</span>
                  <span className="text-beatscout-text-secondary">to enter your track</span>
                </div>
                <div className="h-px bg-beatscout-mint/20" />
                <div className="flex items-center gap-4">
                  <span className="font-mono text-2xl text-beatscout-mint">Our algorithms</span>
                  <span className="text-beatscout-text-secondary">filter and group all edits/remixes automatically</span>
                </div>
                <div className="h-px bg-beatscout-mint/20" />
                <div className="flex items-center gap-4">
                  <span className="font-mono text-2xl text-beatscout-mint">10+</span>
                  <span className="text-beatscout-mint">club-ready edits found instantly</span>
                </div>
              </div>
            </motion.div>


          </div>
          <div className="space-y-4 mt-16">
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <Link
                href="/explorer"
                className="group inline-flex items-center gap-2 px-6 py-3 bg-beatscout-mint text-beatscout-bg font-semibold rounded-sm hover:bg-beatscout-mint-dark transition-all hover:scale-105"
              >
                Try it now!
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - hidden in screenshot mode */}
      <footer className={`relative z-30 py-6 text-center text-sm text-beatscout-text-secondary/60 ${isScreenshotMode ? 'hidden' : ''}`}>
        <div className="max-w-6xl mx-auto px-4">
          <span>BeatScout - Edit Discovery</span>
        </div>
      </footer>
    </main>
  )
}