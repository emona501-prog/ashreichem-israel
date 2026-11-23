package com.chaiproductions.ashreichem;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.onesignal.Continue;
import com.onesignal.OneSignal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

/** התראות אמיתיות של אנדרואיד (OneSignal) – גם כשהאפליקציה סגורה. האתר מדבר עם זה דרך Capacitor.Plugins.OSPush */
@CapacitorPlugin(name = "OSPush")
public class OSPushPlugin extends Plugin {
    private JSObject st() {
        JSObject r = new JSObject();
        try {
            r.put("perm", OneSignal.getNotifications().getPermission());
            r.put("on", OneSignal.getUser().getPushSubscription().getOptedIn() && OneSignal.getNotifications().getPermission());
            String id = OneSignal.getUser().getPushSubscription().getId();
            r.put("id", id == null ? "" : id);
        } catch (Exception e) { r.put("on", false); r.put("id", ""); }
        return r;
    }

    @PluginMethod
    public void state(PluginCall call) { call.resolve(st()); }

    @PluginMethod
    public void request(PluginCall call) {
        try {
            OneSignal.getUser().getPushSubscription().optIn();
            OneSignal.getNotifications().requestPermission(true, Continue.with(res -> {
                try { OneSignal.getUser().getPushSubscription().optIn(); } catch (Exception e) { }
                getActivity().runOnUiThread(() -> call.resolve(st()));
            }));
        } catch (Exception e) { call.resolve(st()); }
    }

    @PluginMethod
    public void optOut(PluginCall call) {
        try { OneSignal.getUser().getPushSubscription().optOut(); } catch (Exception e) { }
        call.resolve(st());
    }

    @PluginMethod
    public void setTags(PluginCall call) {
        try {
            JSObject add = call.getObject("add", new JSObject());
            Map<String, String> m = new HashMap<>();
            Iterator<String> it = add.keys();
            while (it.hasNext()) { String k = it.next(); m.put(k, String.valueOf(add.get(k))); }
            if (!m.isEmpty()) OneSignal.getUser().addTags(m);
            JSArray del = call.getArray("del", new JSArray());
            List<String> d = new ArrayList<>();
            for (int i = 0; i < del.length(); i++) d.add(del.getString(i));
            if (!d.isEmpty()) OneSignal.getUser().removeTags(d);
        } catch (Exception e) { }
        call.resolve();
    }
}
