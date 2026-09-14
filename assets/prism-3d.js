/* prism-3d — WebGL propio, sin librería. Local, ~6 KB.
 *
 * No es Three.js recortado: es un motor de juguete hecho a la medida de lo
 * que un modelo pide razonablemente en un hero — un fondo con vida, una
 * malla que gira, un campo de partículas — sin cargar 150 KB de una
 * librería para usar el 2% de lo que trae.
 *
 * Tres reglas, las mismas que `prism-fx.js` mas una:
 * 1. Si el visitante pidió menos movimiento, no se dibuja ni un frame.
 * 2. Sin WebGL2, el <canvas> se queda vacío y se ve lo que haya detrás
 *    (un gradiente CSS, por ejemplo — de ahí que las escenas se declaren
 *    sobre un elemento que YA tiene un fondo de respaldo).
 * 3. En un equipo de gama baja tampoco se dibuja: una escena que hace que
 *    el móvil se caliente y vaya a 12 fps no es «más pro», es peor.
 *
 * `window.__prism3dActivo` se pone a `true` solo cuando de verdad arranca
 * una escena. Es la señal —nada más— que usan las pruebas para saber si el
 * motor decidió dibujar o quedarse quieto; no cambia nada del render. */
(function () {
  "use strict";
  var doc = document;

  function bajaPotencia() {
    try {
      if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
      if (navigator.connection && navigator.connection.saveData) return true;
    } catch (e) {
      /* sin esos datos, se asume que el equipo aguanta */
    }
    return false;
  }

  var lento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lento || bajaPotencia()) return;

  /* ---------- mat4, lo justo para una cámara en perspectiva ---------- */
  function mult(a, b) {
    var out = new Float32Array(16);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[k * 4 + i] * b[j * 4 + k];
        out[j * 4 + i] = s;
      }
    }
    return out;
  }
  function perspectiva(fovy, aspecto, cerca, lejos) {
    var f = 1 / Math.tan(fovy / 2);
    return new Float32Array([
      f / aspecto, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (lejos + cerca) / (cerca - lejos), -1,
      0, 0, (2 * lejos * cerca) / (cerca - lejos), 0,
    ]);
  }
  function rotY(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  function rotX(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  function trasladar(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  function compilar(gl, tipo, fuente) {
    var sh = gl.createShader(tipo);
    gl.shaderSource(sh, fuente);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }
  function programa(gl, vs, fs) {
    var v = compilar(gl, gl.VERTEX_SHADER, vs);
    var f = compilar(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }

  /* color de la escena: el mismo truco que ya usa el CSS del kit
     (`currentColor`) — el autor tiñe la escena poniendo `color` en el
     propio elemento, sin inventar otro sistema de temas. */
  function colorDe(el) {
    var m = (getComputedStyle(el).color || "").match(/[\d.]+/g);
    if (!m || m.length < 3) return [0.5, 0.6, 1];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }

  /* Se pausa fuera de pantalla: una escena que nadie mira no tiene que
     seguir calentando el procesador. */
  function conVisibilidad(el, cb) {
    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (filas) {
        visible = filas[0].isIntersecting;
      }).observe(el);
    }
    return function () {
      return visible;
    };
  }

  function ajustarTamano(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    var h = canvas.clientHeight || canvas.parentElement.clientHeight || 300;
    var pw = Math.max(1, Math.round(w * dpr));
    var ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    return [w, h];
  }

  /* ---------- escena: partículas ---------- */
  var VS_PUNTOS =
    "attribute vec3 a_pos;" +
    "uniform mat4 u_mvp;" +
    "uniform float u_t;" +
    "void main(){" +
    "vec3 p=a_pos;" +
    "p.y+=sin(u_t*0.4+a_pos.x*3.0)*0.08;" +
    "p.x+=cos(u_t*0.3+a_pos.y*3.0)*0.08;" +
    "gl_Position=u_mvp*vec4(p,1.0);" +
    "gl_PointSize=clamp(240.0/gl_Position.w,1.0,5.0);" +
    "}";
  var FS_PUNTOS =
    "precision mediump float;" +
    "uniform vec3 u_color;" +
    "void main(){" +
    "vec2 c=gl_PointCoord-0.5;" +
    "float d=length(c);" +
    "float a=smoothstep(0.5,0.0,d);" +
    "if(a<0.02)discard;" +
    "gl_FragColor=vec4(u_color,a*0.85);" +
    "}";

  function escenaParticulas(gl, canvas) {
    var prog = programa(gl, VS_PUNTOS, FS_PUNTOS);
    if (!prog) return null;
    var n = 260;
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 1.4;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * 1.4;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 1.4;
    }
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    var locPos = gl.getAttribLocation(prog, "a_pos");
    var locMvp = gl.getUniformLocation(prog, "u_mvp");
    var locT = gl.getUniformLocation(prog, "u_t");
    var locColor = gl.getUniformLocation(prog, "u_color");
    var color = colorDe(canvas);

    return function (t, w, h, px, py) {
      gl.useProgram(prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      var proy = perspectiva((45 * Math.PI) / 180, w / h, 0.1, 20);
      var vista = mult(trasladar(0, 0, -3.4), mult(rotX(py * 0.3), rotY(px * 0.3 + t * 0.05)));
      var mvp = mult(proy, vista);
      gl.uniformMatrix4fv(locMvp, false, mvp);
      gl.uniform1f(locT, t);
      gl.uniform3fv(locColor, color);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, n);
    };
  }

  /* ---------- escena: malla (globo de líneas) ---------- */
  var VS_LINEAS =
    "attribute vec3 a_pos;" +
    "uniform mat4 u_mvp;" +
    "void main(){ gl_Position=u_mvp*vec4(a_pos,1.0); }";
  var FS_LINEAS =
    "precision mediump float;" +
    "uniform vec3 u_color;" +
    "void main(){ gl_FragColor=vec4(u_color,0.55); }";

  function generarGlobo(anillos, segmentos, radio) {
    var verts = [];
    for (var i = 0; i <= anillos; i++) {
      var lat = Math.PI * (i / anillos - 0.5);
      var y = Math.sin(lat) * radio;
      var r = Math.cos(lat) * radio;
      for (var j = 0; j <= segmentos; j++) {
        var lon = (j / segmentos) * Math.PI * 2;
        verts.push(Math.cos(lon) * r, y, Math.sin(lon) * r);
      }
    }
    var fila = segmentos + 1;
    var idx = [];
    for (var i2 = 0; i2 <= anillos; i2++) {
      for (var j2 = 0; j2 < segmentos; j2++) idx.push(i2 * fila + j2, i2 * fila + j2 + 1);
    }
    for (var j3 = 0; j3 < fila; j3 += 3) {
      for (var i3 = 0; i3 < anillos; i3++) idx.push(i3 * fila + j3, (i3 + 1) * fila + j3);
    }
    return { verts: new Float32Array(verts), idx: new Uint16Array(idx) };
  }

  function escenaMalla(gl, canvas) {
    var prog = programa(gl, VS_LINEAS, FS_LINEAS);
    if (!prog) return null;
    var g = generarGlobo(14, 24, 1.2);
    var bufV = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufV);
    gl.bufferData(gl.ARRAY_BUFFER, g.verts, gl.STATIC_DRAW);
    var bufI = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufI);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    var locPos = gl.getAttribLocation(prog, "a_pos");
    var locMvp = gl.getUniformLocation(prog, "u_mvp");
    var locColor = gl.getUniformLocation(prog, "u_color");
    var color = colorDe(canvas);

    return function (t, w, h, px, py) {
      gl.useProgram(prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      var proy = perspectiva((40 * Math.PI) / 180, w / h, 0.1, 20);
      var vista = mult(trasladar(0, 0, -3.2), mult(rotX(0.35 + py * 0.2), rotY(t * 0.15 + px * 0.4)));
      var mvp = mult(proy, vista);
      gl.uniformMatrix4fv(locMvp, false, mvp);
      gl.uniform3fv(locColor, color);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufV);
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufI);
      gl.drawElements(gl.LINES, g.idx.length, gl.UNSIGNED_SHORT, 0);
    };
  }

  /* ---------- escena: shader de fondo (sin 3D, solo un fragment shader) --- */
  var VS_LLENO = "attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.0,1.0); }";
  var FS_BLOB =
    "precision mediump float;" +
    "uniform vec2 u_res; uniform float u_t; uniform vec3 u_color;" +
    "void main(){" +
    "vec2 uv=gl_FragCoord.xy/u_res;" +
    "vec2 p=uv*2.0-1.0; p.x*=u_res.x/u_res.y;" +
    "float d=0.0;" +
    "d+=0.5/length(p-vec2(sin(u_t*0.3)*0.5,cos(u_t*0.25)*0.4));" +
    "d+=0.4/length(p-vec2(cos(u_t*0.22)*0.6,sin(u_t*0.31)*0.5));" +
    "d*=0.16;" +
    "gl_FragColor=vec4(u_color*d, min(1.0,d*0.9));" +
    "}";

  function escenaShader(gl, canvas) {
    var prog = programa(gl, VS_LLENO, FS_BLOB);
    if (!prog) return null;
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var locPos = gl.getAttribLocation(prog, "a_pos");
    var locRes = gl.getUniformLocation(prog, "u_res");
    var locT = gl.getUniformLocation(prog, "u_t");
    var locColor = gl.getUniformLocation(prog, "u_color");
    var color = colorDe(canvas);

    return function (t, w, h) {
      gl.useProgram(prog);
      gl.disable(gl.BLEND);
      gl.uniform2f(locRes, w, h);
      gl.uniform1f(locT, t);
      gl.uniform3fv(locColor, color);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  var CONSTRUCTORES = { "3d-particulas": escenaParticulas, "3d-malla": escenaMalla, "3d-shader": escenaShader };

  function arrancar(canvas) {
    var kind = canvas.dataset.fx3d;
    var construir = CONSTRUCTORES[kind];
    if (!construir) return;
    var gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
    if (!gl) return; // sin WebGL2 se queda vacío: se ve el fondo de respaldo
    var dibujarFrame = construir(gl, canvas);
    if (!dibujarFrame) return; // el shader no compiló: mismo criterio, no se rompe nada

    window.__prism3dActivo = true;
    var estaVisible = conVisibilidad(canvas);
    var px = 0,
      py = 0;
    canvas.addEventListener(
      "pointermove",
      function (ev) {
        var r = canvas.getBoundingClientRect();
        px = (ev.clientX - r.left) / r.width - 0.5;
        py = (ev.clientY - r.top) / r.height - 0.5;
      },
      { passive: true }
    );

    var t0 = performance.now();
    (function marco(ahora) {
      requestAnimationFrame(marco);
      if (!estaVisible()) return;
      var wh = ajustarTamano(canvas);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      dibujarFrame((ahora - t0) / 1000, wh[0], wh[1], px, py);
    })(t0);
  }

  function iniciar() {
    var canvases = document.querySelectorAll("canvas[data-fx3d]");
    for (var i = 0; i < canvases.length; i++) arrancar(canvases[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
