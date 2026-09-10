# -*- coding: utf-8 -*-
"""Embeds the deck's fonts into the .pptx package.

Naming a font in the XML only works if the machine opening the file already has
it. That is exactly how v1 failed: the markup was correct and every glyph still
fell back, because Thmanyah and IBM Plex were installed nowhere.

OOXML lets a presentation carry its own fonts. This walks the package and adds:

  ppt/theme/theme1.xml             major/minor fonts, so new text inherits them
  ppt/fonts/fontN.fntdata          the raw TrueType data
  ppt/_rels/presentation.xml.rels  a relationship per face
  [Content_Types].xml              the fntdata default
  presentation.xml                 <p:embeddedFontLst>, first child per schema

Each embedded font declares up to four faces (regular, bold, italic, boldItalic).
We ship regular and bold; PowerPoint synthesises the rest if it needs them.

Run: python3 pptx_embed_fonts.py <in.pptx> [out.pptx]
"""
import os
import shutil
import sys
import zipfile
from lxml import etree

P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
CT = "{http://schemas.openxmlformats.org/package/2006/content-types}"
PR = "{http://schemas.openxmlformats.org/package/2006/relationships}"

FONT_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"

FONTS = os.path.expanduser("~/Library/Fonts")

# typeface name -> {face: filename}. These are the names the slides ask for.
WANTED = {
    "IBM Plex Sans Arabic": {
        "regular": "IBMPlexSansArabic-Regular.ttf",
        "bold": "IBMPlexSansArabic-Bold.ttf",
    },
    "IBM Plex Mono": {
        "regular": "IBMPlexMono-Regular.ttf",
        "bold": "IBMPlexMono-SemiBold.ttf",
    },
}


A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

# The theme python-pptx starts from declares Calibri with empty complex-script
# entries. Every run in the deck overrides it, so the slides render correctly
# either way — but anyone who edits the file and types gets Calibri, and any
# Arabic they type falls back to a system default. Setting the scheme fonts
# makes the deck editable in its own typeface.
def retheme(xml: bytes) -> bytes:
    t = etree.fromstring(xml)
    changed = 0
    for scheme, face in (("majorFont", "IBM Plex Sans Arabic"),
                         ("minorFont", "IBM Plex Sans Arabic")):
        el = t.find(f".//{A}fontScheme/{A}{scheme}")
        if el is None:
            continue
        for tag in ("latin", "ea", "cs"):
            child = el.find(A + tag)
            if child is None:
                child = etree.SubElement(el, A + tag)
            child.set("typeface", face)
            changed += 1
    return etree.tostring(t, xml_declaration=True, encoding="UTF-8", standalone=True), changed


def embed(src, dst):
    tmp = dst + ".tmp"
    shutil.copyfile(src, tmp)

    with zipfile.ZipFile(tmp) as z:
        names = z.namelist()
        parts = {n: z.read(n) for n in names}

    pres = etree.fromstring(parts["ppt/presentation.xml"])
    rels = etree.fromstring(parts["ppt/_rels/presentation.xml.rels"])
    ctypes = etree.fromstring(parts["[Content_Types].xml"])

    # Highest existing rId, so new ones do not collide.
    used = {r.get("Id") for r in rels}
    n = 1
    def next_id():
        nonlocal n
        while f"rId{n}" in used:
            n += 1
        rid = f"rId{n}"
        used.add(rid)
        return rid

    # <p:embeddedFontLst> must be the first child of <p:presentation> that
    # follows sldMasterIdLst/sldIdLst — in practice PowerPoint places it after
    # sldSz/notesSz, so we insert before sldSz and let the schema order hold.
    old = pres.find(P + "embeddedFontLst")
    if old is not None:
        pres.remove(old)
    lst = etree.Element(P + "embeddedFontLst")

    added, missing = [], []
    idx = 0
    for typeface, faces in WANTED.items():
        font_el = etree.SubElement(lst, P + "embeddedFont")
        fnt = etree.SubElement(font_el, P + "font")
        fnt.set("typeface", typeface)
        fnt.set("pitchFamily", "34")
        fnt.set("charset", "0")
        any_face = False
        for face, filename in faces.items():
            path = os.path.join(FONTS, filename)
            if not os.path.exists(path):
                missing.append(filename)
                continue
            idx += 1
            part = f"ppt/fonts/font{idx}.fntdata"
            parts[part] = open(path, "rb").read()
            rid = next_id()
            rel = etree.SubElement(rels, PR + "Relationship")
            rel.set("Id", rid)
            rel.set("Type", FONT_REL)
            rel.set("Target", f"fonts/font{idx}.fntdata")
            el = etree.SubElement(font_el, P + face)
            el.set(R + "id", rid)
            added.append((typeface, face, filename, len(parts[part])))
            any_face = True
        if not any_face:
            lst.remove(font_el)

    if len(lst):
        sldsz = pres.find(P + "sldSz")
        if sldsz is not None:
            sldsz.addprevious(lst)
        else:
            pres.append(lst)

    # The package needs to know what a .fntdata part is.
    if not any(d.get("Extension") == "fntdata" for d in ctypes.findall(CT + "Default")):
        d = etree.Element(CT + "Default")
        d.set("Extension", "fntdata")
        d.set("ContentType", "application/x-fontdata")
        ctypes.insert(0, d)

    themed = 0
    for name in list(parts):
        if name.startswith("ppt/theme/theme") and name.endswith(".xml"):
            parts[name], n = retheme(parts[name])
            themed += n

    parts["ppt/presentation.xml"] = etree.tostring(pres, xml_declaration=True, encoding="UTF-8", standalone=True)
    parts["ppt/_rels/presentation.xml.rels"] = etree.tostring(rels, xml_declaration=True, encoding="UTF-8", standalone=True)
    parts["[Content_Types].xml"] = etree.tostring(ctypes, xml_declaration=True, encoding="UTF-8", standalone=True)

    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data)
    os.remove(tmp)

    for typeface, face, filename, size in added:
        print(f"  embedded {typeface:24} {face:10} {filename:34} {size:>9,} bytes")
    for m in missing:
        print(f"  MISSING  {m}")
    print(f"  theme font entries rewritten: {themed}")
    return len(added)


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    count = embed(src, dst)
    print(f"\n{count} font faces embedded into {dst} ({os.path.getsize(dst):,} bytes)")
