package app.forja.ia

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Actualizar la app sin salir de ella.
 *
 * La CI publica cada APK en la release `android-latest` del repo (público), con
 * `versionCode=N` en las notas. Aquí se compara con la versión instalada, se
 * descarga la nueva y se le pasa al instalador de Android, que pide confirmar
 * (eso no se puede saltar: es Android protegiendo el móvil).
 */
class Actualizador(
    private val actividad: Activity,
    private val avisar: (JSONObject) -> Unit,
) {
    @Volatile private var urlApk: String? = null

    fun buscar() {
        thread(name = "actualizacion", isDaemon = true) {
            try {
                val api = "https://api.github.com/repos/${BuildConfig.REPO}/releases/tags/${BuildConfig.ETIQUETA_RELEASE}"
                val r = JSONObject(leer(api))
                val notas = r.optString("body")
                val codigo = Regex("versionCode=(\\d+)").find(notas)?.groupValues?.get(1)?.toInt() ?: 0
                val version = Regex("versionName=([^\\s]+)").find(notas)?.groupValues?.get(1) ?: r.optString("name")
                val assets = r.optJSONArray("assets")
                var apk: String? = null
                for (i in 0 until (assets?.length() ?: 0)) {
                    val a = assets!!.getJSONObject(i)
                    if (a.optString("name").endsWith(".apk")) apk = a.optString("browser_download_url")
                }
                urlApk = apk
                val disponible = apk != null && codigo > BuildConfig.VERSION_CODE
                avisar(
                    JSONObject().put("tipo", "actualizacion").put("disponible", disponible)
                        .put("version", version)
                        .put("notas", "Instalada: ${BuildConfig.VERSION_NAME}")
                )
            } catch (e: Exception) {
                avisar(
                    JSONObject().put("tipo", "actualizacion").put("disponible", false)
                        .put("error", e.message ?: "sin conexión")
                )
            }
        }
    }

    fun instalar() {
        // Android 8+: hay que permitir «Instalar apps desconocidas» a Forja una vez.
        if (!actividad.packageManager.canRequestPackageInstalls()) {
            actividad.runOnUiThread {
                actividad.startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${actividad.packageName}"))
                )
            }
            avisar(
                JSONObject().put("tipo", "descarga").put("progreso", 0)
                    .put("error", "Permite «Instalar apps desconocidas» para Forja y vuelve a pulsar Actualizar.")
            )
            return
        }
        val url = urlApk ?: run {
            avisar(JSONObject().put("tipo", "descarga").put("progreso", 0).put("error", "Busca la actualización primero."))
            return
        }
        thread(name = "descarga", isDaemon = true) {
            try {
                val dir = File(actividad.cacheDir, "actualizacion").apply { mkdirs() }
                val destino = File(dir, "forja-ia.apk")
                val c = URL(url).openConnection() as HttpURLConnection
                c.instanceFollowRedirects = true
                val total = c.contentLengthLong.coerceAtLeast(1)
                var hecho = 0L
                var ultimo = 0L
                c.inputStream.use { entrada ->
                    destino.outputStream().use { salida ->
                        val buf = ByteArray(256 * 1024)
                        while (true) {
                            val n = entrada.read(buf)
                            if (n < 0) break
                            salida.write(buf, 0, n)
                            hecho += n
                            val ahora = System.currentTimeMillis()
                            if (ahora - ultimo > 300) {
                                ultimo = ahora
                                avisar(JSONObject().put("tipo", "descarga").put("progreso", hecho.toDouble() / total))
                            }
                        }
                    }
                }
                avisar(JSONObject().put("tipo", "descarga").put("progreso", 1.0))
                val uri = FileProvider.getUriForFile(actividad, "${actividad.packageName}.archivos", destino)
                actividad.runOnUiThread {
                    actividad.startActivity(
                        Intent(Intent.ACTION_VIEW)
                            .setDataAndType(uri, "application/vnd.android.package-archive")
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    )
                }
            } catch (e: Exception) {
                avisar(JSONObject().put("tipo", "descarga").put("progreso", 0).put("error", e.message ?: "fallo de red"))
            }
        }
    }

    private fun leer(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.setRequestProperty("Accept", "application/vnd.github+json")
        c.connectTimeout = 10_000
        c.readTimeout = 15_000
        if (c.responseCode != 200) throw IllegalStateException("GitHub respondió ${c.responseCode}")
        return c.inputStream.bufferedReader().use { it.readText() }
    }
}
