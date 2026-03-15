import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def scrape_soundcloud_links(search_url, output_filename):
    print("Starting browser...")
    
    # Set up Chrome options
    options = webdriver.ChromeOptions()
    # options.add_argument('--headless') # Uncomment this line if you want it to run silently in the background
    options.add_argument('--mute-audio') # Mute browser to prevent random autoplaying sounds
    
    # Initialize the Chrome driver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        print("Navigating to SoundCloud...")
        driver.get(search_url)
        time.sleep(4) # Wait for the initial page to load
        
        # Try to click "Accept Cookies" to remove the overlay (which sometimes blocks scrolling)
        try:
            cookie_btn = driver.find_element(By.ID, "onetrust-accept-btn-handler")
            cookie_btn.click()
            time.sleep(1)
        except Exception:
            pass # If the button isn't there, just continue
        
        print("Scrolling down to load all results... (This might take a minute)")
        last_height = driver.execute_script("return document.body.scrollHeight")
        
        while True:
            # Scroll to the bottom of the page
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            
            # Wait for the next batch of songs to load
            time.sleep(3)
            
            # Calculate new scroll height and compare with last scroll height
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                # Wait an extra 3 seconds and check again just in case of lag
                time.sleep(3)
                new_height = driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break # We have reached the absolute bottom of the search results
                    
            last_height = new_height
            
        print("Reached the bottom! Extracting URLs...")
        
        # Find all track elements. SoundCloud uses the class 'soundTitle__title' for track links
        track_elements = driver.find_elements(By.CSS_SELECTOR, "a.soundTitle__title")
        
        # We use a set to automatically remove any duplicate links
        links = set()
        for element in track_elements:
            href = element.get_attribute("href")
            if href:
                links.add(href)
                
        # Save the extracted links into a text file
        with open(output_filename, "w", encoding="utf-8") as file:
            for link in sorted(links):
                file.write(link + "\n")
                
        print(f"\n🎉 Success! {len(links)} links have been extracted and saved to '{output_filename}'.")

    finally:
        # Close the browser
        driver.quit()

if __name__ == "__main__":
    url = "https://soundcloud.com/search?q=it%20goes%20like%20(nanana)"
    output_file = "nanana_links.txt"
    
    scrape_soundcloud_links(url, output_file)
