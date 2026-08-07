// api/tweets.js
// Esta función corre en el servidor (nunca en el navegador del usuario),
// así que tu Bearer Token de X queda protegido.
//
// CONFIGURACIÓN NECESARIA EN VERCEL:
// 1. En tu proyecto de Vercel, ve a Settings > Environment Variables
// 2. Agrega: X_BEARER_TOKEN = tu_token_secreto_aqui
//
// CUENTAS A MONITOREAR: edítalas abajo en ACCOUNTS_TO_TRACK

const ACCOUNTS_TO_TRACK = [
  // pon aquí los @usuarios (sin la arroba) que quieres monitorear
  "elonmusk",
  "example_account_1",
  "example_account_2",
];

// cache simple en memoria para no gastar cuota del tier gratis
// (se reinicia si el servidor duerme, pero evita pedir a X en cada visita)
let cache = { data: null, timestamp: 0 };
const CACHE_MS = 5 * 60 * 1000; // 5 minutos

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_MS) {
    return res.status(200).json({ tweets: cache.data, cached: true });
  }

  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "Falta configurar X_BEARER_TOKEN en Vercel" });
  }

  try {
    const query = ACCOUNTS_TO_TRACK.map(u => `from:${u}`).join(" OR ");
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username,name`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "Error consultando X", detail: errText });
    }

    const json = await response.json();

    const users = {};
    (json.includes?.users || []).forEach(u => { users[u.id] = u; });

    const tweets = (json.data || []).map(t => ({
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      handle: "@" + (users[t.author_id]?.username || "desconocido"),
      name: users[t.author_id]?.name || "",
    }));

    cache = { data: tweets, timestamp: now };
    return res.status(200).json({ tweets, cached: false });

  } catch (err) {
    return res.status(500).json({ error: "Fallo la conexión", detail: err.message });
  }
}
