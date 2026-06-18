#!/usr/bin/env python3
"""
Process a single generated icon: chroma-key removal → center-crop → NEAREST 64x64 → lossless WebP
Usage: python process_single_icon.py <input.png> <output_id> <output_dir>
  input.png: path to the Codex-generated icon on chroma-key background
  output_id: the icon ID (e.g. 'cg_spark')
  output_dir: target directory (e.g. 'sprites/images/icons/individual/' or 'sprites/images/room_decor/icons/')
"""
import sys, os
from PIL import Image

def remove_chroma_key(im, key_color=(255, 0, 255), threshold=30):
    """Remove chroma-key background and add alpha channel."""
    im = im.convert('RGBA')
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Check if pixel is close to key color
            dr, dg, db = abs(r - key_color[0]), abs(g - key_color[1]), abs(b - key_color[2])
            if dr < threshold and dg < threshold and db < threshold:
                pixels[x, y] = (r, g, b, 0)
    return im

def process_icon(input_path, output_id, output_dir, target_size=64):
    """Full processing pipeline."""
    print(f"Processing: {output_id}")
    print(f"  Input: {input_path}")
    
    # Open image
    im = Image.open(input_path)
    print(f"  Original size: {im.size}, Mode: {im.mode}")
    
    # Remove chroma-key background
    im = remove_chroma_key(im)
    print(f"  After chroma-key removal: {im.size}, Mode: {im.mode}")
    
    # Center-crop to square
    w, h = im.size
    sq = min(w, h)
    cx, cy = w // 2, h // 2
    im_sq = im.crop((cx - sq//2, cy - sq//2, cx + sq//2, cy + sq//2))
    print(f"  After center-crop: {im_sq.size}")
    
    # NEAREST resize to target size (preserves crisp pixel edges)
    im_resized = im_sq.resize((target_size, target_size), Image.Resampling.NEAREST)
    print(f"  After NEAREST resize: {im_resized.size}")
    
    # Save as lossless WebP with alpha
    os.makedirs(output_dir, exist_ok=True)
    
    # Save _64 version
    output_path_64 = os.path.join(output_dir, f"{output_id}_{target_size}.webp")
    im_resized.save(output_path_64, format='WEBP', lossless=True, quality=100)
    print(f"  Saved: {output_path_64}")
    print(f"  Size on disk: {os.path.getsize(output_path_64)} bytes")
    
    # Save non-64 version too (for decor which doesn't use _64)
    output_path = os.path.join(output_dir, f"{output_id}.webp")
    im_resized.save(output_path, format='WEBP', lossless=True, quality=100)
    print(f"  Saved: {output_path}")
    print(f"  Size on disk: {os.path.getsize(output_path)} bytes")
    
    return True

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python process_single_icon.py <input.png> <output_id> <output_dir>")
        sys.exit(1)
    input_path = sys.argv[1]
    output_id = sys.argv[2]
    output_dir = sys.argv[3]
    process_icon(input_path, output_id, output_dir)
