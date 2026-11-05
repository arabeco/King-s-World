package com.kingsworld.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

/** No WebView or automatic restart while the system is under memory pressure. */
public class RecoveryActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recovery);
        if (getIntent().getBooleanExtra("renderer_crashed", false)) {
            ((TextView) findViewById(R.id.recovery_message)).setText("Não foi possível manter o jogo aberto.");
        }
        Button retry = findViewById(R.id.recovery_retry);
        retry.setOnClickListener(view -> {
            retry.setEnabled(false);
            startActivity(new Intent(this, MainActivity.class));
            finish();
        });
    }
}
