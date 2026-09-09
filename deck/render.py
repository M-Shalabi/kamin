# -*- coding: utf-8 -*-
"""Renders artboards to PDF with fonts and images inlined, so exports keep their typography.

  python3 render.py                     both decks and the combined file
  python3 render.py --only TheWall      one artboard, to /tmp, for a spot check
"""
import base64
import os
import re
import subprocess
import sys

ORDER = ['Main', 'Question', 'Blind', 'WhoMakes', 'WhatWeBuy', 'WhatChanged', 'TheWall', 'Solution',
         'TheTeam', 'TheReveal', 'TheMap', 'Discovery', 'Decisions', 'TheMath', 'Suppliers',
         'TheClose', 'Team']

ASSETS = ['fig-coordinator.png', 'fig-detective.png', 'fig-auditor.png', 'fig-advisor.png',
          'logo-etimad.png', 'logo-mim.png', 'logo-saudimade.png', 'logo-lcgpa.png', 'logo-gastat.svg',
          'logo-hrsd.png', 'logo-moc.png', 'logo-sca.png',
          'face-mohammed.jpg', 'face-ali.jpg', 'face-abdulaziz.jpg']

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OUT_DIR = '/Users/mohammedshalabi/workspace/personal'
PAGE_CSS = """
<style>@page{size:1600px 900px;margin:0}html,body{margin:0;padding:0;background:#0B0A09}
.page{width:1600px;height:900px;overflow:hidden;position:relative;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}</style></head><body>
"""


def _mime(f):
    if f.endswith('.svg'):
        return 'image/svg+xml'
    return 'image/jpeg' if f.endswith(('.jpg', '.jpeg')) else 'image/png'


def _inlined():
    out = {}
    for f in ASSETS:
        if os.path.exists(f):
            out[f] = 'data:' + _mime(f) + ';base64,' + base64.b64encode(open(f, 'rb').read()).decode()
    return out


IMGS = _inlined()


def page(name):
    src = open(name + '.dc.html', encoding='utf-8').read()
    body = re.search(r'(<div dir="(?:rtl|ltr)".*?)\n</x-dc>', src, re.S).group(1)
    for f, uri in IMGS.items():
        body = body.replace('src="' + f + '"', 'src="' + uri + '"')
    return '<div class="page">' + body + '</div>'


def helmet(name):
    return re.search(r'<helmet>(.*?)</helmet>', open(name + '.dc.html', encoding='utf-8').read(), re.S).group(1)


def render(names, head, out_path):
    tmp = '_render_tmp.html'
    open(tmp, 'w', encoding='utf-8').write(
        '<!doctype html><html><head><meta charset="utf-8">' + head + PAGE_CSS
        + '\n'.join(page(n) for n in names) + '\n</body></html>')
    if os.path.exists(out_path):
        os.remove(out_path)
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
                    '--allow-file-access-from-files', '--virtual-time-budget=45000',
                    '--print-to-pdf-no-header', '--print-to-pdf=' + out_path,
                    'file://' + os.getcwd() + '/' + tmp], capture_output=True)
    os.remove(tmp)
    print(os.path.basename(out_path), os.path.getsize(out_path), 'bytes,', len(names), 'pages')


if __name__ == '__main__':
    if '--only' in sys.argv:
        picks = sys.argv[sys.argv.index('--only') + 1].split(',')
        names = [n if os.path.exists(n + '.dc.html') else 'EN_' + n for n in picks]
        render(names, helmet(names[0]), '/tmp/spot-check.pdf')
    else:
        ar, en = ORDER, ['EN_' + n for n in ORDER]
        combined = helmet('Main').replace(
            'family=IBM+Plex+Mono:wght@400;500',
            'family=Archivo:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500')
        render(ar, helmet('Main'), OUT_DIR + '/KAMIN-Pitch-Deck-AR.pdf')
        render(en, helmet('EN_Main'), OUT_DIR + '/KAMIN-Pitch-Deck-EN.pdf')
        render(ar + en, combined, OUT_DIR + '/KAMIN-Pitch-Deck.pdf')
