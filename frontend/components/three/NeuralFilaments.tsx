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
}

export function NeuralFilaments({
  nodes,
  hoveredNodeId,
  dimmedNodeIds,
  anchorId
}: NeuralFilamentsProps) {
  const connections = useMemo(() => {
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
  }, [nodes, hoveredNodeId, dimmedNodeIds])
  
  return (
    <group>
      {connections.map((connection, index) => (
        <FilamentLine 
          key={`${connection.from.data.id}-${connection.to.data.id}-${index}`}
          connection={connection}
        />
      ))}
    </group>
  )
}

// Individual filament component with animation
function FilamentLine({ connection }: { connection: Connection }) {
  const lineRef = useRef<any>(null)
  
  // Calculate opacity based on state
  const targetOpacity = connection.isHighlighted 
    ? 0.8 
    : connection.isDimmed 
      ? 0.05 
      : 0.15
  
  const targetLineWidth = connection.isHighlighted ? 3 : 1
  
  useFrame(() => {
    if (lineRef.current) {
      // Smoothly interpolate line width for highlighted connections
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
