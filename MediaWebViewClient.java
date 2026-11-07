package com.yousef.gallery;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import android.graphics.Bitmap;
import android.util.LruCache;
import android.util.Size;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Serves gallery files to the web UI with proper HTTP range support (so video seeking
 * works) and cheap thumbnails (so the feed stays fast).
 *
 *   /_media/t/<i|v>/<id>   -> JPEG thumbnail (disk + RAM cached, see ThumbCache)
 *   /_media/o/<i|v>/<id>   -> original file, range requests supported
 */
public class MediaWebViewClient extends BridgeWebViewClient {

    private static final long CHUNK = 3L * 1024 * 1024;

    private final Context ctx;

    public MediaWebViewClient(Bridge bridge) {
        super(bridge);
        this.ctx = bridge.getContext();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String path = request.getUrl().getPath();
        if (path != null && path.startsWith("/_media/")) {
            try {
                WebResourceResponse r = serve(request, path);
                if (r != null) return r;
            } catch (Exception ignored) {
                // fall through to 404
            }
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }
        return super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse serve(WebResourceRequest req, String path) throws Exception {
        String[] p = path.split("/"); // "", "_media", mode, kind, id
        if (p.length < 5) return null;
        String mode = p[2];
        boolean video = p[3].equals("v");
        long id = Long.parseLong(p[4]);
        Uri base = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        Uri uri = ContentUris.withAppendedId(base, id);
        ContentResolver cr = ctx.getContentResolver();
        Map<String, String> h = new HashMap<String, String>();
        h.put("Access-Control-Allow-Origin", "*");

        if (mode.equals("t")) {
            byte[] bytes = ThumbCache.get(ctx, video, id);
            if (bytes == null) return null;
            h.put("Cache-Control", "max-age=604800");
            h.put("Content-Length", String.valueOf(bytes.length));
            return new WebResourceResponse("image/jpeg", null, 200, "OK", h, new ByteArrayInputStream(bytes));
        }

        AssetFileDescriptor afd = cr.openAssetFileDescriptor(uri, "r");
        if (afd == null) return null;
        long total = afd.getLength();
        String mime = cr.getType(uri);
        if (mime == null) mime = video ? "video/mp4" : "image/jpeg";
        h.put("Accept-Ranges", "bytes");
        h.put("Cache-Control", "no-store");

        String range = null;
        for (Map.Entry<String, String> e : req.getRequestHeaders().entrySet()) {
            if (e.getKey().equalsIgnoreCase("Range")) range = e.getValue();
        }
        InputStream in = afd.createInputStream();
        if (range != null && range.startsWith("bytes=") && total > 0) {
            String[] parts = range.substring(6).split(",")[0].trim().split("-", -1);
            long start;
            long end;
            if (parts[0].isEmpty()) { // suffix range: last N bytes
                long n = Long.parseLong(parts[1]);
                start = Math.max(0, total - n);
                end = total - 1;
            } else {
                start = Long.parseLong(parts[0]);
                end = (parts.length > 1 && !parts[1].isEmpty()) ? Long.parseLong(parts[1]) : total - 1;
            }
            if (end >= total) end = total - 1;
            // Never hand the WebView a whole multi-GB file in one go: answer with a bounded chunk
            // and let the player ask for the next one. Playback starts as soon as the first chunk is read.
            if (end - start + 1 > CHUNK) end = start + CHUNK - 1;
            if (start > end) {
                in.close();
                return new WebResourceResponse(mime, null, 416, "Range Not Satisfiable", h, new ByteArrayInputStream(new byte[0]));
            }
            long skipped = 0;
            while (skipped < start) {
                long s = in.skip(start - skipped);
                if (s <= 0) break;
                skipped += s;
            }
            long len = end - start + 1;
            h.put("Content-Range", "bytes " + start + "-" + end + "/" + total);
            h.put("Content-Length", String.valueOf(len));
            return new WebResourceResponse(mime, null, 206, "Partial Content", h, new LimitedInputStream(in, len));
        }
        if (total > 0) h.put("Content-Length", String.valueOf(total));
        return new WebResourceResponse(mime, null, 200, "OK", h, in);
    }

    /** Reads at most `limit` bytes from the wrapped stream. */
    private static class LimitedInputStream extends InputStream {
        private final InputStream in;
        private long left;

        LimitedInputStream(InputStream in, long limit) {
            this.in = in;
            this.left = limit;
        }

        @Override
        public int read() throws IOException {
            if (left <= 0) return -1;
            int b = in.read();
            if (b >= 0) left--;
            return b;
        }

        @Override
        public int read(byte[] buf, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int n = in.read(buf, off, (int) Math.min(len, left));
            if (n > 0) left -= n;
            return n;
        }

        @Override
        public int available() throws IOException {
            return (int) Math.min(in.available(), left);
        }

        @Override
        public void close() throws IOException {
            in.close();
        }
    }

    /**
     * Thumbnails are generated once, stored as small JPEG files in the app cache and kept in RAM.
     * After the first time every thumbnail is a plain file read, so scrolling never waits on
     * MediaStore / video frame extraction again. A background thread pre-builds them at launch.
     */
    public static final class ThumbCache {
        private static final int SIZE = 600;
        private static final String SUFFIX = "_" + SIZE + ".jpg";

        private static final LruCache<String, byte[]> MEM = new LruCache<String, byte[]>(32 * 1024 * 1024) {
            @Override
            protected int sizeOf(String k, byte[] v) {
                return v.length;
            }
        };
        private static final ConcurrentHashMap<String, Object> LOCKS = new ConcurrentHashMap<String, Object>();
        private static final AtomicInteger GEN = new AtomicInteger();
        private static final ExecutorService WARM = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "thumb-warm");
            t.setPriority(Thread.MIN_PRIORITY);
            t.setDaemon(true);
            return t;
        });
        private static File dir;

        private ThumbCache() {}

        private static synchronized File dir(Context c) {
            if (dir == null) {
                dir = new File(c.getApplicationContext().getCacheDir(), "thumbs");
                dir.mkdirs();
            }
            return dir;
        }

        private static byte[] readFile(File f) {
            try (DataInputStream in = new DataInputStream(new FileInputStream(f))) {
                byte[] b = new byte[(int) f.length()];
                in.readFully(b);
                return b.length > 0 ? b : null;
            } catch (Exception e) {
                return null;
            }
        }

        /** Returns JPEG bytes, or null if no thumbnail can be made. */
        public static byte[] get(Context ctx, boolean video, long id) {
            final Context c = ctx.getApplicationContext();
            final String key = (video ? "v" : "i") + id;
            byte[] b = MEM.get(key);
            if (b != null) return b;
            File f = new File(dir(c), key + SUFFIX);
            if (f.exists()) {
                b = readFile(f);
                if (b != null) {
                    MEM.put(key, b);
                    return b;
                }
            }
            Object lock = LOCKS.computeIfAbsent(key, k -> new Object());
            synchronized (lock) {
                try {
                    b = MEM.get(key);
                    if (b != null) return b;
                    if (f.exists()) {
                        b = readFile(f);
                        if (b != null) {
                            MEM.put(key, b);
                            return b;
                        }
                    }
                    Uri base = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                    Uri uri = ContentUris.withAppendedId(base, id);
                    Bitmap bm = c.getContentResolver().loadThumbnail(uri, new Size(SIZE, SIZE), null);
                    ByteArrayOutputStream bos = new ByteArrayOutputStream(48 * 1024);
                    bm.compress(Bitmap.CompressFormat.JPEG, 80, bos);
                    bm.recycle();
                    b = bos.toByteArray();
                    try {
                        File tmp = new File(f.getPath() + ".tmp");
                        try (FileOutputStream out = new FileOutputStream(tmp)) {
                            out.write(b);
                        }
                        if (!tmp.renameTo(f)) tmp.delete();
                    } catch (Exception ignored) {
                        // disk cache is best-effort
                    }
                    MEM.put(key, b);
                    return b;
                } catch (Exception e) {
                    return null;
                } finally {
                    LOCKS.remove(key);
                }
            }
        }

        private static boolean cached(Context c, String key) {
            return MEM.get(key) != null || new File(dir(c), key + SUFFIX).exists();
        }

        /** items look like "v:123" / "i:456", in the order they will be scrolled. */
        public static void prewarm(final Context ctx, final List<String> items) {
            final int gen = GEN.incrementAndGet();
            WARM.execute(() -> {
                for (String s : items) {
                    if (GEN.get() != gen) return; // a newer request replaced this one
                    try {
                        boolean video = s.charAt(0) == 'v';
                        long id = Long.parseLong(s.substring(2));
                        if (cached(ctx, (video ? "v" : "i") + id)) continue;
                        get(ctx, video, id);
                    } catch (Exception ignored) {
                        // skip bad entries
                    }
                }
            });
        }
    }
}
