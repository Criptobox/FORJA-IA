package app.forja.opencodemobile

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL

/**
 * Supervisor seguro provisional: detecta un servidor loopback ya iniciado, pero no
 * afirma que OpenCode esté instalado. La gestión proot/runtime se integra en una fase posterior.
 */
class RuntimeSupervisor(private val context: Context) {
    fun isInstalled(): Boolean = false // No se incluye aún un runtime proot verificable.
    fun isRunning(): Boolean = try {
        val c = URL("http://127.0.0.1:4096/global/health").openConnection() as HttpURLConnection
        c.connectTimeout = 700; c.readTimeout = 700
        try { c.responseCode in 200..299 } finally { c.disconnect() }
    } catch (_: Exception) { false }
    fun version(): String? = null
    fun statusMessage(): String = if (isRunning()) "Servidor OpenCode detectado en localhost." else "El ejecutor OpenCode/proot todavía no está integrado. No se ha iniciado ningún proceso."
}
