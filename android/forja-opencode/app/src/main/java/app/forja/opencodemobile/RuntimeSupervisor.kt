package app.forja.opencodemobile
import android.content.Context
import android.content.Intent
class RuntimeSupervisor(private val context: Context) {
 private val runtime = OcRuntime(context.applicationContext)
 fun isInstalled() = runtime.isInstalled()
 fun isRunning() = runtime.serverReady()
 fun version(): String? = runtime.installedVersion().ifBlank { null }
 fun statusMessage() = when { !isInstalled() -> "OpenCode aún no está instalado. Pulsa Instalar motor."; !isRunning() -> "Motor instalado; servidor detenido o iniciando."; else -> "OpenCode conectado en 127.0.0.1:${runtime.port} · ${version() ?: "versión detectada"}" }
 fun install(progress:(Int,String)->Unit, log:(String)->Unit) = runtime.install(progress,log)
 fun startServer() { context.startService(Intent(context, RuntimeService::class.java)) }
 fun stopServer() { context.startService(Intent(context, RuntimeService::class.java).setAction(RuntimeService.ACTION_STOP_SERVER)) }
 fun logs(lines:Int=80) = runtime.tailLog(lines)
 fun serverUsername() = OcRuntime.SERVER_USER
 fun serverPassword() = runtime.serverPassword()
}