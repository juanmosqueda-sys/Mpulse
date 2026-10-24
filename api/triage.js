// Forwards a Gemini generateContent call. The API key never leaves the server.
const ALLOW = ['https://juanmosqueda-sys.github.io', 'http://localhost', 'http://127.0.0.1', 'null'];

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const ok = ALLOW.some((a) => origin === a || origin.startsWith(a + ':'));
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : ALLOW[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!ok) return res.status(403).json({ error: 'origin not allowed' });
  const key = process.env.GEMINI_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_KEY not configured' });

  const { model, body } = req.body || {};
  if (!/^gemini-[a-z0-9.-]+$/.test(model || '')) return res.status(400).json({ error: 'bad model' });
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
