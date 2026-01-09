import re
import os
import requests

md_file = "src/posts/havok-engine-reverse-engineering.md"
img_dir = "public/images/havok-engine"

os.makedirs(img_dir, exist_ok=True)

pattern = re.compile(r'(?:!\[.*?\]\()?(https://github.com/user-attachments/assets/[a-zA-Z0-9\-]+)')

with open(md_file, encoding='utf-8') as f:
    text = f.read()

urls = sorted(set(pattern.findall(text)))

print(f"Found {len(urls)} images")

for i, url in enumerate(urls):
    if i == 0:
        fn = "header.png"
    else:
        fn = f"image-{i}.png"
    
    out = os.path.join(img_dir, fn)
    
    print(f"Downloading {url} → {fn}")
    try:
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        if r.status_code == 200 and len(r.content) > 1000:
            with open(out, "wb") as w:
                w.write(r.content)
            print(f"  ✓ Success ({len(r.content)} bytes)")
            
            # Replace with local path
            text = text.replace(url, f"/images/havok-engine/{fn}")
        else:
            print(f"  ✗ Failed ({len(r.content)} bytes)")
    except Exception as e:
        print(f"  ✗ Error: {e}")

with open(md_file, "w", encoding='utf-8') as f:
    f.write(text)

print("\nDone! Updated markdown with local image paths.")
