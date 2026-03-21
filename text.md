# BeatScout
**AI-Powered Edit Discovery and Visualization for DJs**

---

## 1. The Problem: The "Cooked" Crate-Digging Workflow

For modern DJs, finding unique edits, remixes, and bootlegs of popular tracks is a painfully inefficient process. The current workflow relies on real-time Shazam hunting during live sets, or manually sifting through thousands of uncurated, low-quality uploads on SoundCloud. Traditional crate-digging is time-consuming, frustrating, and yields a high ratio of trash to playable gems.

---

## 2. The Solution: BeatScout

BeatScout is a SaaS platform that automates and gamifies the discovery of song edits. By combining user-side OAuth integrations, AI-driven audio analysis, and an interactive 3D visualizer, BeatScout lets DJs input a target track and instantly explore a curated, analyzed, and mapped universe of available edits.

---

## 3. The User Experience & Current UI State

The core philosophy of BeatScout is that **finding music should be intuitive, visual, and alive.** **The Request** — The user searches for a specific track (e.g., "Peggy Gou - It Goes Like Nanana").

**The 3D Neural Web Explorer** — Instead of a flat list or a static scatterplot, users are presented with a sleek, interactive 3D "Neural Web" built with `@react-three/fiber` and `@react-three/drei`. 

* **The Anchor Node:** The original track sits exactly at the focal point `[0,0,0]` with a distinct visual indicator.
* **The Nodes (Edits):** Around the anchor floats a web of available edits. They are mapped in 3D space across three proprietary axes:
  - **X axis** — Perceived Tempo (BPM mapping)
  - **Y axis** — Danceability / Energy Level
  - **Z axis** — Temperament / Vibe
* **The Heatmap (Bloom & Emissive):** Nodes are rendered using `meshStandardMaterial` coupled with a post-processing `<Bloom>` effect. A heatmap color system—ranging from cool blue to hot yellow/orange—overlays each point based on its **Production Quality** score. High-quality tracks literally glow brighter in the dark void, letting DJs instantly visually filter out amateur tracks.
* **Neural Filaments:** Nodes that are musically similar (nearest 3D spatial neighbors) are connected by thin, glowing lines, creating an organic, web-like structure. 
* **Interaction:** Hovering over a node triggers a subtle scale animation, illuminates its connected filaments, and displays a glassmorphic tooltip with track metadata. 

Users can navigate to different sectors of this web, preview the track in-browser, and stream it directly from the SoundCloud API.

---

## 4. Technical Architecture & Workflow

### A. Authentication & Sourcing

Users connect their SoundCloud account via OAuth. The resulting access token is forwarded to BeatScout's backend, which uses it to stream audio on the user's behalf — making every request a legitimate, authenticated API call rather than anonymous scraping. Rate limits apply to the user's own SoundCloud allowance (up to 15,000 streams per day).

### B. Job Queue & Async Processing

When a user submits a track, the request is immediately handed off to an **SQS job queue** on AWS. The browser receives a `job_id` and can be closed. When the user returns, the frontend polls `/status/{job_id}` and results stream in.

For each edit, the worker:
1. Checks the cache (returns instantly if analyzed before).
2. If uncached, fetches a 1-minute audio snippet (~1MB) from SoundCloud using the user's bearer token.
3. Passes the audio buffer to the AI analysis pipeline entirely in memory.
4. Stores the extracted parameters in the database and updates the job status.

### C. AI Audio Analysis

Raw audio is processed **in memory and never written to disk**, keeping storage costs negligible and eliminating copyright liability. The pipeline extracts parameters using a combination of models:

**CLAP (Contrastive Language-Audio Pretraining) by LAION** is prompted with natural language queries to extract semantic scores:
- *"A professional, well-mixed, high-quality studio production"* → **Production Quality Score**
- Sub-genre specific queries → **Sub-Genre Classification**
- *"A high-energy, danceable track"* → **Energy & Danceability Score**

**Essentia.js** (TensorFlow-based) is used for model-agnostic ground truth feature extraction (BPM, Camelot Key, etc.).

### D. Camera Configuration

The landing page uses a **shared camera configuration** (`frontend/components/three/camera-config.ts`) to ensure the static screenshot and live 3D animation start from exactly the same position:

```typescript
// Camera position is calculated from spherical coordinates:
// x = radius * sin(45°) * cos(30°)
// y = radius * sin(30°)
// z = radius * cos(45°) * cos(30°)
// where radius = sqrt(70² + 70² + 70²)

export const CAMERA_INITIAL_POSITION: [number, number, number] = [
  74.25,  // x
  60.62,  // y
  74.25   // z
]
```

This shared constant is used by:
- `page.tsx` - Canvas initial camera position
- `NeuralScene.tsx` - Animation frame-0 position and screenshot mode
- `explorer/page.tsx` - Explorer Canvas camera

**To change the starting camera position:** Edit `camera-config.ts` and all components will automatically use the new position.

### E. Database & Caching — The Flywheel Effect

Once a track is analyzed, its parameters are permanently cached. Over time, BeatScout accumulates a proprietary database of track vibes that grows more valuable with every search — dramatically reducing per-query compute costs and improving response times.

---

## 5. Preview Mode & Camera Animation (For Screen Recording)

The 3D Neural Web visualization supports a special **Preview Mode** designed for screen recording and landing page use. When enabled, the explorer displays a seamless, looping camera animation with all UI elements hidden.

### A. How It Works

**Environment Variable Toggle:**
```bash
# In frontend/.env.local
NEXT_PUBLIC_PREVIEW_MODE=true   # Enables animation + hides UI
NEXT_PUBLIC_PREVIEW_MODE=false  # Normal interactive explorer (default)
```

**Camera Animation Behavior:**
- **Duration**: ~25 seconds for a full loop (50% slower than original for smooth recordings)
- **Rotation**: Smooth 0° → 90° → 0° rotation around the scene using sine wave interpolation
- **Zoom Sequence**: 
  - First 5 seconds: Zoom in 10% (from full view to closer view)
  - Middle 15 seconds: Hold zoomed-in position
  - Last 5 seconds: Zoom back out to original position
  - Result: Seamless loop when animation repeats
- **Camera Position**: Starts at [70, 70, 70] with isometric angle, rotates around Y-axis
- **Static Stars**: Background stars are completely static (speed=0, no fade) to prevent flickering during recording

**Component Props:**
```tsx
// NeuralScene accepts a preview prop
<NeuralScene 
  data={songs} 
  onPointClick={handler}
  anchorSongId={anchorId}
  preview={true}  // Enables camera animation
/>
```

### B. Two Render Modes

**Preview Mode (PREVIEW=true):**
- Full-screen 3D canvas only (no sidebar, filters, or table)
- Camera auto-rotates and zooms in seamless loop
- Perfect for screen recordings and landing page backgrounds
- All interactive features disabled (click handlers are no-ops)

**Normal Mode (PREVIEW=false):**
- Full UI with sidebar, filters panel, and results table
- Interactive camera controls (hover to focus, click to orbit)
- Manual exploration with mouse/touch controls
- All features fully functional

### C. Landing Page Static Image

The landing page displays a static screenshot (`public/landing-bg.png`) while the 3D Neural Web loads. This provides a seamless visual experience:

1. User sees static image immediately (no loading wait)
2. 3D animation fades in smoothly once loaded
3. Camera positions are synchronized for perfect transition

**Generating the Screenshot:**

When you change the camera position, scene, or want to update the landing page image, regenerate the screenshot locally:

```bash
cd frontend
npm run generate-preview
```

This command:
- Starts a local Next.js dev server
- Opens Playwright to capture a 1920x1080 screenshot
- Saves it to `public/landing-bg.png`
- Commits the new image to the repo

**Note**: Do not delete or move `public/landing-bg.png`. The landing page relies on this file for the initial static background.

### D. Rebuilding After Toggle

When changing the preview mode, you must rebuild the frontend:

```bash
# For development (with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend

# For production
docker compose up --build -d
```

**Note**: Next.js bundles environment variables at build time, so changing `.env.local` requires a rebuild to take effect.

---

## 6. Monetization & Infrastructure

**Freemium / Tiered Model** — Free users join a standard processing queue. Pro users receive prioritized access to high-speed compute resources.

**Infrastructure** — BeatScout runs entirely on AWS, leveraging SQS for job queuing, DynamoDB for job status tracking, and a persistent database for the analyzed track cache.