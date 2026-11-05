package com.kingsworld.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private boolean recovering;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register before BridgeActivity constructs/loads the WebView, including
        // low-memory termination during the first page load.
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (!recovering) {
                    recovering = true;
                    if (view.getParent() instanceof ViewGroup) {
                        ((ViewGroup) view.getParent()).removeView(view);
                    }
                    view.destroy();
                    startActivity(new Intent(MainActivity.this, RecoveryActivity.class)
                        .putExtra("renderer_crashed", detail.didCrash()));
                    finish();
                }
                return true;
            }
        });
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        bridge = null;
    }
}
