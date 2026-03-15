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

### D. Database & Caching — The Flywheel Effect

Once a track is analyzed, its parameters are permanently cached. Over time, BeatScout accumulates a proprietary database of track vibes that grows more valuable with every search — dramatically reducing per-query compute costs and improving response times.

---

## 5. Monetization & Infrastructure

**Freemium / Tiered Model** — Free users join a standard processing queue. Pro users receive prioritized access to high-speed compute resources.

**Infrastructure** — BeatScout runs entirely on AWS, leveraging SQS for job queuing, DynamoDB for job status tracking, and a persistent database for the analyzed track cache.