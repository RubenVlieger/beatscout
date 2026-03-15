# BeatScout
**AI-Powered Edit Discovery and Visualization for DJs**

---

## 1. The Problem: The "Cooked" Crate-Digging Workflow

For modern DJs, finding unique edits, remixes, and bootlegs of popular tracks is a painfully inefficient process. The current workflow relies on real-time Shazam hunting during live sets, or manually sifting through thousands of uncurated, low-quality uploads on SoundCloud. Traditional crate-digging is time-consuming, frustrating, and yields a high ratio of trash to playable gems.

---

## 2. The Solution: BeatScout

BeatScout is a SaaS platform that automates and gamifies the discovery of song edits. By combining user-side OAuth integrations, AI-driven audio analysis, and an interactive 3D visualizer, BeatScout lets DJs input a target track and instantly explore a curated, analyzed, and mapped universe of available edits.

---

## 3. The User Experience

The core philosophy of BeatScout is that **finding music should be intuitive and fun.**

**The request** — The user searches for a specific track (e.g., "Peggy Gou - It Goes Like Nanana").

**The Edit Explorer** — Instead of a flat list, users are presented with a sleek, interactive 3D scatterplot. The original track sits at the focal point. Around it floats a galaxy of edits, each mapped in 3D space across three proprietary axes:

- **X axis** — Perceived Tempo (how fast the track *feels*, not just raw BPM)
- **Y axis** — Energy Level
- **Z axis** — Temperament / Vibe

A heatmap color system — ranging from cool blue to hot yellow — overlays each point with a **Popularity & Production Quality** score, letting DJs instantly filter out amateur or poorly-mixed tracks without listening to a single one.

**Navigation** — If a DJ wants something slightly more energetic or darker in mood, they navigate to that sector of the 3D space, preview the track in-browser, and stream it directly from the Soundcloud api.

---

## 4. Technical Architecture & Workflow

### A. Authentication & Sourcing

Users connect their SoundCloud account via OAuth. The resulting access token is forwarded to BeatScout's backend, which uses it to stream audio on the user's behalf — making every request a legitimate, authenticated API call rather than anonymous scraping.

This means rate limits apply to the user's own SoundCloud allowance (up to 15,000 streams per day), completely eliminating the risk of BeatScout's servers being IP-banned or API-throttled.

*Future integrations:* Bandcamp and Beatport, subject to their respective API allowances.

### B. Job Queue & Async Processing

When a user submits a track, the request is immediately handed off to an **SQS job queue** on AWS. The browser receives a `job_id` and can be closed — the work continues server-side regardless. When the user returns, the frontend polls `/status/{job_id}` and results stream in as each edit is processed.

For each edit, the worker:

1. Checks the cache — if the track has been analyzed before, results are returned instantly at no compute cost.
2. If uncached, fetches a 1-minute audio snippet (~1MB) from SoundCloud using the user's bearer token.
3. Passes the audio buffer to the AI analysis pipeline entirely in memory.
4. Stores the extracted parameters in the database and updates the job status.

At projected usage (up to 3 concurrent jobs × 50 tracks, one track processed every ~30 seconds), a single small EC2 instance or a Lambda with a 15-minute timeout is sufficient.

### C. AI Audio Analysis

Raw audio is processed **in memory and never written to disk**, keeping storage costs negligible and eliminating copyright liability from audio retention.

The analysis pipeline extracts 10–20 parameters per track using a combination of models:

**CLAP (Contrastive Language-Audio Pretraining) by LAION** is used for semantic, text-guided scoring. Rather than relying on hard-coded classifiers, CLAP is prompted with natural language queries, for example:

- *"A professional, well-mixed, high-quality studio production"* vs. *"An amateur bedroom producer's distorted mix"* → **Production Quality Score**
- Queries targeting specific sub-genres (e.g., afro house, melodic techno, minimal) → **Sub-Genre Classification**
- *"A high-energy, danceable track"* vs. *"A slow, atmospheric piece"* → **Energy & Danceability Score**

**Essentia.js** (TensorFlow-based) is used for lower-level audio feature extraction — BPM, key, Camelot notation, and broad genre classification — providing reliable, model-agnostic ground truth alongside the CLAP outputs.

Additional models will be evaluated and integrated over time.

**Key output parameters per track:**

| Parameter | Source |
|---|---|
| Production Quality Score | CLAP |
| Temperament / Mood | CLAP |
| Perceived Tempo (feel, not raw BPM) | CLAP + Essentia |
| Energy & Danceability | CLAP |
| Sub-Genre Classification | CLAP |
| Camelot Key / Musical Key | Essentia |

### D. Database & Caching — The Flywheel Effect

Once a track is analyzed, its parameters are permanently cached. When a second user searches for the same song, results are returned instantly with zero AI compute cost.

Over time, BeatScout accumulates a proprietary database of track vibes that grows more valuable with every search — dramatically reducing per-query costs and improving response times as the platform scales.

---

## 5. Monetization & Infrastructure

**Freemium / tiered model** — Free users join a standard processing queue. Pro users receive prioritized access to high-speed compute resources for near-instant results.

**Infrastructure** — BeatScout runs entirely on AWS, leveraging SQS for job queuing, DynamoDB for job status tracking, and a persistent database for the analyzed track cache. Early-stage infrastructure costs are minimized through AWS Startup credits and the inherent efficiency of the caching flywheel.