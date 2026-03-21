// Shared camera configuration for Neural Web visualization
// These values MUST stay synchronized between the Canvas initial position
// and the animation frame-0 position in NeuralScene.tsx

/**
 * Base radius for camera positioning
 * Derived from the isometric starting point [70, 70, 70]
 * radius = sqrt(70² + 70² + 70²) ≈ 121.24
 */
export const CAMERA_RADIUS = Math.sqrt(70 * 70 + 70 * 70 + 70 * 70)

/**
 * Base angle for isometric view (45 degrees in radians)
 */
export const CAMERA_BASE_ANGLE = Math.PI / 4

/**
 * Elevation angle (30 degrees in radians)
 */
export const CAMERA_ELEVATION_ANGLE = Math.PI / 6

/**
 * Initial camera position [x, y, z] for frame 0 of the animation
 * Calculated using spherical coordinates:
 * x = radius * sin(baseAngle) * cos(elevationAngle)
 * y = radius * sin(elevationAngle)
 * z = radius * cos(baseAngle) * cos(elevationAngle)
 */
export const CAMERA_INITIAL_POSITION: [number, number, number] = [
  CAMERA_RADIUS * Math.sin(CAMERA_BASE_ANGLE) * Math.cos(CAMERA_ELEVATION_ANGLE),
  CAMERA_RADIUS * Math.sin(CAMERA_ELEVATION_ANGLE),
  CAMERA_RADIUS * Math.cos(CAMERA_BASE_ANGLE) * Math.cos(CAMERA_ELEVATION_ANGLE),
]

// Console log to verify values (will show during build/dev)
// eslint-disable-next-line no-console
console.log('Camera initial position:', CAMERA_INITIAL_POSITION.map(n => n.toFixed(2)))
