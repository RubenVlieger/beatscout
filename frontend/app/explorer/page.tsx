'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/layout/Sidebar'
import { Check, ChevronDown, Play, Download, Filter, Loader2, Search, MousePointer2, Move3d } from 'lucide-react'
import Link from 'next/link'
import { explorerApi } from '@/lib/api'
import * as Slider from '@radix-ui/react-slider'

// Dynamic imports for Three.js components
const Canvas = dynamic(
  () => import('@react-three/fiber').then(mod => ({ default: mod.Canvas })),
  { ssr: false }
)

const NeuralScene = dynamic(
  () => import('@/components/three/NeuralScene').then(mod => ({ default: mod.NeuralScene })),
  { ssr: false }
)

// Type for SongData (re-exported from NeuralScene for type safety)
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

// Canvas Skeleton component for loading state
function CanvasSkeleton() {
  return (
    <div className="relative h-[500px] bg-[#141619] rounded-xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-beatscout-mint border-t-transparent rounded-full animate-spin" />
        <span className="text-beatscout-text-secondary text-sm">Loading visualization...</span>
      </div>
    </div>
  )
}

// Unified loading skeleton for the entire page
function PageSkeleton() {
  return (
    <div className="flex min-h-screen bg-beatscout-bg">
      <Sidebar isLoggedIn={false} />
      <main className="flex-1 ml-64 p-8">
        {/* Header skeleton */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="h-8 w-96 bg-beatscout-panel rounded animate-pulse" />
            <div className="h-8 w-24 bg-beatscout-panel rounded-full animate-pulse" />
          </div>
          <div className="h-8 w-96 bg-beatscout-panel rounded-full animate-pulse" />
        </header>

        {/* Main content skeleton */}
        <div className="grid grid-cols-[1fr_300px] gap-6">
          {/* Neural Web skeleton */}
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beatscout-border">
              <div className="h-5 w-24 bg-beatscout-bg rounded animate-pulse" />
              <div className="h-5 w-32 bg-beatscout-bg rounded animate-pulse" />
            </div>
            <CanvasSkeleton />
          </div>

          {/* Filters skeleton */}
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl p-6 space-y-6">
            <div className="h-5 w-20 bg-beatscout-bg rounded animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-full bg-beatscout-bg rounded animate-pulse" />
              <div className="h-2 w-full bg-beatscout-bg rounded animate-pulse" />
              <div className="h-2 w-full bg-beatscout-bg rounded animate-pulse" />
              <div className="h-2 w-full bg-beatscout-bg rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Table skeleton */}
        <div className="mt-6 bg-beatscout-panel border border-beatscout-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-beatscout-border">
            <div className="h-6 w-48 bg-beatscout-bg rounded animate-pulse" />
          </div>
          <div className="divide-y divide-beatscout-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="h-4 w-48 bg-beatscout-bg rounded animate-pulse" />
                <div className="h-4 w-20 bg-beatscout-bg rounded animate-pulse" />
                <div className="h-4 w-16 bg-beatscout-bg rounded animate-pulse" />
                <div className="h-4 w-16 bg-beatscout-bg rounded animate-pulse" />
                <div className="h-4 w-24 bg-beatscout-bg rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

// FilterSlider component using Radix UI for proper dual-thumb support
function FilterSlider({ label, min, max, value, onChange }: { label: string, min: number, max: number, value: [number, number], onChange: (val: [number, number]) => void }) {
  const handleValueChange = (newValue: number[]) => {
    if (newValue.length === 2) {
      onChange([newValue[0], newValue[1]] as [number, number])
    }
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-beatscout-text-secondary">{label}</span>
        <span className="text-white">{value[0]} - {value[1]}</span>
      </div>
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={value}
        max={max}
        min={min}
        step={1}
        minStepsBetweenThumbs={1}
        onValueChange={handleValueChange}
      >
        <Slider.Track className="bg-beatscout-border relative grow rounded-full h-[6px]">
          <Slider.Range className="absolute bg-beatscout-mint rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          className="block w-4 h-4 bg-beatscout-mint rounded-full shadow-[0_2px_10px] shadow-black/20 hover:bg-beatscout-mint-dark focus:outline-none focus:ring-2 focus:ring-beatscout-mint/50 cursor-grab active:cursor-grabbing"
          aria-label="Minimum"
        />
        <Slider.Thumb
          className="block w-4 h-4 bg-beatscout-mint rounded-full shadow-[0_2px_10px] shadow-black/20 hover:bg-beatscout-mint-dark focus:outline-none focus:ring-2 focus:ring-beatscout-mint/50 cursor-grab active:cursor-grabbing"
          aria-label="Maximum"
        />
      </Slider.Root>
    </div>
  )
}

export default function ExplorerPage() {
  const [songs, setSongs] = useState<SongData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [threeLoaded, setThreeLoaded] = useState(false)
  
  const [tempoRange, setTempoRange] = useState<[number, number]>([120, 145])
  const [danceabilityRange, setDanceabilityRange] = useState<[number, number]>([0, 100])
  const [temperamentRange, setTemperamentRange] = useState<[number, number]>([0, 100])
  const [qualityRange, setQualityRange] = useState<[number, number]>([0, 100])
  const [selectedGenre, setSelectedGenre] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null)
  const [anchorSongId, setAnchorSongId] = useState<string>('')

  // Preload Three.js when component mounts
  useEffect(() => {
    const preloadThree = async () => {
      try {
        await Promise.all([
          import('@react-three/fiber'),
          import('three'),
          import('@react-three/drei'),
          import('@react-three/postprocessing')
        ])
        setThreeLoaded(true)
      } catch (err) {
        console.error('Failed to preload Three.js:', err)
      }
    }
    preloadThree()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await explorerApi.getExampleData()
        setSongs(response.data.songs)
        setMetadata(response.data.metadata)
        
        // Set anchor song (first song or based on metadata)
        if (response.data.songs.length > 0) {
          setAnchorSongId(response.data.songs[0].id)
        }
      } catch (err) {
        setError('Failed to load example data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredSongs = useMemo(() => {
    const filtered = songs.filter(song => 
      song.tempo >= tempoRange[0] && song.tempo <= tempoRange[1] &&
      song.danceability >= danceabilityRange[0] && song.danceability <= danceabilityRange[1] &&
      song.temperament >= temperamentRange[0] && song.temperament <= temperamentRange[1] &&
      song.production_quality >= qualityRange[0] && song.production_quality <= qualityRange[1] &&
      (selectedGenre === 'All' || song.genre === selectedGenre) &&
      (searchQuery === '' || song.title.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    
    if (selectedSong) {
      const selectedIndex = filtered.findIndex(s => s.id === selectedSong.id)
      if (selectedIndex > 0) {
        const selectedItem = filtered[selectedIndex]
        filtered.splice(selectedIndex, 1)
        filtered.unshift(selectedItem)
      }
    }
    
    return filtered
  }, [songs, tempoRange, danceabilityRange, temperamentRange, qualityRange, selectedGenre, searchQuery, selectedSong])

  const genres = ['All', 'House', 'Techno', 'Tech House']

  // Combined loading state - show skeleton while data is loading OR Three.js isn't ready
  if (loading || !threeLoaded) {
    return <PageSkeleton />
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-beatscout-bg">
        <Sidebar isLoggedIn={false} />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <div className="text-red-400">{error}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-beatscout-bg">
      <Sidebar isLoggedIn={false} />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white">
              Edit Discovery for {metadata?.title ? `${metadata.artist} - ${metadata.title}` : 'Peggy Gou - It Goes Like Nanana'}
            </h1>
            <Link 
              href="/plans"
              className="px-4 py-2 bg-beatscout-mint text-beatscout-bg font-semibold rounded-full text-sm hover:bg-beatscout-mint-dark transition-colors"
            >
              Get a Plan
            </Link>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-beatscout-mint/10 border border-beatscout-mint/20 rounded-full text-sm w-fit">
            <Check className="w-4 h-4 text-beatscout-mint" />
            <span className="text-beatscout-mint">
              Analysis complete: {metadata?.successful_analyses || filteredSongs.length} unique edits found, {metadata?.total_songs || 0} Total Results
            </span>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-[1fr_300px] gap-6">
          {/* Left: Neural Web Visualization */}
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beatscout-border">
              <h2 className="font-semibold">Neural Web</h2>
              <button className="flex items-center gap-2 text-sm text-beatscout-text-secondary hover:text-white">
                <Move3d className="w-4 h-4" />
                <span>Interact with the web</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            <div className="relative h-[500px]">
              <Suspense fallback={<CanvasSkeleton />}>
                <Canvas 
                  camera={{ position: [60, 60, 60], fov: 60 }}
                  gl={{ antialias: true, alpha: true }}
                >
                  <color attach="background" args={['#141619']} />
                  <NeuralScene 
                    data={filteredSongs} 
                    onPointClick={setSelectedSong}
                    anchorSongId={anchorSongId}
                  />
                </Canvas>
              </Suspense>
              
              {/* Axis Labels */}
              <div className="absolute bottom-4 left-4 text-xs text-beatscout-text-secondary space-y-1">
                <div>X: Tempo (BPM)</div>
                <div>Y: Danceability</div>
                <div>Z: Temperament</div>
              </div>
              
              {/* Color Legend */}
              <div className="absolute top-4 right-4 bg-beatscout-bg/90 backdrop-blur p-4 rounded-lg border border-beatscout-border">
                <div className="text-xs font-medium mb-2">Production Quality</div>
                <div 
                  className="w-4 h-32 rounded-full mx-auto" 
                  style={{ 
                    background: 'linear-gradient(to top, #1E3A8A 0%, #F97316 100%)' 
                  }} 
                />
                <div className="flex justify-between text-[10px] text-beatscout-text-secondary mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              
              {/* Interaction Hints */}
              <div className="absolute bottom-4 right-4 flex items-center gap-4 text-xs text-beatscout-text-secondary">
                <div className="flex items-center gap-1">
                  <MousePointer2 className="w-3 h-3" />
                  <span>Hover to pulse</span>
                </div>
                <div className="flex items-center gap-1">
                  <Move3d className="w-3 h-3" />
                  <span>Click to focus</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Filters */}
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Filter className="w-5 h-5" />
              <h2 className="font-semibold">Filters</h2>
            </div>
            
            {/* Genre Filter */}
            <div className="mb-6">
              <label className="text-sm text-beatscout-text-secondary mb-2 block">Genre</label>
              <select 
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full px-3 py-2 bg-beatscout-bg border border-beatscout-border rounded-lg text-sm focus:outline-none focus:border-beatscout-mint"
              >
                {genres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            
            {/* Sliders */}
            <FilterSlider label="Tempo Range (BPM)" min={120} max={145} value={tempoRange} onChange={setTempoRange} />
            <FilterSlider label="Danceability" min={0} max={100} value={danceabilityRange} onChange={setDanceabilityRange} />
            <FilterSlider label="Temperament" min={0} max={100} value={temperamentRange} onChange={setTemperamentRange} />
            <FilterSlider label="Min Quality" min={0} max={100} value={qualityRange} onChange={setQualityRange} />
          </div>
        </div>

        {/* Bottom: Results Table */}
        <div className="mt-6 bg-beatscout-panel border border-beatscout-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-beatscout-border flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="font-semibold whitespace-nowrap">Top Edits ({filteredSongs.length} results)</h2>
              {selectedSong && (
                <button
                  onClick={() => setSelectedSong(null)}
                  className="flex items-center gap-1 px-3 py-1 bg-beatscout-mint/20 text-beatscout-mint text-xs rounded-full hover:bg-beatscout-mint/30 transition-colors"
                >
                  <span>Selected: {selectedSong.title.slice(0, 30)}...</span>
                  <span className="ml-1">×</span>
                </button>
              )}
            </div>
            
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-beatscout-text-secondary" />
              <input
                type="text"
                placeholder="Search by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-beatscout-bg border border-beatscout-border rounded-lg text-sm text-white placeholder:text-beatscout-text-secondary focus:outline-none focus:border-beatscout-mint"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-beatscout-text-secondary hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-beatscout-text-secondary border-b border-beatscout-border">
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Genre</th>
                  <th className="px-6 py-3 font-medium">Tempo</th>
                  <th className="px-6 py-3 font-medium">Key</th>
                  <th className="px-6 py-3 font-medium">Production Quality</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSongs.slice(0, 50).map((song) => (
                  <tr 
                    key={song.id} 
                    className={`border-b border-beatscout-border/50 hover:bg-beatscout-bg/50 transition-colors cursor-pointer ${
                      selectedSong?.id === song.id 
                        ? 'bg-beatscout-mint/10 border-l-4 border-l-beatscout-mint' 
                        : ''
                    }`}
                    onClick={() => setSelectedSong(song)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-white truncate max-w-xs flex items-center gap-2" title={song.title}>
                        {selectedSong?.id === song.id && (
                          <span className="w-2 h-2 bg-beatscout-mint rounded-full animate-pulse"></span>
                        )}
                        {song.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-beatscout-text-secondary">{song.genre}</td>
                    <td className="px-6 py-4 text-beatscout-text-secondary">{song.tempo} BPM</td>
                    <td className="px-6 py-4 text-beatscout-text-secondary">{song.key}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: `hsl(${220 + (song.production_quality / 100) * 40}, 70%, ${30 + (song.production_quality / 100) * 50}%)`
                          }}
                        />
                        <span className="text-beatscout-mint">{song.production_quality}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {song.url ? (
                          <>
                            <a 
                              href={song.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 bg-beatscout-border hover:bg-beatscout-border/80 rounded text-xs transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Play className="w-3 h-3" />
                              Preview
                            </a>
                            <a 
                              href={song.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 border border-beatscout-mint text-beatscout-mint hover:bg-beatscout-mint/10 rounded text-xs transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-3 h-3" />
                              Visit
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-beatscout-text-secondary">No link available</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSongs.length > 50 && (
              <div className="px-6 py-4 text-center text-sm text-beatscout-text-secondary border-t border-beatscout-border">
                Showing 50 of {filteredSongs.length} results
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
