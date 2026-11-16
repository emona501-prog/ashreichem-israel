package com.chaiproductions.ashreichem;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** הדפסה: מסך ההדפסה של אנדרואיד (מדפסת / שמירה כ-PDF) */
@CapacitorPlugin(name = "WebPrint")
public class WebPrintPlugin extends Plugin {
    private WebView keep; // שומרים הפניה עד שההדפסה מתחילה

    /** מדפיס את הדף שבאפליקציה */
    @PluginMethod
    public void print(PluginCall call) {
        final String name = call.getString("name", "Ashreichem");
        getActivity().runOnUiThread(() -> {
            try {
                WebView wv = getBridge().getWebView();
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = wv.createPrintDocumentAdapter(name);
                pm.print(name, adapter, new PrintAttributes.Builder().build());
                call.resolve();
            } catch (Exception e) {
                call.reject("print failed: " + e.getMessage());
            }
        });
    }

    /** מדפיס מסמך HTML מוכן (לוחות זמנים, עלון מידע לשבת, עמודי עלון) */
    @PluginMethod
    public void printHtml(PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "Ashreichem");
        getActivity().runOnUiThread(() -> {
            try {
                WebView w = new WebView(getActivity());
                w.getSettings().setJavaScriptEnabled(false);
                w.setWebViewClient(new WebViewClient() {
                    private boolean done = false;
                    @Override
                    public void onPageFinished(WebView v, String url) {
                        if (done) return;
                        done = true;
                        v.postDelayed(() -> {
                            try {
                                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                                pm.print(name, v.createPrintDocumentAdapter(name), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                                call.resolve();
                            } catch (Exception e) {
                                call.reject("print failed: " + e.getMessage());
                            }
                        }, 400);
                    }
                });
                keep = w;
                w.loadDataWithBaseURL("https://emona501-prog.github.io/ashreichem-israel/", html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject("print failed: " + e.getMessage());
            }
        });
    }
}
