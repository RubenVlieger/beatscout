import * as THREE from 'three'

/**
 * Custom easing utility functions to replace maath/easing
 * Provides smooth interpolation between values with exponential damping
 */

/**
 * Smoothly interpolate a Vector3 towards a target using exponential damping
 * Similar to maath's damp3 function
 * @param current - Current Vector3 (mutated in place)
 * @param target - Target Vector3 values
 * @param smoothTime - Time to reach target (lower = faster, ~0.1-0.5 typical)
 * @param deltaTime - Time since last frame
 * @returns Whether the value has reached the target (within epsilon)
 */
export function damp3(
  current: THREE.Vector3,
  target: [number, number, number],
  smoothTime: number,
  deltaTime: number,
  epsilon: number = 0.001
): boolean {
  const [targetX, targetY, targetZ] = target
  
  // Calculate omega (angular frequency) based on smoothTime
  // Using a common approximation for exponential decay
  const omega = 2.0 / smoothTime
  const exp = Math.exp(-omega * deltaTime)
  
  // Apply exponential smoothing
  current.x = targetX + (current.x - targetX) * exp
  current.y = targetY + (current.y - targetY) * exp
  current.z = targetZ + (current.z - targetZ) * exp
  
  // Check if we've reached the target
  const dx = Math.abs(current.x - targetX)
  const dy = Math.abs(current.y - targetY)
  const dz = Math.abs(current.z - targetZ)
  
  return dx < epsilon && dy < epsilon && dz < epsilon
}

/**
 * Smoothly interpolate a scalar value using exponential damping
 * @param current - Current value (passed by reference as array to mutate)
 * @param target - Target value
 * @param smoothTime - Time to reach target
 * @param deltaTime - Time since last frame
 * @param epsilon - Threshold for considering reached
 * @returns Whether the value has reached the target
 */
export function damp(
  current: { value: number },
  target: number,
  smoothTime: number,
  deltaTime: number,
  epsilon: number = 0.001
): boolean {
  const omega = 2.0 / smoothTime
  const exp = Math.exp(-omega * deltaTime)
  
  current.value = target + (current.value - target) * exp
  
  return Math.abs(current.value - target) < epsilon
}

/**
 * Smoothly interpolate between two values using linear interpolation
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
