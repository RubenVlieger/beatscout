import json
import os

def merge_urls():
    # File paths
    DATA_FILE = "example_data.json"
    LINKS_FILE = "links_map.json"
    OUTPUT_FILE = "example_data_with_urls.json"

    # 1. Check if files exist
    if not os.path.exists(DATA_FILE) or not os.path.exists(LINKS_FILE):
        print(f"❌ Error: Make sure both '{DATA_FILE}' and '{LINKS_FILE}' are in the same folder.")
        return

    # 2. Load the JSON data
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        example_data = json.load(f)

    with open(LINKS_FILE, 'r', encoding='utf-8') as f:
        links_map = json.load(f)

    # Create a lowercased version of the links map for better matching
    # This helps link "NANANA" to "Nanana"
    links_map_lower = {k.lower().strip(): v for k, v in links_map.items()}

    # 3. Process the songs
    empty_url_count = 0
    total_songs = len(example_data.get("songs", []))

    for song in example_data.get("songs", []):
        filename = song.get("filename", "")
        
        # Remove the .mp3 extension and any trailing spaces to get the base title
        base_title = filename.rsplit('.mp3', 1)[0].strip()
        
        # Attempt to find the URL
        url = ""
        if base_title in links_map:
            url = links_map[base_title] # Exact match
        elif base_title.lower() in links_map_lower:
            url = links_map_lower[base_title.lower()] # Case-insensitive match
        
        # Assign the URL to the song dictionary
        song["url"] = url
        
        if not url:
            empty_url_count += 1

    # 4. Save the updated data to a new file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(example_data, f, indent=2)

    # 5. Report the results
    print(f"✅ Processing complete! Saved updated data to '{OUTPUT_FILE}'.")
    print("-" * 40)
    print(f"Total songs processed: {total_songs}")
    print(f"Successfully linked:   {total_songs - empty_url_count}")
    print(f"Stayed empty:          {empty_url_count}")
    print("-" * 40)

if __name__ == "__main__":
    merge_urls()
