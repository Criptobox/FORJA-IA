package app.forja.ia

import android.content.Context
import android.content.Intent
import org.json.JSONObject
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
        .put("usuario", if (OcRuntime.SECURE_SERVER) OcRuntime.SERVER_USER else "")
        .put("clave", if (OcRuntime.SECURE_SERVER) rt.serverPassword() else "")
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

    /** Para el servidor (el servicio en primer plano se quita). */
    fun detener() {
        RuntimeService.stopForUpdate(contexto)
        poner("parado")
    }
}
