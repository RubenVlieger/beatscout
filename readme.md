# BeatScout Audio Analysis

AI-powered audio analysis for DJs using CLAP (Contrastive Language-Audio Pretraining).

## Quick Start

### macOS (Homebrew + Conda)

```bash
# Install dependencies
brew install conda
conda env create -f environment.yml
conda activate beatscout

# Analyze a track
python main.py resources/example.mp3
```

### Linux

```bash
# Install Conda (if not already installed)
# See: https://docs.conda.io/en/latest/miniconda.html

# Create environment
conda env create -f environment.yml
conda activate beatscout

# Analyze a track
python main.py resources/example.mp3
```

## Platform-Specific Setup

### Linux with AMD GPU (ROCm)

To use your Radeon GPU on Linux, you need ROCm-enabled PyTorch:

```bash
# Remove standard PyTorch
pip uninstall torch torchvision torchaudio

# Install ROCm-enabled PyTorch (for RDNA2/RDNA3 GPUs like RX 6000/7000 series)
# See: https://pytorch.org/get-started/locally/
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.2

# Verify ROCm is detected
python main.py --list-devices
```

**Supported AMD GPUs for ROCm:**
- RX 7900 XTX/XT (RDNA3) - Full support
- RX 6900 XT/6800 XT (RDNA2) - Full support
- RX 5500M (RDNA1) - Limited support, may require custom build

**ROCm System Requirements:**
- Linux kernel 5.4+ (Ubuntu 20.04/22.04 recommended)
- ROCm 5.0+ installed: https://rocm.docs.amd.com/

### Linux with NVIDIA GPU (CUDA)

```bash
# CUDA is usually auto-detected
# If not, ensure you have CUDA 11.8+ and cuDNN installed

# Verify CUDA is detected
python main.py --list-devices
```

### macOS (Apple Silicon - M1/M2/M3)

MPS (Metal Performance Shaders) is automatically used on Apple Silicon Macs:

```bash
# MPS is auto-detected on arm64 Macs
python main.py --list-devices

# Force CPU if needed
python main.py track.mp3 --device cpu
```

### macOS (Intel)

Intel Macs only support CPU acceleration. External AMD GPUs via eGPU are not supported by PyTorch on macOS.

```bash
# CPU is auto-detected on Intel Macs
python main.py resources/example.mp3
```

## Usage

### Basic Usage

```bash
# Analyze a track with auto-detected device
python main.py track.mp3

# Specify device manually
python main.py track.mp3 --device cuda    # NVIDIA/AMD (ROCm on Linux)
python main.py track.mp3 --device mps     # Apple Silicon only
python main.py track.mp3 --device cpu     # Any platform

# Analyze first 30 seconds only
python main.py track.mp3 --max-duration 30

# Output as JSON
python main.py track.mp3 --json

# Verbose output with timing
python main.py track.mp3 --verbose
```

### Check Available Devices

```bash
python main.py --list-devices
```

Example output on Linux with ROCm:
```
Available Compute Devices
==================================================
Platform:        linux
Architecture:    x86_64
Best Device:     cuda

Device Support:
  CUDA/ROCm:     Yes
  MPS (macOS):   No

Detected GPUs:
  - AMD Radeon RX 6800 XT

Usage:
  python main.py track.mp3 --device cuda  # For NVIDIA/AMD (ROCm)
  python main.py track.mp3 --device mps   # For Apple Silicon
  python main.py track.mp3 --device cpu   # Fallback
```

## CLI Reference

```
usage: main.py [-h] [--model MODEL] [--device {cuda,mps,cpu}] [--max-duration MAX_DURATION] [--list-devices] [--json] [--verbose] [audio_file]

Analyze audio tracks using CLAP-based semantic scoring.

positional arguments:
  audio_file            Path to audio file to analyze (mp3, wav, flac, etc.)

options:
  -h, --help            show this help message and exit
  --model MODEL         Path to CLAP model checkpoint
  --device {cuda,mps,cpu}
                        Device to use (default: auto-detect). Note: ROCm uses 'cuda'.
  --max-duration MAX_DURATION
                        Maximum duration in seconds (default: 60.0)
  --list-devices        List available compute devices and exit
  --json                Output results as JSON
  --verbose, -v         Print detailed processing information

Metrics:
  production_quality  - Professional vs amateur production (0-100)
  danceability        - Danceable energetic vs ambient calm (0-100)
  temperament         - Bright happy vs dark moody (0-100)
```

## Cross-Platform Notes

| Platform | NVIDIA | AMD | Apple | CPU |
|----------|---------|-----|--------|-----|
| Linux    | ✓ CUDA | ✓ ROCm | N/A | ✓ |
| macOS (Intel) | ✗ | ✗ | N/A | ✓ |
| macOS (Apple Silicon) | N/A | N/A | ✓ MPS | ✓ |
| Windows  | ✓ CUDA | ✗ | N/A | ✓ |

**Key Points:**
- **ROCm on Linux**: Uses `cuda` device name in PyTorch (historical reason)
- **Intel Macs**: No GPU acceleration available
- **MPS limitations**: Some CLAP operations may fall back to CPU on macOS

## Model Setup

Download the CLAP model checkpoint:

```bash
# Create models directory
mkdir -p models

# Download model (2GB)
# Option 1: Direct download
wget https://huggingface.co/lukewx/laion-clap-music/resolve/main/music_audioset_epoch_15_esc_90.14.pt -O models/music_audioset_epoch_15_esc_90.14.pt

# Option 2: Via Hugging Face CLI
pip install huggingface-hub
huggingface-cli download lukewx/laion-clap-music music_audioset_epoch_15_esc_90.14.pt --local-dir models
```

## Python API

```python
from src.analyse import analyse_track

# Simple analysis
result = analyse_track("track.mp3")
print(result.clap_scores)
# {'production_quality': 62.3, 'danceability': 98.0, 'temperament': 47.5}

# With custom settings
from src.analyse import AnalysisEngine

engine = AnalysisEngine(device="cuda", max_duration_sec=30)
result = engine.analyse_track("track.mp3")
```

## Troubleshooting

### "CUDA out of memory" on AMD GPU
Your AMD GPU might not have enough VRAM. Try:
```bash
python main.py track.mp3 --device cpu
```

### MPS not working on Apple Silicon
Some CLAP operations aren't supported by MPS. The code automatically falls back to CPU for those operations.

### ROCm not detected on Linux
1. Verify ROCm is installed: `rocm-smi`
2. Install ROCm-enabled PyTorch (see setup above)
3. Check PyTorch can see the GPU: `python -c "import torch; print(torch.cuda.is_available())"`

### Model file not found
Ensure the model is downloaded to `models/music_audioset_epoch_15_esc_90.14.pt` or specify path:
```bash
python main.py track.mp3 --model /path/to/model.pt
```

## Docker Development

For full-stack development with hot reload:

### Quick Start (Development Mode)

```bash
# Start all services with hot reload (no rebuilds needed for code changes!)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or just frontend and backend (no database):
docker compose -f docker-compose.yml -f docker-compose.dev.yml up frontend backend
```

**Development Features:**
- **Frontend**: Changes reflect instantly (~2 seconds) via Next.js hot reload
- **Backend**: Auto-reloads on Python file changes
- **No container rebuilds** needed for code changes
- Just edit files and refresh browser

### Production Mode (Build & Deploy)

```bash
# Build fresh images and start (slow, use only for deployment)
docker compose up --build

# Build only frontend:
docker compose up --build frontend

# Build only backend:
docker compose up --build backend
```

**Use production mode only when:**
- Deploying to production
- Testing production builds
- Package dependencies changed (package.json, requirements.txt)

### Environment Variables

Create a `.env` file:

```env
NEXTAUTH_SECRET=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
SOUNDCLOUD_CLIENT_ID=optional
SOUNDCLOUD_CLIENT_SECRET=optional
```

### Common Tasks

**Install new dependencies:**
```bash
# Frontend - update package.json, then:
docker compose up --build frontend

# Backend - update requirements.txt, then:
docker compose up --build backend
```

**View logs:**
```bash
docker compose logs -f frontend
docker compose logs -f backend
```

**Stop services:**
```bash
docker compose down
docker compose down -v  # Also remove database
```

## Development

### Running Tests

```bash
# Test on example track
python main.py resources/Dont_Stop_Till_You_Get_Enough_J_Young_Edit_KLICKAUD.mp3 --verbose

# Test JSON output
python main.py resources/example.mp3 --json
```

### Performance Benchmarks

| Device | Model Load | Per-Track Analysis |
|--------|-----------|-------------------|
| CPU (Intel i9) | 5s | ~3-5s |
| CPU (AMD Ryzen) | 5s | ~3-5s |
| CUDA (RTX 3080) | 3s | ~0.5s |
| ROCm (RX 6800 XT) | 3s | ~0.8s |
| MPS (M1 Pro) | 4s | ~1.5s |

*Times are approximate and vary by track length (analyzing 60s segments)*
