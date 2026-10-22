package app.forja.opencode

import android.webkit.JavascriptInterface
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Puente WebView para Forja IA. Solo debe registrarse en un WebView que cargue
 * contenido empaquetado/confiable de Forja IA. No acepta comandos shell.
 *
 * Este puente conecta con un servidor OpenCode local ya iniciado en loopback;
 * no empaqueta por sí solo proot ni instala el runtime. El controlador nativo
 * debe iniciar/parar el runtime antes de marcarlo como disponible.
 */
class ForjaOpenCodeBridge(
    private val baseUrl: String = "http://127.0.0.1:4096",
    private val runtimeIsInstalled: () -> Boolean = { false },
    private val runtimeIsRunning: () -> Boolean = { false },
    private val runtimeVersion: () -> String? = { null },
    private val openSettings: () -> Unit = {},
    private val dispatchResult: (String, String) -> Unit = { _, _ -> }
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun getStatus(callbackId: String) = async(callbackId) {
        val installed = runtimeIsInstalled()
        val running = runtimeIsRunning() && healthCheck()
        JSONObject().apply {
            put("available", installed)
            put("running", running)
            put("version", runtimeVersion() ?: JSONObject.NULL)
            put("message", when {
                !installed -> "El runtime local de OpenCode todavía no está instalado."
                !running -> "OpenCode está detenido o no responde en el teléfono."
                else -> "OpenCode local conectado."
            })
        }
    }

    @JavascriptInterface
    fun listModels(callbackId: String) = async(callbackId) {
        val catalog = request("GET", "/provider")
        val providers = catalog.optJSONArray("all") ?: JSONArray()
        val output = JSONArray()
        for (i in 0 until providers.length()) {
            val provider = providers.optJSONObject(i) ?: continue
            val providerId = provider.optString("id", "")
            val models = provider.optJSONObject("models") ?: JSONObject()
            val keys = models.keys()
            while (keys.hasNext()) {
                val id = keys.next()
                val model = models.optJSONObject(id) ?: continue
                val cost = model.optJSONObject("cost") ?: continue
                // OpenCode reports input/output cost; absent or non-zero is never free.
                val input = cost.optDouble("input", Double.NaN)
                val outputCost = cost.optDouble("output", Double.NaN)
                val free = input == 0.0 && outputCost == 0.0
                output.put(JSONObject().apply {
                    put("id", id)
                    put("name", model.optString("name", id))
                    put("providerID", providerId)
                    put("free", free)
                    put("context", model.optJSONObject("limit")?.optInt("context") ?: JSONObject.NULL)
                })
            }
        }
        output
    }

    @JavascriptInterface
    fun runTask(jsonInput: String, callbackId: String) = async(callbackId) {
        val input = JSONObject(jsonInput)
        val prompt = input.optString("prompt", "").trim()
        val selectedModel = input.optString("model", "").trim()
        val sessionId = input.optString("sessionID", "").trim()
        require(prompt.isNotEmpty()) { "Escribe una tarea antes de enviarla." }
        require(prompt.length <= 20_000) { "La tarea supera el límite de 20 000 caracteres." }
        require(selectedModel.matches(Regex("^[a-zA-Z0-9._-]+/[a-zA-Z0-9._:-]+$"))) { "Identificador de modelo inválido." }
        require(runtimeIsRunning() && healthCheck()) { "El motor local no está iniciado." }

        // Relee catálogo en cada ejecución: no confía en la selección del frontend.
        val models = listModelsDirect()
        val model = models.firstOrNull { it.optString("providerID") + "/" + it.optString("id") == selectedModel }
        require(model != null && model.optBoolean("free", false)) {
            "Modelo no disponible o sin coste cero verificado. No se envió la tarea."
        }

        val session = if (sessionId.isBlank()) {
            request("POST", "/session", JSONObject().put("title", "Tarea desde Forja IA")).optString("id")
        } else {
            require(sessionId.matches(Regex("^[a-zA-Z0-9_-]{1,128}$"))) { "Identificador de sesión inválido." }
            sessionId
        }
        require(session.isNotBlank()) { "OpenCode no devolvió una sesión válida." }
        val parts = JSONArray().put(JSONObject().put("type", "text").put("text", "Trabaja como agente de Forja IA. No hagas acciones destructivas sin autorización.\n\nTAREA:\n$prompt"))
        val body = JSONObject()
            .put("model", JSONObject().put("providerID", model.optString("providerID")).put("modelID", model.optString("id")))
            .put("parts", parts)
        val result = request("POST", "/session/${session}/message", body)
        val responseParts = result.optJSONArray("parts") ?: JSONArray()
        val text = (0 until responseParts.length()).mapNotNull { responseParts.optJSONObject(it) }
            .filter { it.optString("type") == "text" }.joinToString("\n") { it.optString("text") }
        JSONObject().put("ok", true).put("sessionID", session).put("model", selectedModel).put("text", text)
    }

    @JavascriptInterface
    fun openRuntimeSettings() { main.post { openSettings() } }

    private fun listModelsDirect(): List<JSONObject> {
        val array = listModelsPayload()
        return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
    }

    private fun listModelsPayload(): JSONArray {
        val catalog = request("GET", "/provider")
        val providers = catalog.optJSONArray("all") ?: JSONArray()
        val output = JSONArray()
        for (i in 0 until providers.length()) {
            val p = providers.optJSONObject(i) ?: continue
            val pid = p.optString("id", "")
            val models = p.optJSONObject("models") ?: JSONObject()
            val keys = models.keys()
            while (keys.hasNext()) {
                val id = keys.next(); val m = models.optJSONObject(id) ?: continue
                val c = m.optJSONObject("cost") ?: continue
                val free = c.optDouble("input", Double.NaN) == 0.0 && c.optDouble("output", Double.NaN) == 0.0
                output.put(JSONObject().put("id", id).put("providerID", pid).put("free", free))
            }
        }
        return output
    }

    private fun healthCheck(): Boolean = try { request("GET", "/global/health").optBoolean("healthy", false) } catch (_: Exception) { false }

    private fun request(method: String, path: String, body: JSONObject? = null): JSONObject {
        require(path.startsWith("/") && !path.startsWith("//")) { "Ruta local inválida." }
        val connection = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 2500
            readTimeout = 120_000
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IllegalStateException("OpenCode HTTP $code: ${raw.take(300)}")
            return JSONObject(raw)
        } finally { connection.disconnect() }
    }

    private fun async(callbackId: String, block: () -> Any?) {
        require(callbackId.matches(Regex("^[a-zA-Z0-9_-]{1,80}$"))) { "Callback inválido." }
        executor.execute {
            val payload = try { JSONObject().put("ok", true).put("data", block()) }
            catch (e: Exception) { JSONObject().put("ok", false).put("error", (e.message ?: "Error interno").take(500)) }
            main.post { dispatchResult(callbackId, payload.toString()) }
        }
    }
}
