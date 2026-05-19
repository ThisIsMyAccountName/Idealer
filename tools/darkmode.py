#!/usr/bin/env python3
"""Property-aware light->semi-dark token rewrite for styles.css.

Strategy:
- Replace the :root block with a warm-charcoal token system (existing var
  names kept + redefined so their ~25 consumers flip too).
- For every color literal, classify by the CSS property it sits in (text /
  background / border / shadow) and by HSL:
    * saturated bg/gradient/fill  -> KEEP (bespoke art keeps ember identity)
    * saturated text              -> hue-bucketed accent token (readable on dark)
    * low-sat near-white bg       -> surface tokens by elevation
    * low-sat dark/mid text       -> --text / --muted
    * low-sat border              -> --border / --border-strong
    * dark rgba (shadow/scrim)    -> stronger black
    * white rgba sheen            -> dim light overlay
- Custom props --ship-*/--x/--y/--cols/--drop-icon-size are left alone.
"""
import re, colorsys, sys

SRC = "styles.css"

ROOT_BLOCK = """:root {
  /* warm-charcoal semi-dark theme */
  --surface-1: #1f1c17;   /* app background, deepest */
  --surface-2: #2a251d;   /* cards / panels */
  --surface-3: #34302a;   /* inputs / hover / nested */
  --surface-4: #3f3a31;   /* chips / highest elevation */
  --text: #ece3d2;
  --text-dim: #cdc3ad;
  --muted: #a99e88;
  --border: #3a3327;
  --border-strong: #4b4336;
  --accent: #e6622a;
  --accent-soft: #f0875a;
  --accent-2: #2cbcae;
  --good: #5fc07c;
  --warn: #e0ad48;
  --danger: #e36a63;
  --info: #5fa8e4;
  --arcane: #bd9fe6;
  --shadow: rgba(0, 0, 0, 0.45);
  --hi: rgba(255, 247, 235, 0.05);
  /* legacy names kept so existing var() consumers re-theme */
  --bg: var(--surface-1);
  --paper: var(--surface-2);
  --ink: var(--text);
  --card-border: var(--border);
  --foil: var(--surface-4);
  --glow: rgba(230, 98, 42, 0.22);
}"""

def to_rgb(s):
    s = s.strip()
    m = re.fullmatch(r'#([0-9a-fA-F]{3})', s)
    if m:
        h = m.group(1)
        return tuple(int(c*2, 16) for c in h) + (1.0,)
    m = re.fullmatch(r'#([0-9a-fA-F]{6})', s)
    if m:
        h = m.group(1)
        return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), 1.0)
    m = re.fullmatch(r'rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)', s)
    if m:
        a = float(m.group(4)) if m.group(4) is not None else 1.0
        return (float(m.group(1)), float(m.group(2)), float(m.group(3)), a)
    return None

def hsl(r,g,b):
    h,l,sat = colorsys.rgb_to_hls(r/255, g/255, b/255)
    return h*360, sat, l

def accent_token(hue):
    if hue >= 345 or hue < 12:   return "var(--danger)"
    if hue < 40:                 return "var(--accent)"
    if hue < 70:                 return "var(--warn)"
    if hue < 165:                return "var(--good)"
    if hue < 205:                return "var(--accent-2)"
    if hue < 255:                return "var(--info)"
    return "var(--arcane)"

def chroma(r, g, b):
    return (max(r, g, b) - min(r, g, b)) / 255.0

# warm-brown parchment "ink" band: looks like text, not an accent
def is_brown_ink(hue, ch):
    return 18 <= hue <= 52 and ch < 0.46

# role: 'text' | 'bg' | 'border' | 'shadow' | 'keep'
def classify(lit, role):
    rgb = to_rgb(lit)
    if rgb is None:
        return None
    r,g,b,a = rgb
    hue, sat, lum = hsl(r,g,b)
    whiteish = min(r,g,b) >= 232
    darkish  = max(r,g,b) <= 60

    if a < 1.0:  # rgba
        ch = chroma(r, g, b)
        if darkish or role == 'shadow':
            na = min(0.6, round(a*1.7, 3))
            return f"rgba(0, 0, 0, {na})"
        light = lum >= 0.62
        if light and ch < 0.32:                 # white / parchment tint
            if role == 'bg':
                return "var(--surface-2)" if a >= 0.55 else "var(--hi)"
            if role == 'border':
                return f"rgba(120, 110, 95, {a})"
            if role == 'text':
                return "var(--text)" if a >= 0.5 else None
            return "var(--hi)"
        if ch >= 0.30:            # genuine colored glow / accent wash
            return None           # keep
        # low-sat mid tone
        if role == 'bg':
            return "var(--surface-3)" if a >= 0.5 else "var(--hi)"
        if role == 'border':
            return f"rgba(120, 110, 95, {a})"
        return "var(--muted)"

    # opaque hex
    if role == 'shadow':
        return None
    ch = chroma(r, g, b)
    brown_ink = is_brown_ink(hue, ch)
    true_accent = sat >= 0.30 and 0.12 < lum < 0.95 and ch >= 0.17 and not brown_ink

    if role == 'text':
        if true_accent:
            return accent_token(hue)
        if lum >= 0.72:           # already light text on a dark accent
            return None
        if lum < 0.50:            return "var(--text)"
        return "var(--muted)"
    if true_accent:
        return None               # bg/border accent art -> keep identity
    if sat >= 0.30 and 0.12 < lum < 0.90 and not brown_ink:
        return None               # other saturated content -> keep
    if role == 'border':
        return "var(--border)" if lum >= 0.45 else "var(--border-strong)"
    if role == 'bg':
        if lum >= 0.90:           return "var(--surface-2)"
        if lum >= 0.78:           return "var(--surface-3)"
        if lum >= 0.50:           return "var(--surface-4)"
        return None               # already dark-ish, leave
    return None

PROP_RE = re.compile(r'([-a-zA-Z]+)\s*:')
COLOR_RE = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)')
SKIP_PROPS = ("--ship", "--x", "--y", "--cols", "--drop-icon-size")

def role_for(prop):
    if prop is None: return 'bg'
    p = prop.lower()
    if p == 'color': return 'text'
    if 'shadow' in p: return 'shadow'
    if p.startswith('border') or p == 'outline' or p == 'outline-color': return 'border'
    if p in ('background','background-color','background-image','fill','stroke',
             'background:') or p.startswith('background'): return 'bg'
    if p.startswith('--'): return 'bg'   # custom props (card-stripe etc.)
    return 'bg'

src = open(SRC, encoding='utf-8').read()

# 1) swap the leading :root{...} block
end = src.index('}', src.index(':root')) + 1
body = src[end:]
summary = {}

def transform_line(line):
    # find last property name before each color (handles multi-decl lines)
    out = []
    pos = 0
    for m in COLOR_RE.finditer(line):
        seg_before = line[:m.start()]
        props = PROP_RE.findall(seg_before)
        prop = props[-1] if props else None
        if prop and any(prop.startswith(s) for s in SKIP_PROPS):
            continue
        role = role_for(prop)
        repl = classify(m.group(0), role)
        if repl and repl != m.group(0):
            key = (m.group(0), role, repl)
            summary[key] = summary.get(key, 0) + 1
            out.append((m.start(), m.end(), repl))
    if not out:
        return line
    res, last = [], 0
    for s,e,r in out:
        res.append(line[last:s]); res.append(r); last = e
    res.append(line[last:])
    return ''.join(res)

new_body = '\n'.join(transform_line(l) for l in body.split('\n'))
open(SRC, 'w', encoding='utf-8').write(ROOT_BLOCK + new_body)

print(f"rewrote {sum(summary.values())} color occurrences "
      f"({len(summary)} distinct literal/role/target combos)\n")
for (lit, role, repl), n in sorted(summary.items(), key=lambda kv:(-kv[1])):
    print(f"  {n:3d}  [{role:7}] {lit:<28} -> {repl}")
