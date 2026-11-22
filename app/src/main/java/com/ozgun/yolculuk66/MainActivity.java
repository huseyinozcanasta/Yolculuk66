package com.ozgun.yolculuk66;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends Activity {
  private static final int OPEN_BACKUP=401, SAVE_BACKUP=402, IMPORT_MODEL=403, MAX_BACKUP=4*1024*1024;
  private static final String GGUF_DOWNLOAD_URL="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";
  private static final String GGUF_STRONG_DOWNLOAD_URL="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf";
  private static final String RELEASE_API="https://api.github.com/repos/huseyinozcanasta/Yolculuk66/releases?per_page=5";
  private static final String RELEASE_PREFIX="https://github.com/huseyinozcanasta/yolculuk66/releases/";
  private WebView webView;
  private OfflineAiHost aiHost;
  private boolean modelReplaceAllowed=false;
  private String pendingBackup;
  @SuppressLint("SetJavaScriptEnabled")
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WebView.setWebContentsDebuggingEnabled(false);
    webView=new WebView(this);
    WebSettings cfg=webView.getSettings();
    cfg.setJavaScriptEnabled(true);
    cfg.setDomStorageEnabled(true);
    cfg.setAllowFileAccess(true);
    cfg.setAllowContentAccess(false);
    cfg.setAllowFileAccessFromFileURLs(false);
    cfg.setAllowUniversalAccessFromFileURLs(false);
    cfg.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    webView.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri=request.getUrl();
        return !("file".equals(uri.getScheme()) && "/android_asset/index.html".equals(uri.getPath()));
      }
    });
    webView.addJavascriptInterface(new FilesBridge(),"AndroidFiles");
    webView.addJavascriptInterface(new UpdatesBridge(),"AndroidUpdates");
    aiHost=new OfflineAiHost(this, (kind,payload) ->
      callback("window.onLocalAIEvent("+JSONObject.quote(kind)+","+JSONObject.quote(payload)+");"));
    webView.addJavascriptInterface(new AIModelBridge(),"AndroidAI");
    setContentView(webView);
    webView.loadUrl("file:///android_asset/index.html");
  }
  private void callback(String javascript) {
    runOnUiThread(()->{if(webView!=null)webView.evaluateJavascript(javascript,null);});
  }
  private void message(String text) {
    callback("window.showNativeMessage("+JSONObject.quote(text)+");");
  }
  public final class AIModelBridge {
    @JavascriptInterface public void openModelDownload() {
      // Explicit tap only. No user save data is sent, and the URL is fixed at build time.
      runOnUiThread(()->{
        Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(GGUF_DOWNLOAD_URL));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {startActivity(intent);}
        catch(ActivityNotFoundException ex){message("Model indirme bağlantısını açacak tarayıcı bulunamadı.");}
      });
    }
    @JavascriptInterface public void openStrongerModelDownload() {
      runOnUiThread(()->{
        Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(GGUF_STRONG_DOWNLOAD_URL));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try{startActivity(intent);}
        catch(ActivityNotFoundException ex){message("Model indirme bağlantısını açacak tarayıcı bulunamadı.");}
      });
    }
    @JavascriptInterface public String status() {
      return aiHost!=null?aiHost.status():"unavailable";
    }
    @JavascriptInterface public void chooseModel(boolean allowReplace) {
      runOnUiThread(()->{
        modelReplaceAllowed=allowReplace;
        Intent choose=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        choose.setType("*/*");
        choose.addCategory(Intent.CATEGORY_OPENABLE);
        try {startActivityForResult(choose,IMPORT_MODEL);}
        catch(ActivityNotFoundException ex){message("Model dosya seçicisi bulunamadı.");}
      });
    }
    @JavascriptInterface public void loadModel() {
      if(aiHost!=null)aiHost.loadModel();
    }
    @JavascriptInterface public void generate(String question,String localContext) {
      if(question==null||question.length()>1000||localContext==null||localContext.length()>4500){
        message("Yerel AI isteği çok uzun.");return;
      }
      if(aiHost!=null)aiHost.generate(question,localContext);
    }
  }

  public final class FilesBridge {
    @JavascriptInterface public void openEncryptedBackup() {
      runOnUiThread(()->{
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("*/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        try {startActivityForResult(intent,OPEN_BACKUP);}
        catch(ActivityNotFoundException ex){message("Dosya seçici bulunamadı.");}
      });
    }
    @JavascriptInterface public void saveEncryptedBackup(String json) {
      if(json==null||json.getBytes(StandardCharsets.UTF_8).length>MAX_BACKUP){
        message("Yedek çok büyük.");return;
      }
      runOnUiThread(()->{
        pendingBackup=json;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.setType("application/octet-stream");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_TITLE,"Yolculuk66-"+System.currentTimeMillis()+".y66backup");
        try{startActivityForResult(intent,SAVE_BACKUP);}
        catch(ActivityNotFoundException ex){pendingBackup=null;message("Dosya kaydedici bulunamadı.");}
      });
    }
  }
  public final class UpdatesBridge {
    @JavascriptInterface public void requestLatest(){
      new Thread(()->{
        HttpURLConnection conn=null;
        try{
          conn=(HttpURLConnection)new URL(RELEASE_API).openConnection();
          conn.setConnectTimeout(8000);
          conn.setReadTimeout(8000);
          conn.setInstanceFollowRedirects(false);
          conn.setRequestProperty("Accept","application/vnd.github+json");
          conn.setRequestProperty("User-Agent","Yolculuk66-Android");
          if(conn.getResponseCode()!=200)throw new IllegalStateException("No published release.");
          try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
  byte[] b=new byte[8192];int n;
            while((n=in.read(b))!=-1){
              if(out.size()+n>262144)throw new IllegalStateException("Oversized release.");
              out.write(b,0,n);
            }
            String data=new String(out.toByteArray(),StandardCharsets.UTF_8);
            callback("window.onNativeReleaseData("+JSONObject.quote(data)+");");
          }
        }catch(Exception ex){
          callback("window.onNativeReleaseFailure("+JSONObject.quote("Güncelleme sunucusuna ulaşılamadı.")+");");
        }finally{if(conn!=null)conn.disconnect();}
      },"y66-update").start();
    }
    @JavascriptInterface public void openUrl(String url) {
      if(url==null||!url.toLowerCase(Locale.ROOT).startsWith(RELEASE_PREFIX)){
        message("Güvenilmeyen bağlantı reddedildi.");return;
      }
      runOnUiThread(()->{
        try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}
        catch(ActivityNotFoundException ex){message("Tarayıcı bulunamadı.");}
      });
    }
  }
  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
    super.onActivityResult(requestCode,resultCode,data);
    if(requestCode==IMPORT_MODEL) {
      if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null&&aiHost!=null)
        aiHost.importModel(data.getData(),modelReplaceAllowed);
      return;
    }
    if(requestCode==SAVE_BACKUP){
      String saved=pendingBackup;pendingBackup=null;
      if(resultCode!=RESULT_OK||data==null||saved==null)return;
      try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
        if(out==null)throw new IllegalStateException();
        out.write(saved.getBytes(StandardCharsets.UTF_8));
        message("Şifreli yedek kaydedildi.");
      }catch(Exception ex){message("Yedek kaydedilemedi.");}
    }
    if(requestCode==OPEN_BACKUP&&resultCode==RESULT_OK&&data!=null){
      try(InputStream in=getContentResolver().openInputStream(data.getData());
          ByteArrayOutputStream out=new ByteArrayOutputStream()){
        if(in==null)throw new IllegalStateException();
        byte[] b=new byte[8192];int n;
        while((n=in.read(b))!=-1){
          if(out.size()+n>MAX_BACKUP)throw new IllegalStateException();
          out.write(b,0,n);
        }
        callback("window.receiveEncryptedBackup("+JSONObject.quote(new String(out.toByteArray(),StandardCharsets.UTF_8))+");");
      }catch(Exception ex){message("Yedek okunamadı veya çok büyük.");}
    }
  }
  @Override public void onBackPressed(){
    if(webView!=null&&webView.canGoBack())webView.goBack();
    else super.onBackPressed();
  }
  @Override protected void onDestroy(){
    if(aiHost!=null){aiHost.shutdown();aiHost=null;}
    if(webView!=null){webView.removeJavascriptInterface("AndroidAI");
      webView.removeJavascriptInterface("AndroidFiles");
      webView.removeJavascriptInterface("AndroidUpdates");webView.destroy();webView=null;}
    super.onDestroy();
  }
}
