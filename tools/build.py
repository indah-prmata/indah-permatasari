# Build the photo assets + data file for the Indah Permatasari site.
#   python tools\build.py            -> process every photo listed in SERIES (skips ones already built)
#   python tools\build.py --data     -> only rewrite data\photos.js (e.g. after dropping a clip into clips\)
# To add photos: append the source file name to a series below and run again.
import os, sys, json, numpy as np, cv2
from PIL import Image

SRC = r"C:\bahan edit web"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL, THUMB, DEPTH, CLIPS = (os.path.join(ROOT, *p) for p in (("img", "full"), ("img", "thumb"), ("img", "depth"), ("clips",)))
for d in (FULL, THUMB, DEPTH, CLIPS, os.path.join(ROOT, "data")): os.makedirs(d, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith((".png", ".jpg", ".jpeg")))
# index numbers follow the contact sheets in C:\indahpromo\sheets (alphabetical order of the source folder)
idx = {}
for line in open(r"C:\indahpromo\sheets\index.txt", encoding="utf-8"):
    i, f, _ = line.rstrip("\n").split("\t"); idx[int(i)] = f

SERIES = [
    dict(key="editorial", name="Editorial", code="ED", bg="#15171B", fg="#E8E6E1", glow="#8A9BB5",
         note="Studio, garis bersih, satu sumber cahaya.",
         photos=[64, 63, 62, 66, 65, 31, 32, 30, 33, 12, 13, 15, 16, 14, 57, 46, 48, 54, 55, 56, 49]),
    dict(key="noir", name="Noir", code="NR", bg="#0A0A0A", fg="#E8E6E1", glow="#FFFFFF",
         note="Hitam putih, panggung, dan bayangan panjang.",
         photos=[74, 72, 75, 76, 77, 78, 73, 71, 67, 69, 70, 82, 83, 86, 90, 91, 93, 95, 114, 117, 119, 120, 115, 122, 123, 126, 128, 129]),
    dict(key="nusantara", name="Nusantara", code="NS", bg="#1D1711", fg="#E8E6E1", glow="#D0915A",
         note="Kain, rumah lama, dan setelan retro.",
         photos=[164, 176, 172, 173, 174, 175, 177, 163, 166, 167, 170, 180, 181, 188, 189, 195, 184, 193]),
    dict(key="beauty", name="Beauty", code="BT", bg="#26120D", fg="#E8E6E1", glow="#FF5A2A",
         note="Wajah, kulit, dan cahaya hangat dari dekat.",
         photos=[104, 102, 105, 101, 103, 106, 11, 25]),
    dict(key="street", name="Street", code="ST", bg="#11171A", fg="#E8E6E1", glow="#58A6B0",
         note="Jakarta sehari-hari, apa adanya.",
         photos=[34, 41, 43, 38, 107, 109, 110, 111, 113, 112, 79, 80, 81, 5, 6, 7, 10]),
    dict(key="warna", name="Warna", code="WR", bg="#27131C", fg="#E8E6E1", glow="#FF4F93",
         note="Set penuh warna, dari studio merah muda sampai hutan tropis.",
         photos=[156, 162, 171, 178, 179, 157, 158, 159, 161, 165, 169, 155, 160, 168]),
]
EXTRA = dict(hero=30, hero_m=74)   # full-bleed opener, desktop / phone (the phone one is a centred portrait crop)
CROP_BOTTOM = {30: .07, 33: .07, 31: .035, 32: .035}   # trims a photographer signature off the bottom edge
COVER = "editorial-010"            # featured cover: subject cut-out so the masthead sits behind her head


def clean_corner(a):
    """Remove the small generator sparkle in the bottom-right corner (top-hat -> inpaint). No-op if none."""
    h, w = a.shape[:2]; y0, x0 = int(h * .88), int(w * .88)
    box = a[y0:, x0:]
    g = cv2.cvtColor(box, cv2.COLOR_RGB2GRAY)
    k = max(9, int(w * .03)) | 1
    th = cv2.morphologyEx(g, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    m = (th > 38).astype(np.uint8) * 255
    frac = m.mean() / 255
    if frac < .0015 or frac > .12: return a
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    a = a.copy(); a[y0:, x0:] = cv2.inpaint(box, m, 5, cv2.INPAINT_TELEA)
    return a


def grade(a):
    """One grade for everything: warm, soft contrast. Black-and-white stays black-and-white."""
    f = a.astype(np.float32) / 255
    sat = (f.max(axis=2) - f.min(axis=2)).mean()
    f = .022 + f * .962
    f = f + (f - f * f * (3 - 2 * f)) * .14
    lum = (f * np.array([.299, .587, .114], np.float32)).sum(axis=2, keepdims=True)
    f = lum + (f - lum) * (0 if sat < .035 else .93)
    f *= np.array([1.022, 1.0, .962], np.float32)
    return (np.clip(f, 0, 1) * 255).astype(np.uint8)


_sess = None
def depth_map(im):
    """Cheap depth for the browser parallax: subject mask (near) over a floor-to-wall gradient."""
    global _sess
    from rembg import remove, new_session
    if _sess is None: _sess = new_session("u2net")
    s = im.copy(); s.thumbnail((384, 384))
    m = np.asarray(remove(s, session=_sess, only_mask=True)).astype(np.float32) / 255
    h, w = m.shape
    m = cv2.GaussianBlur(m, (0, 0), 7)
    ramp = np.linspace(.0, 1.0, h, dtype=np.float32)[:, None] ** 1.6 * np.ones((1, w), np.float32)
    d = np.clip(.18 + .30 * ramp + .52 * m, 0, 1)
    return Image.fromarray((cv2.GaussianBlur(d, (0, 0), 3) * 255).astype(np.uint8))


def fit(im, side):
    im = im.copy(); im.thumbnail((side, side), Image.LANCZOS); return im


def source(i):
    a = np.asarray(Image.open(os.path.join(SRC, idx[i])).convert("RGB"))
    return np.ascontiguousarray(a[:int(a.shape[0] * (1 - CROP_BOTTOM.get(i, 0)))])


def cover_cutout():
    from rembg import remove, new_session
    im = Image.open(os.path.join(FULL, COVER + ".webp")).convert("RGB")
    fg = remove(im, session=new_session("isnet-general-use"))
    a = np.asarray(fg).copy(); al = a[:, :, 3].astype(np.float32) / 255
    a[:, :, 3] = (np.clip((cv2.GaussianBlur(al, (0, 0), 1.2) - .12) / .76, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(ROOT, "img", "cover-fg.webp"), "WEBP", quality=86, method=5)
    print("cover cut-out", flush=True)


def process(i, pid):
    out = os.path.join(FULL, pid + ".webp")
    if os.path.exists(out) and os.path.exists(os.path.join(DEPTH, pid + ".jpg")):
        with Image.open(out) as im: return im.size
    im = Image.fromarray(grade(clean_corner(source(i))))
    full = fit(im, 1600); full.save(out, "WEBP", quality=80, method=5)
    fit(im, 900).save(os.path.join(THUMB, pid + ".webp"), "WEBP", quality=76, method=5)
    depth_map(full).save(os.path.join(DEPTH, pid + ".jpg"), quality=72)
    print(pid, idx[i], full.size, flush=True)
    return full.size


def main():
    data_only = "--data" in sys.argv
    series, photos = [], []
    for s in SERIES:
        series.append({k: s[k] for k in ("key", "name", "code", "bg", "fg", "glow", "note")})
        for n, i in enumerate(s["photos"], 1):
            pid = "%s-%03d" % (s["key"], n)
            if data_only:
                with Image.open(os.path.join(FULL, pid + ".webp")) as im: w, h = im.size
            else:
                w, h = process(i, pid)
            photos.append(dict(id=pid, s=s["key"], n=n, w=w, h=h,
                               v=os.path.exists(os.path.join(CLIPS, pid + ".mp4"))))
    if not data_only:
        for name, i in EXTRA.items():
            im = Image.fromarray(grade(clean_corner(source(i))))
            if name == "hero_m" and im.width > im.height:
                w = int(im.height * .6); x = (im.width - w) // 2; im = im.crop((x, 0, x + w, im.height))
            big = fit(im, 2400 if name == "hero" else 1400)
            big.save(os.path.join(ROOT, "img", name + ".webp"), "WEBP", quality=82, method=5)
            depth_map(big).save(os.path.join(ROOT, "img", name + "-depth.jpg"), quality=72)
            print(name, big.size, flush=True)
        cover_cutout()
    js = json.dumps(dict(series=series, photos=photos), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, "data", "photos.json"), "w", encoding="utf-8").write(js)
    open(os.path.join(ROOT, "data", "photos.js"), "w", encoding="utf-8").write("window.INDAH=" + js + ";")
    print("DONE", len(photos), "photos", flush=True)

main()
