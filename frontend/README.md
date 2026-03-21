# BeatScout Frontend

Next.js application with 3D Neural Web visualization using React Three Fiber.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

## Landing Page Screenshot

The landing page displays a static screenshot (`public/landing-bg.png`) while the 3D Neural Web loads. This creates a seamless user experience:

1. Static image visible immediately on page load
2. 3D animation fades in smoothly once WebGL is ready
3. Camera positions are synchronized for perfect visual transition

### Generating a New Screenshot

When you change the camera position, scene appearance, or node layout, regenerate the screenshot:

```bash
npm run generate-preview
```

This command will:
- Start a local Next.js dev server
- Use Playwright to capture a 1920x1080 screenshot at frame 0
- Save it to `public/landing-bg.png`

**Important:** Commit the updated `landing-bg.png` to the repository. The landing page relies on this file.

### Camera Configuration

The initial camera position is shared across components via `components/three/camera-config.ts`. To change the starting position:

1. Edit `components/three/camera-config.ts`
2. Regenerate the screenshot: `npm run generate-preview`
3. Commit both the config change and the new screenshot

## Preview Mode

For screen recording or demo purposes, enable Preview Mode to hide UI and enable automatic camera rotation:

```bash
# In .env.local
NEXT_PUBLIC_PREVIEW_MODE=true
```

Then rebuild the frontend.

## Project Structure

```
app/                 # Next.js pages
components/          # React components
  three/            # Three.js components
    NeuralScene.tsx       # Main 3D scene
    camera-config.ts      # Shared camera settings
    NeuralOrbs.tsx        # Node rendering
    NeuralFilaments.tsx   # Connection lines
public/             # Static assets
  landing-bg.png    # Landing page background screenshot
scripts/            # Build scripts
  generate-preview.ts  # Screenshot generator
```
