/* Figuras del equipo de diseño: robots cubo 3D, cada uno con su objeto de trabajo (lupa, plano, piezas, pinceles, texto, láser de contraste, etiquetas de código, monóculo).
   Las clases (.prop-radar, .ux-piece-1…) las anima css/equipo.css cuando el agente está trabajando. */
(function (root) {
  let seq = 0;
  const sh = (hex, t) => {
    const n = parseInt(hex.slice(1), 16),
          c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)));
    return '#' + c.map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
  };
  const vol = (id, base, cx = 34, cy = 26, l = .5, d = -.5) =>
    `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="82%"><stop offset="0" stop-color="${sh(base, l)}"/><stop offset=".5" stop-color="${base}"/><stop offset="1" stop-color="${sh(base, d)}"/></radialGradient>`;
  const base = p =>
    `<radialGradient id="${p}s"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${p}g"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${p}o" cx="50%" cy="100%" r="70%"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  const shine = (p, x, y, rx, ry, rot = -25, o = .85) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${p}s)" opacity="${o}" transform="rotate(${rot} ${x} ${y})"/>`;
  const svg = (label, defs, body) =>
    `<svg viewBox="0 0 200 220" role="img" aria-label="${label}"><defs>${defs}</defs>${body}</svg>`;

  const roleProps = (role, col) => {
    switch (role) {
      case 'research':
        return `<g class="prop"><circle class="prop-radar" cx="100" cy="95" r="56" fill="none" stroke="${col}" stroke-width="4"/><g class="prop-loupe"><line x1="158" y1="128" x2="184" y2="156" stroke="#2a2426" stroke-width="11" stroke-linecap="round"/><circle cx="142" cy="112" r="24" fill="#d8ecff" fill-opacity=".75" stroke="#2a2426" stroke-width="7"/><path d="M132 102a12 12 0 0 1 14-2" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g></g>`;
      case 'architect':
        return `<g class="prop prop-blueprint"><rect x="44" y="6" width="112" height="36" rx="9" fill="#1e3a8a" stroke="#fff" stroke-width="2.5"/><rect class="bp-block-1" x="54" y="14" width="26" height="20" rx="4" fill="#60a5fa"/><rect class="bp-block-2" x="87" y="14" width="26" height="20" rx="4" fill="#93c5fd"/><rect class="bp-block-3" x="120" y="14" width="26" height="20" rx="4" fill="#fbbf24"/></g>`;
      case 'ux':
        return `<g class="prop"><g class="ux-piece-1"><rect x="14" y="20" width="44" height="34" rx="9" fill="#fff" stroke="#d49b00" stroke-width="4"/><rect x="22" y="28" width="28" height="7" rx="3" fill="#f2c230"/><rect x="22" y="40" width="18" height="6" rx="3" fill="#e5e0d5"/></g><g class="ux-piece-2"><rect x="142" y="20" width="44" height="34" rx="9" fill="#fff" stroke="#d49b00" stroke-width="4"/><circle cx="156" cy="37" r="7" fill="#f2c230"/><rect x="168" y="32" width="11" height="10" rx="3" fill="#e5e0d5"/></g></g>`;
      case 'ui':
        return `<g class="prop"><circle class="swatch-dot-1" cx="34" cy="36" r="10" fill="#ff7a00" stroke="#fff" stroke-width="2.5"/><circle class="swatch-dot-2" cx="62" cy="20" r="9" fill="#a366f0" stroke="#fff" stroke-width="2.5"/><circle class="swatch-dot-3" cx="92" cy="18" r="8" fill="#2cc2b8" stroke="#fff" stroke-width="2.5"/><g class="prop-brush"><line x1="146" y1="134" x2="182" y2="76" stroke="#854d27" stroke-width="9" stroke-linecap="round"/><path d="M176 84c4-14 16-22 22-16 4 6-2 18-14 22Z" fill="#ff623b"/></g></g>`;
      case 'writer':
        return `<g class="prop"><g class="type-line-1"><rect x="30" y="14" width="54" height="14" rx="7" fill="#239950"/><line x1="40" y1="21" x2="74" y2="21" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g><g class="type-line-2"><rect x="114" y="8" width="60" height="14" rx="7" fill="#3ec46d"/><line x1="124" y1="15" x2="164" y2="15" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g><g class="type-line-3"><rect x="74" y="2" width="48" height="13" rx="6.5" fill="#166f3b"/><line x1="84" y1="8.5" x2="112" y2="8.5" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g></g>`;
      case 'a11y':
        return `<g class="prop"><g class="prop-laser"><line x1="24" y1="88" x2="176" y2="88" stroke="#ff2a2a" stroke-width="4" stroke-linecap="round"/><line x1="24" y1="88" x2="176" y2="88" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 4"/></g><g class="prop-badge-aa"><rect x="134" y="18" width="48" height="26" rx="13" fill="#166f3b" stroke="#fff" stroke-width="2.5"/><text x="158" y="35" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="800" font-size="13">AA ✓</text></g></g>`;
      case 'dev':
        return `<g class="prop"><g class="code-tag-l"><rect x="14" y="24" width="44" height="28" rx="9" fill="#111827" stroke="#2cc2b8" stroke-width="2.5"/><text x="36" y="43" text-anchor="middle" fill="#2cc2b8" font-family="monospace" font-weight="800" font-size="16">&lt;/&gt;</text></g><g class="code-tag-r"><rect x="142" y="24" width="44" height="28" rx="9" fill="#111827" stroke="#2cc2b8" stroke-width="2.5"/><text x="164" y="43" text-anchor="middle" fill="#fbbf24" font-family="monospace" font-weight="800" font-size="16">{ }</text></g></g>`;
      case 'critic':
        return `<g class="prop"><circle cx="122" cy="88" r="16" fill="#fff" fill-opacity=".2" stroke="#f59e0b" stroke-width="4"/><path d="M138 88c10 12 12 30 6 46" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="3 3"/></g>`;
      default:
        return '';
    }
  };

  const cubo = (p, col, mood = 'feliz', hat = false, role = '') => svg('Robot cubo ' + mood,
    base(p) + vol(p + 'b', col, 32, 22, .45) + vol(p + 'h', '#7c7c87', 36, 20, .45),
    `<ellipse class="robot-shadow" cx="100" cy="208" rx="52" ry="9" fill="url(#${p}g)"/>` +
    `<g class="robot-body"><rect x="70" y="160" width="24" height="40" rx="8" fill="url(#${p}b)"/><rect x="106" y="160" width="24" height="40" rx="8" fill="url(#${p}b)"/><rect x="62" y="132" width="76" height="48" rx="14" fill="url(#${p}b)"/><ellipse cx="100" cy="176" rx="34" ry="8" fill="url(#${p}o)"/></g>` +
    `<g class="robot-head"><rect x="38" y="36" width="124" height="104" rx="30" fill="url(#${p}b)"/><rect x="38" y="36" width="124" height="104" rx="30" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.5"/><g class="robot-eyes">` +
    (mood === 'triste'
      ? `<circle cx="78" cy="84" r="6.5" fill="#18141c"/><circle cx="122" cy="84" r="6.5" fill="#18141c"/><path d="M76 118q24-18 48 0" fill="none" stroke="#2a2426" stroke-width="6" stroke-linecap="round"/>`
      : mood === 'calma'
        ? `<path d="M66 84h20M114 84h20" stroke="#2a2426" stroke-width="5.5" stroke-linecap="round"/><path d="M70 104q30 24 60 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`
        : mood === 'picaro'
          ? `<path d="M66 72l18 6M134 72l-18 6" stroke="#2a2426" stroke-width="4.5" stroke-linecap="round"/><circle cx="78" cy="88" r="6.5" fill="#18141c"/><circle cx="122" cy="88" r="6.5" fill="#18141c"/><path d="M66 108q34 20 68 0" fill="none" stroke="#2a2426" stroke-width="6" stroke-linecap="round"/>`
          : `<circle cx="78" cy="86" r="7.5" fill="#164e63"/><circle cx="122" cy="86" r="7.5" fill="#164e63"/><circle cx="75.5" cy="83.5" r="2.6" fill="#fff"/><circle cx="119.5" cy="83.5" r="2.6" fill="#fff"/><path d="M62 104q38 26 76 0" fill="none" stroke="#2a2426" stroke-width="6" stroke-linecap="round"/>`) +
    `</g>` + shine(p, 66, 54, 18, 10) +
    (hat ? `<g class="robot-hat"><ellipse cx="100" cy="40" rx="64" ry="12" fill="url(#${p}h)"/><path d="M62 40c0-30 16-40 38-40s38 10 38 40Z" fill="url(#${p}h)"/><path d="M64 36q36 10 72 0" fill="none" stroke="#4a4a54" stroke-width="4"/></g>` : '') +
    `</g>` + roleProps(role, col)
  );

  root.TintaEquipoArt = { cubo: (col, mood, hat, role) => cubo('te' + (seq++).toString(36) + '-', col, mood, hat, role) };
  if (typeof module !== 'undefined') module.exports = root.TintaEquipoArt;
})(typeof window !== 'undefined' ? window : globalThis);
