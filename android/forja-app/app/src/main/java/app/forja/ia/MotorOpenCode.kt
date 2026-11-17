package app.forja.ia

import android.content.Context
import android.content.Intent
import android.util.Base64
import org.json.JSONObject
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * El OpenCode oficial corriendo DENTRO de esta app (Alpine + PRoot), igual que
 * en OpenCode Mobile: se instala una vez, arranca solo y sirve en 127.0.0.1.
 * La interfaz carga sus modelos gratis y los usa; ni API key ni contraseña para
 * la persona: la contraseña local del servidor la lleva el puente nativo y solo
 * la ve el origen propio de la interfaz (no los iframes de la vista previa).
 *
 * Estados: `parado` → `instalando` (solo la primera vez) → `arrancando` → `listo`,
 * o `error` con un detalle. Todo lo pesado va en un hilo; el estado se avisa por
 * `alCambiar`, que lo manda a la interfaz.
 */
class MotorOpenCode(
    private val contexto: Context,
    /** Avisa de cada cambio de estado (desde un hilo cualquiera). */
    private val alCambiar: (JSONObject) -> Unit,
) {
    private val rt = OcRuntime(contexto)
    private val ocupado = AtomicBoolean(false)

    @Volatile private var estado = "parado"
    @Volatile private var progreso = 0 // permilles (0..1000) mientras se instala
    @Volatile private var mensaje: String? = null
    @Volatile private var ultimoAviso = 0L

    fun instalado(): Boolean = rt.isInstalled()

    fun estadoJson(): JSONObject = JSONObject()
        .put("estado", estado)
        .put("instalado", rt.isInstalled())
        .put("progreso", progreso)
        .put("mensaje", mensaje ?: JSONObject.NULL)
        .put("url", "http://127.0.0.1:${rt.port}")
        // La contraseña local NO se manda a la interfaz: las llamadas al motor las
        // hace este lado (ver `pedir`) y es aquí donde se añade.
        .put("version", rt.installedVersion())

    private fun avisar(forzar: Boolean = true) {
        val ahora = System.currentTimeMillis()
        // El progreso de la descarga llega muy seguido: no hace falta avisar cada vez.
        if (!forzar && ahora - ultimoAviso < 300) return
        ultimoAviso = ahora
        alCambiar(estadoJson())
    }

    private fun poner(nuevo: String, texto: String? = null) {
        estado = nuevo
        mensaje = texto
        avisar()
    }

    /**
     * Instala el motor si hace falta, lo arranca y espera a que conteste. Seguro
     * de llamar varias veces: si ya hay una en marcha, la segunda no hace nada.
     * `instalarSiFalta = false` es el arranque automático al abrir la app: no
     * descarga cientos de MB sin que la persona lo haya pedido.
     */
    fun arrancar(instalarSiFalta: Boolean) {
        if (!rt.isInstalled() && !instalarSiFalta) return
        if (!ocupado.compareAndSet(false, true)) return
        try {
            RuntimeService.gaveUp = false
            if (!rt.isInstalled()) {
                poner("instalando", "Preparando la instalación…")
                contexto.startForegroundService(Intent(contexto, RuntimeService::class.java))
                rt.install({ p, msg ->
                    progreso = p
                    mensaje = msg
                    avisar(forzar = false)
                }, { /* el registro técnico queda en server.log */ })
                progreso = 1000
            }
            poner("arrancando", "Iniciando OpenCode…")
            contexto.startForegroundService(Intent(contexto, RuntimeService::class.java))
            val t0 = System.currentTimeMillis()
            while (!rt.serverReady()) {
                if (RuntimeService.gaveUp) error("OpenCode se cerró varias veces al arrancar")
                if (System.currentTimeMillis() - t0 > 180_000) error("El motor no respondió en 3 minutos")
                Thread.sleep(500)
            }
            poner("listo")
        } catch (e: Throwable) {
            poner("error", (e.message ?: "Error desconocido") + "\n" + rt.tailLog(8))
        } finally {
            ocupado.set(false)
        }
    }

    private val conexiones = ConcurrentHashMap<String, HttpURLConnection>()
    private val cancelados = ConcurrentHashMap.newKeySet<String>()

    /**
     * Una petición HTTP al motor (solo a 127.0.0.1), hecha desde aquí y no desde
     * el navegador: así no hay CORS, ni contenido mixto, ni permiso de red local,
     * y la contraseña del servidor nunca llega a JavaScript. Va por el puente
     * como una serie de avisos `ocHttp` con el mismo `id`: `cabecera` (estado),
     * `datos` (texto a medida que llega: sirve también para los eventos SSE),
     * y `fin` o `error`.
     */
    fun pedir(id: String, metodo: String, ruta: String, cuerpo: String?, aviso: (JSONObject) -> Unit) {
        fun msg(fase: String) = JSONObject().put("tipo", "ocHttp").put("id", id).put("fase", fase)
        // Solo rutas del propio servidor: nada de URLs completas ni de otros equipos.
        if (!ruta.startsWith("/") || ruta.startsWith("//") || metodo !in setOf("GET", "POST", "PUT", "PATCH", "DELETE")) {
            aviso(msg("error").put("mensaje", "Petición no permitida"))
            return
        }
        var con: HttpURLConnection? = null
        try {
            con = URL("http://127.0.0.1:${rt.port}$ruta").openConnection() as HttpURLConnection
            conexiones[id] = con
            con.requestMethod = metodo
            con.connectTimeout = 5_000
            con.readTimeout = 0 // los flujos de eventos no tienen fin: se cortan con `cancelar`
            if (OcRuntime.SECURE_SERVER) {
                val credencial = "${OcRuntime.SERVER_USER}:${rt.serverPassword()}"
                con.setRequestProperty("Authorization", "Basic " + Base64.encodeToString(credencial.toByteArray(Charsets.UTF_8), Base64.NO_WRAP))
            }
            con.setRequestProperty("Accept", "*/*")
            if (cuerpo != null) {
                con.doOutput = true
                con.setRequestProperty("Content-Type", "application/json")
                con.outputStream.use { it.write(cuerpo.toByteArray(Charsets.UTF_8)) }
            }
            val status = con.responseCode
            aviso(msg("cabecera").put("status", status))
            val flujo = if (status < 400) con.inputStream else con.errorStream
            if (flujo != null) {
                InputStreamReader(flujo, Charsets.UTF_8).use { lector ->
                    val buf = CharArray(4096)
                    while (true) {
                        val n = lector.read(buf)
                        if (n < 0) break
                        aviso(msg("datos").put("texto", String(buf, 0, n)))
                    }
                }
            }
            aviso(msg("fin"))
        } catch (e: Exception) {
            // Si lo cortó la interfaz (`cancelar`), no es un error que contar.
            if (!cancelados.remove(id)) aviso(msg("error").put("mensaje", e.message ?: "Sin conexión con el motor"))
        } finally {
            conexiones.remove(id)
            con?.disconnect()
        }
    }

    /** Corta una petición en curso (la interfaz dejó de esperarla). */
    fun cancelar(id: String) {
        val con = conexiones.remove(id) ?: return
        cancelados.add(id)
        Thread { try { con.disconnect() } catch (_: Exception) { } }.start()
    }

    /** Para el servidor (el servicio en primer plano se quita). */
    fun detener() {
        RuntimeService.stopForUpdate(contexto)
        poner("parado")
    }
}
