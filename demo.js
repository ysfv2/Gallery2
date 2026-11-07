/* Demo library used only when the page runs in a normal browser (no phone).
   It lets you preview the whole UI on a PC. Ignored inside the APK. */
(function () {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return;

  const titles = [
    ['健全な♡はいりません！！ 下心100％の♡くださいｗ_2.     Hi @grok ,who is she , why she is so famou on X 0m', 'Twitter'],
    ['Sunset over the bay, timelapse #sunset #timelapse #photography 1m', 'Twitter'],
    ['new kitten update 🐱 #cats #cute #catsoftwitter 0m', 'Twitter'],
    ['Speedrun world record attempt, full run #gaming #speedrun #worldrecord 8m', 'Twitter'],
    ['اطلالة جميلة على البحر #الكويت #بحر #kuwait 0m', 'Twitter'],
    ['Pixel art study: forest at night #pixelart #gamedev #indiedev 0m', 'Twitter'],
    ['Synthwave loop I made at 3am #synthwave #loop #music 2m', 'Twitter'],
    ['Coffee art tutorial in 60 seconds #coffee #latteart 1m', 'Twitter'],
    ['IMG_20261104_181233.jpg', 'Camera'],
    ['Screenshot_20261101-224410.png', 'Screenshots'],
    ['Mountain road trip #travel #roadtrip #photography #nature 0m', 'Download'],
    ['Build log day 12: voxel terrain finally works #gamedev #python #pygame #voxel 3m', 'Twitter']
  ];
  const sizes = [[1080, 1350], [1080, 1080], [1280, 720], [720, 1280], [1200, 800]];
  const items = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 56; i++) {
    const t = titles[i % titles.length];
    const sz = sizes[(i * 7) % sizes.length];
    const kind = (i % 3 === 1) ? 'v' : 'i';
    const isGif = kind === 'i' && i % 11 === 4;
    const ext = kind === 'v' ? '.mp4' : (isGif ? '.gif' : (t[0].endsWith('.png') ? '' : '.jpg'));
    let name = t[0].match(/\.(jpg|png)$/) ? t[0] : t[0] + ext;
    if (i >= titles.length) name = name.replace(/(\.\w+)$/, ' (' + Math.floor(i / titles.length) + ')$1');
    const hue = (i * 47) % 360;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + sz[0] + '" height="' + sz[1] + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',70%,45%)"/>' +
      '<stop offset="1" stop-color="hsl(' + ((hue + 70) % 360) + ',70%,25%)"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/>' +
      '<text x="50%" y="50%" fill="#fff" fill-opacity=".85" font-family="sans-serif" font-size="' + Math.round(sz[0] / 9) + '" text-anchor="middle">#' + (i + 1) + '</text></svg>';
    const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    items.push({
      id: 1000 + i, n: name, k: kind, m: isGif ? 'image/gif' : (kind === 'v' ? 'video/mp4' : 'image/jpeg'),
      r: 'Pictures/' + t[1] + '/', f: t[1], a: now - i * 5400 - (i * i * 37), s: 400000 + i * 91234,
      d: kind === 'v' ? (13 + i) * 1000 : 0, w: sz[0], h: sz[1],
      v: i % 5 === 0 ? 1 : 0, thumb: url, url: kind === 'v' ? 'demo/clip1.mp4' : url
    });
  }
  window.DEMO = { items: items };
})();
