package app.forja.ia

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.IOException

/**
 * Sirve la interfaz de Forja (exportación estática de Next, copiada por la CI
 * en `assets/web/`) bajo https://appassets.androidplatform.net/.
 *
 * Un origen https propio, y no file://, para que todo funcione como en un
 * navegador: almacenamiento, OPFS, service worker, rutas «/forja/».
 */
class AssetsWeb(private val contexto: Context) : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebResourceResponse? {
        var ruta = path.trimStart('/')
        // Next exporta con trailingSlash: «/forja/» es «forja/index.html».
        if (ruta.isEmpty() || ruta.endsWith("/")) ruta += "index.html"
        abrir("web/$ruta")?.let { return it }
        // «/forja» sin barra final
        if (!ruta.substringAfterLast('/').contains('.')) abrir("web/$ruta/index.html")?.let { return it }
        return try {
            WebResourceResponse(
                "text/html", "utf-8", 404, "Not Found", emptyMap(),
                contexto.assets.open("web/404.html"),
            )
        } catch (_: IOException) {
            null
        }
    }

    private fun abrir(ruta: String): WebResourceResponse? = try {
        val flujo = contexto.assets.open(ruta)
        val tipo = tipoDe(ruta)
        val texto = tipo.startsWith("text/") || tipo.endsWith("javascript") || tipo.endsWith("json")
        WebResourceResponse(tipo, if (texto) "utf-8" else null, flujo).apply {
            // La interfaz cambia con cada APK: sin caché del WebView de por medio.
            responseHeaders = mapOf("Cache-Control" to "no-cache")
        }
    } catch (_: IOException) {
        null
    }

    private fun tipoDe(ruta: String): String = when (ruta.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "js", "mjs" -> "application/javascript"
        "css" -> "text/css"
        "json", "webmanifest" -> "application/json"
        "wasm" -> "application/wasm"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "ico" -> "image/x-icon"
        "woff2" -> "font/woff2"
        "woff" -> "font/woff"
        "txt" -> "text/plain"
        "zip" -> "application/zip"
        "mp4" -> "video/mp4"
        else -> "application/octet-stream"
    }
}
