# -*- coding: utf-8 -*-

import os
from PIL import Image

folder = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

def compress_pngs(folder, max_size=160):
    for root, _, files in os.walk(folder):
        for file in files:
            if file.lower().endswith('.png'):
                file_path = os.path.join(root, file)
                try:
                    img = Image.open(file_path)
                    # 计算缩放尺寸，最大边为max_size
                    w, h = img.size
                    if w > h:
                        new_w = max_size
                        new_h = int(h * max_size / w)
                    else:
                        new_h = max_size
                        new_w = int(w * max_size / h)
                    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    img.save(file_path, optimize=True)
                    print(f'Compressed: {file_path} ({w}x{h} -> {new_w}x{new_h})')
                except Exception as e:
                    print(f'Error processing {file_path}: {e}')

if __name__ == '__main__':
    compress_pngs(folder, max_size=160)
