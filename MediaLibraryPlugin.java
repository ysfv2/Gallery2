package com.yousef.gallery;

import android.Manifest;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Lists every photo / video on the phone (that's where Samsung Gallery gets its
 * albums from: each album is a folder, i.e. a MediaStore "bucket").
 */
@CapacitorPlugin(
    name = "MediaLibrary",
    permissions = {
        @Permission(alias = "media", strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO }),
        @Permission(alias = "legacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class MediaLibraryPlugin extends Plugin {

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "media" : "legacy";
    }

    @PluginMethod
    public void getMedia(PluginCall call) {
        if (getPermissionState(alias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias(), call, "permissionCallback");
            return;
        }
        query(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) {
            query(call);
        } else {
            call.reject("PERMISSION_DENIED");
        }
    }

    private void query(PluginCall call) {
        Cursor c = null;
        try {
            ContentResolver cr = getContext().getContentResolver();
            Uri uri = MediaStore.Files.getContentUri("external");
            final boolean favs = Build.VERSION.SDK_INT >= 30;
            String[] base = {
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.MIME_TYPE,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.MediaColumns.RELATIVE_PATH,
                MediaStore.MediaColumns.BUCKET_DISPLAY_NAME,
                MediaStore.MediaColumns.DATE_ADDED,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DURATION,
                MediaStore.MediaColumns.WIDTH,
                MediaStore.MediaColumns.HEIGHT
            };
            String[] proj = base;
            if (favs) { // "favorite" flag (Android 11+)
                proj = java.util.Arrays.copyOf(base, base.length + 1);
                proj[base.length] = MediaStore.MediaColumns.IS_FAVORITE;
            }
            String sel = MediaStore.Files.FileColumns.MEDIA_TYPE + "=? OR " + MediaStore.Files.FileColumns.MEDIA_TYPE + "=?";
            String[] args = {
                String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE),
                String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO)
            };
            c = cr.query(uri, proj, sel, args, MediaStore.MediaColumns.DATE_ADDED + " DESC");
            JSArray items = new JSArray();
            if (c != null) {
                while (c.moveToNext()) {
                    String name = c.getString(1);
                    if (name == null) continue;
                    JSObject o = new JSObject();
                    o.put("id", c.getLong(0));
                    o.put("n", name);
                    o.put("m", c.getString(2));
                    o.put("k", c.getInt(3) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO ? "v" : "i");
                    o.put("r", c.getString(4));
                    o.put("f", c.getString(5));
                    o.put("a", c.getLong(6));
                    o.put("s", c.getLong(7));
                    o.put("d", c.getLong(8));
                    o.put("w", c.getInt(9));
                    o.put("h", c.getInt(10));
                    if (favs && c.getInt(11) == 1) o.put("v", 1);
                    items.put(o);
                }
            }
            JSObject ret = new JSObject();
            ret.put("items", items);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("QUERY_FAILED: " + e.getMessage());
        } finally {
            if (c != null) c.close();
        }
    }

    /** Build thumbnails in the background so the feed never waits on them. items = ["v:12","i:34",...] */
    @PluginMethod
    public void prewarm(PluginCall call) {
        try {
            JSArray arr = call.getArray("items");
            java.util.List<String> list = new java.util.ArrayList<String>();
            if (arr != null) for (int i = 0; i < arr.length(); i++) list.add(arr.getString(i));
            MediaWebViewClient.ThumbCache.prewarm(getContext(), list);
        } catch (Exception ignored) {
            // best effort
        }
        call.resolve();
    }
}
