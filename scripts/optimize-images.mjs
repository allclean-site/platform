// Картинки собранного сайта — последний проход по out/, после localize-cdn.
//
// Замер 17.10.2026: на главной 2,4 МБ картинок, 15 из хранилища Supabase (у части no-cache),
// PNG на 656 КБ, ни у одного <img> нет width/height, lazy почти нигде. Что делается:
//  1. Фото из хранилища (замены клиента) скачиваются и отдаются со своего домена, /media/… —
//     с годовым кэшем (vercel.json). Имя файла сохраняется, меняется только папка.
//  2. JPEG и PNG → WebP рядом, если WebP меньше; src и srcset переписываются.
//  3. width/height настоящего файла: место под фото резервируется до загрузки. Чтобы атрибуты
//     не задали размер там, где его раньше давал сам файл, такие <img> помечены data-wh, и для
//     них width/height:auto (:where — правило слабее любого правила шаблона).
//  4. Всё вне первой секции <main> (ниже неё и закрытое меню шапки), кроме бегущих лент, —
//     loading=lazy и decoding=async. Первое фото первой
//     секции — fetchpriority=high, если там нет видео (у видео постер уже в preload).
//  5. Фоновое видео: preload=metadata вместо auto.
//
// Правила замены фото (applyMedia) отрабатывают раньше, на HTML страниц, и холст кабинета этот
// проход не видит: меняется только адрес и атрибуты, само фото то же.
// Нет sharp или сети — сборка не падает: картинка остаётся прежней, в логе предупреждение.
import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { closeOf } from "./seo-fixes.mjs";

const OUT = "out";
const SITE = "https://allclean.md";
const CACHE = join("node_modules", ".cache", "lg-media"); // скачанное из хранилища между сборками
const STORAGE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/(article-images\/[^"'\s?#]+)$/i;
const RASTER = /\.(jpe?g|png)$/i;
const WH_CSS = '<style id="lg-img-wh">img:where([data-wh]){width:auto;height:auto}</style>';

// Фото лент ниже первого экрана не спорят с первым экраном за сеть, но успевают до прокрутки.
const NEAR = '<script id="lg-near">(function(){function go(b){var l=b.querySelectorAll("img[data-lg-near]");for(var i=0;i<l.length;i++){l[i].loading="eager";l[i].removeAttribute("data-lg-near");}}' +
  'function arm(){var im=document.querySelectorAll("img[data-lg-near]");if(!im.length)return;if(!window.IntersectionObserver)return go(document);' +
  'var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);go(e.target);}});},{rootMargin:"1000px 0px"});' +
  'var seen=[];for(var i=0;i<im.length;i++){var s=im[i].closest("section")||document.body;if(seen.indexOf(s)<0){seen.push(s);io.observe(s);}}}' +
  'if(document.readyState==="complete")arm();else window.addEventListener("load",arm);})();</script>';

const exists = (p) => access(p).then(() => true, () => false);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(f)));
    else if (e.name.endsWith(".html")) out.push(f);
  }
  return out;
}

export async function optimizeImages() {
  let sharp;
  try { sharp = (await import("sharp")).default; } catch { console.warn("[images] нет sharp — WebP и размеры пропущены"); }
  const files = await walk(OUT);
  const pages = new Map();
  for (const f of files) pages.set(f, await readFile(f, "utf8"));

  // Все адреса из <img> вне скриптов.
  const urls = new Set();
  // fn(кусок, его начало в html) — только для кусков вне <script>.
  const outsideScripts = (html, fn) => {
    let off = 0;
    return html.split(/(<script\b[\s\S]*?<\/script>)/i).map((part, i) => { const at = off; off += part.length; return i % 2 ? part : fn(part, at); }).join("");
  };
  const srcsOf = (tag) => {
    const list = [];
    const src = tag.match(/\ssrc="([^"]+)"/); if (src) list.push(src[1]);
    const set = tag.match(/\ssrcset="([^"]+)"/); if (set) for (const c of set[1].split(",")) { const u = c.trim().split(/\s+/)[0]; if (u) list.push(u); }
    return list;
  };
  for (const html of pages.values()) outsideScripts(html, (part) => { for (const t of part.match(/<img\b[^>]*>/gi) || []) srcsOf(t).forEach((u) => urls.add(u)); return part; });
  // …и фото хранилища вне <img>: вторая картинка статьи стоит только в её разметке.
  for (const html of pages.values()) for (const m of html.matchAll(/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/article-images\/[^"'\s?#)\\]+/gi)) urls.add(m[0]);

  // адрес → { url: новый адрес, w, h }
  const map = new Map();
  let fetched = 0, webp = 0, saved = 0, failed = 0;
  for (const u of urls) {
    let buf, local, rel;
    const sb = u.match(STORAGE);
    if (sb) {
      rel = "/media/" + decodeURIComponent(sb[1].replace(/^article-images\//, ""));
      const cached = join(CACHE, rel);
      if (await exists(cached)) buf = await readFile(cached);
      else {
        const r = await fetch(u).catch(() => null);
        if (!r || !r.ok) { console.warn(`[images] НЕ СКАЧАЛОСЬ ${r ? r.status : "сеть"} ${u}`); failed++; continue; }
        buf = Buffer.from(await r.arrayBuffer());
        await mkdir(dirname(cached), { recursive: true });
        await writeFile(cached, buf);
        fetched++;
      }
    } else if (u.startsWith("/") && !u.startsWith("//")) {
      rel = u.split(/[?#]/)[0];
      local = join(OUT, decodeURIComponent(rel));
      if (!(await exists(local))) continue;
      buf = await readFile(local);
    } else continue;

    const entry = { url: rel };
    if (sharp) {
      try {
        const meta = await sharp(buf).metadata();
        const turned = (meta.orientation || 1) >= 5;
        entry.w = turned ? meta.height : meta.width;
        entry.h = turned ? meta.width : meta.height;
        if (RASTER.test(rel)) {
          const out = await sharp(buf).rotate().webp({ quality: 80 }).toBuffer();
          if (out.length < buf.length * 0.95) {
            entry.url = rel.replace(RASTER, ".webp");
            await mkdir(dirname(join(OUT, entry.url)), { recursive: true });
            await writeFile(join(OUT, entry.url), out);
            webp++; saved += buf.length - out.length;
          }
        }
      } catch (e) { console.warn(`[images] не разобрал ${u}: ${e.message}`); }
    }
    // Исходник из хранилища кладём рядом в любом случае: на него ссылаются srcset, og:image и разметка.
    if (sb) { entry.storage = rel; await mkdir(dirname(join(OUT, rel)), { recursive: true }); await writeFile(join(OUT, rel), buf); }
    map.set(u, entry);
  }

  // Переписываем <img>.
  let tags = 0;
  for (const [f, html] of pages) {
    const main = html.indexOf("<main");
    const firstEnd = main < 0 ? -1 : html.indexOf("</section>", main);
    const heroVideo = main >= 0 && /<video\b/i.test(html.slice(main, firstEnd));
    // Бегущие ленты и слайдеры: карточки за правым краем обрезаны контейнером, и lazy не
    // грузит их, пока они не въедут в кадр, — карточка проезжала бы пустой.
    const tracks = [];
    for (const m of html.matchAll(/<(div|section|ul)\b[^>]*\sclass="[^"]*(?:marquee|w-slider)[^"]*"[^>]*>/gi)) {
      const end = closeOf(html, m.index, m[1]);
      if (end) tracks.push([m.index, end[1]]);
    }
    const inTrack = (pos) => tracks.some(([a, b]) => pos > a && pos < b);
    let hiDone = false;
    let out = outsideScripts(html, (part, base) => {
      return part.replace(/<img\b[^>]*>/gi, (tag, at) => {
        const pos = base + at;
        let t = tag;
        for (const u of srcsOf(tag)) {
          const e = map.get(u);
          if (e && e.url !== u) t = t.split(u).join(e.url);
        }
        const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
        const e = src && map.get(src);
        if (e && e.w && e.h && !/\swidth=/.test(t) && !/\sheight=/.test(t)) t = t.replace(/^<img\b/i, `<img width="${e.w}" height="${e.h}" data-wh`);
        // Вне первой секции — и ниже, и в шапке: там кроме логотипа (у него loading=eager)
        // только карточки выпадающего меню, которое закрыто.
        const inHero = main >= 0 && pos > main && pos < firstEnd;
        const below = !inHero && !inTrack(pos);
        if (below && !/\sloading=/.test(t)) t = t.replace(/^<img\b/i, '<img loading="lazy"');
        if (below && !/\sdecoding=/.test(t)) t = t.replace(/^<img\b/i, '<img decoding="async"');
        // Ленты ниже первой секции: lazy с меткой, а грузит их скрипт NEAR после load, когда секция
        // в 1000px от экрана, — все карточки сразу, чтобы ни одна не проехала пустой.
        if (!inHero && inTrack(pos) && !/\sloading=/.test(t)) t = t.replace(/^<img\b/i, '<img loading="lazy" decoding="async" data-lg-near');
        if (inHero && !heroVideo && !hiDone && e && RASTER.test(src.split(/[?#]/)[0]) && !/\sfetchpriority=/.test(t)) {
          t = t.replace(/^<img\b/i, '<img fetchpriority="high"').replace(/\sloading="lazy"/, "");
          hiDone = true;
        }
        if (t !== tag) tags++;
        return t;
      });
    });
    // og:image, twitter:image и image в разметке статьи вели в хранилище: «private, no-cache», чужой
    // домен для поиска по картинкам. Там нужен полный адрес и JPEG как есть — его и отдаём со своего.
    for (const [u, e] of map) if (e.storage && out.includes(u)) out = out.split(u).join(SITE + e.storage);
    out = out.replace(/(<video\b[^>]*\spreload=")auto(")/gi, "$1metadata$2");
    if (out.includes("data-lg-near") && !out.includes('id="lg-near"')) out = out.replace(/<\/body>(?![\s\S]*<\/body>)/, NEAR + "</body>");
    if (out.includes("data-wh") && !out.includes('id="lg-img-wh"')) out = out.replace("</head>", WH_CSS + "</head>");
    if (out !== html) await writeFile(f, out);
  }
  return `${map.size} адресов, из хранилища скачано ${fetched}${failed ? `, не скачалось ${failed}` : ""}, WebP ${webp} (−${Math.round(saved / 1024)} КБ), тегов <img> переписано ${tags}`;
}
