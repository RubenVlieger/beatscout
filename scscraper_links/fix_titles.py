import os
import yt_dlp
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
INPUT_FILE = "nanana_links.txt"
OUTPUT_FILE = "song_url_mapping.txt"
MAX_WORKERS = 10  # 10 is a safe number to avoid getting rate-limited by SoundCloud

def fetch_title_and_url(url, index, total):
    """
    Worker function to fetch the metadata for a single URL without downloading.
    Returns the original index to ensure we can sort them back into order later.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        # extract_flat speeds up the process by preventing deep extraction 
        # when we only need basic metadata like the title.
        'extract_flat': True, 
    }
    
    try:
        print(f"[{index}/{total}] 🔍 Fetching metadata for: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # download=False ensures we ONLY get the dictionary of info
            info = ydl.extract_info(url, download=False)
            title = info.get('title', 'Unknown_Title').strip()
            
            result_string = f"{title} - {url}"
            return index, result_string
            
    except Exception as e:
        print(f"[{index}/{total}] ❌ Error fetching {url} (Error: {e})")
        # Return an error string so you don't lose the URL in the final list
        return index, f"ERROR_FETCHING_TITLE - {url}"

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found. Please ensure it is in the same folder.")
        return

    # Read all non-empty lines from the input file
    with open(INPUT_FILE, 'r') as f:
        links = [line.strip() for line in f if line.strip()]

    total_links = len(links)
    if total_links == 0:
        print("The input file is empty.")
        return

    print(f"Found {total_links} links. Starting multithreaded metadata scraping...")
    
    # We will store results here as tuples: (index, formatted_string)
    results = []

    # Execute tasks concurrently
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all tasks and store the future objects alongside their index
        future_to_url = {
            executor.submit(fetch_title_and_url, url, i + 1, total_links): url 
            for i, url in enumerate(links)
        }
        
        # as_completed yields futures as soon as they finish
        for future in as_completed(future_to_url):
            try:
                # Get the returned (index, result_string)
                data = future.result()
                results.append(data)
            except Exception as e:
                print(f"Thread generated an exception: {e}")

    # Sort results by the original index to maintain the exact order of your input file
    results.sort(key=lambda x: x[0])

    # Write the perfectly ordered results to the output file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out_f:
        for index, line_content in results:
            out_f.write(line_content + "\n")

    print(f"\n✅ All done! Successfully mapped {len(results)} songs.")
    print(f"Check the file '{OUTPUT_FILE}' for your results.")

if __name__ == "__main__":
    main()
