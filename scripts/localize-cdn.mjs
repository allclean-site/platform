// Последний проход по собранному сайту: всё, что ещё ссылается на чужой CDN, переносим
// на свой домен.
//
// Адреса скриптов и шрифта переписывает site-privacy.mjs — они известны наперёд. А вот
// картинки приходят из зеркала и из правок редактора, их список заранее неизвестен и
// может пополниться в любой момент, когда в редакторе выберут изображение из шаблона.
// Поэтому здесь не список, а правило: любой файл с чужого хоста скачивается и подменяется
// своим адресом. Скачанное лежит в public/site-assets/cdn и коммитится — следующая сборка
// ничего не качает, а сайт не зависит от того, жив ли CDN шаблона.
import { readdir, readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, extname, basename } from "node:path";

const OUT = "out";
const CACHE = join("public", "site-assets", "cdn"); // хранится в репозитории
const DEST = join(OUT, "cdn");                      // то, что уезжает на хостинг
const HOSTS = ["cdn.prod.website-files.com", "assets.website-files.com", "d3e54v103j8qbb.cloudfront.net"];

const urlRe = new RegExp(`https://(?:${HOSTS.join("|")})/[^"'\\s)\\\\]+`, "g");

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(f)));
    else if (e.name.endsWith(".html")) out.push(f);
  }
  return out;
}

const exists = (p) => access(p).then(() => true, () => false);

// Имя: читаемое из адреса + короткий хеш адреса, чтобы разные картинки с одинаковым
// именем не затирали друг друга.
function localName(url) {
  const clean = decodeURIComponent(url.split("?")[0]);
  const ext = (extname(clean) || ".bin").toLowerCase();
  const stem = basename(clean, extname(clean)).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);
  return `${stem}-${createHash("sha1").update(url).digest("hex").slice(0, 8)}${ext}`;
}

export async function localizeCdnFiles() {
  const files = await walk(OUT);
  const urls = new Set();
  const contents = new Map();
  for (const f of files) {
    const html = await readFile(f, "utf8");
    const found = html.match(urlRe);
    if (!found) continue;
    contents.set(f, html);
    found.forEach((u) => urls.add(u));
  }
  if (!urls.size) return "чужих адресов нет";

  await mkdir(CACHE, { recursive: true });
  await mkdir(DEST, { recursive: true });

  const map = new Map();
  let downloaded = 0, failed = 0;
  for (const u of urls) {
    const name = localName(u);
    const cached = join(CACHE, name);
    if (!(await exists(cached))) {
      const r = await fetch(u).catch(() => null);
      if (!r || !r.ok) {
        // Сборку не роняем: одна чужая картинка лучше, чем невыкаченный сайт. Но в логе видно.
        console.warn(`[localize-cdn] НЕ СКАЧАЛОСЬ ${r ? r.status : "сеть"} ${u}`);
        failed++;
        continue;
      }
      await writeFile(cached, Buffer.from(await r.arrayBuffer()));
      downloaded++;
    }
    await copyFile(cached, join(DEST, name));
    map.set(u, `/cdn/${name}`);
  }

  let pages = 0;
  for (const [f, html] of contents) {
    let out = html;
    for (const [u, local] of map) out = out.split(u).join(local);
    if (out !== html) { await writeFile(f, out); pages++; }
  }
  return `${map.size} файл(ов) на своём домене (скачано ${downloaded}${failed ? `, не удалось ${failed}` : ""}), страниц исправлено ${pages}`;
}
