/* Conexión con una IA (clave propia). Inspirado en FORJA-IA: cada proveedor trae su clave, la app pide la lista real de
   modelos y PRUEBA cada uno con una petición mínima: solo se quedan los que responden de verdad.
   Los catálogos mienten (modelos retirados, «gratis» que no lo son, ids viejos), así que nada se da por bueno sin probarlo.
   Núcleo sin DOM: recibe fetch y almacenamiento, así se prueba sin red.
   La clave solo viaja al proveedor elegido; no entra en enlaces compartidos ni en copias de seguridad. */
(function (root) {
  'use strict';
  const KEY = 'estilos-tinta-ia-v1';
  const PROVIDERS = [
    { id: 'groq', name: 'Groq', protocol: 'openai', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', tagline: 'Muy rápido · capa gratuita generosa', defaults: ['gpt-oss-120b', 'gpt-oss-20b', 'qwen3-32b'] },
    { id: 'gemini', name: 'Google Gemini', protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/app/apikey', tagline: 'Capa gratuita generosa · Flash', defaults: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] },
    { id: 'openrouter', name: 'OpenRouter', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', tagline: 'Cientos de modelos · decenas gratis (:free)', freeOnly: true, defaults: [], hint: 'Para usar los «:free» activa el uso de datos en openrouter.ai/settings/privacy.' },
    { id: 'aihubmix', name: 'AiHubMix', protocol: 'openai', baseUrl: 'https://aihubmix.com/v1', keyUrl: 'https://aihubmix.com/apikey', tagline: 'Una clave para varios · modelos «-free»', freeOnly: true, defaults: [] },
    { id: 'opencode', name: 'OpenCode Zen', protocol: 'openai', baseUrl: 'https://opencode.ai/zen/v1', keyUrl: 'https://opencode.ai/auth', tagline: 'Modelos «-free» · a veces sin clave', freeOnly: true, keyOptional: true, defaults: [] },
    { id: 'deepseek', name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', tagline: 'Muy barato', defaults: ['deepseek-chat'] },
    { id: 'nvidia', name: 'NVIDIA NIM', protocol: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1', keyUrl: 'https://build.nvidia.com/settings/api-keys', tagline: 'Créditos al crear la cuenta', defaults: [], hint: 'Clave nvapi-… Si el navegador la bloquea, usa otro proveedor.' },
    { id: 'openai', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', tagline: 'GPT · sin capa gratuita', defaults: ['gpt-4.1-mini'] },
    { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', keyUrl: 'https://console.anthropic.com/settings/keys', tagline: 'Claude · sin capa gratuita', defaults: [] },
    { id: 'custom', name: 'Otro (compatible con OpenAI)', protocol: 'openai', baseUrl: '', keyUrl: '', tagline: 'Pon tú la dirección base, por ejemplo la de un servidor propio', custom: true, defaults: [] }
  ];
  const getProvider = id => PROVIDERS.find(p => p.id === id) || null;

  /* ───────── Qué significa cada respuesta (criterio de FORJA-IA) ───────── */
  const NO_EXISTE = ['model_not_found', 'model not found', 'unknown model', 'does not exist', 'no such model', 'invalid model', 'unsupported model', 'not available', 'no longer available', 'deprecated', 'no permission to access model', 'is not found'];
  function classify(status, body) {
    const t = String(body || '').toLowerCase();
    if (status === 0) return 'sin-red';
    if (status >= 200 && status < 300) return 'ok';
    if (status === 429) return 'limitado';
    if (status === 404 || status === 410) return 'no-existe';
    if (status === 401) return 'sin-clave';
    if (status === 403) return NO_EXISTE.some(s => t.includes(s)) ? 'no-existe' : 'sin-permiso';
    if (status === 400 || status === 422) return NO_EXISTE.some(s => t.includes(s)) ? 'no-existe' : 'caido';
    return 'caido';
  }
  /* «limitado» cuenta como válido: el modelo existe, solo se agotó la cuota (los gratuitos son los que más se limitan). */
  const usable = v => v === 'ok' || v === 'limitado';
  const MESSAGES = { ok: 'Responde', limitado: 'Existe, pero se agotó la cuota', 'no-existe': 'El proveedor no reconoce este modelo', 'sin-permiso': 'Tu clave no tiene acceso a este modelo', 'sin-clave': 'Clave no válida o caducada', caido: 'El proveedor devolvió un error', 'sin-red': 'Sin respuesta: sin conexión o el proveedor bloquea las conexiones desde el navegador (CORS). Prueba con otro proveedor; Groq y Gemini suelen funcionar.' };
  /* Pistas con frases literales del proveedor; si no encaja ninguna, null y se enseña el texto tal cual. */
  function hint(status, body) {
    const t = String(body || '').toLowerCase();
    if (t.includes('data policy') || t.includes('data-policy')) return 'No es que el modelo no exista: OpenRouter bloquea los gratis hasta que aceptes su política de datos (openrouter.ai/settings/privacy).';
    if (t.includes('no endpoints found') || t.includes('no allowed providers')) return 'Ahora mismo ningún proveedor sirve ese modelo. Suele volver solo.';
    if (status === 429 || t.includes('rate limit')) return 'Límite de peticiones: el modelo está bien; espera y vuelve a probar.';
    if (status === 401) return 'La clave no es válida o ha caducado. Es la clave, no el modelo.';
    return null;
  }
  /* Culpa confirmada del modelo: solo si no hay una explicación mejor (bloqueo de cuenta, límite…). */
  const modelFault = r => (r.verdict === 'no-existe' || r.verdict === 'sin-permiso') && hint(r.status, r.detail) === null;

  /* Modelos que no sirven para escribir (embeddings, voz, imagen, moderación…). */
  const NOT_CHAT = /embed|whisper|tts|stt|transcrib|moderat|guard|rerank|image|vision-only|dall|sdxl|flux|stable-diff|audio|speech|aqa|imagen|veo|lyria|realtime|computer-use|bge-|clip/i;
  const isChatLike = id => !NOT_CHAT.test(id);
  const isFree = id => /(:free|-free)$/i.test(id) || /[:\-]free\b/i.test(id);

  /* ───────── Direcciones y cabeceras por protocolo ───────── */
  function safeBase(url) {
    let u; try { u = new URL(String(url || '').trim()); } catch (e) { return null; }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
    if (u.username || u.password) return null;
    return u.origin + u.pathname.replace(/\/+$/, '');
  }
  function baseOf(def, cfg) { return safeBase((cfg && cfg.baseUrl) || def.baseUrl); }
  function headersFor(def, cfg) {
    const k = String((cfg && cfg.apiKey) || '').trim();
    if (def.protocol === 'anthropic') return { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    if (def.protocol === 'gemini') return { 'x-goog-api-key': k };
    return k ? { Authorization: 'Bearer ' + k } : {};
  }
  function parseModels(def, json) {
    const arr = def.protocol === 'gemini' ? (json.models || []).filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, '')) : (json.data || []).map(m => m && m.id);
    return [...new Set(arr.filter(x => typeof x === 'string' && x))].sort();
  }
  function bodyFor(def, model, messages, o) {
    const max = o.maxTokens || 1024;
    if (def.protocol === 'gemini') {
      return { contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: max, temperature: o.temperature == null ? .7 : o.temperature } };
    }
    if (def.protocol === 'anthropic') {
      const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
      const b = { model, max_tokens: max, messages: messages.filter(m => m.role !== 'system') }; if (sys) b.system = sys; if (o.temperature != null) b.temperature = o.temperature; return b;
    }
    const b = { model, messages }; b[o.maxParam || 'max_tokens'] = max; if (o.temperature != null) b.temperature = o.temperature; return b;
  }
  function urlFor(def, base, model) {
    if (def.protocol === 'gemini') return base + '/models/' + encodeURIComponent(model) + ':generateContent';
    if (def.protocol === 'anthropic') return base + '/v1/messages';
    return base + '/chat/completions';
  }
  function textOf(def, json) {
    try {
      if (def.protocol === 'gemini') return (json.candidates[0].content.parts || []).map(p => p.text || '').join('');
      if (def.protocol === 'anthropic') return (json.content || []).map(p => p.text || '').join('');
      const m = json.choices[0].message; return String(m.content || '');
    } catch (e) { return ''; }
  }

  function create(env) {
    const f = env.fetch, storage = env.storage, now = env.now || Date.now;
    let data = null;
    const blank = () => ({ v: 1, providers: {}, active: null });
    function load() {
      if (data) return data;
      try { const raw = JSON.parse(storage.getItem(KEY) || 'null'); data = raw && raw.v === 1 && typeof raw.providers === 'object' ? raw : blank(); } catch (e) { data = blank(); }
      return data;
    }
    function persist() { try { storage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
    const cfgOf = id => { const d = load(); return d.providers[id] || (d.providers[id] = { apiKey: '', baseUrl: '', models: [], checked: {} }); };
    const timeoutSignal = ms => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; };

    async function request(url, init, ms) {
      const t = timeoutSignal(ms || 30000);
      try { const res = await f(url, { ...init, signal: t.signal }); let text = ''; if (!res.ok) { try { text = (await res.text()).slice(0, 400); } catch (e) { /* sin cuerpo */ } } return { res, text }; } finally { t.done(); }
    }
    /* Lista real de modelos del proveedor. */
    async function listModels(providerId) {
      const def = getProvider(providerId), cfg = cfgOf(providerId), base = def && baseOf(def, cfg);
      if (!def || !base) throw Object.assign(new Error('La dirección del proveedor no es válida (debe ser https).'), { verdict: 'caido', status: 0 });
      let r; try { r = await request(base + (def.protocol === 'anthropic' ? '/v1/models' : '/models'), { method: 'GET', headers: headersFor(def, cfg) }); } catch (e) { throw Object.assign(new Error(MESSAGES['sin-red']), { verdict: 'sin-red', status: 0 }); }
      if (!r.res.ok) { const v = classify(r.res.status, r.text); throw Object.assign(new Error(hint(r.res.status, r.text) || MESSAGES[v] + (r.text ? ' — ' + r.text.slice(0, 160) : '')), { verdict: v, status: r.res.status }); }
      let json; try { json = await r.res.json(); } catch (e) { throw Object.assign(new Error('El proveedor no devolvió una lista de modelos legible.'), { verdict: 'caido', status: r.res.status }); }
      return parseModels(def, json);
    }
    /* Una petición mínima: ¿responde este modelo con esta clave? */
    async function probe(providerId, model) {
      const def = getProvider(providerId), cfg = cfgOf(providerId), base = def && baseOf(def, cfg), t0 = now();
      const out = (verdict, status, detail) => ({ verdict, status, detail: detail || undefined, ms: now() - t0, at: now() });
      if (!def || !base) return out('caido', 0, 'Dirección no válida');
      const msgs = [{ role: 'user', content: 'hi' }];
      const send = async o => request(urlFor(def, base, model), { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersFor(def, cfg) }, body: JSON.stringify(bodyFor(def, model, msgs, { maxTokens: 16, ...o })) }, 25000);
      try {
        let r = await send({});
        if (r.res.status === 400 && /max_completion_tokens/i.test(r.text)) r = await send({ maxParam: 'max_completion_tokens' });
        return out(classify(r.res.status, r.text), r.res.status, r.text);
      } catch (e) { return out('sin-red', 0, e && e.message); }
    }
    /* Prueba una lista con límite de concurrencia: una ráfaga se comería el límite por minuto y provocaría 429 falsos. */
    async function probeAll(items, fn, opts) {
      const limit = Math.max(1, (opts && opts.concurrency) || 3), out = new Map(); let i = 0;
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { for (;;) { const k = i++; if (k >= items.length) return; const it = items[k], r = await fn(it); out.set(it, r); if (opts && opts.onResult) opts.onResult(it, r); } }));
      return out;
    }
    /* Candidatos a probar: los de chat (y gratis si el proveedor es de gratuitos), con tope. */
    function candidates(def, all, cap) {
      let c = all.filter(isChatLike); if (def.freeOnly) c = c.filter(isFree);
      const first = (def.defaults || []).filter(m => c.includes(m)), rest = c.filter(m => !first.includes(m));
      return [...first, ...rest].slice(0, cap || 24);
    }
    /* Todo el recorrido: lista → prueba → guarda solo lo que responde. */
    async function connect(providerId, opts) {
      opts = opts || {}; const def = getProvider(providerId), cfg = cfgOf(providerId);
      let all; try { all = await listModels(providerId); } catch (e) {
        if (e.verdict === 'sin-clave' || e.verdict === 'sin-red' || !(def.defaults || []).length) throw e;
        all = def.defaults.slice();   /* el proveedor no deja listar: se prueban los de siempre */
      }
      if (!all.length && def.defaults && def.defaults.length) all = def.defaults.slice();
      const list = candidates(def, all, opts.cap), results = await probeAll(list, m => probe(providerId, m), { concurrency: 3, onResult: opts.onResult });
      const checked = {}, good = [];
      results.forEach((r, m) => { checked[m] = r; if (usable(r.verdict)) good.push(m); });
      cfg.models = good; cfg.checked = checked; cfg.lastCheck = now(); cfg.total = all.length; cfg.tested = list.length;
      if (data.active && data.active.provider === providerId && !good.includes(data.active.model)) data.active = null;
      if (!data.active && good.length) data.active = { provider: providerId, model: good[0] };
      persist();
      return { total: all.length, tested: list.length, good, results, broken: [...results.entries()].filter(([, r]) => modelFault(r)).map(([m]) => m) };
    }
    /* Conversación: devuelve el texto. Lanza con verdict/status si falla. */
    async function chat(messages, o) {
      o = o || {}; const d = load(), act = o.provider ? { provider: o.provider, model: o.model } : d.active;
      if (!act) throw Object.assign(new Error('No hay ninguna IA conectada.'), { verdict: 'sin-clave', status: 0 });
      const def = getProvider(act.provider), cfg = cfgOf(act.provider), base = def && baseOf(def, cfg);
      if (!def || !base) throw Object.assign(new Error('La dirección del proveedor no es válida.'), { verdict: 'caido', status: 0 });
      const send = async x => request(urlFor(def, base, act.model), { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersFor(def, cfg) }, body: JSON.stringify(bodyFor(def, act.model, messages, { ...o, ...x })) }, o.timeout || 90000);
      let r; try { r = await send({}); if (r.res.status === 400 && /max_completion_tokens/i.test(r.text)) r = await send({ maxParam: 'max_completion_tokens' }); } catch (e) { throw Object.assign(new Error(MESSAGES['sin-red']), { verdict: 'sin-red', status: 0 }); }
      if (!r.res.ok) { const v = classify(r.res.status, r.text); throw Object.assign(new Error(hint(r.res.status, r.text) || MESSAGES[v]), { verdict: v, status: r.res.status, detail: r.text }); }
      let json; try { json = await r.res.json(); } catch (e) { throw Object.assign(new Error('Respuesta ilegible del proveedor.'), { verdict: 'caido', status: r.res.status }); }
      const text = textOf(def, json); if (!text.trim()) throw Object.assign(new Error('El modelo respondió vacío. Prueba con otro.'), { verdict: 'caido', status: r.res.status });
      return text;
    }
    return {
      providers: PROVIDERS, getProvider, load, persist, cfgOf, listModels, probe, probeAll, connect, chat, candidates,
      setKey(id, key, baseUrl) { const c = cfgOf(id); c.apiKey = String(key || '').trim().slice(0, 400); if (baseUrl !== undefined) c.baseUrl = String(baseUrl || '').trim().slice(0, 300); persist(); },
      setActive(provider, model) { const c = cfgOf(provider); if (!c.models.includes(model)) return false; data.active = { provider, model }; persist(); return true; },
      active() { const d = load(); return d.active && getProvider(d.active.provider) ? d.active : null; },
      forget(id) { const d = load(); delete d.providers[id]; if (d.active && d.active.provider === id) d.active = null; persist(); },
      hasKey(id) { const def = getProvider(id); return !!(def && (def.keyOptional || cfgOf(id).apiKey)); }
    };
  }
  const api = { create, PROVIDERS, getProvider, classify, usable, hint, modelFault, isChatLike, isFree, safeBase, MESSAGES, KEY };
  root.TintaIA = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
