"""Use the already installed/cached Playwright CLI; never install dependencies."""
from pathlib import Path
import argparse
import json
import os
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('script',type=Path)
    parser.add_argument('--session',default='erp_v3')
    args=parser.parse_args()
    node=Path(os.environ.get('METAMALL_NODE',str(Path.home()/'AppData/Local/npm-cache/_npx/9e308f29f5e381cc/node_modules/node/bin/node.exe')))
    cli=Path(os.environ.get('METAMALL_PLAYWRIGHT_CLI',str(Path.home()/'AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js')))
    if not node.is_file() or not cli.is_file():
        raise SystemExit('Set METAMALL_NODE and METAMALL_PLAYWRIGHT_CLI to existing tools. This script does not install them.')
    source=args.script.resolve()
    result=subprocess.run([str(node),str(cli),'--session='+args.session,'run-code','--filename',str(source)],capture_output=True,cwd=ROOT)
    source.with_suffix('.log').write_bytes(result.stdout+result.stderr)
    output=result.stdout.decode('utf-8',errors='replace')
    match=re.search(r'### Result\s+(\{.*?\})\s+### Ran',output,re.S)
    if not match:
        print(output[:3000]);raise SystemExit(1)
    evidence=json.loads(match[1])
    source.with_suffix('.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'result':str(source.with_suffix('.json')),'errors':evidence.get('errors',[]),'failed':evidence.get('failed',[])},ensure_ascii=False))
