package app.forja.opencodemobile

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import app.forja.opencode.ForjaOpenCodeBridge
import app.forja.opencodemobile.RuntimeSupervisor
import app.forja.opencode.ForjaOpenCodeWebViewHost

/** Host Android inicial. Carga UI local confiable y no habilita puente en páginas remotas. */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var supervisor: RuntimeSupervisor
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supervisor = RuntimeSupervisor(this)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(15, 17, 24)) }
        statusText = TextView(this).apply { text = "Forja IA · Motor local pendiente de instalar"; setTextColor(Color.WHITE); setPadding(20, 14, 20, 14) }
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    if (url.startsWith("file:///android_asset/forja/")) installBridge()
                }
                override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = !url.startsWith("file:///android_asset/forja/")
            }
        }
        root.addView(statusText)
        root.addView(webView, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        webView.loadUrl("file:///android_asset/forja/index.html")
    }

    private fun installBridge() {
        val bridge = ForjaOpenCodeBridge(
            runtimeIsInstalled = { supervisor.isInstalled() },
            runtimeIsRunning = { supervisor.isRunning() },
            runtimeVersion = { supervisor.version() },
            openSettings = { statusText.text = supervisor.statusMessage() },
            dispatchResult = { id, payload -> if (::host.isInitialized) host.deliverResult(id, payload) }
        )
        host = ForjaOpenCodeWebViewHost(webView, bridge)
        host.install()
    }

    private lateinit var host: ForjaOpenCodeWebViewHost
    override fun onDestroy() { if (::webView.isInitialized) webView.destroy(); super.onDestroy() }
}
