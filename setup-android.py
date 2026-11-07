#!/usr/bin/env python3
"""Run after `npx cap add android`. Adds the native gallery plugin, permissions,
black theme and the dice launcher icon. Safe to run more than once."""
import re, shutil, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
app = root / "android" / "app" / "src" / "main"
pkg_dir = app / "java" / "com" / "yousef" / "gallery"
res = app / "res"

# 1) Java sources (package must match appId in capacitor.config.json)
pkg_dir.mkdir(parents=True, exist_ok=True)
for f in (root / "native").glob("*.java"):
    shutil.copy(f, pkg_dir / f.name)

# 2) Android 10+ only (lets us use MediaStore folders + thumbnails without fallbacks)
vg = root / "android" / "variables.gradle"
t = vg.read_text()
vg.write_text(re.sub(r"minSdkVersion\s*=\s*\d+", "minSdkVersion = 29", t))

# 3) Manifest permissions
mf = app / "AndroidManifest.xml"
m = mf.read_text()
if "READ_MEDIA_IMAGES" not in m:
    perms = (
        '    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />\n'
        '    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />\n'
        '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n'
    )
    m = m.replace("</manifest>", perms + "</manifest>")
    mf.write_text(m)

# 4) Black status/navigation bars
st = res / "values" / "styles.xml"
s = st.read_text()
if "statusBarColor" not in s:
    s = s.replace(
        '<item name="android:background">@null</item>',
        '<item name="android:background">@null</item>\n'
        '        <item name="android:statusBarColor">#000000</item>\n'
        '        <item name="android:navigationBarColor">#000000</item>',
    )
    st.write_text(s)

# 5) Launcher icon: blue square with a white die
(res / "drawable").mkdir(exist_ok=True)
shutil.copy(root / "native" / "ic_launcher_foreground.xml", res / "drawable" / "ic_launcher_dice.xml")
(res / "values" / "ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#1D9BF0</color>\n</resources>\n'
)
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    (res / "mipmap-anydpi-v26" / name).write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@drawable/ic_launcher_dice"/>\n'
        '</adaptive-icon>\n'
    )
print("Android project patched.")
