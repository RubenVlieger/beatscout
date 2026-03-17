'use client'

import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Play } from 'lucide-react'
import { damp3 } from '@/lib/easing'

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
  onDoubleClick: () => void
  onHover: () => void
  onLeave: () => void
  index: number
  orbitMode: boolean
  isCenter: boolean
  isOrbiting: boolean
  shouldHide: boolean
  orbitPosition: [number, number, number] | null
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
  onDoubleClick,
  onHover,
  onLeave,
  index,
  orbitMode,
  isCenter,
  isOrbiting,
  shouldHide,
  orbitPosition
}: NeuralOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const hitMeshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const [internalHovered, setInternalHovered] = useState(false)
  
  // Track current animated position for orbit mode
  const currentPosition = useRef(new THREE.Vector3(...position))
  // Track current scale for smooth transitions
  const currentScale = useRef(new THREE.Vector3(1, 1, 1))
  
  const actuallyHovered = isHovered || internalHovered
  
  // Material properties based on quality - MeshPhysicalMaterial provides clearcoat for high quality
  const materialProps = useMemo(() => {
    const q = data.production_quality
    if (q >= 70) {
      // High quality: smooth, polished with clearcoat
      return {
        roughness: 0.05,
        metalness: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        sheen: 0.2,
        sheenRoughness: 0.1,
        sheenColor: new THREE.Color(color)
      }
    }
    if (q >= 40) {
      // Medium quality: semi-polished, subtle clearcoat
      return {
        roughness: 0.2,
        metalness: 0.7,
        clearcoat: 0.3,
        clearcoatRoughness: 0.1,
        sheen: 0.0
      }
    }
    // Low quality: rough, matte, no clearcoat
    return {
      roughness: 0.5,
      metalness: 0.5,
      clearcoat: 0.0,
      clearcoatRoughness: 0.5,
      sheen: 0.0
    }
  }, [data.production_quality, color])
  
  // Bobbing speed based on quality
  const bobbingSpeed = useMemo(() => {
    const q = data.production_quality
    if (q >= 70) return 0.5
    if (q >= 40) return 0.4
    return 0.3
  }, [data.production_quality])
  
  // Emissive intensity based on production quality and selection state
  const emissiveIntensity = useMemo(() => {
    const baseIntensity = 0.3
    const qualityBoost = (data.production_quality / 100) * 1.2
    const selectionBoost = isSelected ? 0.5 : 0
    const centerBoost = isCenter ? 0.8 : 0
    return baseIntensity + qualityBoost + selectionBoost + centerBoost
  }, [data.production_quality, isSelected, isCenter])
  
  // Calculate target scale based on state
  const targetScale = useMemo(() => {
    if (shouldHide) return new THREE.Vector3(0, 0, 0)
    
    const baseScale = isAnchor ? 1.2 : 1.0
    const hoverScale = actuallyHovered ? 1.8 : 1.0
    const selectionScale = isSelected ? 1.5 : 1.0
    const centerScale = isCenter ? 2.0 : 1.0
    const orbitingScale = isOrbiting ? 1.2 : 1.0
    const dimmedScale = isDimmed ? 0.7 : 1.0
    const defaultScale = isAnchor ? 1.5 : 0.8
    
    const finalScale = baseScale * hoverScale * selectionScale * centerScale * orbitingScale * dimmedScale * defaultScale
    return new THREE.Vector3(finalScale, finalScale, finalScale)
  }, [isAnchor, actuallyHovered, isSelected, isCenter, isOrbiting, shouldHide, isDimmed])
  
  // Calculate target opacity
  const targetOpacity = useMemo(() => {
    if (shouldHide) return 0
    return isDimmed ? 0.3 : 1.0
  }, [shouldHide, isDimmed])
  
  useFrame((state, delta) => {
    if (!meshRef.current || !groupRef.current) return
    
    const time = state.clock.elapsedTime
    
    // Breathing animation - subtle Y offset based on time, index, and quality
    const breathOffset = Math.sin(time * bobbingSpeed + index * 0.2) * 0.5
    
    // Handle position animation for orbit mode
    if (orbitMode && orbitPosition) {
      const targetPos = isCenter 
        ? position
        : orbitPosition
      
      const targetWithBreath: [number, number, number] = [
        targetPos[0],
        targetPos[1] + breathOffset,
        targetPos[2]
      ]
      
      damp3(currentPosition.current, targetWithBreath, 0.15, delta)
      groupRef.current.position.copy(currentPosition.current)
    } else if (orbitMode && isCenter) {
      const targetWithBreath: [number, number, number] = [
        position[0],
        position[1] + breathOffset,
        position[2]
      ]
      
      damp3(currentPosition.current, targetWithBreath, 0.15, delta)
      groupRef.current.position.copy(currentPosition.current)
    } else {
      // Normal mode - return to original position with breathing
      const targetWithBreath: [number, number, number] = [
        position[0],
        position[1] + breathOffset,
        position[2]
      ]
      
      damp3(currentPosition.current, targetWithBreath, 0.15, delta)
      groupRef.current.position.copy(currentPosition.current)
    }
    
    // Smooth scale interpolation using lerp
    currentScale.current.lerp(targetScale, 0.1)
    meshRef.current.scale.copy(currentScale.current)
    
    // Update material opacity
    if (meshRef.current.material) {
      const material = meshRef.current.material as THREE.MeshPhysicalMaterial
      material.opacity = THREE.MathUtils.lerp(material.opacity || 1, targetOpacity, 0.1)
    }
    
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
  
  const handleDoubleClick = (e: any) => {
    e.stopPropagation()
    onDoubleClick()
  }
  
  return (
    <group ref={groupRef} position={position}>
      {/* Invisible Hit Sphere - 1.7x larger for easier interaction */}
      <mesh
        ref={hitMeshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <sphereGeometry args={[1.7, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      
      {/* Main Orb - visual only, no interaction handlers */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={materialProps.roughness}
          metalness={materialProps.metalness}
          clearcoat={materialProps.clearcoat}
          clearcoatRoughness={materialProps.clearcoatRoughness}
          sheen={materialProps.sheen}
          sheenRoughness={materialProps.sheenRoughness || 0}
          sheenColor={materialProps.sheenColor || new THREE.Color(0x000000)}
          transparent
          opacity={targetOpacity}
        />
      </mesh>
      
      {/* Anchor Ring Effect */}
      {isAnchor && !shouldHide && (
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
      
      {/* Center Node Indicator Ring */}
      {isCenter && !shouldHide && (
        <mesh>
          <torusGeometry args={[3, 0.1, 16, 100]} />
          <meshStandardMaterial
            color="#F97316"
            emissive="#F97316"
            emissiveIntensity={1.5}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
      
      {/* Tooltip */}
      {(actuallyHovered || isHovered) && !shouldHide && (
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
