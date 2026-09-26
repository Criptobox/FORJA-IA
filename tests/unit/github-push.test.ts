import { describe, expect, it } from "vitest";
import { ghEnsureRepo, pistaDeGithub, uploadToGithub, type GhFetch, type GhItem } from "../../src/lib/forja/github-upload";

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
  commits: Record<string, { tree: string; parents: string[]; message?: string }>;
  arboles: Record<string, Record<string, string>>;
  /** modo de cada ruta en cada árbol (solo los que no son 100644) */
  modos: Record<string, Record<string, string>>;
  blobs: Record<string, string>;
  existe: boolean;
  descripcion?: string;
}

function githubFalso(inicial?: Partial<RepoFalso>) {
  const repo: RepoFalso = {
    defaultBranch: "main",
    ramas: {},
    commits: {},
    arboles: {},
    modos: {},
    blobs: {},
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
      repo.descripcion = cuerpo.description as string | undefined;
      // auto_init: el repo nace con un README en su rama
      if (cuerpo.auto_init) {
        repo.arboles.treeinit = { "README.md": "# w" };
        repo.commits.commitinit = { tree: "treeinit", parents: [] };
        repo.ramas[repo.defaultBranch] = "commitinit";
      }
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
    // Un repo sin ningún commit no admite la Git Data API (como el de verdad)
    const vacio = Object.keys(repo.ramas).length === 0;
    if (vacio && /\/git\/(blobs|trees|commits)$/.test(ruta) && metodo === "POST") {
      return err(409, "Git Repository is empty.");
    }
    if (ruta === "/repos/yo/w/git/blobs" && metodo === "POST") {
      const sha = nuevo("blob");
      repo.blobs[sha] = String(cuerpo.content);
      return ok({ sha });
    }
    if (ruta === "/repos/yo/w/git/trees" && metodo === "POST") {
      const bt = cuerpo.base_tree ? String(cuerpo.base_tree) : "";
      const base = bt ? { ...repo.arboles[bt] } : {};
      const modos = bt ? { ...(repo.modos[bt] ?? {}) } : {};
      for (const e of cuerpo.tree as { path: string; content?: string; sha?: string | null; mode?: string }[]) {
        if (e.sha === null) {
          delete base[e.path];
          delete modos[e.path];
          continue;
        }
        base[e.path] = e.content ?? `blob:${e.sha}`;
        if (e.mode && e.mode !== "100644") modos[e.path] = e.mode;
        else delete modos[e.path];
      }
      const sha = nuevo("tree");
      repo.arboles[sha] = base;
      repo.modos[sha] = modos;
      return ok({ sha });
    }
    const mTree = ruta.match(/^\/repos\/yo\/w\/git\/trees\/([^?]+)\?recursive=1$/);
    if (mTree && metodo === "GET") {
      const t = repo.arboles[mTree[1]];
      return t ? ok({ truncated: false, tree: Object.keys(t).map((path) => ({ path, type: "blob" })) }) : err(404, "Not Found");
    }
    const mContents = ruta.match(/^\/repos\/yo\/w\/contents\/(.+)$/);
    if (mContents && metodo === "PUT") {
      const rama = String(cuerpo.branch ?? repo.defaultBranch);
      const padre = repo.ramas[rama];
      const baseArbol = padre ? { ...repo.arboles[repo.commits[padre].tree] } : {};
      baseArbol[decodeURIComponent(mContents[1])] = atob(String(cuerpo.content));
      const tsha = nuevo("tree");
      repo.arboles[tsha] = baseArbol;
      const csha = nuevo("commit");
      repo.commits[csha] = { tree: tsha, parents: padre ? [padre] : [] };
      repo.ramas[rama] = csha;
      return ok({ commit: { sha: csha } });
    }
    if (ruta === "/repos/yo/w/git/commits" && metodo === "POST") {
      const sha = nuevo("commit");
      repo.commits[sha] = {
        tree: String(cuerpo.tree),
        parents: (cuerpo.parents as string[]) ?? [],
        message: String(cuerpo.message ?? ""),
      };
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
      const rama = decodeURIComponent(mPatch[1]);
      // sin force, solo avanza si el commit nuevo desciende del actual
      const actual = repo.ramas[rama];
      if (actual && !(repo.commits[String(cuerpo.sha)]?.parents ?? []).includes(actual)) {
        return err(422, "Update is not a fast forward");
      }
      repo.ramas[rama] = String(cuerpo.sha);
      return ok({ object: { sha: cuerpo.sha } });
    }
    return err(404, `sin ruta falsa para ${metodo} ${ruta}`);
  };

  return {
    f,
    repo,
    llamadas,
    arbolDe: (rama: string) => repo.arboles[repo.commits[repo.ramas[rama]]?.tree ?? ""],
    modosDe: (rama: string) => repo.modos[repo.commits[repo.ramas[rama]]?.tree ?? ""] ?? {},
  };
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

  it("en modo «añadir», lo que ya estaba en el repo NO se borra", async () => {
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
      modo: "anadir",
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
      if (url.includes("/git/refs") && init?.method === "PATCH") g.repo.ramas.main = "otracosa";
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

  it("un proyecto grande entra en UN SOLO commit, con el árbol montado por tramos", async () => {
    const g = githubFalso();
    const muchos = Array.from({ length: 700 }, (_, i) => archivo(`f${i}.txt`, `n${i}`));
    const r = await uploadToGithub("tk", { repoName: "w", isPrivate: false, items: muchos, fetchImpl: g.f });
    expect(r.commits).toBe(1);
    expect(g.repo.ramas.main).toBe(r.sha);
    // un solo commit nuevo, colgando del README inicial
    expect(g.repo.commits[r.sha].parents).toEqual(["commitinit"]);
    const arboles = g.llamadas.filter((l) => l === "POST /repos/yo/w/git/trees").length;
    expect(arboles, "varios tramos de árbol").toBeGreaterThan(1);
    expect(g.llamadas.filter((l) => l === "POST /repos/yo/w/git/commits")).toHaveLength(1);
    // ningún archivo se queda por el camino entre tramos
    expect(Object.keys(g.arbolDe("main"))).toHaveLength(700);
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

  it("un token de GitHub App sube a un repo YA EXISTENTE aunque crear (POST) le esté vetado", async () => {
    // Bug real: un token de GitHub App (ghu_…) no tiene permiso para
    // POST /user/repos (hace falta «Administration», que esta app no pide)
    // — GitHub devuelve 403 «Resource not accessible by integration» en
    // ESE endpoint sin importar si el repo de destino ya existe ni si la
    // instalación tiene acceso de escritura a su contenido. Antes del
    // reordenamiento, ghEnsureRepo intentaba crear PRIMERO y la subida a un
    // repo ya existente y ya autorizado fallaba igual.
    const g = githubFalso({ existe: true, defaultBranch: "main" });
    const postSiempreVetado: GhFetch = async (url, init) => {
      if (url.endsWith("/user/repos") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ message: "Resource not accessible by integration" }),
          { status: 403 }
        );
      }
      return g.f(url, init);
    };
    const r = await ghEnsureRepo("ghu_faketoken", "w", false, postSiempreVetado);
    expect(r.created).toBe(false);
    expect(r.branch).toBe("main");
  });
});

describe("una cuenta nueva sin permiso para crear repos", () => {
  it("se dice qué hacer: crearlo vacío en GitHub o reconectar con «Otra cuenta»", async () => {
    const g = githubFalso();
    const vetado: GhFetch = async (url, init) => {
      if (url.endsWith("/user/repos") && init?.method === "POST") {
        return new Response(JSON.stringify({ message: "Resource not accessible by integration" }), { status: 403 });
      }
      return g.f(url, init);
    };
    await expect(ghEnsureRepo("ghu_x", "web-nueva", false, vetado)).rejects.toThrow(/github\.com\/new.*Otra cuenta/s);
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

describe("subir a GitHub — reemplazar, repos vacíos y cortes", () => {
  const conCommit = (arbol: Record<string, string>) => ({
    existe: true,
    ramas: { main: "commit0" },
    commits: { commit0: { tree: "tree0", parents: [] } },
    arboles: { tree0: arbol },
  });

  it("por defecto REEMPLAZA: el repo queda exactamente como el proyecto y se cuenta lo quitado", async () => {
    const g = githubFalso(conCommit({ "README.md": "viejo", "src/viejo.js": "ya no existe", "index.html": "v1" }));
    const r = await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [archivo("index.html", "v2"), archivo("css/a.css", "body{}")],
      fetchImpl: g.f,
    });
    expect(Object.keys(g.arbolDe("main")).sort()).toEqual(["css/a.css", "index.html"]);
    expect(g.arbolDe("main")["index.html"]).toBe("v2");
    expect(r.eliminados).toBe(2);
    // el historial anterior sigue ahí: el commit nuevo cuelga del viejo
    expect(g.repo.commits[r.sha].parents).toEqual(["commit0"]);
    expect(g.repo.commits[r.sha].message).toMatch(/Actualiza el proyecto/);
  });

  it("un repo VACÍO (creado en GitHub sin README) también se sube", async () => {
    // Antes: 409 «Git Repository is empty» en el primer blob y fin.
    const g = githubFalso({ existe: true });
    const r = await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [archivo("index.html", "<h1>hola</h1>")],
      fetchImpl: g.f,
    });
    expect(g.repo.ramas.main).toBe(r.sha);
    expect(Object.keys(g.arbolDe("main"))).toEqual(["index.html"]);
    expect(r.eliminados).toBe(0);
  });

  it("en un repo vacío y modo «añadir», el archivo de arranque tampoco se queda", async () => {
    const g = githubFalso({ existe: true });
    await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [archivo("index.html", "x")],
      modo: "anadir",
      fetchImpl: g.f,
    });
    expect(Object.keys(g.arbolDe("main"))).toEqual(["index.html"]);
  });

  it("un corte de red o un 502 a mitad se reintenta y la subida termina", async () => {
    const g = githubFalso();
    let fallos = 0;
    const inestable: GhFetch = async (url, init) => {
      if (url.endsWith("/git/trees") && fallos === 0) {
        fallos++;
        throw new TypeError("Failed to fetch");
      }
      if (url.endsWith("/git/commits") && init?.method === "POST" && fallos === 1) {
        fallos++;
        return new Response(JSON.stringify({ message: "Bad Gateway" }), { status: 502 });
      }
      return g.f(url, init);
    };
    const r = await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [archivo("index.html", "x")],
      fetchImpl: inestable,
      dormir: async () => {},
    });
    expect(fallos).toBe(2);
    expect(g.repo.ramas.main).toBe(r.sha);
  });

  it("si la red no vuelve, se dice claro y la rama NO se toca", async () => {
    const g = githubFalso(conCommit({ "README.md": "x" }));
    const caido: GhFetch = async (url, init) => {
      if (url.endsWith("/git/trees")) throw new TypeError("Failed to fetch");
      return g.f(url, init);
    };
    await expect(
      uploadToGithub("tk", { repoName: "w", isPrivate: false, items: [archivo("a.txt", "a")], fetchImpl: caido, dormir: async () => {} })
    ).rejects.toThrow(/tras varios intentos/);
    expect(g.repo.ramas.main).toBe("commit0");
  });

  it("un 404 NO se reintenta: repetir un «no» solo gasta tiempo", async () => {
    const g = githubFalso();
    let llamadas = 0;
    const f: GhFetch = async (url, init) => {
      if (url.endsWith("/git/trees")) {
        llamadas++;
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }
      return g.f(url, init);
    };
    await expect(
      uploadToGithub("tk", { repoName: "w", isPrivate: false, items: [archivo("a.txt", "a")], fetchImpl: f, dormir: async () => {} })
    ).rejects.toThrow(/404/);
    expect(llamadas).toBe(1);
  });

  it("los scripts suben con permiso de ejecución (por «#!» o por venir así del ZIP)", async () => {
    const g = githubFalso();
    await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [
        archivo("scripts/deploy.sh", "#!/bin/bash\necho hola"),
        { ...archivo("gradlew", "exec sin shebang"), exec: true },
        archivo("index.html", "<p>x</p>"),
      ],
      fetchImpl: g.f,
    });
    const modos = g.modosDe("main");
    expect(modos["scripts/deploy.sh"]).toBe("100755");
    expect(modos["gradlew"]).toBe("100755");
    expect(modos["index.html"]).toBeUndefined();
  });

  it("los binarios y los textos grandes van como blob aparte, sin corromperse", async () => {
    const g = githubFalso();
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3])], "logo.png");
    const grande = "x".repeat(600 * 1024);
    await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [{ path: "img/logo.png", file: png }, archivo("datos.json", grande), archivo("index.html", "hola")],
      fetchImpl: g.f,
    });
    const arbol = g.arbolDe("main");
    expect(arbol["img/logo.png"]).toMatch(/^blob:/);
    expect(arbol["datos.json"]).toMatch(/^blob:/);
    expect(arbol["index.html"]).toBe("hola");
  });

  it("un repo nuevo NO sale con una descripción inventada", async () => {
    const g = githubFalso();
    await uploadToGithub("tk", { repoName: "w", isPrivate: false, items: [archivo("a.txt", "a")], fetchImpl: g.f });
    expect(g.repo.descripcion).toBeUndefined();
    const g2 = githubFalso();
    await uploadToGithub("tk", {
      repoName: "w",
      isPrivate: false,
      items: [archivo("a.txt", "a")],
      descripcion: "Web de la cafetería",
      fetchImpl: g2.f,
    });
    expect(g2.repo.descripcion).toBe("Web de la cafetería");
  });

  it("si alguien subió cambios mientras tanto, no se pisa: se para con un mensaje claro", async () => {
    const g = githubFalso(conCommit({ "README.md": "x" }));
    const carrera: GhFetch = async (url, init) => {
      if (url.endsWith("/git/commits") && init?.method === "POST") {
        const res = await g.f(url, init);
        // otro push llega justo antes de mover la rama
        g.repo.commits.ajeno = { tree: "tree0", parents: ["commit0"] };
        g.repo.ramas.main = "ajeno";
        return res;
      }
      return g.f(url, init);
    };
    await expect(
      uploadToGithub("tk", { repoName: "w", isPrivate: false, items: [archivo("a.txt", "a")], fetchImpl: carrera })
    ).rejects.toThrow(/mientras subías/);
    expect(g.repo.ramas.main).toBe("ajeno");
  });
});
