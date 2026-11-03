# Avisos de terceros — skills de pantalla del Estudio

`src/lib/forja/estudio/skills.ts` contiene **adaptaciones condensadas y
traducidas** de estas piezas de **Open Design Agent Kit**
(https://github.com/feimacode/open-design-agent-kit, MIT, © 2026 Iven Xu):

| Skill FORJA | Original en el kit |
|---|---|
| producto | `packages/content/assets/open-design/craft/product-ui.md` |
| marco-app | `skills/app-shell/SKILL.md` |
| tabla | `skills/app-table/SKILL.md` |
| formulario | `skills/app-form/SKILL.md` |
| detalle | `skills/app-detail/SKILL.md` |
| busqueda | `skills/app-search/SKILL.md` |
| ajustes | `skills/app-settings/SKILL.md` y `skills/flow-settings/SKILL.md` |
| acceso | `skills/flow-sign-in/SKILL.md` |
| bienvenida | `skills/flow-onboarding/SKILL.md` |
| planes | `skills/flow-paywall/SKILL.md` |
| asistente | `skills/flow-ai-chat/SKILL.md` |

Todas son skills **escritas por el propio kit** (llevan la marca «Kit skill» /
«Kit craft doc»), cubiertas por su licencia MIT. El resto del catálogo del kit
(unas 170 skills, plantillas y sistemas de diseño) viene de
[nexu-io/open-design](https://github.com/nexu-io/open-design), que es
**Apache-2.0**, y **no se ha copiado**: si algún día se trae, hay que conservar
su aviso de licencia y marcar los cambios, como pide Apache-2.0.

Cambios respecto al original: traducidas al español, recortadas a ≤ 650
caracteres (para modelos gratis), sin la maquinaria del kit (`data-od-*`,
herramientas MCP, semillas HTML) y con comprobaciones deterministas propias
(`comprobar`).

## Licencia MIT del original

```
MIT License

Copyright (c) 2026 Iven Xu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
