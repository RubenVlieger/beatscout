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
  orbitMode,
  centerNode,
  preview,
  screenshotMode,
  dragNodeWorldPos
}: {
  targetPosition: THREE.Vector3 | null
  orbitMode: boolean
  centerNode: SongData | null
  preview: boolean
  screenshotMode?: boolean
  dragNodeWorldPos: THREE.Vector3 | null
}) {
  const controlsRef = useRef<CameraControls>(null)
  const { camera, gl } = useThree()

  // Track state for transitions
  const lastOrbitMode = useRef(orbitMode)
  const lastCenterNode = useRef<SongData | null>(null)
  const isInitialized = useRef(false)
  
  // Animation state for intro rotation (preview mode)
  const isAnimating = useRef(false)
  const animationTimeRef = useRef(0)
  
  useEffect(() => {
    if (!preview) return
    const timer = setTimeout(() => {
      isAnimating.current = true
    }, 1000)
    return () => clearTimeout(timer)
  }, [preview])

  const ANIMATION_DURATION = 300000
  const INITIAL_DISTANCE = CAMERA_RADIUS

  // Preview mode: continuous circular rotation
  useFrame((state, delta) => {
    if (screenshotMode) return
    if (!preview || !isAnimating.current) return

    animationTimeRef.current += delta * 1000
    const elapsed = animationTimeRef.current % ANIMATION_DURATION
    const progress = elapsed / ANIMATION_DURATION
    const fullAngle = progress * Math.PI * 2
    const currentAngle = CAMERA_BASE_ANGLE + fullAngle
    const radius = INITIAL_DISTANCE

    const x = radius * Math.sin(currentAngle) * Math.cos(CAMERA_ELEVATION_ANGLE)
    const z = radius * Math.cos(currentAngle) * Math.cos(CAMERA_ELEVATION_ANGLE)
    const y = radius * Math.sin(CAMERA_ELEVATION_ANGLE)

    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
  })
  
  // Manual orbit: when a node is held, orbit camera around it via canvas pointermove
  useEffect(() => {
    if (!controlsRef.current || preview) return
    if (!dragNodeWorldPos) {
      // Node released — sync CameraControls to wherever manual orbit left the camera
      if (controlsRef.current) {
        const pos = camera.position
        controlsRef.current.setLookAt(pos.x, pos.y, pos.z, 0, 0, 0, false)
      }
      return
    }
    
    const canvas = gl.domElement
    const nodePos = dragNodeWorldPos.clone()
    let startX = 0
    let startY = 0
    let hasStart = false
    let orbiting = false
    const DEAD_ZONE = 3 // pixels before orbit activates
    
    const onPointerMove = (e: PointerEvent) => {
      if (!hasStart) {
        startX = e.clientX
        startY = e.clientY
        hasStart = true
        return
      }
      
      // Dead zone: don't orbit until cursor moves 3+ px from initial position
      if (!orbiting) {
        const dist = Math.sqrt((e.clientX - startX) ** 2 + (e.clientY - startY) ** 2)
        if (dist < DEAD_ZONE) return
        orbiting = true
        // Reset start to current pos so first orbit step isn't a big jump
        startX = e.clientX
        startY = e.clientY
        return
      }
      
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      startX = e.clientX
      startY = e.clientY
      
      // Orbit camera around the node using spherical coordinates
      const sensitivity = 0.005
      const offset = camera.position.clone().sub(nodePos)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      spherical.theta -= dx * sensitivity
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * sensitivity))
      offset.setFromSpherical(spherical)
      camera.position.copy(nodePos).add(offset)
      camera.lookAt(nodePos)
    }
    
    canvas.addEventListener('pointermove', onPointerMove)
    return () => canvas.removeEventListener('pointermove', onPointerMove)
  }, [dragNodeWorldPos, camera, gl, preview])
  
  // Handle orbit mode and focus transitions
  useEffect(() => {
    if (!controlsRef.current) return
    
    const orbitChanged = lastOrbitMode.current !== orbitMode
    const centerChanged = lastCenterNode.current?.id !== centerNode?.id
    
    if (orbitMode && centerNode && (orbitChanged || centerChanged)) {
      // Entering double-click orbit mode — top-down perpendicular to the neighbor ring
      const centerX = ((centerNode.tempo - 120) / 25) * 100 - 50
      const centerY = centerNode.danceability - 50
      const centerZ = centerNode.temperament - 50

      controlsRef.current.setLookAt(
        centerX, centerY, centerZ + 40,
        centerX, centerY, centerZ,
        true
      )
      isAnimating.current = false
    } else if (!orbitMode && orbitChanged) {
      if (preview) {
        isAnimating.current = true
        animationTimeRef.current = 0
      }
    } else if (targetPosition && !orbitMode) {
      // Single-click focus
      const offset = new THREE.Vector3(20, 15, 20)
      const newPosition = targetPosition.clone().add(offset)
      
      controlsRef.current.setLookAt(
        newPosition.x, newPosition.y, newPosition.z,
        targetPosition.x, targetPosition.y, targetPosition.z,
        true
      )
      if (preview) {
        isAnimating.current = false
      }
    }
    
    lastOrbitMode.current = orbitMode
    lastCenterNode.current = centerNode
  }, [targetPosition, orbitMode, centerNode, preview])

  // Initialize camera position on mount
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const [x, y, z] = CAMERA_INITIAL_POSITION
    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()

    if (controlsRef.current) {
      controlsRef.current.setLookAt(x, y, z, 0, 0, 0, false)
    }
  }, [camera])

  const isPreviewMode = preview || screenshotMode
  // Disable CameraControls during orbit mode AND during manual drag-orbit
  const controlsDisabled = orbitMode || !!dragNodeWorldPos

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={!controlsDisabled}
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
  
  // Double-click orbit mode state (shows center node + neighbors in ring)
  const [orbitMode, setOrbitMode] = useState(false)
  const [centerNode, setCenterNode] = useState<SongData | null>(null)
  const [orbitingNeighbors, setOrbitingNeighbors] = useState<SongData[]>([])
  
  // Press-and-hold drag orbit state (orbits camera around held node)
  const [dragOrbitNodeId, setDragOrbitNodeId] = useState<string | null>(null)
  
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
  
  // Get target position for camera focus (single-click)
  const targetPosition = useMemo(() => {
    if (!selectedNodeId) return null
    const node = nodes.find(n => n.id === selectedNodeId)
    return node ? new THREE.Vector3(...node.position) : null
  }, [selectedNodeId, nodes])
  
  // Get drag-orbit target position (press-and-hold on a node)
  const dragNodeWorldPos = useMemo(() => {
    if (!dragOrbitNodeId) return null
    const node = nodes.find(n => n.id === dragOrbitNodeId)
    return node ? new THREE.Vector3(...node.position) : null
  }, [dragOrbitNodeId, nodes])
  
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
    const isSameNode = selectedNodeId === node.id
    setSelectedNodeId(isSameNode ? null : node.id)
    onPointClick(isSameNode ? null : node.data)
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
  
  // Press-and-hold: set drag orbit node immediately.
  // Dead zone in the orbit handler prevents jitter on click/double-click.
  const handleNodePointerDown = useCallback((nodeId: string) => {
    if (orbitMode) return
    setDragOrbitNodeId(nodeId)
    setHoveredNodeId(null)
  }, [orbitMode])
  
  const handleNodePointerUp = useCallback(() => {
    setDragOrbitNodeId(null)
  }, [])
  
  // Safety: clear drag state on global pointer-up (e.g. mouse released outside canvas)
  useEffect(() => {
    const handleGlobalPointerUp = () => setDragOrbitNodeId(null)
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
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
        onNodePointerDown={handleNodePointerDown}
        onNodePointerUp={handleNodePointerUp}
        dragOrbitNodeId={dragOrbitNodeId}
      />
      
      {/* Camera controller */}
      <CameraController
        targetPosition={targetPosition}
        orbitMode={orbitMode}
        centerNode={centerNode}
        preview={!!preview}
        screenshotMode={!!screenshotMode}
        dragNodeWorldPos={dragNodeWorldPos}
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
