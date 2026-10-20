"""Export the generated documents using already installed Microsoft Office."""
from pathlib import Path
import json
import shutil
import win32com.client

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'

if __name__ == '__main__':
    source = DOCS / '侯福宽ERP课程作业报告.docx'
    word = win32com.client.DispatchEx('Word.Application')
    word.Visible = False
    word.DisplayAlerts = 0
    document = None
    try:
        document = word.Documents.Open(str(source), ReadOnly=True)
        document.Repaginate()
        document.ExportAsFixedFormat(str(source.with_suffix('.pdf')), 17)
    finally:
        if document is not None:
            document.Close(False)
        word.Quit()
    powerpoint = win32com.client.DispatchEx('PowerPoint.Application')
    deck = None
    try:
        source = DOCS / '元宇宙商圈_课程汇报.pptx'
        deck = powerpoint.Presentations.Open(str(source), ReadOnly=True, WithWindow=False)
        # SaveAs avoids optional COM interface arguments in ExportAsFixedFormat.
        deck.SaveAs(str(source.with_suffix('.pdf')), 32)
    finally:
        if deck is not None:
            deck.Close()
        powerpoint.Quit()
    for suffix in ['.pptx', '.pdf']:
        source = DOCS / ('元宇宙商圈_课程汇报' + suffix)
        shutil.copy2(source, ROOT.parent / source.name)
    print(json.dumps({'exported': [p.name for p in DOCS.glob('*.pdf')]}, ensure_ascii=False))
