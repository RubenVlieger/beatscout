'use client'

import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { CameraControls, Html, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { SongData } from './NeuralOrb'
import { NeuralOrb } from './NeuralOrb'
import { NeuralFilaments } from './NeuralFilaments'

// Types
interface NeuralSceneProps {
  data: SongData[]
  onPointClick: (song: SongData | null) => void
  anchorSongId: string
}

interface NodeData {
  id: string
  position: [number, number, number]
  color: THREE.Color
  data: SongData
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
  centerNode
}: {
  targetPosition: THREE.Vector3 | null
  isFocusing: boolean
  orbitMode: boolean
  centerNode: SongData | null
}) {
  const controlsRef = useRef<CameraControls>(null)
  const { camera } = useThree()
  const initialPosition = useRef(new THREE.Vector3(60, 60, 60))
  
  // Track if we need to animate camera
  const lastOrbitMode = useRef(orbitMode)
  const lastCenterNode = useRef<SongData | null>(null)
  
  useEffect(() => {
    if (!controlsRef.current) return
    
    // Check if orbit mode or center node changed
    const orbitChanged = lastOrbitMode.current !== orbitMode
    const centerChanged = lastCenterNode.current?.id !== centerNode?.id
    
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
    } else if (!orbitMode && orbitChanged) {
      // Exiting orbit mode - return to default isometric view
      controlsRef.current.setLookAt(
        initialPosition.current.x, initialPosition.current.y, initialPosition.current.z,
        0, 0, 0,
        true // enable transition
      )
    } else if (targetPosition && isFocusing && !orbitMode) {
      // Normal focus mode (single click)
      const offset = new THREE.Vector3(20, 15, 20)
      const newPosition = targetPosition.clone().add(offset)
      
      controlsRef.current.setLookAt(
        newPosition.x, newPosition.y, newPosition.z,
        targetPosition.x, targetPosition.y, targetPosition.z,
        true // enable transition
      )
    }
    
    lastOrbitMode.current = orbitMode
    lastCenterNode.current = centerNode
  }, [targetPosition, isFocusing, orbitMode, centerNode])
  
  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={10}
      maxDistance={200}
      restThreshold={0.01}
      smoothTime={0.5}
      draggingSmoothTime={0.1}
    />
  )
}

// Main scene component
function NeuralWeb({
  data,
  onPointClick,
  anchorSongId
}: NeuralSceneProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // Orbit mode state
  const [orbitMode, setOrbitMode] = useState(false)
  const [centerNode, setCenterNode] = useState<SongData | null>(null)
  const [orbitingNeighbors, setOrbitingNeighbors] = useState<SongData[]>([])
  
  // Process nodes with positions and colors
  const nodes = useMemo<NodeData[]>(() => {
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
      
      return {
        id: song.id,
        position: [x, y, z] as [number, number, number],
        color,
        data: song
      }
    })
  }, [data])
  
  // Calculate which nodes should be dimmed
  const dimmedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>()
    
    // Find the hovered node's neighbors
    const hoveredNode = nodes.find(n => n.id === hoveredNodeId)
    if (!hoveredNode) return new Set<string>()
    
    // Calculate distances to find connected nodes
    const connectedIds = new Set<string>([hoveredNodeId])
    
    nodes.forEach(node => {
      if (node.id !== hoveredNodeId) {
        const distance = getDistance(node.position, hoveredNode.position)
        // Consider nodes within 30 units as connected
        if (distance < 30) {
          connectedIds.add(node.id)
        }
      }
    })
    
    // Return IDs of nodes that should be dimmed (not in connected set)
    return new Set(nodes.filter(n => !connectedIds.has(n.id)).map(n => n.id))
  }, [hoveredNodeId, nodes])
  
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
  
  const handleNodeHover = useCallback((nodeId: string) => {
    setHoveredNodeId(nodeId)
  }, [])
  
  const handleNodeLeave = useCallback(() => {
    setHoveredNodeId(null)
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
      
      {/* Background stars for atmosphere */}
      <Stars 
        radius={200} 
        depth={50} 
        count={1000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={0.5}
      />
      
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
      
      {/* Neural orbs (nodes) */}
      {nodes.map((node, index) => {
        const isCenter = centerNode?.id === node.id
        const isOrbiting = orbitingNeighbors.some(n => n.id === node.id)
        const shouldHide = orbitMode && !isCenter && !isOrbiting
        const orbitPosition = isOrbiting ? orbitPositions.get(node.id) || null : null
        
        return (
          <NeuralOrb
            key={node.id}
            position={node.position}
            color={node.color}
            data={node.data}
            isAnchor={node.id === anchorSongId}
            isHovered={hoveredNodeId === node.id}
            isDimmed={dimmedNodeIds.has(node.id)}
            isSelected={selectedNodeId === node.id}
            onClick={() => handleNodeClick(node)}
            onDoubleClick={() => handleNodeDoubleClick(node)}
            onHover={() => handleNodeHover(node.id)}
            onLeave={handleNodeLeave}
            index={index}
            orbitMode={orbitMode}
            isCenter={isCenter}
            isOrbiting={isOrbiting}
            shouldHide={shouldHide}
            orbitPosition={orbitPosition}
          />
        )
      })}
      
      {/* Camera controller */}
      <CameraController 
        targetPosition={targetPosition} 
        isFocusing={isTransitioning}
        orbitMode={orbitMode}
        centerNode={centerNode}
      />
      
      {/* Bloom post-processing */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          height={300}
          intensity={1.5}
        />
      </EffectComposer>
    </>
  )
}

// Export the complete NeuralScene component
export function NeuralScene({
  data,
  onPointClick,
  anchorSongId
}: NeuralSceneProps) {
  return (
    <NeuralWeb
      data={data}
      onPointClick={onPointClick}
      anchorSongId={anchorSongId}
    />
  )
}

export type { SongData, NeuralSceneProps, NodeData }
