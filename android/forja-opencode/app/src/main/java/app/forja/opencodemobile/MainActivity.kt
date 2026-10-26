package app.forja.opencodemobile
import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.forja.opencode.ForjaOpenCodeBridge
import app.forja.opencode.ForjaOpenCodeWebViewHost
import java.util.concurrent.atomic.AtomicBoolean
class MainActivity : Activity() {
 private lateinit var webView:WebView; private lateinit var supervisor:RuntimeSupervisor; private lateinit var statusText:TextView; private lateinit var logText:TextView; private lateinit var installButton:Button; private lateinit var openButton:Button; private lateinit var host:ForjaOpenCodeWebViewHost; private var bridgeInstalled=false; private var pageRequested=false
 private val busy=AtomicBoolean(false)
 override fun onCreate(savedInstanceState:Bundle?) { super.onCreate(savedInstanceState); supervisor=RuntimeSupervisor(this)
  val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(15,17,24)) }
  statusText=TextView(this).apply { textSize=14f; setTextColor(Color.WHITE); setPadding(18,14,18,10) }
  installButton=Button(this).apply { text="Instalar / reparar motor OpenCode"; setOnClickListener { installRuntime() } }
  openButton=Button(this).apply { text="Abrir Forja IA"; isEnabled=false; setOnClickListener {
   if (supervisor.isInstalled()) supervisor.startServer()
   webView.visibility = View.VISIBLE
   statusText.text = supervisor.statusMessage()
   if (!pageRequested) {
     pageRequested = true
     webView.loadUrl("file:///android_asset/forja/index.html")
   }
  } }
  logText=TextView(this).apply { textSize=11f; setTextColor(Color.LTGRAY); setPadding(18,8,18,8) }
  root.addView(statusText); root.addView(installButton); root.addView(openButton); root.addView(ScrollView(this).apply { addView(logText) },LinearLayout.LayoutParams(-1,0,1f))
  webView=WebView(this).apply { visibility=View.GONE; settings.javaScriptEnabled=true; settings.domStorageEnabled=true; settings.allowFileAccess=false; settings.allowContentAccess=false; webViewClient=object:WebViewClient(){ override fun onPageFinished(view:WebView,url:String){
    if (url == "file:///android_asset/forja/index.html" && !bridgeInstalled) {
      bridgeInstalled = true
      installBridge()
    }
   }; override fun shouldOverrideUrlLoading(view:WebView,url:String)=!url.startsWith("file:///android_asset/forja/") } }
  root.addView(webView,LinearLayout.LayoutParams(-1,0,2f)); setContentView(root); refreshStatus(); if(supervisor.isInstalled()) supervisor.startServer()
 }
 private fun installRuntime(){ if(!busy.compareAndSet(false,true))return; installButton.isEnabled=false; statusText.text="Preparando runtime OpenCode…"; Thread { try { supervisor.install({p,m->runOnUiThread{statusText.text="$m (${p/10}%)"}},{line->runOnUiThread{logText.text=(logText.text.toString()+"\n"+line).takeLast(12000)}}); supervisor.startServer(); runOnUiThread{statusText.text="Runtime instalado. Iniciando servidor…";openButton.isEnabled=true} } catch(e:Exception){runOnUiThread{statusText.text="Error instalando OpenCode: ${e.message?:"error desconocido"}";logText.text=supervisor.logs()}} finally{busy.set(false);runOnUiThread{installButton.isEnabled=true;refreshStatus()}} }.start() }
 private fun refreshStatus(){statusText.text=supervisor.statusMessage();openButton.isEnabled=supervisor.isInstalled()}
 private fun installBridge(){ val bridge=ForjaOpenCodeBridge(runtimeIsInstalled={supervisor.isInstalled()},runtimeIsRunning={supervisor.isRunning()},runtimeVersion={supervisor.version()},serverUsername={supervisor.serverUsername()},serverPassword={supervisor.serverPassword()},openSettings={runOnUiThread{statusText.text=supervisor.statusMessage()}},dispatchResult={id,payload->if(::host.isInitialized)host.deliverResult(id,payload)}); host=ForjaOpenCodeWebViewHost(webView,bridge);host.install() }
 override fun onDestroy(){if(::webView.isInitialized)webView.destroy();super.onDestroy()}
}