package app.forja.ia

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager

class RuntimeService : Service() {
    companion object {
        const val ACTION_STOP_SERVER = "app.forja.ia.STOP_SERVER"
        @Volatile var proc: Process? = null
        /** true si el servidor se cerró varias veces seguidas nada más arrancar. */
        @Volatile var gaveUp = false
        fun stopForUpdate(ctx: Context) {
            val i = Intent(ctx, RuntimeService::class.java).setAction(ACTION_STOP_SERVER)
            ctx.startService(i)
            val until = System.currentTimeMillis() + 8000
            while (System.currentTimeMillis() < until) {
                val p = proc
                if (p == null || !p.isAlive) break
                try { Thread.sleep(150) } catch (_: InterruptedException) { break }
            }
        }
    }
    private var lock: PowerManager.WakeLock? = null
    private var watcher: Thread? = null
    @Volatile private var stopping = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SERVER) {
            stopping = true
            watcher?.interrupt(); watcher = null
            proc?.destroy(); proc = null
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        val rt = OcRuntime(this)
        val ready = rt.isInstalled()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("rt", "Motor OpenCode", NotificationManager.IMPORTANCE_LOW))
        val pi = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val stopIntent = Intent(this, RuntimeService::class.java).setAction(ACTION_STOP_SERVER)
        val stopPi = PendingIntent.getService(this, 21, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(this, "rt")
            .setContentTitle("Motor OpenCode activo")
            .setContentText(if (ready) "Servidor local en 127.0.0.1:${rt.port}" else "Instalando el motor…")
            .setSmallIcon(R.drawable.ic_stat)
            .setContentIntent(pi)
            .addAction(Notification.Action.Builder(null, "Detener servidor", stopPi).build())
            .setOngoing(true)
            .build()
        startForeground(1, n)
        if (lock == null) {
            lock = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "forja:opencode").apply { acquire() }
        }
        if (ready) supervise(rt)
        return START_STICKY
    }

    /** Vigila el proceso: si OpenCode se cae (p. ej. falta de memoria), lo relanza con espera creciente. */
    private fun supervise(rt: OcRuntime) {
        if (watcher?.isAlive == true) return
        stopping = false
        watcher = Thread {
            var fails = 0
            while (!stopping) {
                val t0 = System.currentTimeMillis()
                val p = try { rt.startServer() } catch (e: Exception) { null }
                proc = p
                try { p?.waitFor() } catch (e: InterruptedException) { break }
                if (stopping) break
                fails = if (System.currentTimeMillis() - t0 > 60_000) 0 else fails + 1
                if (fails >= 5) { gaveUp = true; break }
                try { Thread.sleep(minOf(2000L * fails.coerceAtLeast(1), 10_000L)) } catch (e: InterruptedException) { break }
            }
        }.apply { isDaemon = true; start() }
    }

    override fun onDestroy() {
        stopping = true
        watcher?.interrupt(); watcher = null
        proc?.destroy(); proc = null
        lock?.release(); lock = null
        super.onDestroy()
    }
}
