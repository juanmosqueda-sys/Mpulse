// Gemini-backed triage. Takes text and/or a photo, returns a structured decision.
// Falls back to the keyword classifier in app.js when the API is off, slow, or unsure.

const AI = (() => {
  const MODELS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  const BUDGET_MS = 15000;  // ceiling for the whole triage, upload included; the keyword result is already on screen meanwhile
  // The Gemini key is never committed. It is entered once on the device (hold the seal → Demo options) and kept in localStorage.
  const key = () => { try { return localStorage.getItem('mpulse-gemini-key') || (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_KEY) || ''; } catch (e) { return (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_KEY) || ''; } };
  const setKey = (k) => { try { if (k) localStorage.setItem('mpulse-gemini-key', k.trim()); else localStorage.removeItem('mpulse-gemini-key'); } catch (e) { /* ignore */ } };
  // Same-origin /api/triage when the whole app is served from Vercel; otherwise the configured proxy; a device key always wins.
  const proxy = () => {
    if (key()) return '';
    if (typeof location !== 'undefined' && /\.vercel\.app$/.test(location.hostname)) return '/api/triage';
    return (typeof CONFIG !== 'undefined' && CONFIG.AI_PROXY) || '';
  };
  const enabled = () => (typeof CONFIG !== 'undefined' && CONFIG.AI === true) && (!!key() || !!proxy());

  function prompt() {
    const types = ISSUE_TYPES.map((t) => `${t.id}: ${t.label}`).join('; ');
    const blds = BUILDINGS.map((b) => `${b.id}: ${b.name}`).join('; ');
    return `You triage campus maintenance and safety reports for San José State University.
Given the report (text, and a photo if attached), decide — the reporter never chooses these:
- category: "fix" (something broken that a department repairs), "alert" (a hazard other people need to be warned about right now, e.g. flooding, exposed wiring, blocked exit, smoke), or "suggestion" (an idea or feedback, nothing is broken).
- type: one id from this list that best matches: ${types}. Chairs, desks, tables and whiteboards are "furniture" (Facilities); "classroom" is only projectors, screens and podium tech (IT). Use "other" only if nothing fits.
- building: one id from this list if the text or photo indicates it, else null: ${blds}.
- detail: short location detail inside the building (floor, room, side) or "".
- severity: "low" | "medium" | "high" | "critical" (critical = immediate danger to life).
- emergency: true if someone may be hurt or in danger right now (fire, weapon, injury, assault).
- genuine: false if this looks like a joke, test, spam, or has no actionable content.
- faultVisible: true only if the defect itself is visible in the photo or stated in the text (a crack, a leak, a dark light, a missing cover, an error screen, a stuck door). false if you only recognise the object (an outlet, a projector, a fountain that looks normal) — never assume something is broken just because it was photographed.
- description: one plain sentence describing what the photo shows and the problem (if no photo, summarize the text). Mention hazards for a blind user, e.g. a crack across a ramp.
- confidence: 0 to 1.
Respond with ONLY a JSON object with exactly those keys. No prose, no markdown.`;
  }

  // Shrink a photo before upload: ~1024px JPEG is plenty for triage and cuts a 5 MB iPhone photo to ~150 KB.
  function shrink(dataUrl, max = 800) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        if (k === 1 && dataUrl.length < 400000) return resolve(dataUrl);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  const ATTEMPT_MS = 6000;  // a stuck connection is abandoned after 6 s and retried fresh
  async function call(model, parts, ctrl, noThink = false, retried = false) {
    const own = new AbortController();
    const onAbort = () => own.abort();
    ctrl.signal.addEventListener('abort', onAbort);
    const t = setTimeout(() => own.abort(), ATTEMPT_MS);
    try {
      const gen = { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 300 };
      if (!noThink) gen.thinkingConfig = { thinkingBudget: 0 };   // no "thinking" pass: this is a classification, speed matters more
      const body = { contents: [{ role: 'user', parts }], generationConfig: gen };
      const p = proxy();
      const res = p
        ? await fetch(p, { method: 'POST', signal: own.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, body }) })
        : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST', signal: own.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key() }, body: JSON.stringify(body),
          });
      if (res.status === 400 && !noThink) return call(model, parts, ctrl, true);   // model rejected thinkingConfig → plain retry
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const json = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      return JSON.parse(json);
    } catch (e) {
      if (e.name === 'AbortError' && !ctrl.signal.aborted && !retried) { clearTimeout(t); ctrl.signal.removeEventListener('abort', onAbort); return call(model, parts, ctrl, noThink, true); }
      if (e.name !== 'AbortError') console.warn('AI triage failed on', model, e.message || e); throw e;
    } finally { clearTimeout(t); ctrl.signal.removeEventListener('abort', onAbort); }
  }

  // text: string; photo: data URL or null. Returns a normalized decision or null.
  async function triage({ text, photo }) {
    if (!enabled()) return null;
    const parts = [{ text: prompt() + '\n\nREPORT TEXT: ' + (text && text.trim() ? text.trim() : '(none, photo only)') }];
    if (photo && /^data:image\//.test(photo)) {
      const small = await shrink(photo);
      const m = small.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
      if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
    }
    const ctrl = new AbortController();
    const deadline = setTimeout(() => ctrl.abort(), BUDGET_MS);
    const normalize = (r) => {
      const typeOk = ISSUE_TYPES.some((t) => t.id === r.type);
      const bldOk = r.building && BUILDINGS.some((b) => b.id === r.building);
      return {
        category: ['fix', 'alert', 'suggestion'].includes(r.category) ? r.category : 'fix',
        type: typeOk ? r.type : 'other',
        building: bldOk ? r.building : null,
        detail: typeof r.detail === 'string' ? r.detail.slice(0, 60) : '',
        severity: ['low', 'medium', 'high', 'critical'].includes(r.severity) ? r.severity : 'medium',
        emergency: !!r.emergency,
        genuine: r.genuine !== false,
        faultVisible: r.faultVisible !== false,
        description: typeof r.description === 'string' ? r.description.slice(0, 300) : '',
        confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
        model: r.__model,
      };
    };
    let lastErr = null;
    try {
      // Race the two fastest models; whichever answers first wins. A 503 on one doesn't cost any time.
      const racers = MODELS.slice(0, 2).map((m) => call(m, parts, ctrl).then((r) => ({ ...r, __model: m })));
      const r = await Promise.any(racers);
      clearTimeout(deadline); ctrl.abort();
      return normalize(r);
    } catch (e) { lastErr = e.errors ? e.errors[e.errors.length - 1] : e; }
    // Both failed quickly (e.g. 503s): one last try on the third model inside whatever budget remains.
    if (!ctrl.signal.aborted) {
      try { const r = await call(MODELS[2], parts, ctrl); clearTimeout(deadline); return normalize({ ...r, __model: MODELS[2] }); }
      catch (e) { lastErr = e; }
    }
    clearTimeout(deadline);
    AI.lastError = lastErr ? (lastErr.name === 'AbortError' ? 'took too long' : (lastErr.message || String(lastErr))) : null;
    return null;
  }

  function warm() {
    try { const p = proxy(); if (p) fetch(p, { method: 'OPTIONS' }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  return { triage, enabled, setKey, warm, hasKey: () => !!key() || !!proxy(), lastError: null };
})();
