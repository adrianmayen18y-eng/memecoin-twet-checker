// api/tweets.js
// Lee noticias reales y en vivo de Watcher Guru (fuente de noticias cripto confiable)
// vía su RSS público. No necesita ningún token, cuenta, ni permiso de nadie.
// Esta función corre en el servidor para evitar problemas de CORS en el navegador.

let cache = { data: null, timestamp: 0 };
const CACHE_MS = 2 * 60 * 1000; // 2 minutos

const RSS_URL = "https://watcher.guru/news/author/watcherguru/feed";

function extractTicker(text) {
  const found = text.match(/\$[A-Za-z]{2,10}/g);
  return found ? found[0].toUpperCase() : null;
}

// Extrae los <item> de un XML de RSS sin librerías externas
function parseRSS(xml) {
  const items = [];
  const itemBlocks = xml.split("<item>").slice(1);
  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s);
    const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/s);
    const linkMatch = block.match(/<link>(.*?)<\/link>/s);
    if (titleMatch) {
      items.push({
        title: titleMatch[1].trim(),
        date: dateMatch ? dateMatch[1].trim() : null,
        link: linkMatch ? linkMatch[1].trim() : null,
      });
    }
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_MS) {
    return res.status(200).json({ tweets: cache.data, cached: true });
  }

  try {
    const response = await fetch(RSS_URL);
    if (!response.ok) {
      return res.status(502).json({ error: "No se pudo leer el feed de noticias" });
    }
    const xml = await response.text();
    const items = parseRSS(xml).slice(0, 20);

    const tweets = items.map((item, i) => ({
      id: String(i) + "-" + (item.link || item.title),
      text: item.title,
      created_at: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
      handle: "@WatcherGuru",
      name: "Watcher Guru",
      ticker: extractTicker(item.title),
    }));

    cache = { data: tweets, timestamp: now };
    return res.status(200).json({ tweets, cached: false });

  } catch (err) {
    return res.status(500).json({ error: "Fallo la conexión", detail: err.message });
  }
}
