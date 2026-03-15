'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { SongData } from './NeuralOrb'

interface NodeData {
  position: [number, number, number]
  data: SongData
}

interface NeuralFilamentsProps {
  nodes: NodeData[]
  hoveredNodeId: string | null
  dimmedNodeIds: Set<string>
  anchorId: string
  orbitMode: boolean
  centerNode: SongData | null
  orbitingNeighbors: SongData[]
  orbitPositions: Map<string, [number, number, number]>
}

// Calculate Euclidean distance between two 3D points
function getDistance(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p1[0] - p2[0]
  const dy = p1[1] - p2[1]
  const dz = p1[2] - p2[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Find nearest neighbors for a node
function findNearestNeighbors(
  node: NodeData,
  allNodes: NodeData[],
  count: number
): NodeData[] {
  const distances = allNodes
    .filter(n => n.data.id !== node.data.id)
    .map(n => ({
      node: n,
      distance: getDistance(node.position, n.position)
    }))
    .sort((a, b) => a.distance - b.distance)
  
  return distances.slice(0, count).map(d => d.node)
}

interface Connection {
  from: NodeData
  to: NodeData
  color: THREE.Color
  isHighlighted: boolean
  isDimmed: boolean
  isOrbitConnection?: boolean
}

export function NeuralFilaments({
  nodes,
  hoveredNodeId,
  dimmedNodeIds,
  anchorId,
  orbitMode,
  centerNode,
  orbitingNeighbors,
  orbitPositions
}: NeuralFilamentsProps) {
  // Calculate connections based on mode
  const connections = useMemo(() => {
    // If in orbit mode, render hub-and-spoke connections
    if (orbitMode && centerNode) {
      const result: Connection[] = []
      const centerNodeData = nodes.find(n => n.data.id === centerNode.id)
      
      if (!centerNodeData) return result
      
      // Get center position (original or animated based on orbit)
      const centerX = ((centerNode.tempo - 120) / 25) * 100 - 50
      const centerY = centerNode.danceability - 50
      const centerZ = centerNode.temperament - 50
      const centerPosition: [number, number, number] = [centerX, centerY, centerZ]
      
      // Create connections from center to each orbiting neighbor
      orbitingNeighbors.forEach(neighbor => {
        const neighborNode = nodes.find(n => n.data.id === neighbor.id)
        if (!neighborNode) return
        
        // Use orbit position if available, otherwise use original position
        const neighborPosition = orbitPositions.get(neighbor.id) || neighborNode.position
        
        // Color based on production quality
        const quality = neighbor.production_quality / 100
        const lineColor = new THREE.Color().lerpColors(
          new THREE.Color('#1E3A8A'),
          new THREE.Color('#F97316'),
          quality
        )
        
        // Hub and spoke connections are always highlighted
        result.push({
          from: { position: centerPosition, data: centerNode },
          to: { position: neighborPosition, data: neighbor },
          color: lineColor,
          isHighlighted: true,
          isDimmed: false,
          isOrbitConnection: true
        })
      })
      
      return result
    }
    
    // Normal mode: neural web connections
    const result: Connection[] = []
    const processedPairs = new Set<string>()
    
    nodes.forEach(node => {
      // Dynamic connection count based on production quality (3-8 connections)
      const qualityFactor = node.data.production_quality / 100
      const connectionCount = Math.floor(3 + qualityFactor * 5)
      
      const neighbors = findNearestNeighbors(node, nodes, connectionCount)
      
      neighbors.forEach(neighbor => {
        // Create unique pair ID to avoid duplicates
        const pairId = [node.data.id, neighbor.data.id].sort().join('-')
        
        if (!processedPairs.has(pairId)) {
          processedPairs.add(pairId)
          
          // Color interpolation between the two nodes
          const fromColor = new THREE.Color().lerpColors(
            new THREE.Color('#1E3A8A'),
            new THREE.Color('#F97316'),
            node.data.production_quality / 100
          )
          
          const toColor = new THREE.Color().lerpColors(
            new THREE.Color('#1E3A8A'),
            new THREE.Color('#F97316'),
            neighbor.data.production_quality / 100
          )
          
          const lineColor = new THREE.Color().lerpColors(fromColor, toColor, 0.5)
          
          // Determine if this connection should be highlighted
          const isHighlighted = 
            hoveredNodeId === node.data.id || 
            hoveredNodeId === neighbor.data.id
          
          // Determine if this connection should be dimmed
          const isDimmed = 
            dimmedNodeIds.has(node.data.id) || 
            dimmedNodeIds.has(neighbor.data.id)
          
          result.push({
            from: node,
            to: neighbor,
            color: isHighlighted ? new THREE.Color('#68ED9E') : lineColor,
            isHighlighted,
            isDimmed
          })
        }
      })
    })
    
    return result
  }, [nodes, hoveredNodeId, dimmedNodeIds, orbitMode, centerNode, orbitingNeighbors, orbitPositions])
  
  return (
    <group>
      {connections.map((connection, index) => (
        <FilamentLine 
          key={`${connection.from.data.id}-${connection.to.data.id}-${index}`}
          connection={connection}
          orbitMode={orbitMode}
        />
      ))}
    </group>
  )
}

// Individual filament component with animation
function FilamentLine({ connection, orbitMode }: { connection: Connection; orbitMode: boolean }) {
  const lineRef = useRef<any>(null)
  
  // Calculate opacity based on state
  const targetOpacity = orbitMode
    ? 0.8 // Orbit mode connections are always bright
    : connection.isHighlighted 
      ? 0.8 
      : connection.isDimmed 
        ? 0.05 
        : 0.15
  
  const targetLineWidth = orbitMode
    ? 2 // Orbit mode uses consistent width
    : connection.isHighlighted 
      ? 3 
      : 1
  
  useFrame(() => {
    if (lineRef.current) {
      // Smoothly interpolate line width
      lineRef.current.material.linewidth = THREE.MathUtils.lerp(
        lineRef.current.material.linewidth || 1,
        targetLineWidth,
        0.1
      )
    }
  })
  
  const points = useMemo(() => {
    return [connection.from.position, connection.to.position].map(
      p => new THREE.Vector3(...p)
    )
  }, [connection.from.position, connection.to.position])
  
  return (
    <Line
      ref={lineRef}
      points={points}
      color={connection.color}
      lineWidth={targetLineWidth}
      transparent
      opacity={targetOpacity}
    />
  )
}

export type { NodeData, Connection }
