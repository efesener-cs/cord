#!/usr/bin/env python3
"""Render the approved shared vector logo into native launcher and splash assets."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
logo = root / 'packages/ui/src/assets/cord-logo.svg'
res = root / 'apps/mobile/android/app/src/main/res'

def render(path: Path, size: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['magick', '-background', '#a8bd8b', str(logo), '-resize', f'{size}x{size}', '-alpha', 'remove', str(path)], check=True)

for density, size in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    directory = res / f'mipmap-{density}'
    for name in ['ic_launcher.png', 'ic_launcher_round.png']:
        render(directory / name, size)
    foreground = size * 108 // 48
    subprocess.run(['magick', '-background', 'none', str(logo), '-resize', f'{foreground * 2 // 3}x{foreground * 2 // 3}', '-gravity', 'center', '-background', 'none', '-extent', f'{foreground}x{foreground}', str(directory / 'ic_launcher_foreground.png')], check=True)

render(root / 'apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024)
render(root / 'apps/desktop/resources/cord.png', 512)
render(root / 'apps/desktop/public/cord-icon.png', 256)
subprocess.run(['magick', str(root / 'apps/desktop/resources/cord.png'), '-define', 'icon:auto-resize=256,128,64,48,32,16', str(root / 'apps/desktop/resources/cord.ico')], check=True)
for path in list(res.glob('drawable*/splash.png')) + list((root / 'apps/mobile/ios/App/App/Assets.xcassets/Splash.imageset').glob('*.png')):
    size = subprocess.check_output(['magick', str(path), '-format', '%wx%h', 'info:'], text=True).strip()
    width, height = map(int, size.split('x'))
    mark = min(width, height) // 4
    subprocess.run(['magick', '-size', size, 'xc:#0e0f0f', '(', '-background', 'none', str(logo), '-resize', f'{mark}x{mark}', ')', '-gravity', 'center', '-composite', str(path)], check=True)
