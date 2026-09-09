# -*- coding: utf-8 -*-
"""Derives the English artboards from the Arabic ones so both stay pixel-identical in design."""
import re, json
from tr_en import TR

ORDER = ['Main','Question','Blind','WhoMakes','WhatWeBuy','WhatChanged','TheWall','Solution','TheTeam',
         'Coordinator','Detective','Auditor','Strategist','TheReveal','TheMap','Journey','Outreach','TheMath','TheClose','Team']
TITLES = ['1 Cover','2 The Question','3 Nobody Can Tell','4 Raise Your Hand','5 Different Names','6 What Changed',
          '7 The 5-Year Wall','8 So What Now','9 Hire A Team','10 Coordinator','11 Detective','12 Auditor',
          '13 Advisor','14 The Reveal','15 The Map','16 One Request','17 Outreach','18 The Math','19 The Close','20 The Team']

AR_FONT = "'Thmanyah','Geeza Pro',Tahoma,sans-serif"
EN_FONT = "'Archivo','Geeza Pro','Helvetica Neue',Arial,sans-serif"
LINK_OLD = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap">'
LINK_NEW = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
            'family=Archivo:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500&display=swap">')
DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
KEYS = sorted(TR, key=len, reverse=True)


def tune_line_height(html):
    """Arabic line-heights are loose for its ascenders; Latin display type needs them tight."""
    def fix(m):
        style = m.group(1)
        fs = re.search(r'font-size:\s*(\d+)px', style)
        lh = re.search(r'line-height:\s*([\d.]+)\b', style)
        if not (fs and lh):
            return m.group(0)
        size, cur = int(fs.group(1)), float(lh.group(1))
        new = 1.06 if size >= 46 else 1.32 if size >= 30 else (1.55 if cur > 1.6 else cur)
        return 'style="' + style.replace(lh.group(0), 'line-height: ' + str(new)) + '"'
    return re.sub(r'style="([^"]*)"', fix, html)


W = 1392  # TheMap svg viewBox width


def mirror_path(d):
    out = []
    for cmd, body in re.findall(r'([MLHVQZ])([^MLHVQZ]*)', d):
        nums = re.findall(r'-?[\d.]+', body)
        if cmd in 'ML':
            pts = [(W - float(nums[i]), nums[i + 1]) for i in range(0, len(nums), 2)]
            out.append(cmd + ' '.join('%g,%s' % p for p in pts))
        elif cmd == 'H':
            out.append('H' + ' '.join('%g' % (W - float(n)) for n in nums))
        elif cmd == 'Q':
            pts = [(W - float(nums[i]), nums[i + 1]) for i in range(0, len(nums), 2)]
            out.append('Q' + ' '.join('%g,%s' % p for p in pts))
        else:
            out.append(cmd + body)
    return ''.join(out)


def mirror(svg):
    svg = re.sub(r'(<(?:rect|image)\b[^>]*?)x="([\d.]+)"([^>]*?width="([\d.]+)")',
                 lambda m: m.group(1) + 'x="%g"' % (W - float(m.group(2)) - float(m.group(4))) + m.group(3), svg)
    svg = re.sub(r'(<text\b[^>]*?)x="([\d.]+)"', lambda m: m.group(1) + 'x="%g"' % (W - float(m.group(2))), svg)
    svg = re.sub(r'(<path\b[^>]*?\sd=")([^"]+)"', lambda m: m.group(1) + mirror_path(m.group(2)) + '"', svg)
    return svg


def mirror_themap(html):
    """Mirror the diagram so it flows left to right, but leave the Saudi outline group unflipped."""
    m = re.search(r'<g transform="translate\((\d+),(\d+)\)">', html)
    tx, ty = int(m.group(1)), int(m.group(2))
    a = m.start()
    b = html.index('</g>', a) + 4
    head, group, tail = html[:a], html[a:b], html[b:]
    i = head.rindex('<svg')
    # the outline's own centre is at local x=98, so mirroring the frame means placing it here
    group = group.replace(m.group(0), '<g transform="translate(%g,%d)">' % (W - tx - 196, ty))
    return head[:i] + mirror(head[i:]) + group + mirror(tail)


def build(name):
    src = open(name + '.dc.html', encoding='utf-8').read()
    src = src.replace(LINK_OLD, LINK_NEW)
    src = re.sub(r"@font-face\{font-family:'Thmanyah';.*?\}", '', src, flags=re.S)
    src = src.replace('<div dir="rtl"', '<div dir="ltr"', 1)
    for k in KEYS:
        src = src.replace(k, TR[k])
    body_at = src.index('<div dir="ltr"')
    head, body = src[:body_at], src[body_at:]
    body = body.translate(DIGITS)
    body = (body.replace('border-right:4px', 'border-left:4px')
                .replace('padding-right:26px', 'padding-left:26px')
                .replace('border-right:1px solid #23201D', 'border-left:1px solid #23201D'))
    body = body.replace('&#8592;', '&#8594;')  # flow arrows follow the reading direction
    body = tune_line_height(body)
    if name == 'Team':
        body = body.replace('font-size:76px', 'font-size:64px')
    if name == 'Coordinator':
        body = body.replace('\u0635\u0645\u0627\u0645 \u0643\u0631\u0648\u064a 2 \u0628\u0648\u0635\u0629', '2-inch ball valve')
    if name == 'TheMap':
        body = mirror_themap(body)
        # the english source list is wider than its box, so set it on two lines
        body = re.sub(r'<text([^>]*?)y="78.0"([^>]*)>Registries[^<]*</text>',
                      lambda m: '<text%sy="73.0"%s>Registries \u00b7 tenders</text>'
                                '<text%sy="91.0"%s>certificates \u00b7 imports</text>'
                                % (m.group(1), m.group(2), m.group(1), m.group(2)), body)
    out = (head + body).replace(AR_FONT, EN_FONT)
    open('EN_' + name + '.dc.html', 'w', encoding='utf-8').write(out)


for n in ORDER + ['AsIs']:
    build(n)

cv = json.load(open('canvas.json', encoding='utf-8'))
cv['artboards'] = [a for a in cv['artboards'] if not a['file'].startswith('EN_')]
for i, (n, t) in enumerate(zip(ORDER, TITLES)):
    cv['artboards'].append({'file': 'EN_%s.dc.html' % n, 'title': t, 'x': (i % 4) * 1760,
                            'y': 8120 + (i // 4) * 1160, 'w': 1600, 'h': 900, 'page': 'page-1'})
cv['artboards'].append({'file': 'EN_AsIs.dc.html', 'title': 'Appendix · Without Us', 'x': 1760, 'y': 0,
                        'w': 1600, 'h': 900, 'page': 'page-2'})
json.dump(cv, open('canvas.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('built', len(ORDER) + 1, 'english artboards')
