"""Turn OpenStreetMap data for Google's The Dalles campus into compact local geometry (metres).

Inputs (data/osm/, © OpenStreetMap contributors, ODbL):
  thedalles-campus.json        site areas, buildings, substations, power lines
  thedalles-surroundings.json  roads, ponds
  thedalles-water-rel.json     Lake Bonneville (Columbia River) and Taylor Lake relations
Output: data/thedalles-geo.json   x = east, z = south (scene convention: north = -z)

Run: python3 data/build_thedalles_geo.py
"""
import json, math, pathlib

HERE = pathlib.Path(__file__).parent
LAT0, LON0 = 45.630, -121.205
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110540
HALF = 2600  # keep a 5.2 km square around the campus

def xy(p):
    return ((p['lon'] - LON0) * KX, -(p['lat'] - LAT0) * KZ)

def r1(v):
    return round(v, 1)

def assemble(ways):
    """Join way geometries end-to-end into closed rings."""
    segs = [[xy(p) for p in w] for w in ways if len(w) > 1]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]: ring += s[1:]
                elif s[-1] == ring[-1]: ring += s[-2::-1]
                elif s[-1] == ring[0]: ring = s[:-1] + ring
                elif s[0] == ring[0]: ring = s[::-1][:-1] + ring
                else: continue
                segs.pop(i); changed = True; break
        rings.append(ring)
    return rings

def clip(ring, h=HALF):
    """Sutherland–Hodgman clip of a polygon to the square [-h, h]²."""
    def edge(pts, inside, cut):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a): out.append(cut(a, b))
                out.append(b)
            elif inside(a):
                out.append(cut(a, b))
        return out
    def cx(v):
        return lambda a, b: (v, a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]))
    def cz(v):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]), v)
    pts = ring
    for inside, cut in [(lambda p: p[0] >= -h, cx(-h)), (lambda p: p[0] <= h, cx(h)), (lambda p: p[1] >= -h, cz(-h)), (lambda p: p[1] <= h, cz(h))]:
        pts = edge(pts, inside, cut) if pts else pts
    return pts

def simplify(pts, tol=3.0):
    """Drop points closer than tol metres to the previous kept point."""
    out = [pts[0]]
    for p in pts[1:]:
        if math.dist(p, out[-1]) >= tol: out.append(p)
    return out

campus = json.load(open(HERE / 'osm/thedalles-campus.json'))['elements']
around = json.load(open(HERE / 'osm/thedalles-surroundings.json'))['elements']
rels = json.load(open(HERE / 'osm/thedalles-water-rel.json'))['elements']

geo = {'meta': {'origin': [LAT0, LON0], 'units': 'metres; x east, z south', 'source': 'OpenStreetMap contributors (ODbL)', 'retrieved': '2026-11-09'},
       'sites': [], 'buildings': [], 'substations': [], 'powerlines': [], 'water': [], 'roads': []}

for e in campus:
    t = e.get('tags', {})
    g = [xy(p) for p in e.get('geometry', [])]
    rec = lambda: [[r1(a), r1(b)] for a, b in g]
    if 'landuse' in t:
        geo['sites'].append({'name': t.get('name'), 'ring': rec()})
    elif t.get('power') == 'substation':
        geo['substations'].append({'operator': t.get('operator'), 'ring': rec()})
    elif t.get('power') == 'line':
        pts = [p for p in g if abs(p[0]) < HALF and abs(p[1]) < HALF]
        if len(pts) > 1: geo['powerlines'].append({'name': t.get('name'), 'line': [[r1(a), r1(b)] for a, b in pts]})
    elif 'building' in t:
        geo['buildings'].append({'id': e['id'], 'operator': t.get('operator'), 'ring': rec()})

for e in rels:
    outers = [m['geometry'] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
    for ring in assemble(outers):
        c = clip(ring)
        if len(c) > 3:
            geo['water'].append({'name': e.get('tags', {}).get('name'), 'ring': [[r1(a), r1(b)] for a, b in simplify(c)]})

for e in around:
    t = e.get('tags', {})
    g = [xy(p) for p in e.get('geometry', [])]
    if t.get('natural') == 'water' and e['type'] == 'way':
        c = clip(g)
        if len(c) > 3: geo['water'].append({'name': t.get('name') or 'pond', 'ring': [[r1(a), r1(b)] for a, b in simplify(c, 2)]})
    elif t.get('highway') and t['highway'] != 'service':
        pts = [p for p in g if abs(p[0]) < HALF and abs(p[1]) < HALF]
        if len(pts) > 1: geo['roads'].append({'kind': t['highway'], 'line': [[r1(a), r1(b)] for a, b in pts]})

(HERE / 'thedalles-geo.json').write_text(json.dumps(geo, separators=(',', ':')))
print({k: len(v) for k, v in geo.items() if isinstance(v, list)}, f"{(HERE / 'thedalles-geo.json').stat().st_size // 1024} KB")
