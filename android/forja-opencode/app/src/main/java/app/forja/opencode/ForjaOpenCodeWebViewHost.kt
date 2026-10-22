package app.forja.opencode

import android.annotation.SuppressLint
import android.webkit.WebView
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Instala el puente callback-based que espera el contrato TypeScript.
 * Registrar únicamente después de cargar la UI empaquetada y confiable de Forja.
 * No permite invocar JavaScript arbitrario desde una cadena recibida de la web.
 */
class ForjaOpenCodeWebViewHost(
    private val webView: WebView,
    private val bridge: ForjaOpenCodeBridge
) {
    private val nextId = AtomicLong(1)
    private val callbacks = ConcurrentHashMap<String, String>()

    @SuppressLint("SetJavaScriptEnabled")
    fun install() {
        webView.settings.javaScriptEnabled = true
        webView.addJavascriptInterface(BridgeApi(), "ForjaOpenCodeNativeAndroid")
        webView.evaluateJavascript(BOOTSTRAP, null)
    }

    fun deliverResult(callbackId: String, payload: String) {
        // Callback IDs son generados localmente y solo se interpolan IDs validados.
        if (!callbackId.matches(Regex("^[a-zA-Z0-9_-]{1,80}$"))) return
        val escaped = JSONObject.quote(payload)
        webView.post {
            webView.evaluateJavascript(
                "window.__forjaOpenCodeResolve && window.__forjaOpenCodeResolve('$callbackId', $escaped)",
                null
            )
        }
    }

    private inner class BridgeApi {
        @android.webkit.JavascriptInterface
        fun getStatus(): String = submit { id -> bridge.getStatus(id) }

        @android.webkit.JavascriptInterface
        fun listModels(): String = submit { id -> bridge.listModels(id) }

        @android.webkit.JavascriptInterface
        fun runTask(input: String): String = submit { id -> bridge.runTask(input, id) }

        @android.webkit.JavascriptInterface
        fun openRuntimeSettings() = bridge.openRuntimeSettings()

        private fun submit(call: (String) -> Unit): String {
            val id = "fc${nextId.getAndIncrement()}"
            callbacks[id] = id
            call(id)
            return id
        }
    }

    companion object {
        private val BOOTSTRAP = """
            (function () {
              const pending = new Map();
              window.__forjaOpenCodeResolve = function(id, payload) {
                const resolve = pending.get(id);
                if (!resolve) return;
                pending.delete(id);
                try {
                  const envelope = JSON.parse(payload);
                  if (!envelope.ok) resolve({ok:false,error:envelope.error || 'Error del motor local'});
                  else resolve({ok:true,data:envelope.data});
                } catch (_) { resolve({ok:false,error:'Respuesta inválida del motor local'}); }
              };
              function call(method, input) {
                return new Promise((resolve) => {
                  try {
                    const id = window.ForjaOpenCodeNativeAndroid[method](...(input === undefined ? [] : [input]));
                    pending.set(id, (envelope) => {
                      if (!envelope.ok) return resolve({ok:false,error:envelope.error});
                      resolve(envelope);
                    });
                  } catch (e) { resolve({ok:false,error:String(e && e.message || e)}); }
                });
              }
              window.ForjaOpenCodeNative = {
                getStatus: () => call('getStatus').then(x => x && x.ok === false ? {available:false,running:false,message:x.error} : x.data),
                listModels: () => call('listModels').then(x => x && x.ok === false ? {error:x.error || 'No se pudo leer el catálogo'} : (x.data || [])),
                runTask: (input) => call('runTask', JSON.stringify(input)).then(x => x && x.ok === false ? x : x.data),
                openRuntimeSettings: () => window.ForjaOpenCodeNativeAndroid.openRuntimeSettings()
              };
            })();
        """.trimIndent()
    }
}
