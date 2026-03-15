import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

# Configuration
INPUT_DIR = "example_songs"
OUTPUT_DIR = "example_songs_shortened"
MAX_WORKERS = 5  # Adjust this based on your CPU cores

def process_song(input_path, index, total):
    """
    Worker function to trim a single song to 60 seconds and convert to 128kbps.
    """
    filename = os.path.basename(input_path)
    output_path = os.path.join(OUTPUT_DIR, filename)
    
    # Construct the FFmpeg command
    # -y : Overwrite output files without asking
    # -i : Input file path
    # -t 60 : Stop writing the output after 60 seconds
    # -b:a 128k : Set audio bitrate to 128kbps
    command = [
        "ffmpeg", 
        "-y", 
        "-i", input_path, 
        "-t", "60", 
        "-b:a", "128k", 
        output_path
    ]
    
    try:
        print(f"[{index}/{total}] 🎵 Processing: {filename}")
        # Run FFmpeg, suppressing its massive console output to keep things clean
        subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        print(f"[{index}/{total}] ✅ Finished: {filename}")
    except subprocess.CalledProcessError as e:
        print(f"[{index}/{total}] ❌ Error processing {filename}. Ensure the file isn't corrupted.")
    except FileNotFoundError:
        print(f"[{index}/{total}] ❌ Error: FFmpeg not found! Please install FFmpeg and add it to your PATH.")

def main():
    # Check if input directory exists
    if not os.path.exists(INPUT_DIR):
        print(f"Error: The folder '{INPUT_DIR}' was not found in the current directory.")
        return

    # Create output directory if it doesn't exist to prevent overwriting originals
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Gather all .mp3 files from the input directory
    mp3_files = [
        os.path.join(INPUT_DIR, f) 
        for f in os.listdir(INPUT_DIR) 
        if f.lower().endswith(".mp3")
    ]
    
    total_files = len(mp3_files)
    
    if total_files == 0:
        print(f"No .mp3 files found in '{INPUT_DIR}'.")
        return

    print(f"Found {total_files} MP3 files. Starting multithreaded processing...")

    # Execute the tasks concurrently
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for i, file_path in enumerate(mp3_files):
            # Submit each file to a thread
            executor.submit(process_song, file_path, i + 1, total_files)

    print(f"\n🎉 All done! Your shortened, 128kbps songs are waiting in the '{OUTPUT_DIR}' folder.")

if __name__ == "__main__":
    main()
