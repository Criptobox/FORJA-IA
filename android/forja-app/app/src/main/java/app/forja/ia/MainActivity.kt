package app.forja.ia

import android.annotation.SuppressLint
import android.app.Activity
import android.app.ActivityManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.provider.OpenableColumns
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.concurrent.thread

/**
 * Forja IA para Android: la interfaz de siempre (exportada en estático, dentro
 * de la APK) más un motor llama.cpp nativo y la actualización desde la app.
 *
 * El puente con la interfaz NO es un @JavascriptInterface: ese llega a todos
 * los marcos, y la vista previa enseña en iframes código que ha escrito un
 * modelo. Se usa un canal de mensajes (`ForjaNativo`) y un script de arranque
 * que solo existen para el origen propio y el marco principal; el script
 * monta encima `window.ForjaAndroid`, que es lo que usa la interfaz.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var motor: MotorNativo
    private lateinit var actualizador: Actualizador
    private val principal = Handler(Looper.getMainLooper())
    private var canal: JavaScriptReplyProxy? = null
    private var alElegirArchivos: ValueCallback<Array<Uri>>? = null
    private val dirModelos by lazy { File(filesDir, "modelos").apply { mkdirs() } }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(estado: Bundle?) {
        super.onCreate(estado)
        motor = MotorNativo(this) { e -> enviar(JSONObject().put("tipo", "motor").put("estado", e)) }
        actualizador = Actualizador(this) { e -> enviar(e) }

        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            // La interfaz (https) habla con llama-server en http://127.0.0.1.
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        val cargador = WebViewAssetLoader.Builder()
            .setDomain(DOMINIO)
            .addPathHandler("/", AssetsWeb(this))
            .build()

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse? =
                cargador.shouldInterceptRequest(r.url)

            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                if (r.url.host == DOMINIO) return false
                // Enlaces de fuera (documentación, GitHub…): al navegador.
                startActivity(Intent(Intent.ACTION_VIEW, r.url))
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                v: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                alElegirArchivos?.onReceiveValue(null)
                alElegirArchivos = callback
                return try {
                    startActivityForResult(params.createIntent(), PEDIR_ARCHIVOS)
                    true
                } catch (_: Exception) {
                    alElegirArchivos = null
                    false
                }
            }
        }

        instalarPuente()
        web.loadUrl("https://$DOMINIO/")
    }

    private fun instalarPuente() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) return // WebView muy antiguo: la interfaz funciona, sin motor nativo
        val origenes = setOf(MotorNativo.ORIGEN)
        WebViewCompat.addWebMessageListener(web, "ForjaNativo", origenes) { _, mensaje, _, esPrincipal, respuesta ->
            if (!esPrincipal) return@addWebMessageListener
            canal = respuesta
            val m = try {
                JSONObject(mensaje.data ?: return@addWebMessageListener)
            } catch (_: Exception) {
                return@addWebMessageListener
            }
            atender(m.optString("op"), m.optJSONArray("args") ?: JSONArray())
        }
        WebViewCompat.addDocumentStartJavaScript(web, PUENTE_JS, origenes)
    }

    private fun atender(op: String, args: JSONArray) {
        when (op) {
            "hola" -> enviarEstado()
            "elegirModelo" -> startActivityForResult(
                Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"),
                PEDIR_MODELO,
            )
            "borrarModelo" -> {
                val nombre = File(args.optString(0)).name
                File(dirModelos, nombre).delete()
                enviarEstado()
            }
            "iniciar" -> {
                val nombre = File(args.optString(0)).name
                val archivo = File(dirModelos, nombre)
                val ctx = args.optInt(1, 16384)
                val hilos = args.optInt(2, 4)
                if (!archivo.exists()) {
                    enviar(JSONObject().put("tipo", "error").put("mensaje", "El modelo «$nombre» ya no está en la app."))
                } else {
                    thread(isDaemon = true) { motor.iniciar(archivo, nombre, ctx, hilos) }
                }
            }
            "detener" -> thread(isDaemon = true) { motor.detener() }
            "buscarActualizacion" -> actualizador.buscar()
            "instalarActualizacion" -> actualizador.instalar()
        }
    }

    @Deprecated("API de actividades clásica: no hace falta androidx.activity solo para esto")
    override fun onActivityResult(peticion: Int, resultado: Int, datos: Intent?) {
        super.onActivityResult(peticion, resultado, datos)
        when (peticion) {
            PEDIR_ARCHIVOS -> {
                alElegirArchivos?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultado, datos))
                alElegirArchivos = null
            }
            PEDIR_MODELO -> {
                val uri = datos?.data ?: return
                if (resultado == RESULT_OK) importarModelo(uri)
            }
        }
    }

    /** Copia el .gguf elegido dentro de la app, avisando del progreso. */
    private fun importarModelo(uri: Uri) {
        thread(name = "importar", isDaemon = true) {
            try {
                var nombre = "modelo.gguf"
                var total = -1L
                contentResolver.query(uri, null, null, null, null)?.use { c ->
                    if (c.moveToFirst()) {
                        val n = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        val t = c.getColumnIndex(OpenableColumns.SIZE)
                        if (n >= 0) nombre = File(c.getString(n)).name
                        if (t >= 0) total = c.getLong(t)
                    }
                }
                if (!nombre.endsWith(".gguf", ignoreCase = true)) {
                    enviar(JSONObject().put("tipo", "error").put("mensaje", "«$nombre» no es un archivo .gguf."))
                    return@thread
                }
                val libre = StatFs(filesDir.absolutePath).availableBytes
                if (total > 0 && total > libre - 200L * 1024 * 1024) {
                    enviar(JSONObject().put("tipo", "error").put("mensaje", "No hay espacio para «$nombre» en el móvil."))
                    return@thread
                }
                val destino = File(dirModelos, nombre)
                val temporal = File(dirModelos, "$nombre.parcial")
                var hecho = 0L
                var ultimo = 0L
                contentResolver.openInputStream(uri)!!.use { entrada ->
                    temporal.outputStream().use { salida ->
                        val buf = ByteArray(1024 * 1024)
                        while (true) {
                            val n = entrada.read(buf)
                            if (n < 0) break
                            salida.write(buf, 0, n)
                            hecho += n
                            val ahora = System.currentTimeMillis()
                            if (ahora - ultimo > 300) {
                                ultimo = ahora
                                val p = if (total > 0) hecho.toDouble() / total else 0.0
                                enviar(JSONObject().put("tipo", "importando").put("nombre", nombre).put("progreso", p))
                            }
                        }
                    }
                }
                temporal.renameTo(destino)
                enviarEstado()
                enviar(JSONObject().put("tipo", "importado").put("nombre", nombre))
            } catch (e: Exception) {
                enviar(JSONObject().put("tipo", "error").put("mensaje", "No se pudo importar el modelo: ${e.message}"))
            }
        }
    }

    private fun enviarEstado() {
        val am = getSystemService(ACTIVITY_SERVICE) as ActivityManager
        val mem = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val modelos = JSONArray()
        dirModelos.listFiles { f -> f.name.endsWith(".gguf", ignoreCase = true) }
            ?.sortedBy { it.name }
            ?.forEach { modelos.put(JSONObject().put("nombre", it.name).put("bytes", it.length())) }
        val version = packageManager.getPackageInfo(packageName, 0)
        enviar(
            JSONObject()
                .put("tipo", "_estado")
                .put(
                    "info",
                    JSONObject()
                        .put("version", version.versionName)
                        .put("versionCode", BuildConfig.VERSION_CODE)
                        .put("ramTotalMB", mem.totalMem / (1024 * 1024))
                        .put("ramDisponibleMB", mem.availMem / (1024 * 1024))
                        .put("nucleos", Runtime.getRuntime().availableProcessors())
                )
                .put("modelos", modelos)
                .put("motor", motor.estadoJson())
        )
    }

    /** Al canal de la interfaz, siempre desde el hilo principal. */
    private fun enviar(m: JSONObject) {
        principal.post { canal?.postMessage(m.toString()) }
    }

    @Deprecated("Atrás clásico: suficiente para un único WebView")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        motor.detener()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val DOMINIO = "appassets.androidplatform.net"
        private const val PEDIR_ARCHIVOS = 1
        private const val PEDIR_MODELO = 2

        /** Monta `window.ForjaAndroid` (lo que usa la interfaz) sobre el canal. */
        private val PUENTE_JS = """
            (function () {
              var canal = window.ForjaNativo;
              if (!canal || window.ForjaAndroid) return;
              var est = { info: null, modelos: [], motor: null };
              var resolver;
              var listo = new Promise(function (r) { resolver = r; });
              function avisar(d) { window.dispatchEvent(new CustomEvent("forja-android", { detail: d })); }
              canal.onmessage = function (e) {
                var d;
                try { d = JSON.parse(e.data); } catch (_) { return; }
                if (!d || typeof d !== "object" || typeof d.tipo !== "string") return;
                if (d.tipo === "_estado") {
                  est = d;
                  if (resolver) { resolver(); resolver = null; }
                  avisar({ tipo: "estado" });
                  return;
                }
                if (d.tipo === "motor") est.motor = d.estado;
                avisar(d);
              };
              function enviar(op) {
                canal.postMessage(JSON.stringify({ op: op, args: Array.prototype.slice.call(arguments, 1) }));
              }
              window.ForjaAndroid = {
                listo: listo,
                info: function () { return JSON.stringify(est.info); },
                modelos: function () { return JSON.stringify(est.modelos || []); },
                estadoMotor: function () { return JSON.stringify(est.motor); },
                elegirModelo: function () { enviar("elegirModelo"); },
                borrarModelo: function (n) { enviar("borrarModelo", n); },
                iniciar: function (n, c, h) { enviar("iniciar", n, c, h); },
                detener: function () { enviar("detener"); },
                buscarActualizacion: function () { enviar("buscarActualizacion"); },
                instalarActualizacion: function () { enviar("instalarActualizacion"); }
              };
              enviar("hola");
            })();
        """.trimIndent()
    }
}
