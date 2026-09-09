"""Validate rendered screenshots and package only the upload-ready PNG files.

Pillow is used for lossless file-format normalization and QA contact sheets;
the artwork itself is rendered by Koubou from the HTML/CSS templates.
"""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parent
NAMES = ['01-home', '02-cheki', '03-event', '04-artist', '05-calendar', '06-stats']
SETS = [('iphone', 'iphone-6.9', (1320, 2868)), ('ipad', 'ipad-13', (2064, 2752))]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--profile', choices=['original', 'iphone-6.5'], default='original')
args = parser.parse_args()
compatibility = args.profile == 'iphone-6.5'
if compatibility:
    SETS = [('iphone', 'iphone-6.5', (1284, 2778))]
RAW_SIZES = {'iphone': (1320, 2868), 'ipad': (2064, 2752)}
manifest = {'language': 'zh-Hans', 'date': '2026-09-09', 'profile': args.profile, 'files': []}

for platform, folder, size in SETS:
    target = ROOT / 'ready' / 'zh-Hans' / folder
    target.mkdir(parents=True, exist_ok=True)
    sources = sorted((ROOT / 'export' / folder).rglob('*.png'))
    assert [p.stem for p in sources] == NAMES, 'Expected exactly six ordered screenshots'
    for source in sources:
        layout = json.loads(source.with_suffix('.layout.json').read_text())
        assert not layout['overlaps'], f'Layout overlap: {source}'
        for element in layout['elements']:
            assert element['x'] >= 0 and element['y'] >= 0
            assert element['x'] + element['width'] <= 1.001
            assert element['y'] + element['height'] <= 1.001
        raw = ROOT / 'raw' / platform / source.name
        with Image.open(raw) as original:
            assert original.size == RAW_SIZES[platform], f'Wrong simulator screenshot size: {raw}'
        destination = target / source.name
        with Image.open(source) as rendered:
            assert rendered.size == size, f'Wrong export size: {source}'
            if rendered.mode == 'RGBA':
                assert rendered.getchannel('A').getextrema() == (255, 255), 'Unexpected transparency'
            else:
                assert rendered.mode == 'RGB', f'Unexpected color mode: {rendered.mode}'
            rendered.convert('RGB').save(destination, format='PNG', optimize=True)
        with Image.open(destination) as checked:
            checked.verify()
        manifest['files'].append({
            'path': str(destination.relative_to(ROOT)), 'width': size[0], 'height': size[1],
            'mode': 'RGB', 'alpha': False, 'bytes': destination.stat().st_size,
            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
            'rawSha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
            'layoutInBounds': True, 'layoutOverlaps': 0,
        })

    # Preview sheets are for review only; never include them in the upload ZIP.
    cell_width = 440
    cell_height = round(cell_width * size[1] / size[0])
    gap = 20
    preview = Image.new('RGB', (cell_width * 3 + gap * 4, cell_height * 2 + gap * 3), '#e3e7eb')
    for index, name in enumerate(NAMES):
        with Image.open(target / (name + '.png')) as shot:
            shot.thumbnail((cell_width, cell_height), Image.Resampling.LANCZOS)
            preview.paste(shot, (gap + (index % 3) * (cell_width + gap), gap + (index // 3) * (cell_height + gap)))
    preview_name = folder if compatibility else platform
    preview.save(ROOT / f'preview-{preview_name}.jpg', quality=94, subsampling=0)

validation_name = 'validation-iphone-6.5.json' if compatibility else 'validation.json'
(ROOT / 'qa' / validation_name).write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
archives = []
for _, folder, _ in SETS:
    archive = ROOT / f'ota-log-app-store-{folder}-zh-Hans.zip'
    entries = [entry for entry in manifest['files'] if f'/{folder}/' in entry['path']]
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as package:
        for entry in entries:
            path = ROOT / entry['path']
            package.write(path, path.name)
    with zipfile.ZipFile(archive) as package:
        assert sorted(package.namelist()) == [name + '.png' for name in NAMES]
        assert package.testzip() is None
    archives.append({'path': str(archive), 'bytes': archive.stat().st_size})
print(json.dumps({'validated': len(manifest['files']), 'archives': archives}, ensure_ascii=False))
