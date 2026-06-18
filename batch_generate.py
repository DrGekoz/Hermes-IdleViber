#!/usr/bin/env python3
"""Process Codex-generated icon: black removal -> content auto-crop -> 128x128 WebP"""
import sys, os, glob, shutil
from PIL import Image

def process_icon(icon_id, output_subdir, img_path=None):
    """Process a single icon: find content bbox, crop tight, NEAREST to 128x128."""
    if img_path is None:
        codex_dir = r'C:\Users\josep\.codex\generated_images'
        if not os.path.isdir(codex_dir):
            print(f"ERROR: {codex_dir} not found"); return False
        dirs = sorted([d for d in os.listdir(codex_dir) if os.path.isdir(os.path.join(codex_dir, d))])
        if not dirs: print("ERROR: No sessions"); return False
        latest = dirs[-1]
        imgs = sorted(glob.glob(os.path.join(codex_dir, latest, 'ig_*.png')))
        if not imgs: print(f"ERROR: No PNG in {latest}"); return False
        img_path = imgs[0]
    
    print(f"Processing: {icon_id}")
    
    im = Image.open(img_path).convert('RGBA')
    w, h = im.size
    pixels = im.load()
    
    # Remove black background and find content bounds
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r < 10 and g < 10 and b < 10:
                pixels[x, y] = (r, g, b, 0)  # Remove black
            else:
                xs.append(x); ys.append(y)
    
    if not xs:
        print("  WARNING: No content found, using full image")
        bbox = (0, 0, w, h)
    else:
        padding = 15
        x1 = max(0, min(xs) - padding)
        y1 = max(0, min(ys) - padding)
        x2 = min(w, max(xs) + padding)
        y2 = min(h, max(ys) + padding)
        bbox = (x1, y1, x2, y2)
    
    print(f"  Source: {w}x{h}, Content bbox: {bbox[2]-bbox[0]}x{bbox[3]-bbox[1]}")
    
    # Crop tight to content
    im_crop = im.crop(bbox)
    
    # Make square (max dimension, center-crop to square)
    cw, ch = im_crop.size
    sq = max(cw, ch)
    im_sq = Image.new('RGBA', (sq, sq), (0, 0, 0, 0))
    paste_x = (sq - cw) // 2
    paste_y = (sq - ch) // 2
    im_sq.paste(im_crop, (paste_x, paste_y))
    
    # NEAREST resize to 128x128
    im_128 = im_sq.resize((128, 128), Image.Resampling.NEAREST)
    print(f"  Output: 128x128")
    
    # Determine output directory
    if output_subdir == 'icons/individual':
        out_dir = r'F:\aaaaaVIBECODING\Hermes-IdleViber\sprites\images\icons\individual'
    elif output_subdir == 'room_decor/icons':
        out_dir = r'F:\aaaaaVIBECODING\Hermes-IdleViber\sprites\images\room_decor\icons'
    else:
        out_dir = os.path.join(r'F:\aaaaaVIBECODING\Hermes-IdleViber\sprites\images', output_subdir)
    
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{icon_id}.webp")
    im_128.save(path, format='WEBP', lossless=True, quality=100)
    print(f"  Saved: {icon_id}.webp ({os.path.getsize(path)} bytes)")
    return True

def process_latest_as(icon_id, output_subdir):
    """Convenience: process latest Codex image as given icon_id."""
    return process_icon(icon_id, output_subdir)

def batch_process(icon_ids, output_subdir, img_paths):
    """Process multiple icons from a list of image paths."""
    results = []
    for i, icon_id in enumerate(icon_ids):
        if i < len(img_paths):
            ok = process_icon(icon_id, output_subdir, img_paths[i])
            results.append(ok)
    return all(results)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python batch_generate.py <icon_id> <output_subdir>")
        sys.exit(1)
    sys.exit(0 if process_latest_as(sys.argv[1], sys.argv[2]) else 1)
