'use client'

import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Play } from 'lucide-react'

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

interface NeuralOrbProps {
  position: [number, number, number]
  color: THREE.Color
  data: SongData
  isAnchor: boolean
  isHovered: boolean
  isDimmed: boolean
  isSelected: boolean
  onClick: () => void
  onHover: () => void
  onLeave: () => void
  index: number
}

export function NeuralOrb({
  position,
  color,
  data,
  isAnchor,
  isHovered,
  isDimmed,
  isSelected,
  onClick,
  onHover,
  onLeave,
  index
}: NeuralOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const [internalHovered, setInternalHovered] = useState(false)
  
  const actuallyHovered = isHovered || internalHovered
  
  // Emissive intensity based on production quality and selection state
  const emissiveIntensity = useMemo(() => {
    const baseIntensity = 0.3
    const qualityBoost = (data.production_quality / 100) * 1.2
    const selectionBoost = isSelected ? 0.5 : 0
    return baseIntensity + qualityBoost + selectionBoost
  }, [data.production_quality, isSelected])
  
  // Calculate scale based on hover and selection state
  const targetScale = isAnchor ? 1.2 : 1.0
  const hoverScale = actuallyHovered ? 1.8 : 1.0
  const selectionScale = isSelected ? 1.5 : 1.0
  const dimmedScale = isDimmed ? 0.7 : 1.0
  
  useFrame((state) => {
    if (!meshRef.current) return
    
    const time = state.clock.elapsedTime
    
    // Breathing animation - subtle Y offset based on time and index
    // Only apply breathOffset (not position[1] again since mesh is inside group with position)
    const breathOffset = Math.sin(time * 0.5 + index * 0.2) * 0.5
    meshRef.current.position.y = breathOffset
    
    // Smooth scale interpolation
    const finalScale = (targetScale * hoverScale * selectionScale * dimmedScale) * (isAnchor ? 1.5 : 0.8)
    meshRef.current.scale.lerp(
      new THREE.Vector3(finalScale, finalScale, finalScale),
      0.1
    )
    
    // Rotate anchor ring
    if (ringRef.current && isAnchor) {
      ringRef.current.rotation.x = time * 0.3
      ringRef.current.rotation.y = time * 0.5
    }
  })
  
  const handlePointerOver = () => {
    setInternalHovered(true)
    onHover()
  }
  
  const handlePointerOut = () => {
    setInternalHovered(false)
    onLeave()
  }
  
  const handleClick = (e: any) => {
    e.stopPropagation()
    onClick()
  }
  
  return (
    <group position={position}>
      {/* Main Orb */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={isDimmed ? 0.3 : 1.0}
        />
      </mesh>
      
      {/* Anchor Ring Effect */}
      {isAnchor && (
        <mesh ref={ringRef}>
          <torusGeometry args={[2.5, 0.05, 16, 100]} />
          <meshStandardMaterial
            color="#68ED9E"
            emissive="#68ED9E"
            emissiveIntensity={2}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}
      
      {/* Tooltip */}
      {(actuallyHovered || isHovered) && (
        <Html distanceFactor={20}>
          <div 
            className="bg-[#1C2024]/95 backdrop-blur-md border border-[#2D3238] px-8 py-6 rounded-xl shadow-2xl pointer-events-none min-w-[600px]"
            style={{ fontSize: '32px' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="font-bold text-white" style={{ fontSize: '40px' }}>
                {data.title}
              </div>
              <Play className="w-8 h-8 text-[#68ED9E]" />
            </div>
            
            {/* Waveform visualization */}
            <div className="flex items-end gap-[4px] h-10 mb-6 px-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[#68ED9E]/60 rounded-full"
                  style={{
                    width: '10px',
                    height: `${Math.random() * 100}%`,
                    animation: `pulse 0.5s ease-in-out ${i * 0.05}s infinite alternate`
                  }}
                />
              ))}
            </div>
            
            {/* Metadata */}
            <div className="space-y-3 text-[#8B949E]" style={{ fontSize: '28px' }}>
              <div className="flex justify-between">
                <span>Genre:</span>
                <span className="text-white">{data.genre}</span>
              </div>
              <div className="flex justify-between">
                <span>Key:</span>
                <span className="text-white">{data.key}</span>
              </div>
              <div className="flex justify-between">
                <span>Tempo:</span>
                <span className="text-white">{data.tempo} BPM</span>
              </div>
              <div className="flex justify-between">
                <span>Quality:</span>
                <span className="text-[#68ED9E]">{data.production_quality}/100</span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

export type { SongData, NeuralOrbProps }
