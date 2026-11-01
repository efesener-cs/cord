package dev.cord.preview;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle state) {
        registerPlugin(ScreenSharePlugin.class);
        super.onCreate(state);
    }
}
