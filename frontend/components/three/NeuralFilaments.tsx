'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
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

interface BaseConnection {
  from: NodeData
  to: NodeData
  color: THREE.Color
}

interface Connection extends BaseConnection {
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
  const lineSegmentsRef = useRef<THREE.LineSegments>(null)
  
  // Pre-compute static topology (no hover state dependencies)
  const baseConnections = useMemo(() => {
    // If in orbit mode, render hub-and-spoke connections
    if (orbitMode && centerNode) {
      const result: BaseConnection[] = []
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
        
        result.push({
          from: { position: centerPosition, data: centerNode },
          to: { position: neighborPosition, data: neighbor },
          color: lineColor
        })
      })
      
      return result
    }
    
    // Normal mode: neural web connections
    const result: BaseConnection[] = []
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
          
          result.push({
            from: node,
            to: neighbor,
            color: lineColor
          })
        }
      })
    })
    
    return result
  }, [nodes, orbitMode, centerNode, orbitingNeighbors, orbitPositions])
  
  // Build connections with visual state for position/color arrays
  const connectionsWithVisuals = useMemo<Connection[]>(() => {
    const highlightColor = new THREE.Color('#68ED9E')
    
    return baseConnections.map(conn => {
      const isHighlighted = orbitMode 
        ? true
        : hoveredNodeId === conn.from.data.id || hoveredNodeId === conn.to.data.id
      
      const isDimmed = !orbitMode && (
        dimmedNodeIds.has(conn.from.data.id) || 
        dimmedNodeIds.has(conn.to.data.id)
      )
      
      return {
        ...conn,
        color: isHighlighted ? highlightColor : conn.color,
        isHighlighted,
        isDimmed
      }
    })
  }, [baseConnections, hoveredNodeId, dimmedNodeIds, orbitMode])
  
  // Generate position and color arrays for BufferGeometry
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(connectionsWithVisuals.length * 6)
    const col = new Float32Array(connectionsWithVisuals.length * 6)
    
    connectionsWithVisuals.forEach((conn, i) => {
      // Start vertex
      pos[i * 6 + 0] = conn.from.position[0]
      pos[i * 6 + 1] = conn.from.position[1]
      pos[i * 6 + 2] = conn.from.position[2]
      // End vertex
      pos[i * 6 + 3] = conn.to.position[0]
      pos[i * 6 + 4] = conn.to.position[1]
      pos[i * 6 + 5] = conn.to.position[2]

      // Start color
      col[i * 6 + 0] = conn.color.r
      col[i * 6 + 1] = conn.color.g
      col[i * 6 + 2] = conn.color.b
      // End color
      col[i * 6 + 3] = conn.color.r
      col[i * 6 + 4] = conn.color.g
      col[i * 6 + 5] = conn.color.b
    })
    return { positions: pos, colors: col }
  }, [connectionsWithVisuals])
  
  // Efficient hover state updates - directly mutate color buffer
  useEffect(() => {
    if (!lineSegmentsRef.current || baseConnections.length === 0) return
    
    const colorAttribute = lineSegmentsRef.current.geometry.attributes.color
    const colorArray = colorAttribute.array as Float32Array
    const highlightColor = new THREE.Color('#68ED9E')
    
    // Update colors based on hover state
    baseConnections.forEach((conn, i) => {
      const isHighlighted = orbitMode 
        ? true
        : hoveredNodeId === conn.from.data.id || hoveredNodeId === conn.to.data.id
      
      const targetColor = isHighlighted ? highlightColor : conn.color
      
      // Update start vertex color
      colorArray[i * 6 + 0] = targetColor.r
      colorArray[i * 6 + 1] = targetColor.g
      colorArray[i * 6 + 2] = targetColor.b
      // Update end vertex color
      colorArray[i * 6 + 3] = targetColor.r
      colorArray[i * 6 + 4] = targetColor.g
      colorArray[i * 6 + 5] = targetColor.b
    })
    
    colorAttribute.needsUpdate = true
  }, [baseConnections, hoveredNodeId, orbitMode])
  
  // Update opacity in useFrame for smooth transitions
  useFrame(() => {
    if (!lineSegmentsRef.current) return
    
    const material = lineSegmentsRef.current.material as THREE.LineBasicMaterial
    const targetOpacity = orbitMode ? 0.8 : 0.3
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.1)
  })
  
  if (connectionsWithVisuals.length === 0) return null
  
  return (
    <lineSegments ref={lineSegmentsRef} key={connectionsWithVisuals.length}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position" 
          count={positions.length / 3} 
          array={positions} 
          itemSize={3} 
        />
        <bufferAttribute 
          attach="attributes-color" 
          count={colors.length / 3} 
          array={colors} 
          itemSize={3} 
        />
      </bufferGeometry>
      <lineBasicMaterial 
        vertexColors 
        transparent 
        opacity={orbitMode ? 0.8 : 0.3} 
      />
    </lineSegments>
  )
}

export type { NodeData, Connection }