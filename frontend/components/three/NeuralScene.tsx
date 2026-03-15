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

// Camera controller that smoothly focuses on selected node
function CameraController({
  targetPosition,
  isFocusing
}: {
  targetPosition: THREE.Vector3 | null
  isFocusing: boolean
}) {
  const controlsRef = useRef<CameraControls>(null)
  const { camera } = useThree()
  
  useEffect(() => {
    if (targetPosition && controlsRef.current && isFocusing) {
      // Smoothly move camera to frame the selected node and its cluster
      const offset = new THREE.Vector3(20, 15, 20)
      const newPosition = targetPosition.clone().add(offset)
      
      controlsRef.current.setLookAt(
        newPosition.x, newPosition.y, newPosition.z,
        targetPosition.x, targetPosition.y, targetPosition.z,
        true // enable transition
      )
    }
  }, [targetPosition, isFocusing])
  
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
        const distance = Math.sqrt(
          Math.pow(node.position[0] - hoveredNode.position[0], 2) +
          Math.pow(node.position[1] - hoveredNode.position[1], 2) +
          Math.pow(node.position[2] - hoveredNode.position[2], 2)
        )
        // Consider nodes within 30 units as connected
        if (distance < 30) {
          connectedIds.add(node.id)
        }
      }
    })
    
    // Return IDs of nodes that should be dimmed (not in connected set)
    return new Set(nodes.filter(n => !connectedIds.has(n.id)).map(n => n.id))
  }, [hoveredNodeId, nodes])
  
  // Get target position for camera focus
  const targetPosition = useMemo(() => {
    if (!selectedNodeId) return null
    const node = nodes.find(n => n.id === selectedNodeId)
    return node ? new THREE.Vector3(...node.position) : null
  }, [selectedNodeId, nodes])
  
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
      />
      
      {/* Neural orbs (nodes) */}
      {nodes.map((node, index) => (
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
          onHover={() => handleNodeHover(node.id)}
          onLeave={handleNodeLeave}
          index={index}
        />
      ))}
      
      {/* Camera controller */}
      <CameraController 
        targetPosition={targetPosition} 
        isFocusing={isTransitioning}
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
