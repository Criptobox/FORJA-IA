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
    private val serverUsername: () -> String = { "opencode" },
    private val serverPassword: () -> String = { "" },
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
        // Copia el flujo de OpenCode-mobile: catálogo oficial público + modelos
        // presentes en el proveedor OpenCode del runtime + precio cero verificable.
        val officialIds = loadOfficialZenModelIds()
        val catalog = request("GET", "/provider")
        val providers = catalog.optJSONArray("all") ?: JSONArray()
        val output = JSONArray()
        for (i in 0 until providers.length()) {
            val provider = providers.optJSONObject(i) ?: continue
            val providerId = provider.optString("id", "")
            val providerName = provider.optString("name", providerId)
            val identity = (providerId + " " + providerName).lowercase()
            if (!(identity.contains("opencode") || providerId.equals("zen", true))) continue
            val models = provider.optJSONObject("models") ?: JSONObject()
            val keys = models.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val model = models.optJSONObject(key) ?: continue
                val id = model.optString("id", key)
                if (!officialIds.contains(id)) continue
                val cost = model.optJSONObject("cost") ?: continue
                val cache = cost.optJSONObject("cache")
                val cacheRead = if (cost.has("cache_read")) cost.opt("cache_read") else cache?.opt("read")
                val cacheWrite = if (cost.has("cache_write")) cost.opt("cache_write") else cache?.opt("write")
                val costs = listOf(cost.opt("input"), cost.opt("output"), cacheRead, cacheWrite)
                val knownZero = costs.all { value ->
                    value != null && value != JSONObject.NULL && value.toString().toDoubleOrNull() == 0.0
                }
                if (!knownZero) continue
                output.put(JSONObject().apply {
                    put("id", id)
                    put("name", model.optString("name", id))
                    put("providerID", providerId)
                    put("providerName", providerName)
                    put("free", true)
                    put("priceVerified", true)
                    put("context", model.optJSONObject("limit")?.optInt("context") ?: JSONObject.NULL)
                })
            }
        }
        output
    }

    private fun loadOfficialZenModelIds(): Set<String> {
        val connection = (URL("https://opencode.ai/zen/v1/models").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12000
            readTimeout = 12000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "Forja-IA/OpenCode-Mobile")
        }
        try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            require(code in 200..299) { "Catálogo oficial OpenCode Zen HTTP $code" }
            val json = org.json.JSONTokener(raw).nextValue()
            val rows = when (json) {
                is JSONArray -> json
                is JSONObject -> json.optJSONArray("data") ?: json.optJSONArray("models")
                    ?: throw IllegalStateException("El catálogo oficial no contiene modelos reconocibles.")
                else -> throw IllegalStateException("Formato del catálogo oficial no válido.")
            }
            val ids = mutableSetOf<String>()
            for (i in 0 until rows.length()) {
                val row = rows.opt(i)
                val id = when (row) {
                    is String -> row
                    is JSONObject -> row.optString("id", row.optString("name", ""))
                    else -> ""
                }
                if (id.isNotBlank()) ids.add(id)
            }
            require(ids.isNotEmpty()) { "El catálogo oficial no devolvió modelos." }
            return ids
        } finally { connection.disconnect() }
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
        val officialIds = loadOfficialZenModelIds()
        val catalog = request("GET", "/provider")
        val providers = catalog.optJSONArray("all") ?: JSONArray()
        val output = mutableListOf<JSONObject>()
        for (i in 0 until providers.length()) {
            val p = providers.optJSONObject(i) ?: continue
            val pid = p.optString("id", "")
            val pname = p.optString("name", pid)
            val identity = (pid + " " + pname).lowercase()
            if (!(identity.contains("opencode") || pid.equals("zen", true))) continue
            val models = p.optJSONObject("models") ?: JSONObject()
            val keys = models.keys()
            while (keys.hasNext()) {
                val key = keys.next(); val m = models.optJSONObject(key) ?: continue
                val id = m.optString("id", key)
                if (!officialIds.contains(id)) continue
                val c = m.optJSONObject("cost") ?: continue
                val cache = c.optJSONObject("cache")
                val cr = if (c.has("cache_read")) c.opt("cache_read") else cache?.opt("read")
                val cw = if (c.has("cache_write")) c.opt("cache_write") else cache?.opt("write")
                val values = listOf(c.opt("input"), c.opt("output"), cr, cw)
                val free = values.all { v -> v != null && v != JSONObject.NULL && v.toString().toDoubleOrNull() == 0.0 }
                if (free) output.add(JSONObject().put("id", id).put("providerID", pid).put("free", true))
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
            val password = serverPassword()
            if (password.isNotBlank()) {
                val token = android.util.Base64.encodeToString("${serverUsername()}:$password".toByteArray(Charsets.UTF_8), android.util.Base64.NO_WRAP)
                setRequestProperty("Authorization", "Basic $token")
            }
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
