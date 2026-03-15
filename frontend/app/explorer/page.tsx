'use client'

import { useState, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import Sidebar from '@/components/layout/Sidebar'
import { Check, ChevronDown, Play, Download, Filter, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { explorerApi } from '@/lib/api'

// Types for song data
interface SongData {
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

// ScatterPlotPoint component
function ScatterPoint({ position, color, data, onClick }: { position: [number, number, number], color: string, data: SongData, onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  
  return (
    <mesh 
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      <sphereGeometry args={[hovered ? 0.8 : 0.5, 16, 16]} />
      <meshBasicMaterial color={color} />
      {hovered && (
        <Html>
          <div className="bg-beatscout-panel border border-beatscout-border px-3 py-2 rounded-lg whitespace-nowrap pointer-events-none shadow-lg" style={{ fontSize: '8px' }}>
            <div className="font-semibold text-white" style={{ fontSize: '10px', marginBottom: '2px' }}>{data.title}</div>
            <div className="text-beatscout-text-secondary">{data.genre} • {data.key}</div>
            <div className="text-beatscout-mint mt-1">Quality: {data.production_quality}</div>
            <div className="text-beatscout-text-secondary">Tempo: {data.tempo} BPM</div>
          </div>
        </Html>
      )}
    </mesh>
  )
}

// 3D Scene component
function ScatterPlot({ data, onPointClick }: { data: SongData[], onPointClick?: (song: SongData) => void }) {
  const points = useMemo(() => {
    return data.map(song => {
      // Map Tempo (120-145) to X axis (-50 to 50)
      const x = ((song.tempo - 120) / 25) * 100 - 50
      // Danceability (0-100) to Y axis (-50 to 50)
      const y = song.danceability - 50
      // Temperament (0-100) to Z axis (-50 to 50)
      const z = song.temperament - 50
      
      // Color based on production quality (dark blue to bright orange)
      const quality = song.production_quality / 100
      const color = new THREE.Color().lerpColors(
        new THREE.Color('#1E3A8A'),  // Dark blue (low quality)
        new THREE.Color('#F97316'),  // Bright orange (high quality)
        quality
      )
      
      return { position: [x, y, z] as [number, number, number], color: color.getStyle(), data: song }
    })
  }, [data])

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {/* Grid */}
      <gridHelper args={[100, 20, '#2D3238', '#2D3238']} position={[0, -50, 0]} />
      
      {/* Axes */}
      <axesHelper args={[60]} />
      
      {/* Scatter points */}
      {points.map((point, index) => (
        <ScatterPoint 
          key={index} 
          {...point} 
          onClick={() => onPointClick?.(point.data)}
        />
      ))}
      
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
    </>
  )
}

// FilterSlider component with proper dual handle functionality
function FilterSlider({ label, min, max, value, onChange }: { label: string, min: number, max: number, value: [number, number], onChange: (val: [number, number]) => void }) {
  const [localValue, setLocalValue] = useState<[number, number]>(value)
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Ensure min <= max and handle overlap
  const handleMinChange = (newMin: number) => {
    const clampedMin = Math.min(newMin, localValue[1])
    setLocalValue([clampedMin, localValue[1]])
    onChange([clampedMin, localValue[1]])
  }

  const handleMaxChange = (newMax: number) => {
    const clampedMax = Math.max(newMax, localValue[0])
    setLocalValue([localValue[0], clampedMax])
    onChange([localValue[0], clampedMax])
  }

  const minPercent = ((localValue[0] - min) / (max - min)) * 100
  const maxPercent = ((localValue[1] - min) / (max - min)) * 100

  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-beatscout-text-secondary">{label}</span>
        <span className="text-white">{localValue[0]} - {localValue[1]}</span>
      </div>
      <div className="relative h-8 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-2 bg-beatscout-border rounded-full" />
        
        {/* Active track */}
        <div 
          className="absolute h-2 bg-beatscout-mint rounded-full"
          style={{ 
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`
          }}
        />

        {/* Min handle */}
        <input
          type="range"
          min={min}
          max={max}
          value={localValue[0]}
          onChange={(e) => handleMinChange(parseInt(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer z-10"
          style={{ 
            pointerEvents: 'auto'
          }}
        />
        
        {/* Max handle */}
        <input
          type="range"
          min={min}
          max={max}
          value={localValue[1]}
          onChange={(e) => handleMaxChange(parseInt(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer z-20"
          style={{ 
            pointerEvents: 'auto'
          }}
        />

        {/* Visual thumbs */}
        <div 
          className="absolute w-4 h-4 bg-beatscout-mint rounded-full shadow-lg pointer-events-none"
          style={{ 
            left: `calc(${minPercent}% - 8px)`
          }}
        />
        <div 
          className="absolute w-4 h-4 bg-beatscout-mint rounded-full shadow-lg pointer-events-none"
          style={{ 
            left: `calc(${maxPercent}% - 8px)`
          }}
        />
      </div>
    </div>
  )
}

export default function ExplorerPage() {
  const [songs, setSongs] = useState<SongData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  
  // Filter states
  const [tempoRange, setTempoRange] = useState<[number, number]>([120, 145])
  const [danceabilityRange, setDanceabilityRange] = useState<[number, number]>([0, 100])
  const [temperamentRange, setTemperamentRange] = useState<[number, number]>([0, 100])
  const [qualityRange, setQualityRange] = useState<[number, number]>([0, 100])
  const [selectedGenre, setSelectedGenre] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null)

  // Fetch example data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await explorerApi.getExampleData()
        setSongs(response.data.songs)
        setMetadata(response.data.metadata)
      } catch (err) {
        setError('Failed to load example data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter songs and sort selected to top
  const filteredSongs = useMemo(() => {
    const filtered = songs.filter(song => 
      song.tempo >= tempoRange[0] && song.tempo <= tempoRange[1] &&
      song.danceability >= danceabilityRange[0] && song.danceability <= danceabilityRange[1] &&
      song.temperament >= temperamentRange[0] && song.temperament <= temperamentRange[1] &&
      song.production_quality >= qualityRange[0] && song.production_quality <= qualityRange[1] &&
      (selectedGenre === 'All' || song.genre === selectedGenre) &&
      (searchQuery === '' || song.title.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    
    // Move selected song to the top if it exists
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

  if (loading) {
    return (
      <div className="flex min-h-screen bg-beatscout-bg">
        <Sidebar isLoggedIn={false} />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <div className="flex items-center gap-2 text-beatscout-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading analysis data...</span>
          </div>
        </main>
      </div>
    )
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
          {/* Left: 3D Visualization */}
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beatscout-border">
              <h2 className="font-semibold">Edit Explorer</h2>
              <button className="flex items-center gap-2 text-sm text-beatscout-text-secondary hover:text-white">
                Interact visualization
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            <div className="relative h-[500px]">
              <Canvas camera={{ position: [60, 60, 60], fov: 60 }}>
                <ScatterPlot data={filteredSongs} onPointClick={setSelectedSong} />
              </Canvas>
              
              {/* Axis Labels */}
              <div className="absolute bottom-4 left-4 text-xs text-beatscout-text-secondary">
                <div className="mb-1">X: Tempo (BPM)</div>
                <div className="mb-1">Y: Danceability</div>
                <div>Z: Temperament</div>
              </div>
              
              {/* Color Legend */}
              <div className="absolute top-4 right-4 bg-beatscout-bg/80 backdrop-blur p-4 rounded-lg border border-beatscout-border">
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
                    className={`border-b border-beatscout-border/50 hover:bg-beatscout-bg/50 transition-colors ${
                      selectedSong?.id === song.id 
                        ? 'bg-beatscout-mint/10 border-l-4 border-l-beatscout-mint' 
                        : ''
                    }`}
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
                            backgroundColor: new THREE.Color().lerpColors(
                              new THREE.Color('#1E3A8A'),
                              new THREE.Color('#F97316'),
                              song.production_quality / 100
                            ).getStyle()
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
                            >
                              <Play className="w-3 h-3" />
                              Preview
                            </a>
                            <a 
                              href={song.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 border border-beatscout-mint text-beatscout-mint hover:bg-beatscout-mint/10 rounded text-xs transition-colors"
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
