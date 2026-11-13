/* Carga scripts del navegador (sin module.exports) dentro de un contexto aislado de vm y devuelve lo que se pida. */
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
module.exports = function cargar(archivo, expresion) {
  const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
  return vm.runInContext(fs.readFileSync(path.join(__dirname, '../../web/js', archivo), 'utf8') + '\n;(' + expresion + ')', ctx);
};
