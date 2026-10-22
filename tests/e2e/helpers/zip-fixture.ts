import { crc32 } from "node:zlib";

/**
 * Construye un ZIP (sin compresión) en memoria. Así el E2E no depende de un
 * binario versionado que puede perderse en el checkout de CI.
 */
export function crearZip(entradas: Record<string, string>): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let offset = 0;
  for (const [nombre, contenido] of Object.entries(entradas)) {
    const nom = Buffer.from(nombre, "utf8");
    const datos = Buffer.from(contenido, "utf8");
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nom.length, 26);
    locales.push(local, nom, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt32LE(offset, 42);
    centrales.push(central, nom);
    offset += local.length + nom.length + datos.length;
  }
  const dirCentral = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(Object.keys(entradas).length, 8);
  fin.writeUInt16LE(Object.keys(entradas).length, 10);
  fin.writeUInt32LE(dirCentral.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, dirCentral, fin]);
}

/** Proyecto cuyo HTML pide styles.css y script.js, pero trae css.css y javascript.js. */
export function zipHamburgueseria(): Buffer {
  const carpeta = "web ambueguesa/";
  return crearZip({
    [`${carpeta}index.html`]: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Hamburguesería</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><h1>Hamburguesería</h1></header>
  <main><p>Las mejores hamburguesas de la ciudad.</p></main>
  <script src="script.js"></script>
</body>
</html>
`,
    [`${carpeta}css.css`]: `body { font-family: "Poppins", sans-serif; margin: 0; }\nh1 { color: #c2410c; }\n`,
    [`${carpeta}javascript.js`]: `document.body.dataset.listo = "1";\n`,
  });
}
