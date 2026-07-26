# -*- coding: utf-8 -*-
"""
Make RO the primary locale of the imported AllClean site: RO pages move to the site ROOT, RU pages
move under /ru. Swaps the two URL namespaces (/ro <-> root, root <-> /ru) in BOTH the page metadata
(slug/file/id/group + index defaultLocale) AND the mirrored HTML (nav href, canonical, og:url,
hreflang). x-default hreflang is repointed to the new default (RO/root).

Idempotent-ish: run ONCE on a fresh mirror (root=RU, /ro=RO). Reads public/import/allclean, writes a
sibling temp dir, which the caller swaps into place after verification.
"""
import json, os, re, sys, io

SRC = os.path.join("public", "import", "allclean")
OUT = os.path.join("public", "import", "allclean__ro")

BASE = "https://allclean.md"
# Root-relative first path segments that are ASSETS/utility, never page routes → left untouched.
ASSET_FIRST = {"images", "video", "fonts", "js", "_astro", "cdn", "css", "assets"}
ASSET_EXACT = {"logo.svg", "favicon.ico", "favicon.svg", "favicon-32x32.png", "favicon-16x16.png",
               "apple-touch-icon.png", "sitemap.xml", "sitemap-index.xml", "robots.txt",
               "site.webmanifest", "manifest.json", "browserconfig.xml"}

def is_asset(path):
    seg = path.lstrip("/").split("/", 1)[0]
    return seg in ASSET_FIRST or seg in ASSET_EXACT or seg.startswith("favicon")

def map_path(p):
    """Map a site path to its new namespace. /ro* -> root ; root(page) -> /ru ; assets unchanged."""
    if p in ("/ro", "/ro/"):
        return "/"
    if p.startswith("/ro/"):
        return p[3:]            # /ro/about -> /about
    if p == "/":
        return "/ru"
    if is_asset(p) or p.startswith("#"):
        return p
    return "/ru" + p            # /about -> /ru/about ; /services/office -> /ru/services/office

def swap_html(html):
    # 1) Absolute allclean.md URLs (canonical, og:url, hreflang href, any absolute nav).
    def abs_sub(m):
        path = m.group(1) or "/"
        return BASE + map_path(path)
    html = re.sub(r'https://allclean\.md(/[^"\'\s)>]*)?', abs_sub, html)
    # 2) Root-relative href / action (navigation). src/srcset (assets) are left alone.
    def rel_sub(m):
        attr, path = m.group(1), m.group(2)
        return '%s="%s"' % (attr, map_path(path))
    html = re.sub(r'(href|action)="(/[^"]*)"', rel_sub, html)
    # 3) x-default must point to the DEFAULT locale (now RO = root) → set it to the ro-MD alternate.
    ro_href = re.search(r'hreflang="ro-MD"\s+href="([^"]+)"', html)
    if ro_href:
        html = re.sub(r'(hreflang="x-default"\s+href=")[^"]+(")',
                      lambda m: m.group(1) + ro_href.group(1) + m.group(2), html)
    return html

HTML_FIELDS = ["prefix", "suffix", "bodyPrefix", "pwOpen", "mainOpen", "pwClose", "mainClose", "tailScripts"]

def new_file_name(lang, old_file):
    if lang == "ru":
        return "ru" if old_file == "index" else "ru__" + old_file
    # ro
    if old_file == "ro":
        return "index"
    return old_file[len("ro__"):] if old_file.startswith("ro__") else old_file

def new_id(lang, old_id):
    if lang == "ru":
        return "ru/" + old_id
    if old_id.startswith("ro/"):
        return old_id[3:]
    return old_id

def transform_page(page):
    for f in HTML_FIELDS:
        if isinstance(page.get(f), str):
            page[f] = swap_html(page[f])
    for b in page.get("blocks", []):
        b["content"]["html"] = swap_html(b["content"]["html"])
    page["slug"] = map_path(page["slug"])
    page["group"] = map_path(page["group"])
    return page

def main():
    idx = json.load(io.open(os.path.join(SRC, "_pages.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    new_pages = []
    for entry in idx["pages"]:
        lang = entry["lang"]
        old_file = entry["file"]
        page = json.load(io.open(os.path.join(SRC, old_file + ".json"), encoding="utf-8"))
        nf = new_file_name(lang, old_file)
        page["id"] = new_id(lang, page["id"])
        page = transform_page(page)
        # write full page json (binary utf-8, LF — matches the mirror's byte convention)
        with io.open(os.path.join(OUT, nf + ".json"), "w", encoding="utf-8", newline="\n") as fh:
            json.dump(page, fh, ensure_ascii=False)
        # index entry (lightweight)
        ne = dict(entry)
        ne["file"] = nf
        ne["id"] = page["id"]
        ne["slug"] = page["slug"]
        ne["group"] = page["group"]
        new_pages.append(ne)
    idx["pages"] = new_pages
    idx["defaultLocale"] = "ro"
    idx["locales"] = ["ro", "ru"]
    with io.open(os.path.join(OUT, "_pages.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(idx, fh, ensure_ascii=False)
    print("OK: wrote", len(new_pages), "pages to", OUT)

if __name__ == "__main__":
    main()
