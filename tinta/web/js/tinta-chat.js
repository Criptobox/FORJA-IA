/* Historial del chat de diseño y preparación de lo que se le manda al modelo.
   Lógica pura (sin DOM ni red): guarda la conversación en el dispositivo (sin claves), recorta lo antiguo para no gastar
   de más —los modelos gratuitos tienen poco margen— y deja los mensajes alternados usuario/asistente, que algunos
   proveedores exigen. */
(function (root) {
  'use strict';
  const KEY = 'estilos-tinta-chat-v1', MAX_MSGS = 60, MAX_LEN = 6000;
  function create(env) {
    const storage = env.storage, now = env.now || Date.now; let list = null;
    const load = () => { if (list) return list; try { const r = JSON.parse(storage.getItem(KEY) || 'null'); list = Array.isArray(r) ? r.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-MAX_MSGS) : []; } catch (e) { list = []; } return list; };
    const save = () => { try { storage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } };
    return {
      all() { return load().slice(); },
      add(role, content) { if (role !== 'user' && role !== 'assistant') return false; const c = String(content || '').slice(0, MAX_LEN); if (!c.trim()) return false; load().push({ role, content: c, t: now() }); if (list.length > MAX_MSGS) list.splice(0, list.length - MAX_MSGS); save(); return true; },
      dropLastAssistant() { load(); if (list.length && list[list.length - 1].role === 'assistant') { list.pop(); save(); return true; } return false; },
      clear() { list = []; save(); },
      /* Lo último que pidió la persona (para elegir bloques del catálogo afines). */
      lastIdea() { return load().filter(m => m.role === 'user').slice(-2).map(m => m.content).join(' ').slice(0, 400); },
      /* Mensajes para el modelo: instrucciones + los últimos turnos dentro del presupuesto, alternados y empezando por el usuario. */
      forModel(system, opts) {
        const budget = (opts && opts.budget) || 12000; const out = []; let used = 0;
        for (let i = load().length - 1; i >= 0; i--) { const m = list[i]; if (used + m.content.length > budget && out.length >= 1) break; out.unshift({ role: m.role, content: m.content }); used += m.content.length; }
        const merged = []; out.forEach(m => { const last = merged[merged.length - 1]; if (last && last.role === m.role) last.content += '\n\n' + m.content; else merged.push({ ...m }); });
        while (merged.length && merged[0].role !== 'user') merged.shift();
        return [{ role: 'system', content: String(system || '') }, ...merged];
      }
    };
  }
  const api = { create, KEY, MAX_MSGS, MAX_LEN };
  root.TintaChat = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
