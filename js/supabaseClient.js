var sb = null;
var SUPABASE_READY = false;

(function initSupabase() {
  try {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error('[biletakas] Supabase SDK yüklenemedi.');
      return;
    }

    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });

    window.sb = sb;
    window.SUPABASE_READY = true;
    SUPABASE_READY = true;
  } catch (err) {
    console.error('[biletakas] Supabase client oluşturulamadı:', err);
  }
})();