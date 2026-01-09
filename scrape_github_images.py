"""
Script to download images from GitHub markdown page using Playwright
Requires: pip install playwright requests
Then run: playwright install chromium
"""

from playwright.sync_api import sync_playwright
import requests
import os
import time

url = "https://github.com/mooofin/CTFs/blob/main/CTFs-main/tests/Keeper%20of%20the%20Rejected%20Flame%20Bound%20to%20Worlds%20Unrendered.md"
img_dir = "public/images/havok-engine"

os.makedirs(img_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    
    print(f"Opening {url}")
    page.goto(url, wait_until="networkidle")
    
    # Wait for images to load
    time.sleep(3)
    
    # Find all images in the article
    images = page.locator('article img').all()
    
    print(f"Found {len(images)} images")
    
    for i, img in enumerate(images):
        src = img.get_attribute('src')
        if not src:
            continue
            
        print(f"\nImage {i+1}/{len(images)}")
        print(f"  Source: {src[:80]}...")
        
        # Determine filename
        if i == 0:
            filename = "header.png"
        else:
            filename = f"image-{i}.png"
        
        filepath = os.path.join(img_dir, filename)
        
        try:
            # Download with browser cookies/auth
            response = requests.get(src, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://github.com/'
            })
            
            if response.status_code == 200 and len(response.content) > 1000:
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                print(f"  ✓ Saved as {filename} ({len(response.content):,} bytes)")
            else:
                print(f"  ✗ Failed: {response.status_code}, {len(response.content)} bytes")
                
        except Exception as e:
            print(f"  ✗ Error: {e}")
    
    browser.close()

print("\n✓ Done!")
