'use client'

import { useRef, useMemo, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Play } from 'lucide-react'
import { damp3 } from '@/lib/easing'
import type { SongData } from './NeuralOrb'

// Shared geometry - created once per app lifecycle
const orbGeometry = new THREE.SphereGeometry(1, 16, 16)

// Shared uniforms for vertex shader animations
const customUniforms = { uTime: { value: 0 } }

// Anchor Ring component that updates position every frame
function AnchorRing({ 
  anchorSongId, 
  globalIndexMap, 
  currentPositions 
}: { 
  anchorSongId: string
  globalIndexMap: Map<string, number>
  currentPositions: React.MutableRefObject<Float32Array | undefined>
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const anchorIdx = globalIndexMap.get(anchorSongId)
  
  useFrame(() => {
    if (!meshRef.current || anchorIdx === undefined || !currentPositions.current) return
    meshRef.current.position.set(
      currentPositions.current[anchorIdx * 3],
      currentPositions.current[anchorIdx * 3 + 1],
      currentPositions.current[anchorIdx * 3 + 2]
    )
  })
  
  if (anchorIdx === undefined || !currentPositions.current) return null
  
  const pos: [number, number, number] = [
    currentPositions.current[anchorIdx * 3],
    currentPositions.current[anchorIdx * 3 + 1],
    currentPositions.current[anchorIdx * 3 + 2]
  ]
  
  return (
    <mesh ref={meshRef} position={pos}>
      <torusGeometry args={[2.5, 0.05, 16, 100]} />
      <meshStandardMaterial
        color="#39FF14"
        emissive="#39FF14"
        emissiveIntensity={2}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}

// Apply breathing animation and colored emission - uses built-in instanceColor
const applyInstancingShader = (shader: THREE.Shader) => {
  shader.uniforms.uTime = customUniforms.uTime;

  // Inject uniform declaration in vertex shader
  shader.vertexShader = `
    uniform float uTime;
    ${shader.vertexShader}
  `;

  // Inject breathing animation in vertex shader
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    transformed.y += sin( uTime * 0.4 + float( gl_InstanceID ) * 0.2 ) * 0.5;
    `
  );

  // Inject colored emission in fragment shader
  // Multiply emissive color by instance color so emission matches the orb's color
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `
    #include <emissivemap_fragment>
    totalEmissiveRadiance *= vColor;
    `
  );
};

// Quality-tier materials with enhanced emissive contrast
// High quality glows aggressively, low quality is significantly dimmer
const qualityMaterials = {
  high: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.8,
    roughness: 0.05,
    metalness: 0.95,
    transparent: true
  }),
  medium: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.7,
    transparent: true
  }),
  low: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.15,
    roughness: 0.7,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7
  })
}

// Apply instancing shader for breathing animation only
qualityMaterials.high.onBeforeCompile = applyInstancingShader
qualityMaterials.medium.onBeforeCompile = applyInstancingShader
qualityMaterials.low.onBeforeCompile = applyInstancingShader

interface NeuralOrbData {
  id: string
  position: [number, number, number]
  color: THREE.Color
  colorHex: string
  data: SongData
  quality: 'high' | 'medium' | 'low'
  bobbingSpeed: number
  emissiveIntensity: number
}

interface NeuralOrbsProps {
  nodes: NeuralOrbData[]
  anchorSongId: string
  hoveredNodeId: string | null
  dimmedNodeIds: Set<string>
  selectedNodeId: string | null
  orbitMode: boolean
  centerNode: SongData | null
  orbitingNeighbors: SongData[]
  orbitPositions: Map<string, [number, number, number]>
  onNodeClick: (nodeId: string) => void
  onNodeDoubleClick: (nodeId: string) => void
  onNodeHover: (nodeId: string | null) => void
  onNodePointerDown: (nodeId: string) => void
  onNodePointerUp: () => void
  dragOrbitNodeId: string | null
}

export function NeuralOrbs({
  nodes,
  anchorSongId,
  hoveredNodeId,
  dimmedNodeIds,
  selectedNodeId,
  orbitMode,
  centerNode,
  orbitingNeighbors,
  orbitPositions,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  onNodePointerDown,
  onNodePointerUp,
  dragOrbitNodeId
}: NeuralOrbsProps) {
  // Three.js hooks
  const { camera, size } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointer = useMemo(() => new THREE.Vector2(), [])
  
  // Separate refs for each quality tier
  const highOrbRef = useRef<THREE.InstancedMesh>(null)
  const mediumOrbRef = useRef<THREE.InstancedMesh>(null)
  const lowOrbRef = useRef<THREE.InstancedMesh>(null)
  
  // Group ref for scene-level raycasting
  const groupRef = useRef<THREE.Group>(null)
  
  // Track hover state
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoveredNodeRef = useRef<string | null>(null)
  const hoverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Track which nodes need animation updates (hover, selection, orbit mode transitions)
  const animatingNodesRef = useRef<Set<string>>(new Set())
  const prevOrbitModeRef = useRef(orbitMode)
  
  // Group nodes by quality tier
  const qualityGroups = useMemo(() => {
    const high: NeuralOrbData[] = []
    const medium: NeuralOrbData[] = []
    const low: NeuralOrbData[] = []
    
    nodes.forEach(node => {
      if (node.quality === 'high') high.push(node)
      else if (node.quality === 'medium') medium.push(node)
      else low.push(node)
    })
    
    return { high, medium, low }
  }, [nodes])
  
  // Build quality -> global index map for raycast result mapping
  const qualityToGlobalMap = useMemo(() => {
    const high = new Map<number, string>() // instanceId -> nodeId
    const medium = new Map<number, string>()
    const low = new Map<number, string>()
    
    qualityGroups.high.forEach((node, i) => high.set(i, node.id))
    qualityGroups.medium.forEach((node, i) => medium.set(i, node.id))
    qualityGroups.low.forEach((node, i) => low.set(i, node.id))
    
    return { high, medium, low }
  }, [qualityGroups])
  
  // Build index mappings for each quality group
  const indexMappings = useMemo(() => {
    const highMap = new Map<string, number>()
    const mediumMap = new Map<string, number>()
    const lowMap = new Map<string, number>()
    
    qualityGroups.high.forEach((node, i) => highMap.set(node.id, i))
    qualityGroups.medium.forEach((node, i) => mediumMap.set(node.id, i))
    qualityGroups.low.forEach((node, i) => lowMap.set(node.id, i))
    
    return { highMap, mediumMap, lowMap }
  }, [qualityGroups])
  
  // Build global node index map
  const globalIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    nodes.forEach((node, i) => map.set(node.id, i))
    return map
  }, [nodes])
  
  // Track current positions and scales for animation
  const currentPositions = useRef<Float32Array>()
  const currentScales = useRef<Float32Array>()
  
  // Initialize position/scale buffers
  useMemo(() => {
    currentPositions.current = new Float32Array(nodes.length * 3)
    currentScales.current = new Float32Array(nodes.length)
    
    nodes.forEach((node, i) => {
      currentPositions.current![i * 3] = node.position[0]
      currentPositions.current![i * 3 + 1] = node.position[1]
      currentPositions.current![i * 3 + 2] = node.position[2]
      currentScales.current![i] = 1
    })
  }, [nodes])
  
  // Initialize instance matrices and colors on mount
  useEffect(() => {
    const tempMatrix = new THREE.Matrix4()
    
    // Initialize high quality orbs
    if (highOrbRef.current) {
      qualityGroups.high.forEach((node, i) => {
        tempMatrix.makeTranslation(node.position[0], node.position[1], node.position[2])
        highOrbRef.current!.setMatrixAt(i, tempMatrix)
        highOrbRef.current!.setColorAt(i, node.color)
      })
      highOrbRef.current.instanceMatrix.needsUpdate = true
      if (highOrbRef.current.instanceColor) {
        highOrbRef.current.instanceColor.needsUpdate = true
      }
    }
    
    // Initialize medium quality orbs
    if (mediumOrbRef.current) {
      qualityGroups.medium.forEach((node, i) => {
        tempMatrix.makeTranslation(node.position[0], node.position[1], node.position[2])
        mediumOrbRef.current!.setMatrixAt(i, tempMatrix)
        mediumOrbRef.current!.setColorAt(i, node.color)
      })
      mediumOrbRef.current.instanceMatrix.needsUpdate = true
      if (mediumOrbRef.current.instanceColor) {
        mediumOrbRef.current.instanceColor.needsUpdate = true
      }
    }
    
    // Initialize low quality orbs
    if (lowOrbRef.current) {
      qualityGroups.low.forEach((node, i) => {
        tempMatrix.makeTranslation(node.position[0], node.position[1], node.position[2])
        lowOrbRef.current!.setMatrixAt(i, tempMatrix)
        lowOrbRef.current!.setColorAt(i, node.color)
      })
      lowOrbRef.current.instanceMatrix.needsUpdate = true
      if (lowOrbRef.current.instanceColor) {
        lowOrbRef.current.instanceColor.needsUpdate = true
      }
    }
  }, [qualityGroups, nodes])
  
  // Detect nodes that need animation updates
  useEffect(() => {
    // Orbit mode transition - all nodes need animation
    if (prevOrbitModeRef.current !== orbitMode) {
      nodes.forEach(node => animatingNodesRef.current.add(node.id))
      prevOrbitModeRef.current = orbitMode
      return
    }
    
    // Hover changes - mark affected nodes
    if (hoveredNodeId) {
      animatingNodesRef.current.add(hoveredNodeId)
      // Also animate neighbors for scale changes
      const hoveredNode = nodes.find(n => n.id === hoveredNodeId)
      if (hoveredNode) {
        // Add all nodes for now (simplification - could be optimized to only neighbors)
        nodes.forEach(n => animatingNodesRef.current.add(n.id))
      }
    }
    
    // Selection changes
    if (selectedNodeId) {
      animatingNodesRef.current.add(selectedNodeId)
    }
    
    // Center node changes in orbit mode
    if (centerNode?.id) {
      animatingNodesRef.current.add(centerNode.id)
    }
    
    // Orbiting neighbors
    orbitingNeighbors.forEach(n => animatingNodesRef.current.add(n.id))
  }, [hoveredNodeId, selectedNodeId, centerNode, orbitingNeighbors, orbitMode, nodes])
  
  // Helper to get target position WITHOUT breathing offset (now handled in GPU)
  const getTargetPosition = useCallback((node: NeuralOrbData, index: number): [number, number, number] => {
    if (orbitMode) {
      const isCenter = centerNode?.id === node.id
      const isOrbiting = orbitingNeighbors.some(n => n.id === node.id)
      
      if (isCenter) {
        return node.position
      }
      
      if (isOrbiting) {
        const orbitPos = orbitPositions.get(node.id)
        if (orbitPos) {
          return orbitPos
        }
      }
    }
    
    return node.position
  }, [orbitMode, centerNode, orbitingNeighbors, orbitPositions])
  
  // Helper to get target scale
  const getTargetScale = useCallback((node: NeuralOrbData): number => {
    const isAnchor = node.id === anchorSongId
    const isHovered = hoveredNodeId === node.id
    const isSelected = selectedNodeId === node.id
    const isCenter = centerNode?.id === node.id
    const isOrbiting = orbitingNeighbors.some(n => n.id === node.id)
    const shouldHide = orbitMode && !isCenter && !isOrbiting
    const isDimmed = dimmedNodeIds.has(node.id)
    
    if (shouldHide) return 0
    
    const baseScale = isAnchor ? 1.2 : 1.0
    const hoverScale = isHovered ? 1.8 : 1.0
    const selectionScale = isSelected ? 1.5 : 1.0
    const centerScale = isCenter ? 2.0 : 1.0
    const orbitingScale = isOrbiting ? 1.2 : 1.0
    const dimmedScale = isDimmed ? 0.7 : 1.0
    const defaultScale = isAnchor ? 1.5 : 0.8
    
    return baseScale * hoverScale * selectionScale * centerScale * orbitingScale * dimmedScale * defaultScale
  }, [anchorSongId, hoveredNodeId, selectedNodeId, centerNode, orbitingNeighbors, orbitMode, dimmedNodeIds])
  
  // Helper to get target opacity
  const getTargetOpacity = useCallback((node: NeuralOrbData): number => {
    const isCenter = centerNode?.id === node.id
    const isOrbiting = orbitingNeighbors.some(n => n.id === node.id)
    const shouldHide = orbitMode && !isCenter && !isOrbiting
    
    if (shouldHide) return 0
    return dimmedNodeIds.has(node.id) ? 0.3 : 1.0
  }, [centerNode, orbitingNeighbors, orbitMode, dimmedNodeIds])
  
  // Batch animation update - ONLY update animating nodes
  useFrame((state, delta) => {
    if (!highOrbRef.current || !mediumOrbRef.current || !lowOrbRef.current) return
    
    // Update shared time uniform for GPU breathing animation
    customUniforms.uTime.value = state.clock.elapsedTime
    
    const tempVector = new THREE.Vector3()
    const tempMatrix = new THREE.Matrix4()
    const tempColor = new THREE.Color()
    const tempScale = new THREE.Vector3()
    
    let needsUpdate = false
    
    // Update high quality orbs - only those that need animation
    qualityGroups.high.forEach((node, i) => {
      const globalIdx = globalIndexMap.get(node.id)!
      const targetPos = getTargetPosition(node, globalIdx)
      const targetScale = getTargetScale(node)
      const targetOpacity = getTargetOpacity(node)
      
      const currentIdx = globalIdx * 3
      const currentX = currentPositions.current![currentIdx]
      const currentY = currentPositions.current![currentIdx + 1]
      const currentZ = currentPositions.current![currentIdx + 2]
      const currentScale = currentScales.current![globalIdx]
      
      // Check if this node needs animation (transitions, hover, orbit mode)
      const needsAnim = animatingNodesRef.current.has(node.id) || 
                        Math.abs(targetPos[0] - currentX) > 0.01 ||
                        Math.abs(targetPos[1] - currentY) > 0.01 ||
                        Math.abs(targetPos[2] - currentZ) > 0.01 ||
                        Math.abs(targetScale - currentScale) > 0.01
      
      if (needsAnim) {
        needsUpdate = true
        
        damp3(
          tempVector.set(currentX, currentY, currentZ),
          targetPos,
          0.15,
          delta
        )
        
        currentPositions.current![currentIdx] = tempVector.x
        currentPositions.current![currentIdx + 1] = tempVector.y
        currentPositions.current![currentIdx + 2] = tempVector.z
        
        currentScales.current![globalIdx] = THREE.MathUtils.lerp(currentScale, targetScale, 0.1)
        
        tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z)
        const scaleVal = currentScales.current![globalIdx]
        tempScale.set(scaleVal, scaleVal, scaleVal)
        tempMatrix.scale(tempScale)
        highOrbRef.current!.setMatrixAt(i, tempMatrix)

        // Update color with emissive boost
        const emissiveBoost = 1 + (selectedNodeId === node.id ? 0.5 : 0) + (centerNode?.id === node.id ? 0.8 : 0)
        tempColor.copy(node.color).multiplyScalar(emissiveBoost)
        highOrbRef.current!.setColorAt(i, tempColor)
      }
    })

    // Update medium quality orbs - only those that need animation
    qualityGroups.medium.forEach((node, i) => {
      const globalIdx = globalIndexMap.get(node.id)!
      const targetPos = getTargetPosition(node, globalIdx)
      const targetScale = getTargetScale(node)
      
      const currentIdx = globalIdx * 3
      const currentX = currentPositions.current![currentIdx]
      const currentY = currentPositions.current![currentIdx + 1]
      const currentZ = currentPositions.current![currentIdx + 2]
      const currentScale = currentScales.current![globalIdx]
      
      const needsAnim = animatingNodesRef.current.has(node.id) || 
                        Math.abs(targetPos[0] - currentX) > 0.01 ||
                        Math.abs(targetPos[1] - currentY) > 0.01 ||
                        Math.abs(targetPos[2] - currentZ) > 0.01 ||
                        Math.abs(targetScale - currentScale) > 0.01
      
      if (needsAnim) {
        needsUpdate = true
        
        damp3(
          tempVector.set(currentX, currentY, currentZ),
          targetPos,
          0.15,
          delta
        )
        
        currentPositions.current![currentIdx] = tempVector.x
        currentPositions.current![currentIdx + 1] = tempVector.y
        currentPositions.current![currentIdx + 2] = tempVector.z
        
        currentScales.current![globalIdx] = THREE.MathUtils.lerp(currentScale, targetScale, 0.1)
        
        tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z)
        const scaleVal = currentScales.current![globalIdx]
        tempScale.set(scaleVal, scaleVal, scaleVal)
        tempMatrix.scale(tempScale)
        mediumOrbRef.current!.setMatrixAt(i, tempMatrix)

        const emissiveBoost = 1 + (selectedNodeId === node.id ? 0.5 : 0) + (centerNode?.id === node.id ? 0.8 : 0)
        tempColor.copy(node.color).multiplyScalar(emissiveBoost)
        mediumOrbRef.current!.setColorAt(i, tempColor)
      }
    })

    // Update low quality orbs - only those that need animation
    qualityGroups.low.forEach((node, i) => {
      const globalIdx = globalIndexMap.get(node.id)!
      const targetPos = getTargetPosition(node, globalIdx)
      const targetScale = getTargetScale(node)
      
      const currentIdx = globalIdx * 3
      const currentX = currentPositions.current![currentIdx]
      const currentY = currentPositions.current![currentIdx + 1]
      const currentZ = currentPositions.current![currentIdx + 2]
      const currentScale = currentScales.current![globalIdx]
      
      const needsAnim = animatingNodesRef.current.has(node.id) || 
                        Math.abs(targetPos[0] - currentX) > 0.01 ||
                        Math.abs(targetPos[1] - currentY) > 0.01 ||
                        Math.abs(targetPos[2] - currentZ) > 0.01 ||
                        Math.abs(targetScale - currentScale) > 0.01
      
      if (needsAnim) {
        needsUpdate = true
        
        damp3(
          tempVector.set(currentX, currentY, currentZ),
          targetPos,
          0.15,
          delta
        )
        
        currentPositions.current![currentIdx] = tempVector.x
        currentPositions.current![currentIdx + 1] = tempVector.y
        currentPositions.current![currentIdx + 2] = tempVector.z
        
        currentScales.current![globalIdx] = THREE.MathUtils.lerp(currentScale, targetScale, 0.1)
        
        tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z)
        const scaleVal = currentScales.current![globalIdx]
        tempScale.set(scaleVal, scaleVal, scaleVal)
        tempMatrix.scale(tempScale)
        lowOrbRef.current!.setMatrixAt(i, tempMatrix)

        const emissiveBoost = 1 + (selectedNodeId === node.id ? 0.5 : 0) + (centerNode?.id === node.id ? 0.8 : 0)
        tempColor.copy(node.color).multiplyScalar(emissiveBoost)
        lowOrbRef.current!.setColorAt(i, tempColor)
      }
    })
    
    // Only mark updates if something changed
    if (needsUpdate) {
      highOrbRef.current.instanceMatrix.needsUpdate = true
      highOrbRef.current.instanceColor!.needsUpdate = true
      mediumOrbRef.current.instanceMatrix.needsUpdate = true
      mediumOrbRef.current.instanceColor!.needsUpdate = true
      lowOrbRef.current.instanceMatrix.needsUpdate = true
      lowOrbRef.current.instanceColor!.needsUpdate = true
    }
    
    // Clear animation set after processing
    animatingNodesRef.current.clear()
  })
  
  // Find node by quality tier and instance ID
  const getNodeByQualityAndInstanceId = useCallback((quality: 'high' | 'medium' | 'low', instanceId: number): NeuralOrbData | undefined => {
    if (quality === 'high') return qualityGroups.high[instanceId]
    if (quality === 'medium') return qualityGroups.medium[instanceId]
    return qualityGroups.low[instanceId]
  }, [qualityGroups])
  
  // Scene-level raycasting for accurate depth-based hover selection
  const handleScenePointerMove = useCallback((event: { pointer: { x: number; y: number } }) => {
    // Suppress hover updates while drag-orbiting to prevent tooltip flickering
    if (dragOrbitNodeId) return
    
    // Update pointer coordinates from event
    const { x, y } = event.pointer
    pointer.set(x, y)
    
    // Set ray from camera through pointer
    raycaster.setFromCamera(pointer, camera)
    
    // Collect intersections from all three quality meshes
    const intersections: THREE.Intersection[] = []
    
    if (highOrbRef.current) {
      raycaster.intersectObject(highOrbRef.current, false, intersections)
    }
    if (mediumOrbRef.current) {
      raycaster.intersectObject(mediumOrbRef.current, false, intersections)
    }
    if (lowOrbRef.current) {
      raycaster.intersectObject(lowOrbRef.current, false, intersections)
    }
    
    // If no intersections, schedule hover clear
    if (intersections.length === 0) {
      if (!hoverTimeoutRef.current && hoveredNodeRef.current !== null) {
        hoverTimeoutRef.current = setTimeout(() => {
          onNodeHover(null)
          hoveredNodeRef.current = null
          hoverTimeoutRef.current = null
        }, 50)
      }
      return
    }
    
    // Cancel any pending hover clear since we're hovering something
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    
    // Sort by distance and get closest
    intersections.sort((a, b) => a.distance - b.distance)
    const closest = intersections[0]
    
    if (!closest || typeof closest.instanceId !== 'number') return
    
    // Map to node ID based on which mesh was hit
    let nodeId: string | undefined
    const mesh = closest.object as THREE.InstancedMesh
    
    if (mesh === highOrbRef.current) {
      nodeId = qualityToGlobalMap.high.get(closest.instanceId)
    } else if (mesh === mediumOrbRef.current) {
      nodeId = qualityToGlobalMap.medium.get(closest.instanceId)
    } else if (mesh === lowOrbRef.current) {
      nodeId = qualityToGlobalMap.low.get(closest.instanceId)
    }
    
    if (nodeId && nodeId !== hoveredNodeRef.current) {
      // Clear any pending debounce
      if (hoverDebounceRef.current) {
        clearTimeout(hoverDebounceRef.current)
        hoverDebounceRef.current = null
      }
      
      // Small delay before showing overlay to prevent flickering
      hoverDebounceRef.current = setTimeout(() => {
        hoveredNodeRef.current = nodeId
        onNodeHover(nodeId)
      }, 30)
    }
  }, [camera, pointer, raycaster, qualityToGlobalMap, onNodeHover, dragOrbitNodeId])
  
  const handleScenePointerOut = useCallback(() => {
    // Clear any pending show debounce
    if (hoverDebounceRef.current) {
      clearTimeout(hoverDebounceRef.current)
      hoverDebounceRef.current = null
    }
    
    // Clear hover after timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      onNodeHover(null)
      hoveredNodeRef.current = null
      hoverTimeoutRef.current = null
    }, 50)
  }, [onNodeHover])
  
  const handleClick = useCallback((event: { instanceId?: number; stopPropagation?: () => void }, quality: 'high' | 'medium' | 'low') => {
    const instanceId = event.instanceId
    if (typeof instanceId !== 'number') return
    
    const node = getNodeByQualityAndInstanceId(quality, instanceId)
    if (node) {
      onNodeClick(node.id)
      event.stopPropagation?.()
    }
  }, [getNodeByQualityAndInstanceId, onNodeClick])
  
  const handleDoubleClick = useCallback((event: { instanceId?: number; stopPropagation?: () => void }, quality: 'high' | 'medium' | 'low') => {
    const instanceId = event.instanceId
    if (typeof instanceId !== 'number') return
    
    const node = getNodeByQualityAndInstanceId(quality, instanceId)
    if (node) {
      onNodeDoubleClick(node.id)
      event.stopPropagation?.()
    }
  }, [getNodeByQualityAndInstanceId, onNodeDoubleClick])
  
  const handlePointerDown = useCallback((event: { instanceId?: number; stopPropagation?: () => void }, quality: 'high' | 'medium' | 'low') => {
    const instanceId = event.instanceId
    if (typeof instanceId !== 'number') return
    
    const node = getNodeByQualityAndInstanceId(quality, instanceId)
    if (node) {
      onNodePointerDown(node.id)
      event.stopPropagation?.()
    }
  }, [getNodeByQualityAndInstanceId, onNodePointerDown])
  
  const handlePointerUp = useCallback(() => {
    onNodePointerUp()
  }, [onNodePointerUp])
  
  // Get hovered node index for tooltip
  const hoveredNodeIndex = useMemo(() => {
    if (!hoveredNodeId) return -1
    return nodes.findIndex(n => n.id === hoveredNodeId)
  }, [hoveredNodeId, nodes])
  
  return (
    <>
      <group 
        ref={groupRef}
        onPointerMove={handleScenePointerMove}
        onPointerOut={handleScenePointerOut}
        onPointerUp={handlePointerUp}
      >
        {/* High Quality Orbs */}
        <instancedMesh
          ref={highOrbRef}
          args={[orbGeometry, qualityMaterials.high, qualityGroups.high.length]}
          onClick={(e) => handleClick(e, 'high')}
          onDoubleClick={(e) => handleDoubleClick(e, 'high')}
          onPointerDown={(e) => handlePointerDown(e, 'high')}
          frustumCulled={false}
        />
        
        {/* Medium Quality Orbs */}
        <instancedMesh
          ref={mediumOrbRef}
          args={[orbGeometry, qualityMaterials.medium, qualityGroups.medium.length]}
          onClick={(e) => handleClick(e, 'medium')}
          onDoubleClick={(e) => handleDoubleClick(e, 'medium')}
          onPointerDown={(e) => handlePointerDown(e, 'medium')}
          frustumCulled={false}
        />
        
        {/* Low Quality Orbs */}
        <instancedMesh
          ref={lowOrbRef}
          args={[orbGeometry, qualityMaterials.low, qualityGroups.low.length]}
          onClick={(e) => handleClick(e, 'low')}
          onDoubleClick={(e) => handleDoubleClick(e, 'low')}
          onPointerDown={(e) => handlePointerDown(e, 'low')}
          frustumCulled={false}
        />
      </group>
      
      {/* Anchor Ring for anchor node */}
      {anchorSongId && <AnchorRing 
        anchorSongId={anchorSongId} 
        globalIndexMap={globalIndexMap} 
        currentPositions={currentPositions} 
      />}
      

      
      {/* Tooltip for hovered node */}
      {hoveredNodeIndex !== -1 && (() => {
        const node = nodes[hoveredNodeIndex]
        const pos = [
          currentPositions.current![hoveredNodeIndex * 3],
          currentPositions.current![hoveredNodeIndex * 3 + 1],
          currentPositions.current![hoveredNodeIndex * 3 + 2]
        ] as [number, number, number]
        
        // Check if this node should be hidden in orbit mode
        const isCenter = centerNode?.id === node.id
        const isOrbiting = orbitingNeighbors.some(n => n.id === node.id)
        const shouldHide = orbitMode && !isCenter && !isOrbiting
        
        if (shouldHide) return null
        
        return (
          <Html key={node.id} position={pos}>
            <div 
              className="bg-[#0A0A0A]/95 backdrop-blur-md border border-[#39FF14] rounded-sm shadow-[0_0_20px_rgba(57,255,20,0.3)] pointer-events-none"
              style={{ 
                fontSize: '14px',
                width: '320px',
                padding: '16px'
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="font-bold text-white leading-tight" style={{ fontSize: '16px', maxWidth: '260px' }}>
                  {node.data.title}
                </div>
                <Play className="w-4 h-4 text-[#39FF14] flex-shrink-0 ml-2" />
              </div>
              
              <div className="flex items-end gap-[2px] h-6 mb-4 px-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-[#39FF14]/60 rounded-sm"
                    style={{
                      width: '6px',
                      height: `${Math.random() * 100}%`,
                      animation: `pulse 0.5s ease-in-out ${i * 0.05}s infinite alternate`
                    }}
                  />
                ))}
              </div>
              
              <div className="space-y-1.5 text-[#8B949E] text-[13px]">
                <div className="flex justify-between">
                  <span className="uppercase tracking-wide">Genre</span>
                  <span className="text-white">{node.data.genre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="uppercase tracking-wide">Key</span>
                  <span className="text-white font-mono">{node.data.key}</span>
                </div>
                <div className="flex justify-between">
                  <span className="uppercase tracking-wide">Tempo</span>
                  <span className="text-white font-mono">{node.data.tempo} BPM</span>
                </div>
                <div className="flex justify-between">
                  <span className="uppercase tracking-wide">Quality</span>
                  <span className="text-[#39FF14] font-mono">{node.data.production_quality}/100</span>
                </div>
              </div>
            </div>
          </Html>
        )
      })()}
    </>
  )
}

export type { NeuralOrbData }