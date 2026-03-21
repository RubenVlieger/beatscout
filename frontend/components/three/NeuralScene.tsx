'use client'

import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { CameraControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { SongData } from './NeuralOrb'
import { NeuralFilaments } from './NeuralFilaments'
import { NeuralOrbs } from './NeuralOrbs'
import { CAMERA_RADIUS, CAMERA_INITIAL_POSITION, CAMERA_BASE_ANGLE, CAMERA_ELEVATION_ANGLE } from './camera-config'

// Deterministic PRNG (Mulberry32)
function createSeededRandom(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Deterministic Stars Component
function DeterministicStars({ count = 5000, radius = 300, depth = 100 }) {
  const { positions, sizes } = useMemo(() => {
    const random = createSeededRandom(1337) // Hardcoded seed ensures identical results
    const posArray = new Float32Array(count * 3)
    const sizeArray = new Float32Array(count)
    
    // Mimic the spherical shell distribution of drei's Stars
    for (let i = 0; i < count; i++) {
      const r = radius + (random() * depth)
      const theta = random() * 2 * Math.PI
      const phi = Math.acos(2 * random() - 1)
      
      posArray[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      posArray[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      posArray[i * 3 + 2] = r * Math.cos(phi)
      
      // Vary star sizes for pseudo-random brightness (0.5 to 1.5)
      sizeArray[i] = 0.5 + random() * 1.0
    }
    return { positions: posArray, sizes: sizeArray }
  }, [count, radius, depth])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={1.0}
        sizeAttenuation={true}
        color="#ffffff"
        transparent
        opacity={0.35}
        fog={false}
        depthWrite={false}
      />
    </points>
  )
}

// Types
interface NeuralSceneProps {
  data: SongData[]
  onPointClick: (song: SongData | null) => void
  anchorSongId: string
  preview?: boolean
  screenshotMode?: boolean
  onSceneReady?: () => void
}

// Component that tracks when the scene is fully rendered and painted
function SceneReadyTracker({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    // 1. Force GPU to compile all shaders and materials immediately
    gl.compile(scene, camera)

    // 2. Wait for the browser to actually paint the frame to the screen.
    // We nest requestAnimationFrame twice to ensure the GPU pipeline has flushed.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onReady()
      })
    })
  }, [gl, scene, camera, onReady])

  return null
}

interface NodeData {
  id: string
  position: [number, number, number]
  color: THREE.Color
  colorHex: string
  data: SongData
  quality: 'high' | 'medium' | 'low'
  bobbingSpeed: number
  emissiveIntensity: number
}

// Calculate Euclidean distance between two 3D points
function getDistance(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p1[0] - p2[0]
  const dy = p1[1] - p2[1]
  const dz = p1[2] - p2[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Camera controller that smoothly focuses on selected node and handles orbit mode
function CameraController({
  targetPosition,
  isFocusing,
  orbitMode,
  centerNode,
  preview,
  screenshotMode
}: {
  targetPosition: THREE.Vector3 | null
  isFocusing: boolean
  orbitMode: boolean
  centerNode: SongData | null
  preview: boolean
  screenshotMode?: boolean
}) {
  const controlsRef = useRef<CameraControls>(null)
  const { camera } = useThree()

  // Track if we need to animate camera
  const lastOrbitMode = useRef(orbitMode)
  const lastCenterNode = useRef<SongData | null>(null)
  const isInitialized = useRef(false)
  
  // Animation state for intro rotation
  const isAnimating = useRef(false)
  const animationTimeRef = useRef(0)
  
  // Start animation after 1 second delay in preview mode
  useEffect(() => {
    if (!preview) return
    const timer = setTimeout(() => {
      isAnimating.current = true
    }, 1000)
    return () => clearTimeout(timer)
  }, [preview])

  // Animation constants - 2x slower for smoother, more elegant rotation
  const ANIMATION_DURATION = 300000 // ~300 seconds for full 360-degree rotation
  // Uses shared camera config - change in camera-config.ts to update everywhere
  const INITIAL_DISTANCE = CAMERA_RADIUS

  // Animation frame handler for continuous circular rotation
  useFrame((state, delta) => {
    // Skip animation in screenshot mode - camera stays static
    if (screenshotMode) return

    // Only animate in preview mode
    if (!preview || !isAnimating.current) return

    // Use delta time for smooth animation regardless of frame rate
    animationTimeRef.current += delta * 1000
    const elapsed = animationTimeRef.current % ANIMATION_DURATION // Seamless loop
    const progress = elapsed / ANIMATION_DURATION

    // Continuous 360-degree rotation (no zoom, no back-and-forth)
    const fullAngle = progress * Math.PI * 2 // 0 to 360 degrees

    // Calculate camera position based on spherical coordinates
    // Start from isometric angle and rotate around Y axis
    const currentAngle = CAMERA_BASE_ANGLE + fullAngle

    // Constant radius (no zoom in/out)
    const radius = INITIAL_DISTANCE

    // Calculate position (maintaining isometric-like view while rotating)
    const x = radius * Math.sin(currentAngle) * Math.cos(CAMERA_ELEVATION_ANGLE)
    const z = radius * Math.cos(currentAngle) * Math.cos(CAMERA_ELEVATION_ANGLE)
    const y = radius * Math.sin(CAMERA_ELEVATION_ANGLE)

    // Update camera position directly to avoid setLookAt overhead
    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
    // Note: updateProjectionMatrix() not needed for position updates
  })
  
  useEffect(() => {
    if (!controlsRef.current) return
    
    // Check if orbit mode or center node changed
    const orbitChanged = lastOrbitMode.current !== orbitMode
    const centerChanged = lastCenterNode.current?.id !== centerNode?.id
    
    // Note: Animation continues running for screen recording purposes
    // User interactions will temporarily override, but animation resumes when reset
    
    if (orbitMode && centerNode && (orbitChanged || centerChanged)) {
      // Entering orbit mode or switching center - animate to top-down view
      const centerX = ((centerNode.tempo - 120) / 25) * 100 - 50
      const centerY = centerNode.danceability - 50
      const centerZ = centerNode.temperament - 50
      
      // Camera positioned above looking down
      const newPosition = new THREE.Vector3(centerX, centerY, centerZ + 40)
      const lookAt = new THREE.Vector3(centerX, centerY, centerZ)
      
      controlsRef.current.setLookAt(
        newPosition.x, newPosition.y, newPosition.z,
        lookAt.x, lookAt.y, lookAt.z,
        true // enable transition
      )
      // Pause animation while in orbit mode
      isAnimating.current = false
    } else if (!orbitMode && orbitChanged) {
      // Exiting orbit mode - animation will automatically resume on next frame
      isAnimating.current = true
      animationTimeRef.current = 0
    } else if (targetPosition && isFocusing && !orbitMode) {
      // Normal focus mode (single click)
      const offset = new THREE.Vector3(20, 15, 20)
      const newPosition = targetPosition.clone().add(offset)
      
      controlsRef.current.setLookAt(
        newPosition.x, newPosition.y, newPosition.z,
        targetPosition.x, targetPosition.y, targetPosition.z,
        true // enable transition
      )
      // Pause animation while focusing
      isAnimating.current = false
    }
    
    lastOrbitMode.current = orbitMode
    lastCenterNode.current = centerNode
  }, [targetPosition, isFocusing, orbitMode, centerNode])

  // Initialize camera position on mount - runs for ALL modes to ensure consistency
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    // Position camera at the exact starting frame of the animation
    // Uses shared CAMERA_INITIAL_POSITION from camera-config.ts
    const [x, y, z] = CAMERA_INITIAL_POSITION

    // Set camera position and look at origin immediately
    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()

    // Also update CameraControls to match, preventing any transition animation
    if (controlsRef.current) {
      controlsRef.current.setLookAt(x, y, z, 0, 0, 0, false)
    }

    if (screenshotMode) {
      console.log('Screenshot mode: Camera positioned at frame 0', { x: x.toFixed(2), y: y.toFixed(2), z: z.toFixed(2) })
    }
  }, [screenshotMode, camera])

  // In preview mode, disable smooth transitions to prevent CameraControls
  // from animating away from our scripted animation position
  const isPreviewMode = preview || screenshotMode

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={10}
      maxDistance={160}
      restThreshold={0.01}
      smoothTime={isPreviewMode ? 0 : 0.5}
      draggingSmoothTime={0.1}
    />
  )
}

// Main scene component
function NeuralWeb({
  data,
  onPointClick,
  anchorSongId,
  preview,
  screenshotMode,
  onSceneReady
}: NeuralSceneProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // Orbit mode state
  const [orbitMode, setOrbitMode] = useState(false)
  const [centerNode, setCenterNode] = useState<SongData | null>(null)
  const [orbitingNeighbors, setOrbitingNeighbors] = useState<SongData[]>([])
  
  // Process nodes with positions, colors, and pre-computed properties
  const nodes = useMemo<NodeData[]>(() => {
    return data.map(song => {
      // Map Tempo (120-145) to X axis (-50 to 50)
      const x = ((song.tempo - 120) / 25) * 100 - 50
      // Danceability (0-100) to Y axis (-50 to 50)
      const y = song.danceability - 50
      // Temperament (0-100) to Z axis (-50 to 50)
      const z = song.temperament - 50
      
      // Color based on production quality (dark blue to bright orange)
      const qualityFactor = song.production_quality / 100
      const color = new THREE.Color().lerpColors(
        new THREE.Color('#1E3A8A'),  // Dark blue (low quality)
        new THREE.Color('#F97316'),  // Bright orange (high quality)
        qualityFactor
      )
      
      // Pre-compute color as hex string for efficient use
      const colorHex = color.getHexString()
      
      // Pre-compute quality tier for material selection
      const quality = song.production_quality >= 70 ? 'high' : song.production_quality >= 40 ? 'medium' : 'low'
      
      // Pre-compute bobbing speed
      const bobbingSpeed = song.production_quality >= 70 ? 0.5 : song.production_quality >= 40 ? 0.4 : 0.3
      
      // Pre-compute emissive intensity
      const emissiveIntensity = 0.3 + (song.production_quality / 100) * 1.2
      
      return {
        id: song.id,
        position: [x, y, z] as [number, number, number],
        color,
        colorHex,
        data: song,
        quality,
        bobbingSpeed,
        emissiveIntensity
      }
    })
  }, [data])
  
  // Pre-compute adjacency map for fast neighbor lookups
  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    
    // For each node, find neighbors within 30 units
    nodes.forEach(node => {
      const neighbors = new Set<string>()
      nodes.forEach(otherNode => {
        if (node.id !== otherNode.id) {
          const distance = getDistance(node.position, otherNode.position)
          if (distance < 30) {
            neighbors.add(otherNode.id)
          }
        }
      })
      map.set(node.id, neighbors)
    })
    
    return map
  }, [nodes])
  
  // Calculate which nodes should be dimmed using adjacency map (O(1) lookup)
  const dimmedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>()
    
    // Get pre-computed neighbors from adjacency map
    const neighbors = adjacencyMap.get(hoveredNodeId)
    if (!neighbors) return new Set<string>()
    
    // Build set of IDs that should NOT be dimmed (hovered + neighbors)
    const connectedIds = new Set<string>([hoveredNodeId, ...Array.from(neighbors)])
    
    // Return IDs of nodes that should be dimmed (not in connected set)
    return new Set(nodes.filter(n => !connectedIds.has(n.id)).map(n => n.id))
  }, [hoveredNodeId, nodes, adjacencyMap])
  
  // Calculate orbit positions for neighbors
  const orbitPositions = useMemo(() => {
    if (!orbitMode || !centerNode || orbitingNeighbors.length === 0) {
      return new Map<string, [number, number, number]>()
    }
    
    const centerX = ((centerNode.tempo - 120) / 25) * 100 - 50
    const centerY = centerNode.danceability - 50
    const centerZ = centerNode.temperament - 50
    const radius = 15
    
    // Calculate angles based on relative danceability and temperament
    const neighborsWithAngles = orbitingNeighbors.map(neighbor => {
      const deltaDance = neighbor.danceability - centerNode.danceability
      const deltaTemp = neighbor.temperament - centerNode.temperament
      const angle = Math.atan2(deltaTemp, deltaDance)
      return { neighbor, angle }
    })
    
    // Sort by angle
    const sorted = neighborsWithAngles.sort((a, b) => a.angle - b.angle)
    
    // Assign evenly spaced angles
    const positions = new Map<string, [number, number, number]>()
    sorted.forEach((item, i) => {
      const newAngle = i * (2 * Math.PI / orbitingNeighbors.length)
      const targetX = centerX + radius * Math.cos(newAngle)
      const targetY = centerY + radius * Math.sin(newAngle)
      const targetZ = centerZ
      positions.set(item.neighbor.id, [targetX, targetY, targetZ])
    })
    
    return positions
  }, [orbitMode, centerNode, orbitingNeighbors])
  
  // Get target position for camera focus
  const targetPosition = useMemo(() => {
    if (!selectedNodeId) return null
    const node = nodes.find(n => n.id === selectedNodeId)
    return node ? new THREE.Vector3(...node.position) : null
  }, [selectedNodeId, nodes])
  
  // Find nearest neighbors for orbit mode
  const findNearestNeighbors = useCallback((centerNodeData: SongData, count: number = 9): SongData[] => {
    const centerNodeWithPosition = nodes.find(n => n.data.id === centerNodeData.id)
    if (!centerNodeWithPosition) return []
    
    const distances = nodes
      .filter(n => n.data.id !== centerNodeData.id)
      .map(n => ({
        data: n.data,
        distance: getDistance(centerNodeWithPosition.position, n.position)
      }))
      .sort((a, b) => a.distance - b.distance)
    
    return distances.slice(0, count).map(d => d.data)
  }, [nodes])
  
  const handleNodeClick = useCallback((node: NodeData) => {
    // Toggle selection - if clicking same node, deselect it
    const isSameNode = selectedNodeId === node.id
    const newSelectedId = isSameNode ? null : node.id
    
    setSelectedNodeId(newSelectedId)
    setIsTransitioning(true)
    onPointClick(isSameNode ? null : node.data)
    
    // Quick transition - no delay
    setIsTransitioning(false)
  }, [selectedNodeId, onPointClick])
  
  const handleNodeDoubleClick = useCallback((node: NodeData) => {
    if (!orbitMode) {
      // Entering orbit mode
      setCenterNode(node.data)
      setOrbitingNeighbors(findNearestNeighbors(node.data, 9))
      setOrbitMode(true)
      // Also select the node
      setSelectedNodeId(node.id)
      onPointClick(node.data)
    } else if (centerNode?.id === node.data.id) {
      // Exiting orbit mode (double-clicked center)
      setOrbitMode(false)
      setCenterNode(null)
      setOrbitingNeighbors([])
      setSelectedNodeId(null)
      onPointClick(null)
    } else if (orbitingNeighbors.some(n => n.id === node.data.id)) {
      // Switching to new center (clicked an orbiting node)
      setCenterNode(node.data)
      setOrbitingNeighbors(findNearestNeighbors(node.data, 9))
      setSelectedNodeId(node.id)
      onPointClick(node.data)
    }
  }, [orbitMode, centerNode, orbitingNeighbors, findNearestNeighbors, onPointClick])
  
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId)
  }, [])
  
  // Build node data for filaments
  const filamentNodes = useMemo(() => {
    return nodes.map(n => ({
      position: n.position,
      data: n.data
    }))
  }, [nodes])
  
  return (
    <>
      {/* Lighting setup for glow effect */}
      <ambientLight intensity={0.2} />
      <pointLight position={[50, 50, 50]} intensity={0.5} color="#68ED9E" />
      <pointLight position={[-50, -50, -50]} intensity={0.3} color="#1E3A8A" />
      <pointLight position={[0, 100, 0]} intensity={0.4} color="#F97316" />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#141619', 30, 150]} />
      
      {/* Deterministic Background stars for seamless crossfade */}
      <DeterministicStars radius={300} depth={100} count={5000} />
      
      {/* Neural filaments (connections) */}
      <NeuralFilaments
        nodes={filamentNodes}
        hoveredNodeId={hoveredNodeId}
        dimmedNodeIds={dimmedNodeIds}
        anchorId={anchorSongId}
        orbitMode={orbitMode}
        centerNode={centerNode}
        orbitingNeighbors={orbitingNeighbors}
        orbitPositions={orbitPositions}
      />
      
      {/* Neural orbs (nodes) - Instanced for performance */}
      <NeuralOrbs
        nodes={nodes}
        anchorSongId={anchorSongId}
        hoveredNodeId={hoveredNodeId}
        dimmedNodeIds={dimmedNodeIds}
        selectedNodeId={selectedNodeId}
        orbitMode={orbitMode}
        centerNode={centerNode}
        orbitingNeighbors={orbitingNeighbors}
        orbitPositions={orbitPositions}
        onNodeClick={(nodeId) => handleNodeClick(nodes.find(n => n.id === nodeId)!)}
        onNodeDoubleClick={(nodeId) => handleNodeDoubleClick(nodes.find(n => n.id === nodeId)!)}
        onNodeHover={handleNodeHover}
      />
      
      {/* Camera controller */}
      <CameraController
        targetPosition={targetPosition}
        isFocusing={isTransitioning}
        orbitMode={orbitMode}
        centerNode={centerNode}
        preview={!!preview}
        screenshotMode={!!screenshotMode}
      />
      
      {/* Bloom post-processing */}
      <EffectComposer enableNormalPass={false}>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={7.0}
          mipmapBlur={true}
        />
      </EffectComposer>

      {/* Scene ready tracker - triggers callback when scene is fully rendered */}
      {onSceneReady && <SceneReadyTracker onReady={onSceneReady} />}
    </>
  )
}

// Export the complete NeuralScene component
export function NeuralScene({
  data,
  onPointClick,
  anchorSongId,
  preview,
  screenshotMode,
  onSceneReady
}: NeuralSceneProps) {
  return (
    <NeuralWeb
      data={data}
      onPointClick={onPointClick}
      anchorSongId={anchorSongId}
      preview={preview}
      screenshotMode={screenshotMode}
      onSceneReady={onSceneReady}
    />
  )
}

export type { SongData, NeuralSceneProps, NodeData }
