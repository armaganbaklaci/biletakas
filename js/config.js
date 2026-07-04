// ============================================================
// biletakas — Supabase Yapılandırması
// ============================================================
// Aşağıdaki iki değeri kendi Supabase projenizin bilgileriyle
// değiştirin. Supabase Dashboard > Project Settings > API
// sayfasından "Project URL" ve "anon public" key'i kopyalayın.
// ============================================================

const SUPABASE_URL = 'https://mpfyylhtgkyfiqaqoicr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AXAwm5irGT_yKk5vzhQT9Q_9QJdRCHy';

const BILETAKAS_IBAN = {
  accountName: 'Biletakas',
  iban: 'TR00 0000 0000 0000 0000 0000 00',
  bank: 'Banka Adı',
  descriptionHint: 'Havale açıklamasına işlem kodunu (BTK-XXXXXX) yazın.',
};

const TICKET_STORAGE_BUCKET = 'transaction-tickets';
const TICKET_MAX_BYTES = 10 * 1024 * 1024;
const TICKET_ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg'
};
const TICKET_ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
