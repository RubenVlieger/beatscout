import os
import tempfile
import yt_dlp
from concurrent.futures import ThreadPoolExecutor

MAX_WORKERS = 5 

def download_single_link(link, ydl_opts, index, total):
    """
    Worker function to download a single link. 
    Creating the YoutubeDL instance inside the thread ensures thread safety.
    """
    try:
        print(f"[{index}/{total}] Starting: {link}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([link])
        print(f"[{index}/{total}] ✅ Finished: {link}")
    except Exception as e:
        print(f"[{index}/{total}] ❌ Skipping {link} (Error: {e})")

def download_snippets(input_file):
    # Create a temporary directory that won't clutter your Desktop/Downloads
    temp_dir = tempfile.mkdtemp(prefix="soundcloud_snippets_")
    print(f"📁 Temporary folder created at: {temp_dir}")
    print("Items in this folder will be deleted by your OS eventually.\n")

    # Configuration for yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
        # This tells ffmpeg to download only the first 60 seconds
        'download_sections': '[*0-60]', 
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '128',
        }],
        'noplaylist': True,
        'match_filter': yt_dlp.utils.match_filter_func(["title~=(?i)(nanana|peggy|gou)"]),

        'postprocessor_args': {
            'ffmpeg': ['-t', '60'] 
        },
        'prefer_ffmpeg': True,

        'quiet': True,
        'no_warnings': True,
    }

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Run the scraper script first.")
        return

    with open(input_file, 'r') as f:
        links = [line.strip() for line in f if line.strip()]
        
    total_links = len(links)
    print(f"Found {total_links} links. Starting downloads with {MAX_WORKERS} concurrent workers...")

    # Set up the ThreadPoolExecutor for multi-threading
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for i, link in enumerate(links):
            # Submit each download task to the thread pool
            executor.submit(download_single_link, link, ydl_opts, i + 1, total_links)

    print(f"\n✅ All downloads complete! Your 60-second snippets are located in:\n{temp_dir}")
    print("Note: You can open this folder by typing 'open " + temp_dir + "' in your terminal.")

if __name__ == "__main__":
    download_snippets("nanana_links.txt")