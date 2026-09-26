/** Forja IA — Utilidades puras de OAuth de GitHub (sin I/O).
 * El intercambio de código y las cookies viven en el servidor;
 * aquí solo hay parsers y URLs, para poder probarlos. */

export type OAuthTokenResult = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
  token_type?: string;
  scope?: string;
};

/** GitHub a veces responde JSON y a veces application/x-www-form-urlencoded. */
export function parseOAuthTokenResponse(text: string, contentType = ""): OAuthTokenResult {
  const trimmed = text.trim();
  if (!trimmed) return { error: "empty", error_description: "GitHub no devolvió token" };
  if (contentType.includes("json") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as OAuthTokenResult;
    } catch {
      return { error: "invalid_json", error_description: "GitHub devolvió JSON ilegible" };
    }
  }
  const p = new URLSearchParams(trimmed);
  return {
    access_token: p.get("access_token") || undefined,
    refresh_token: p.get("refresh_token") || undefined,
    error: p.get("error") || undefined,
    error_description: p.get("error_description") || undefined,
    token_type: p.get("token_type") || undefined,
    scope: p.get("scope") || undefined,
  };
}

/** Los client_id de GitHub Apps empiezan por Iv1. / Iv23.; los de OAuth App son hex. */
export function isGithubAppClientId(id: string): boolean {
  return /^Iv\d+\./i.test(id.trim());
}

export function githubAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge?: string;
  /** deja elegir con qué cuenta de GitHub entrar (conectar OTRA cuenta) */
  elegirCuenta?: boolean;
}): string {
  const u = new URL("https://github.com/login/oauth/authorize");
  if (opts.elegirCuenta) u.searchParams.set("prompt", "select_account");
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  // GitHub App: los permisos salen del manifiesto, no de scope=repo.
  if (!isGithubAppClientId(opts.clientId)) u.searchParams.set("scope", "repo");
  if (opts.challenge) {
    u.searchParams.set("code_challenge", opts.challenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

export function githubInstallUrl(slug: string): string {
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;
}

/** Nombre de la GitHub App que se registra en la cuenta del usuario.
 *
 * GitHub exige que el nombre de una App sea ÚNICO EN TODO GITHUB. Con un
 * nombre fijo («Forja IA») solo funcionaba la primera vez: la segunda —otra
 * cuenta, o la misma cuando caducaba la cookie— GitHub respondía «Name is
 * already in use» y la conexión se quedaba ahí. Un sufijo aleatorio corto lo
 * evita (máx. 34 caracteres). */
export function nombreDeApp(sufijo: string = Math.random().toString(36).slice(2, 8)): string {
  return `Forja IA ${sufijo}`.slice(0, 34);
}

/** Manifiesto para registrar una GitHub App en la cuenta del usuario (cero config). */
export function githubManifestPayload(origin: string, nombre: string = nombreDeApp()): Record<string, unknown> {
  const o = origin.replace(/\/+$/, "");
  return {
    name: nombre,
    url: o,
    description: "Edita repositorios y sube los cambios a main desde Forja.",
    hook_attributes: { url: `${o}/api/github/webhook`, active: false },
    redirect_url: `${o}/api/github/manifest/callback`,
    callback_urls: [`${o}/api/github/oauth/callback`],
    setup_url: `${o}/api/github/oauth/callback`,
    public: false,
    // administration: crear el repo al subir. Sin él, una cuenta nueva (sin
    // repos todavía) no podía subir nada: POST /user/repos → 403.
    default_permissions: { contents: "write", metadata: "read", administration: "write" },
    request_oauth_on_install: true,
  };
}

export type AppCreds = { clientId: string; clientSecret: string; slug?: string };

export function parseAppCredsJson(raw: string): AppCreds | null {
  try {
    const j = JSON.parse(raw) as Partial<AppCreds>;
    if (!j.clientId?.trim() || !j.clientSecret?.trim()) return null;
    return {
      clientId: String(j.clientId),
      clientSecret: String(j.clientSecret),
      slug: j.slug ? String(j.slug) : undefined,
    };
  } catch {
    return null;
  }
}

export const GH_OAUTH_MSG = "forja-github";
export const GH_STATE_COOKIE = "forja_gh_state";
export const GH_APP_COOKIE = "forja_gh_app";
