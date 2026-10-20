# Cron de aprendizaje — que FORJA IA estudie solo, cada día

El ciclo de aprendizaje ya es **acotado y autocuidado**: 3 fuentes por
ciclo, 40k caracteres por página, 2 MB por descarga y **15 minutos de
descanso mínimo** entre ciclos (`intervaloSuficiente()` + el 429 de la
ruta). Por eso un cron diario es seguro: como mucho lee 3 páginas al día.

## Opción A — Vercel Cron (si tu FORJA IA despliega en Vercel)

`vercel.json` en la raíz de tu proyecto:

```json
{
  "crons": [
    { "path": "/api/forja/aprender", "schedule": "0 9 * * *" }
  ]
}
```

`schedule` usa UTC: `0 9 * * *` = 09:00 UTC. Para tu zona horaria ajusta
(p. ej. 09:00 en Madrid verano = `0 7 * * *`; Ciudad de México = `0 15 * * *`).

La ruta ya valida el secreto del cron: define `FORJA_ADMIN_SECRET` en las
variables de entorno de Vercel y Vercel envía automáticamente
`Authorization: Bearer <CRON_SECRET>`. Para que el cron pase la guardia de
dueño, fija también:

```
FORJA_ADMIN_SECRET=<el mismo valor que CRON_SECRET>
```

## Opción B — Cualquier scheduler externo (cron de tu VPS, GitHub Actions…)

```
# crontab del servidor — cada día a las 9:00
0 9 * * * curl -s -X POST -H "Authorization: Bearer $FORJA_ADMIN_SECRET" https://tuproyecto.com/api/forja/aprender > /var/log/d1-aprender.log
```

Con GitHub Actions (`.github/workflows/d1-aprender.yml`):

```yaml
name: FORJA IA aprende
on:
  schedule:
    - cron: "0 9 * * *"
  workflow_dispatch: {}
jobs:
  aprender:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sf -X POST \
            -H "Authorization: Bearer ${{ secrets.FORJA_ADMIN_SECRET }}" \
            https://tuproyecto.com/api/forja/aprender
```

## Qué esperar

- Si el descanso no ha pasado, la ruta responde `429` y no pasa nada:
  es la protección trabajando, no un error.
- El informe de cada ciclo (qué leyó, qué aprendió, qué descartó) queda
  visible en el Apartado la próxima vez que abras Ajustes, y las reglas
  nuevas viajan solas al Diseñador según tu perfil (4–10 por petición).
- Si un día añades fuentes nuevas al Apartado, puedes lanzar el ciclo a
  mano con «Aprender ahora» sin esperar al cron (respetando el descanso).
