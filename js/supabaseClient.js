// ============================================================
// biletakas — Supabase Client
// ============================================================
// CDN üzerinden yüklenen @supabase/supabase-js global "supabase"
// nesnesini kullanarak client oluşturur. Diğer dosyalar bu
// dosyadaki `sb` değişkenini kullanır.
// ============================================================

let sb = null;
let SUPABASE_READY = false;

(function initSupabase() {
  try {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error('[biletakas] Supabase SDK yüklenemedi. CDN script etiketini kontrol edin.');
      return;
    }
    if (!SUPABASE_URL || SUPABASE_URL.indexOf('YOUR-PROJECT-REF') !== -1) {
      console.warn('[biletakas] Supabase URL / anon key henüz ayarlanmadı. js/config.js dosyasını düzenleyin.');
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    SUPABASE_READY = true;
  } catch (err) {
    console.error('[biletakas] Supabase client oluşturulamadı:', err);
  }
})();
