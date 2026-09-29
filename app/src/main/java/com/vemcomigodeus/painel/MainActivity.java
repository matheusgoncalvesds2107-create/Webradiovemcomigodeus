package com.vemcomigodeus.painel;

import android.os.*;
import android.content.*;
import android.view.View;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {
  private static final String BASE="https://webradiovemcomigodeus.onrender.com";
  private EditText token,casterPass; private TextView program,hostName,radioStatus,log;
  private final Handler h=new Handler(Looper.getMainLooper());

  @Override public void onCreate(Bundle b){
    super.onCreate(b); setContentView(R.layout.activity_main);
    token=findViewById(R.id.token); casterPass=findViewById(R.id.casterPass); program=findViewById(R.id.program);
    hostName=findViewById(R.id.hostName); radioStatus=findViewById(R.id.radioStatus); log=findViewById(R.id.log);
    load();
    findViewById(R.id.save).setOnClickListener(v->save());
    findViewById(R.id.prepare).setOnClickListener(v->prepare());
    findViewById(R.id.start).setOnClickListener(v->start());
    findViewById(R.id.stop).setOnClickListener(v->stop());
    h.post(statusLoop);
  }
  private void load(){ android.content.SharedPreferences p=getSharedPreferences("x",MODE_PRIVATE);token.setText(p.getString("t",""));casterPass.setText(p.getString("c","")); }
  private void save(){getSharedPreferences("x",MODE_PRIVATE).edit().putString("t",token.getText().toString()).putString("c",casterPass.getText().toString()).apply();toast("Salvo só neste celular.");}
  private void prepare(){ new Thread(()->{try{JSONObject x=req("/api/prepare-day","POST",null,false);ui("Programação: "+x.optString("date"));}catch(Exception e){ui(e.getMessage());}}).start(); }
  private void start(){
    save();
    new Thread(()->{
      try{
        JSONObject cfg=new JSONObject();cfg.put("host","sapircast.caster.fm");cfg.put("port","11743");cfg.put("mount","/I3Pqo");cfg.put("user","source");cfg.put("password",casterPass.getText().toString());cfg.put("name","Web Rádio Vem Comigo Deus");cfg.put("bitrate","96k");
        req("/api/signal/config","POST",cfg,true);
        JSONObject x=req("/api/signal/start","POST",new JSONObject(),true);
        ui(x.optBoolean("running")?"TRANSMISSÃO INICIADA":"Comando enviado.");
      }catch(Exception e){ui(e.getMessage());}
    }).start();
  }
  private void stop(){ new Thread(()->{try{req("/api/signal/stop","POST",new JSONObject(),true);ui("TRANSMISSÃO PARADA");}catch(Exception e){ui(e.getMessage());}}).start(); }
  private final Runnable statusLoop=new Runnable(){public void run(){new Thread(()->{
    try{
      JSONObject s=req("/api/status","GET",null,false);
      JSONObject c=s.optJSONObject("current");
      runOnUiThread(()->{
        if(c!=null){program.setText(c.optString("nome","Programa"));hostName.setText("Programa automático da Web Rádio");}
        else{program.setText("Louvores que Edificam");hostName.setText("Web Rádio Vem Comigo Deus");}
      });
      JSONObject q=req("/api/signal/status","GET",null,false);
      runOnUiThread(()->radioStatus.setText(q.optBoolean("running")?"● TRANSMITINDO AO VIVO":"TRANSMISSOR PARADO"));
    }catch(Exception ignored){}
  }).start();h.postDelayed(this,10000);}};
  private JSONObject req(String path,String method,JSONObject body,boolean admin)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(BASE+path).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(120000);c.setRequestMethod(method);c.setRequestProperty("Accept","application/json");
    if(admin)c.setRequestProperty("x-admin-token",token.getText().toString().trim());
    if(body!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(OutputStream o=c.getOutputStream()){o.write(body.toString().getBytes(StandardCharsets.UTF_8));}}
    int code=c.getResponseCode();InputStream in=code>=400?c.getErrorStream():c.getInputStream();String txt=read(in);JSONObject j=new JSONObject(txt.isEmpty()?"{}":txt);if(code>=400)throw new Exception(j.optString("error","HTTP "+code));return j;
  }
  private String read(InputStream in)throws Exception{if(in==null)return "";ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] x=new byte[4096];int n;while((n=in.read(x))!=-1)b.write(x,0,n);return b.toString("UTF-8");}
  private void ui(String s){runOnUiThread(()->log.setText(s));} private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_SHORT).show();}
}