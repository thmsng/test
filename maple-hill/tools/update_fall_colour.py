#!/usr/bin/env python3
"""Refresh the fall colour report built into maple-hill/landing-page.html.

Downloads https://www.ontarioparks.ca/fallcolour (or reads a saved copy), pulls out the
park reports the page embeds for its own map, cleans them up, and writes them:
  - into landing-page.html, between the PARK DATA markers
  - to data/fall-colour.json, for reference

Usage:
  python3 maple-hill/tools/update_fall_colour.py            # download the live report
  python3 maple-hill/tools/update_fall_colour.py saved.html # use a saved copy of the page
"""
import datetime as dt
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

SOURCE = 'https://www.ontarioparks.ca/fallcolour'
ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / 'landing-page.html'
JSON_OUT = ROOT / 'data' / 'fall-colour.json'
START, END = '<!-- PARK DATA:START -->', '<!-- PARK DATA:END -->'
TORONTO = dt.timezone(dt.timedelta(hours=-4))  # report dates fall in EDT (Sept to early Nov)
REGIONS = {'Northwest': 'Northwestern', 'Northeast': 'Northeastern'}


def fetch(arg):
    if arg:
        return Path(arg).read_text(encoding='utf-8')
    req = urllib.request.Request(SOURCE, headers={'User-Agent': 'Mozilla/5.0 (fall colour summary)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8')


def clean(text):
    text = re.sub(r'<[^>]+>', ' ', text or '')
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def as_int(v):
    try:
        return max(0, min(100, int(float(v))))
    except (TypeError, ValueError):
        return None


def parse(page):
    m = re.search(r'var data = (\[.*?\]);\s*\n', page)
    if not m:
        raise SystemExit('Could not find the park data on the Ontario Parks page. The page layout may have changed.')
    parks = []
    for d in json.loads(m.group(1)):
        cc, lf = as_int(d.get('colour_change')), as_int(d.get('leaf_fall'))
        try:
            lat, lng = float(d['lat']), float(d['lng'])
        except (KeyError, TypeError, ValueError):
            continue
        if cc is None or str(d.get('reporting', 'yes')).lower() != 'yes':
            continue
        ts = d.get('report_date')
        date = dt.datetime.fromtimestamp(int(ts), TORONTO).date().isoformat() if str(ts).isdigit() else None
        location = clean(d.get('location'))
        parks.append({
            'name': clean(d.get('park_name')),
            'area': '' if location.lower() == 'whole park' else location,
            'slug': re.sub(r'[^a-z0-9-]', '', str(d.get('shortname', '')).lower()),
            'region': REGIONS.get(clean(d.get('region')), clean(d.get('region'))),
            'change': cc,
            'fall': lf or 0,
            'colour': clean(d.get('dominant_colour')) or 'Green',
            'viewing': clean(d.get('viewing')),
            'date': date,
            'lat': round(lat, 4),
            'lng': round(lng, 4),
        })
    if len(parks) < 10:
        raise SystemExit(f'Only {len(parks)} park reports found; refusing to overwrite the page.')
    parks.sort(key=lambda p: p['name'])
    return parks


def main():
    parks = parse(fetch(sys.argv[1] if len(sys.argv) > 1 else None))
    payload = {
        'source': SOURCE,
        'retrieved': dt.datetime.now(TORONTO).date().isoformat(),
        'parks': parks,
    }
    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')

    page = PAGE.read_text(encoding='utf-8')
    a, b = page.find(START), page.find(END)
    if a < 0 or b < a:
        raise SystemExit(f'Could not find the {START} markers in {PAGE.name}.')
    blob = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    block = f'{START}\n<script type="application/json" id="parkData">{blob}</script>\n'
    PAGE.write_text(page[:a] + block + page[b:], encoding='utf-8')
    dates = sorted(p['date'] for p in parks if p['date'])
    print(f'{len(parks)} parks, reports from {dates[0]} to {dates[-1]}, written to {PAGE.name} and {JSON_OUT.name}')


if __name__ == '__main__':
    main()
