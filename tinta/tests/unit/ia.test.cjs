const test = require('node:test'), assert = require('node:assert/strict');
const IA = require('../../web/js/tinta-ia.js');
const mem = () => { const s = {}; return { getItem: k => s[k] ?? null, setItem: (k, v) => { s[k] = String(v); }, s }; };
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
/* proveedor falso OpenAI-compatible */
function fakeFetch(log) {
  return async (url, init) => {
    log && log.push({ url, init });
    if (init.method === 'GET') return resp(200, { data: ['bueno', 'roto', 'limitado', 'embed-v1', 'tokens-nuevo', 'whisper-1', 'zeta'].map(id => ({ id })) });
    const b = JSON.parse(init.body), m = b.model;
    if (m === 'roto') return resp(404, { error: 'The model `roto` does not exist' });
    if (m === 'limitado') return resp(429, 'rate limit');
    if (m === 'zeta') return resp(400, 'bad request something else');
    if (m === 'tokens-nuevo') return b.max_tokens ? resp(400, 'Unsupported parameter: max_tokens. Use max_completion_tokens') : resp(200, { choices: [{ message: { content: 'ok' } }] });
    return resp(200, { choices: [{ message: { content: 'hola' } }] });
  };
}
const make = (fetch, storage) => IA.create({ fetch, storage: storage || mem() });

test('clasifica respuestas como FORJA-IA', () => {
  assert.equal(IA.classify(0), 'sin-red'); assert.equal(IA.classify(200), 'ok'); assert.equal(IA.classify(429), 'limitado'); assert.equal(IA.classify(404), 'no-existe'); assert.equal(IA.classify(410), 'no-existe'); assert.equal(IA.classify(401), 'sin-clave');
  assert.equal(IA.classify(403, 'no permission to access model x'), 'no-existe'); assert.equal(IA.classify(403, 'forbidden'), 'sin-permiso');
  assert.equal(IA.classify(400, 'unknown model'), 'no-existe'); assert.equal(IA.classify(400, 'otra cosa'), 'caido'); assert.equal(IA.classify(500), 'caido');
  assert.ok(IA.usable('limitado') && IA.usable('ok') && !IA.usable('no-existe'));
});
test('un bloqueo de cuenta no se acusa al modelo', () => {
  assert.equal(IA.modelFault({ verdict: 'no-existe', status: 404, detail: 'blocked by data policy' }), false);
  assert.equal(IA.modelFault({ verdict: 'no-existe', status: 404, detail: 'model not found' }), true);
});
test('solo direcciones https (o localhost)', () => {
  assert.equal(IA.safeBase('https://api.x.com/v1/'), 'https://api.x.com/v1'); assert.equal(IA.safeBase('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  for (const u of ['http://api.x.com/v1', 'javascript:alert(1)', 'https://user:pw@x.com', '', 'nada']) assert.equal(IA.safeBase(u), null, u);
});
test('connect: lista, prueba y se queda solo con lo que responde', async () => {
  const log = [], ia = make(fakeFetch(log)); ia.setKey('groq', '  sk-test  ');
  const seen = []; const r = await ia.connect('groq', { onResult: (m, x) => seen.push(m + ':' + x.verdict) });
  assert.deepEqual(r.good.sort(), ['bueno', 'limitado', 'tokens-nuevo']); assert.deepEqual(r.broken, ['roto']);
  assert.equal(r.tested, 5, 'no prueba embeddings ni voz'); assert.ok(!seen.some(s => /embed|whisper/.test(s)));
  assert.equal(ia.cfgOf('groq').checked.zeta.verdict, 'caido'); assert.ok(!ia.cfgOf('groq').models.includes('zeta'));
  assert.ok(log.every(x => x.init.headers.Authorization === 'Bearer sk-test'), 'la clave se limpia y se manda como Bearer');
  assert.ok(ia.active() && ia.active().provider === 'groq');
});
test('persiste y no pierde lo verificado', async () => {
  const st = mem(), ia = make(fakeFetch(), st); ia.setKey('groq', 'k'); await ia.connect('groq');
  const ia2 = make(fakeFetch(), st); assert.deepEqual(ia2.cfgOf('groq').models.sort(), ['bueno', 'limitado', 'tokens-nuevo']); assert.equal(ia2.active().provider, 'groq');
  assert.equal(ia2.setActive('groq', 'roto'), false); assert.equal(ia2.setActive('groq', 'limitado'), true); ia2.forget('groq'); assert.equal(ia2.active(), null);
});
test('proveedores de solo gratuitos: solo se prueban los free', async () => {
  const f = async (url, init) => init.method === 'GET' ? resp(200, { data: [{ id: 'a/b:free' }, { id: 'caro/modelo' }, { id: 'x-free' }] }) : resp(200, { choices: [{ message: { content: 'ok' } }] });
  const ia = make(f); ia.setKey('openrouter', 'k'); const r = await ia.connect('openrouter'); assert.deepEqual(r.good.sort(), ['a/b:free', 'x-free']);
});
test('sin respuesta o clave mala: error claro, no lista vacía', async () => {
  const caida = make(async () => { throw new TypeError('Failed to fetch'); }); caida.setKey('groq', 'k');
  await assert.rejects(caida.connect('groq'), e => e.verdict === 'sin-red' && /CORS/.test(e.message));
  const mala = make(async () => resp(401, 'invalid api key')); mala.setKey('groq', 'k');
  await assert.rejects(mala.connect('groq'), e => e.verdict === 'sin-clave');
});
test('si no deja listar pero hay modelos de siempre, se prueban esos', async () => {
  const f = async (url, init) => init.method === 'GET' ? resp(403, 'nope') : resp(200, { choices: [{ message: { content: 'ok' } }] });
  const ia = make(f); ia.setKey('deepseek', 'k'); assert.deepEqual((await ia.connect('deepseek')).good, ['deepseek-chat']);
});
test('probeAll respeta la concurrencia', async () => {
  const ia = make(fakeFetch()); let run = 0, max = 0;
  await ia.probeAll([1, 2, 3, 4, 5, 6, 7, 8], async () => { run++; max = Math.max(max, run); await new Promise(r => setTimeout(r, 5)); run--; return { verdict: 'ok' }; }, { concurrency: 3 });
  assert.equal(max, 3);
});
test('chat: forma de la petición y la respuesta por protocolo', async () => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); if (url.includes('generateContent')) return resp(200, { candidates: [{ content: { parts: [{ text: 'g' }] } }] }); if (url.includes('/v1/messages')) return resp(200, { content: [{ text: 'a' }] }); return resp(200, { choices: [{ message: { content: 'o' } }] }); };
  const ia = make(f), msgs = [{ role: 'system', content: 'sé breve' }, { role: 'user', content: 'hola' }];
  ia.setKey('groq', 'K'); ia.cfgOf('groq').models = ['m1']; ia.setActive('groq', 'm1'); assert.equal(await ia.chat(msgs), 'o'); assert.match(calls[0].url, /groq\.com\/openai\/v1\/chat\/completions$/); assert.equal(calls[0].body.messages.length, 2);
  ia.setKey('gemini', 'G'); assert.equal(await ia.chat(msgs, { provider: 'gemini', model: 'gemini-x' }), 'g'); assert.equal(calls[1].init.headers['x-goog-api-key'], 'G'); assert.match(calls[1].url, /models\/gemini-x:generateContent$/);
  ia.setKey('anthropic', 'A'); assert.equal(await ia.chat(msgs, { provider: 'anthropic', model: 'c' }), 'a'); assert.equal(calls[2].body.system, 'sé breve'); assert.equal(calls[2].body.messages.length, 1); assert.equal(calls[2].init.headers['anthropic-dangerous-direct-browser-access'], 'true');
});
test('chat: errores con motivo y respuesta vacía', async () => {
  const ia = make(async () => resp(429, 'rate limit')); ia.setKey('groq', 'k'); await assert.rejects(ia.chat([{ role: 'user', content: 'x' }], { provider: 'groq', model: 'm' }), e => e.verdict === 'limitado');
  const vacia = make(async () => resp(200, { choices: [{ message: { content: '' } }] })); await assert.rejects(vacia.chat([{ role: 'user', content: 'x' }], { provider: 'groq', model: 'm' }), /vacío/);
  await assert.rejects(make(fakeFetch()).chat([{ role: 'user', content: 'x' }]), /No hay ninguna IA/);
});
