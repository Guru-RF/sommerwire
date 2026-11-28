# Sommerwire, by ON9PK Koen Van den Heuvel. Upstream material: Unlicense. Original RF.Guru fork contributions: Apache-2.0. See repository LICENSE.
# Usage: python3 tools/make_logo.py brand
# Generates the Sommerwire logo SVGs: a vertical antenna on the ground with its radiated wavefronts,
# and their faint mirror image below the ground (image theory / Sommerfeld ground).
import math, os, sys
out = sys.argv[1]
LIGHT = dict(a='#1d4ed8', b='#0e8fb5', text='#13294b', sub='#5b6876', ground='#94a3b8')
DARK  = dict(a='#3b82f6', b='#22d3ee', text='#e3e9ef', sub='#93a1b0', ground='#56677a')

def mark(x0, y0, s, gid):
    """Mark drawn in a 120x120 box at (x0, y0) scaled by s."""
    P = lambda x, y: f'{x0 + x * s:.2f},{y0 + y * s:.2f}'
    gy, cx, gap, sw = 86, 60, 7.5, 5
    parts = []
    def arcs(r, below=False):
        h = math.sqrt(r * r - gap * gap)
        sgn = 1 if below else -1
        ys = gy + sgn * h
        # left: from ground up to the gap; right: from the gap down to the ground
        sweepL = 0 if below else 1
        return (f'M{P(cx - r, gy)} A{r*s:.2f},{r*s:.2f} 0 0 {sweepL} {P(cx - gap, ys)} '
                f'M{P(cx + gap, ys)} A{r*s:.2f},{r*s:.2f} 0 0 {sweepL} {P(cx + r, gy)}')
    up = ' '.join(arcs(r) for r in (19, 30, 41, 52))
    dn = ' '.join(arcs(r, True) for r in (19, 30))
    w = sw * s
    parts.append(f'<path class="sw-gnd" d="M{P(2, gy)} L{P(118, gy)}" stroke-width="{2.4*s:.2f}" stroke-linecap="round"/>')
    parts.append(f'<g opacity="0.28" stroke="url(#{gid})" stroke-width="{w:.2f}" stroke-linecap="round" fill="none"><path d="{dn}"/>'
                 f'<path d="M{P(cx, gy + 4)} L{P(cx, gy + 28)}" stroke-dasharray="{4*s:.2f} {5*s:.2f}"/></g>')
    parts.append(f'<g stroke="url(#{gid})" stroke-width="{w:.2f}" stroke-linecap="round" fill="none"><path d="{up}"/>'
                 f'<path d="M{P(cx, gy)} L{P(cx, 30)}"/><circle cx="{x0 + cx*s:.2f}" cy="{y0 + 23.5*s:.2f}" r="{6*s:.2f}"/></g>')
    return '\n  '.join(parts)

def grad(gid, x1, y1, x2, y2):
    return (f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'
            f'<stop offset="0" class="sw-a"/><stop offset="1" class="sw-b"/></linearGradient>')

def style(mode):
    def rules(c):
        return (f'.sw-a{{stop-color:{c["a"]}}} .sw-b{{stop-color:{c["b"]}}} .sw-gnd{{stroke:{c["ground"]}}} '
                f'.sw-name{{fill:url(#swg)}} .sw-sub{{fill:{c["sub"]}}}')
    if mode == 'light': return rules(LIGHT)
    if mode == 'dark': return rules(DARK)
    return rules(LIGHT) + ' @media (prefers-color-scheme: dark){' + rules(DARK) + '}'

FONT = "font-family=\"'IBM Plex Sans','Helvetica Neue',Arial,sans-serif\""
def stacked(mode):
    W, H = 360, 330
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Sommerwire, Wire Antenna Modeler">
  <defs>{grad('swg', 40, 40, 320, 260)}</defs>
  <style>{style(mode)}</style>
  {mark(75, 4, 1.75, 'swg')}
  <text class="sw-name" x="{W/2}" y="266" text-anchor="middle" {FONT} font-size="37" font-weight="700" textLength="318" lengthAdjust="spacing">SOMMERWIRE</text>
  <text class="sw-sub" x="{W/2}" y="300" text-anchor="middle" {FONT} font-size="15" font-weight="500" textLength="316" lengthAdjust="spacing">WIRE ANTENNA MODELER</text>
</svg>
'''
def horizontal(mode):
    W, H = 440, 112
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Sommerwire, Wire Antenna Modeler">
  <defs>{grad('swg', 0, 0, 420, 110)}</defs>
  <style>{style(mode)}</style>
  {mark(0, 0, 0.93, 'swg')}
  <text class="sw-name" x="124" y="62" {FONT} font-size="35" font-weight="700" textLength="306" lengthAdjust="spacing">SOMMERWIRE</text>
  <text class="sw-sub" x="125" y="90" {FONT} font-size="14" font-weight="500" textLength="304" lengthAdjust="spacing">WIRE ANTENNA MODELER</text>
</svg>
'''
def icon(mode):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Sommerwire">
  <defs>{grad('swg', 10, 10, 110, 100)}</defs>
  <style>{style(mode)}</style>
  {mark(0, -1, 1, 'swg')}
</svg>
'''
for name, fn in [('logo', stacked), ('logo-horizontal', horizontal), ('icon', icon)]:
    for mode in ('auto', 'light', 'dark'):
        fn_name = f'{name}.svg' if mode == 'auto' else f'{name}-{mode}.svg'
        open(os.path.join(out, fn_name), 'w').write(fn(mode))
# the app header draws the same mark inline: print it with  python3 tools/make_logo.py <dir> --inline
if '--inline' in sys.argv: print(mark(0, 0, 1, 'swhg'))
print('ok')
