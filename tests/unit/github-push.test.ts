import { describe, expect, it } from "vitest";
import { ghEnsureRepo, pistaDeGithub, uploadToGithub, type GhFetch, type GhItem } from "../../src/lib/prism/github-upload";

/** Forja IA — La subida a GitHub, con un GitHub de mentira delante.
 *
 * Esto no existía. Toda la subida era código sin una sola prueba porque hacía
 * falta una cuenta de GitHub de verdad para ejecutarlo — y por eso el fallo de
 * la rama fija sobrevivió versiones enteras: en un repo con `master`, la app
 * creaba un commit huérfano, se tragaba el error de la rama y decía
 * «¡Completado!» con GitHub intacto.
 *
 * El GitHub de mentira de aquí abajo se comporta como el de verdad en lo que
 * importa: tiene una rama por defecto que puede NO llamarse main, exige el
 * `base_tree` para conservar lo que ya había, y solo da por publicado lo que
 * la rama apunta.
 */

interface RepoFalso {
  defaultBranch: string;
  ramas: Record<string, string>;
  commits: Record<string, { tree: string; parents: string[] }>;
  arboles: Record<string, Record<string, string>>;
  existe: boolean;
}

function githubFalso(inicial?: Partial<RepoFalso>) {
  const repo: RepoFalso = {
    defaultBranch: "main",
    ramas: {},
    commits: {},
    arboles: {},
    existe: false,
    ...inicial,
  };
  let n = 0;
  const nuevo = (p: string) => `${p}${(++n).toString().padStart(4, "0")}`;
  const llamadas: string[] = [];

  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const err = (status: number, message: string, errores?: unknown[]) =>
    new Response(JSON.stringify({ message, ...(errores ? { errors: errores } : {}) }), { status });

  const f: GhFetch = async (url, init) => {
    const metodo = init?.method ?? "GET";
    const ruta = url.replace("https://api.github.com", "");
    llamadas.push(`${metodo} ${ruta}`);
    const cuerpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    if (ruta === "/user") return ok({ login: "yo", name: "Yo", avatar_url: "" });

    if (ruta === "/user/repos" && metodo === "POST") {
      if (repo.existe) return err(422, "name already exists on this account");
      repo.existe = true;
      return ok({ owner: { login: "yo" }, html_url: "https://github.com/yo/w", default_branch: repo.defaultBranch });
    }
    if (ruta === "/repos/yo/w" && metodo === "GET") {
      if (!repo.existe) return err(404, "Not Found");
      return ok({ owner: { login: "yo" }, html_url: "https://github.com/yo/w", default_branch: repo.defaultBranch });
    }

    const mRef = ruta.match(/^\/repos\/yo\/w\/git\/ref\/heads\/(.+)$/);
    if (mRef && metodo === "GET") {
      const sha = repo.ramas[decodeURIComponent(mRef[1])];
      return sha ? ok({ object: { sha } }) : err(404, "Branch not found");
    }
    const mCommit = ruta.match(/^\/repos\/yo\/w\/git\/commits\/(.+)$/);
    if (mCommit && metodo === "GET") {
      const c = repo.commits[mCommit[1]];
      return c ? ok({ tree: { sha: c.tree } }) : err(404, "Not Found");
    }
    if (ruta === "/repos/yo/w/git/trees" && metodo === "POST") {
      const base = cuerpo.base_tree ? { ...repo.arboles[String(cuerpo.base_tree)] } : {};
      for (const e of cuerpo.tree as { path: string; content?: string }[]) base[e.path] = e.content ?? "bin";
      const sha = nuevo("tree");
      repo.arboles[sha] = base;
      return ok({ sha });
    }
    if (ruta === "/repos/yo/w/git/commits" && metodo === "POST") {
      const sha = nuevo("commit");
      repo.commits[sha] = { tree: String(cuerpo.tree), parents: (cuerpo.parents as string[]) ?? [] };
      return ok({ sha, tree: { sha: cuerpo.tree } });
    }
    if (ruta === "/repos/yo/w/git/refs" && metodo === "POST") {
      const nombre = String(cuerpo.ref).replace("refs/heads/", "");
      if (repo.ramas[nombre]) return err(422, "Reference already exists");
      repo.ramas[nombre] = String(cuerpo.sha);
      return ok({ object: { sha: cuerpo.sha } });
    }
    const mPatch = ruta.match(/^\/repos\/yo\/w\/git\/refs\/heads\/(.+)$/);
    if (mPatch && metodo === "PATCH") {
      repo.ramas[decodeURIComponent(mPatch[1])] = String(cuerpo.sha);
      return ok({ object: { sha: cuerpo.sha } });
    }
    return err(404, `sin ruta falsa para ${metodo} ${ruta}`);
  };

  return { f, repo, llamadas, arbolDe: (rama: string) => repo.arboles[repo.commits[repo.ramas[rama]]?.tree ?? ""] };
}

const archivo = (path: string, texto: string): GhItem => ({
  path,
  file: new File([texto], path.split("/").pop() ?? path),
});

describe("subir a GitHub", () => {
  it("un repo nuevo queda publicado en su rama", async () => {
    const g = githubFalso();
    const r = await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: true,
      items: [archivo("index.html", "<h1>hola</h1>")],
      fetchImpl: g.f,
    });
    expect(r.branch).toBe("main");
    expect(g.repo.ramas.main).toBe(r.sha);
    expect(g.arbolDe("main")).toHaveProperty("index.html");
  });

  it("un repo cuya rama es «master» TAMBIÉN queda publicado", async () => {
    // El fallo que traía al usuario: se asumía «main». Con «master», la rama
    // no se encontraba, el commit salía huérfano, el error se tragaba y la app
    // decía «¡Completado!» sin haber subido nada.
    const g = githubFalso({
      defaultBranch: "master",
      existe: true,
      ramas: { master: "commit0" },
      commits: { commit0: { tree: "tree0", parents: [] } },
      arboles: { tree0: { "README.md": "viejo" } },
    });
    const r = await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [archivo("index.html", "<h1>hola</h1>")],
      fetchImpl: g.f,
    });
    expect(r.branch).toBe("master");
    expect(g.repo.ramas.master).toBe(r.sha);
    expect(g.repo.ramas.main, "no se inventa una rama main paralela").toBeUndefined();
    // y el commit cuelga de lo que ya había, no es un huérfano
    expect(g.repo.commits[r.sha].parents).toEqual(["commit0"]);
  });

  it("lo que ya estaba en el repo NO se borra", async () => {
    const g = githubFalso({
      existe: true,
      ramas: { main: "commit0" },
      commits: { commit0: { tree: "tree0", parents: [] } },
      arboles: { tree0: { "README.md": "no me borres", "src/app.js": "yo tampoco" } },
    });
    await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [archivo("index.html", "nuevo")],
      fetchImpl: g.f,
    });
    const arbol = g.arbolDe("main");
    expect(Object.keys(arbol).sort()).toEqual(["README.md", "index.html", "src/app.js"]);
  });

  it("si no se puede leer el árbol base, PARA: seguir borraría el repo", async () => {
    // Sin esto, un fallo al leer el commit devolvía treeSha "" y el commit iba
    // sin base_tree: el repo se quedaba solo con los archivos del lote.
    const g = githubFalso({
      existe: true,
      ramas: { main: "commit0" },
      commits: {}, // el commit no se puede leer
      arboles: { tree0: { "README.md": "no me borres" } },
    });
    await expect(
      uploadToGithub("tk", {
        repoName: "w",
        isPrivate: false,
        items: [archivo("index.html", "nuevo")],
        fetchImpl: g.f,
      })
    ).rejects.toThrow();
    expect(g.repo.ramas.main, "la rama no se movió").toBe("commit0");
  });

  it("si la rama no acaba apuntando a nuestro commit, NO se dice que fue bien", async () => {
    const g = githubFalso();
    const sabotaje: GhFetch = async (url, init) => {
      const res = await g.f(url, init);
      // alguien mueve la rama a otro sitio justo después de subir
      if (url.includes("/git/refs") && init?.method === "POST") g.repo.ramas.main = "otracosa";
      return res;
    };
    await expect(
      uploadToGithub("tk", {
        repoName: "w",
        isPrivate: false,
        items: [archivo("index.html", "x")],
        fetchImpl: sabotaje,
      })
    ).rejects.toThrow(/no quedó publicada/i);
  });

  it("varios lotes encadenan commits y el último manda", async () => {
    const g = githubFalso();
    const muchos = Array.from({ length: 130 }, (_, i) => archivo(`f${i}.txt`, `n${i}`));
    const r = await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: muchos,
      fetchImpl: g.f,
    });
    expect(r.commits).toBeGreaterThan(1);
    expect(g.repo.ramas.main).toBe(r.sha);
    // ningún archivo se queda por el camino entre lotes
    expect(Object.keys(g.arbolDe("main"))).toHaveLength(130);
  });

  it("un 422 que NO es «ya existe» se cuenta, no se da por bueno", async () => {
    const g = githubFalso();
    const nombreMalo: GhFetch = async (url, init) => {
      if (url.endsWith("/user/repos") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            message: "Repository creation failed.",
            errors: [{ message: "name is not available" }],
          }),
          { status: 422 }
        );
      }
      return g.f(url, init);
    };
    await expect(ghEnsureRepo("tk", "w", false, nombreMalo)).rejects.toThrow(/name is not available/);
  });

  it("el repo que ya existía se reutiliza con SU rama", async () => {
    const g = githubFalso({ existe: true, defaultBranch: "develop" });
    const r = await ghEnsureRepo("tk", "w", false, g.f);
    expect(r.created).toBe(false);
    expect(r.branch).toBe("develop");
  });
});

describe("qué hacer cuando GitHub dice que no", () => {
  it("cada código dice qué arreglar, no solo qué pasó", () => {
    expect(pistaDeGithub(401, "Bad credentials")).toMatch(/vuelve a conectar/i);
    expect(pistaDeGithub(403, "Resource not accessible")).toMatch(/alcance «repo»/i);
    expect(pistaDeGithub(403, "API rate limit exceeded")).toMatch(/espera unos minutos/i);
    expect(pistaDeGithub(404, "Not Found")).toMatch(/no existe o tu token/i);
    expect(pistaDeGithub(500, "boom")).toMatch(/falla GitHub, no tú/i);
  });

  it("un código sin pista no se inventa una", () => {
    expect(pistaDeGithub(200, "ok")).toBe("");
  });
});
