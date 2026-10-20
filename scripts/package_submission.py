"""Package only course deliverables and reproducible source/data, no live DB."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = '侯福宽ERP课程作业报告'
TARGET = ROOT.parent / NAME
SOURCE = TARGET / '源代码和数据集' / 'metamall'


def allowed(path):
    relative = path.relative_to(ROOT)
    if any(p in {'.git', '.venv', 'output', '.playwright-cli', '__pycache__', 'media', 'staticfiles'} for p in relative.parts):
        return False
    if path.suffix in {'.pyc', '.pyo', '.log', '.sqlite3'} or path.name == '.env':
        return False
    if relative.parts[0] == 'docs' and '方案审查' in path.name:
        return False
    return True


if __name__ == '__main__':
    assert TARGET.resolve().parent == ROOT.parent.resolve()
    if TARGET.exists() and not (TARGET / '交付清单.json').exists():
        raise RuntimeError('Existing submission folder is not managed by this script: ' + str(TARGET))
    TARGET.mkdir(exist_ok=True)
    files = []
    for name in ['manage.py', 'requirements.txt', 'README.md', '.gitignore']:
        files.append(ROOT / name)
    for folder in ['config', 'mall', 'commerce', 'templates', 'static', 'dataset', 'scripts', 'docs']:
        files.extend(p for p in (ROOT / folder).rglob('*') if p.is_file() and allowed(p))
    for path in files:
        destination = SOURCE / path.relative_to(ROOT)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    for name in [NAME + '.docx', NAME + '.pdf', '元宇宙商圈_课程汇报.pptx', '元宇宙商圈_课程汇报.pdf', '新版演示与验证说明.md']:
        shutil.copy2(ROOT / 'docs' / name, TARGET / name)
    manifest = {
        'version': 'v4-20261020', 'site': 'http://10.24.116.90:3002/',
        'report': NAME + '.docx', 'source': '源代码和数据集/metamall',
        'dataset': '源代码和数据集/metamall/dataset/seed.json',
        'note': 'Fresh seed: 3 factories, 3 stores, 12 products, 3 coupons. The fourth store is a live builder publication. No private live database, virtualenv or git history included.',
        'files': {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)},
    }
    (TARGET / '交付清单.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    archive = TARGET.with_suffix('.zip')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in TARGET.rglob('*'):
            if p.is_file(): z.write(p, str(p.relative_to(TARGET.parent)))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        names = z.namelist()
        assert any(n.endswith('/dataset/seed.json') for n in names)
        assert any(n.endswith('/' + NAME + '.docx') for n in names)
        assert not any('/.venv/' in n or '/.git/' in n or n.endswith('db.sqlite3') for n in names)
    print(json.dumps({'zip':str(archive),'bytes':archive.stat().st_size,'source_files':len(files),'zip_entries':len(names)},ensure_ascii=False))
