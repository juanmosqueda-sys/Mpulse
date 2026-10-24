// Gemini-backed triage. Takes text and/or a photo, returns a structured decision.
// Falls back to the keyword classifier in app.js when the API is off, slow, or unsure.

const AI = (() => {
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const TIMEOUT_MS = 9000;
  const key = () => (typeof CONFIG !== 'undefined' && (CONFIG.GEMINI_KEY || CONFIG.GOOGLE_MAPS_KEY)) || '';
  const enabled = () => !!key() && (typeof CONFIG === 'undefined' || CONFIG.AI !== false);

  function prompt() {
    const types = ISSUE_TYPES.map((t) => `${t.id}: ${t.label}`).join('; ');
    const blds = BUILDINGS.map((b) => `${b.id}: ${b.name}`).join('; ');
    return `You triage campus maintenance and safety reports for San José State University.
Given the report (text, and a photo if attached), decide — the reporter never chooses these:
- category: "fix" (something broken that a department repairs), "alert" (a hazard other people need to be warned about right now, e.g. flooding, exposed wiring, blocked exit, smoke), or "suggestion" (an idea or feedback, nothing is broken).
- type: one id from this list that best matches: ${types}. Use "other" only if nothing fits.
- building: one id from this list if the text or photo indicates it, else null: ${blds}.
- detail: short location detail inside the building (floor, room, side) or "".
- severity: "low" | "medium" | "high" | "critical" (critical = immediate danger to life).
- emergency: true if someone may be hurt or in danger right now (fire, weapon, injury, assault).
- genuine: false if this looks like a joke, test, spam, or has no actionable content.
- description: one plain sentence describing what the photo shows and the problem (if no photo, summarize the text). Mention hazards for a blind user, e.g. a crack across a ramp.
- confidence: 0 to 1.
Respond with ONLY a JSON object with exactly those keys. No prose, no markdown.`;
  }

  async function call(model, parts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key())}`, {
        method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const json = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      return JSON.parse(json);
    } finally { clearTimeout(timer); }
  }

  // text: string; photo: data URL or null. Returns a normalized decision or null.
  async function triage({ text, photo }) {
    if (!enabled()) return null;
    const parts = [{ text: prompt() + '\n\nREPORT TEXT: ' + (text && text.trim() ? text.trim() : '(none, photo only)') }];
    if (photo && /^data:image\//.test(photo)) {
      const m = photo.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
      if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
    }
    let lastErr = null;
    for (const model of MODELS) {
      try {
        const r = await call(model, parts);
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
          description: typeof r.description === 'string' ? r.description.slice(0, 300) : '',
          confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
          model,
        };
      } catch (e) { lastErr = e; console.warn('AI triage failed on', model, e.message || e); }
    }
    AI.lastError = lastErr ? (lastErr.message || String(lastErr)) : null;
    return null;
  }

  return { triage, enabled, lastError: null };
})();
