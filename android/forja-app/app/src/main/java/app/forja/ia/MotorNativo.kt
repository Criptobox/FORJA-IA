package app.forja.ia

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.ServerSocket
import java.net.URL
import java.util.UUID
import kotlin.concurrent.thread

/**
 * llama.cpp compilado para el móvil (`llama-server`), arrancado como proceso.
 *
 * Va empaquetado como `libllama-server.so` en jniLibs: Android solo deja
 * ejecutar binarios que estén en `nativeLibraryDir`. Escucha en 127.0.0.1 con
 * una clave aleatoria por arranque (cualquier app del móvil puede hablar con
 * 127.0.0.1; sin la clave no le sirve de nada) y solo acepta peticiones con el
 * origen de la interfaz (CORS).
 *
 * Para el resto de Forja es un servidor OpenAI-compatible como cualquier otro:
 * chat, herramientas del agente, streaming… todo lo hace llama-server.
 */
class MotorNativo(
    private val contexto: Context,
    /** Avisa de cada cambio de estado (desde un hilo cualquiera). */
    private val alCambiar: (JSONObject) -> Unit,
) {
    @Volatile private var proceso: Process? = null
    @Volatile private var estado = "parado"
    @Volatile private var modelo: String? = null
    @Volatile private var ctx = 0
    @Volatile private var puerto = 0
    @Volatile private var clave = ""
    @Volatile private var detalle: String? = null
    private val log = ArrayDeque<String>()

    fun estadoJson(): JSONObject = JSONObject()
        .put("estado", estado)
        .put("modelo", modelo ?: JSONObject.NULL)
        .put("contexto", ctx)
        .put("url", if (puerto > 0) "http://127.0.0.1:$puerto/v1" else "")
        .put("clave", clave)
        .apply { detalle?.let { put("detalle", it) } }

    @Synchronized
    fun iniciar(archivo: File, alias: String, contextoTokens: Int, hilos: Int) {
        detener()
        val binario = File(contexto.applicationInfo.nativeLibraryDir, "libllama-server.so")
        if (!binario.exists()) {
            fallar("Esta APK no trae el motor nativo (falta libllama-server.so).")
            return
        }
        puerto = puertoLibre()
        clave = UUID.randomUUID().toString()
        modelo = alias
        ctx = contextoTokens
        detalle = null
        synchronized(log) { log.clear() }
        cambiar("cargando")

        val orden = listOf(
            binario.absolutePath,
            "-m", archivo.absolutePath,
            "--alias", alias,
            "--host", "127.0.0.1",
            "--port", puerto.toString(),
            "-c", contextoTokens.toString(),
            "-t", hilos.toString(),
            // Plantilla de chat del propio modelo: herramientas del agente.
            "--jinja",
            "--api-key", clave,
            "--cors-origins", ORIGEN,
            "--no-webui",
        )
        val p = try {
            ProcessBuilder(orden)
                .directory(contexto.filesDir)
                .redirectErrorStream(true)
                .apply { environment()["HOME"] = contexto.filesDir.absolutePath }
                .start()
        } catch (e: Exception) {
            fallar("No se pudo lanzar el motor: ${e.message}")
            return
        }
        proceso = p

        // Lo que escribe llama-server: se guarda para explicar un fallo.
        thread(name = "motor-log", isDaemon = true) {
            p.inputStream.bufferedReader().forEachLine { linea ->
                synchronized(log) {
                    log.addLast(linea.take(300))
                    while (log.size > 40) log.removeFirst()
                }
            }
        }
        // Esperar a que conteste /health (cargar 1-5 GB lleva su rato).
        thread(name = "motor-espera", isDaemon = true) {
            val limite = System.currentTimeMillis() + 300_000
            while (System.currentTimeMillis() < limite) {
                if (proceso !== p) return@thread
                if (!p.isAlive) {
                    fallar("El motor se cerró al cargar el modelo. ${causa()}")
                    return@thread
                }
                if (sano()) {
                    cambiar("listo")
                    // Y vigilar que siga vivo.
                    val codigo = p.waitFor()
                    if (proceso === p) fallar("El motor se detuvo (código $codigo). ${causa()}")
                    return@thread
                }
                Thread.sleep(500)
            }
            detener()
            fallar("El modelo tardó demasiado en cargar.")
        }
    }

    @Synchronized
    fun detener() {
        val p = proceso ?: return
        proceso = null
        p.destroy()
        thread(isDaemon = true) {
            Thread.sleep(3000)
            if (p.isAlive) p.destroyForcibly()
        }
        puerto = 0
        clave = ""
        cambiar("parado")
    }

    private fun sano(): Boolean = try {
        val c = URL("http://127.0.0.1:$puerto/health").openConnection() as HttpURLConnection
        c.connectTimeout = 1000
        c.readTimeout = 1000
        val ok = c.responseCode == 200
        c.disconnect()
        ok
    } catch (_: Exception) {
        false
    }

    /** La última línea del log que suena a fallo; si no, las tres últimas. */
    private fun causa(): String = synchronized(log) {
        log.lastOrNull { Regex("error|fail|abort|unable|cannot|out of memory", RegexOption.IGNORE_CASE).containsMatchIn(it) }
            ?: log.takeLast(3).joinToString(" · ")
    }

    private fun fallar(motivo: String) {
        detalle = motivo
        cambiar("error")
    }

    private fun cambiar(nuevo: String) {
        estado = nuevo
        alCambiar(estadoJson())
    }

    private fun puertoLibre(): Int = ServerSocket(0).use { it.localPort }

    companion object {
        const val ORIGEN = "https://appassets.androidplatform.net"
    }
}
