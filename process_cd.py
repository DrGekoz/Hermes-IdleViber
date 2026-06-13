import os, glob, sys
from PIL import Image
import numpy as np

# Find latest generated image dir
dirs = sorted([d for d in glob.glob("/c/Users/josep/.codex/generated_images/*/") if os.path.isdir(d)], key=os.path.getmtime)
latest_dir = dirs[-1] if dirs else None
print("Latest dir:", latest_dir)
if not latest_dir:
    sys.exit(1)

files = glob.glob(os.path.join(latest_dir, "ig_*.png"))
if not files:
    print("No files found")
    sys.exit(1)
src = files[0]
print("Source:", src)

img = Image.open(src).convert("RGBA")
w, h = img.size
print(f"Size: {w}x{h}")

arr = np.array(img)
mask = (arr[:,:,0] > 200) & (arr[:,:,1] < 100) & (arr[:,:,2] > 200)
arr[mask] = [0,0,0,0]
mask2 = (arr[:,:,0] > 170) & (arr[:,:,1] < 130) & (arr[:,:,2] > 170)
arr[mask2] = [0,0,0,0]
result = Image.fromarray(arr, "RGBA")

grid_w, grid_h = w // 4, h // 4
out_dir = "F:/aaaaaVIBECODING/Hermes-IdleViber/sprites/images/icons/individual"

cd_items = ["cd_led", "cd_pi", "cd_switch", "cd_gaming_pc", "cd_render", "cd_server",
            "cd_datacenter", "cd_super", "cd_neural", "cd_ai_core", "cd_digital", "cd_cyberspace", "cd_techno"]

for idx, name in enumerate(cd_items):
    col, row = idx % 4, idx // 4
    icon = result.crop((col * grid_w, row * grid_h, (col + 1) * grid_w, (row + 1) * grid_h))
    icon64 = icon.resize((64, 64), Image.Resampling.NEAREST)
    png_path = os.path.join(out_dir, name + ".png")
    icon64.save(png_path)
    print(f"  {name}.png")
