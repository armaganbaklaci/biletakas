// ============================================================
// biletakas — Ortak Yardımcı Fonksiyonlar
// ============================================================

/* ---------- Toast ---------- */
function showToast(message) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(showToast._timer);
  toast.textContent = message;
  toast.classList.remove('hidden');
  showToast._timer = setTimeout(function () {
    toast.classList.add('hidden');
  }, 3200);
}

/* ---------- Format ---------- */
function formatPrice(amount) {
  var n = Number(amount) || 0;
  return '₺' + n.toLocaleString('tr-TR');
}

function formatEventDate(isoString) {
  if (!isoString) return '';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  var days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  var months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var gun = d.getDate();
  var ay = months[d.getMonth()];
  var yil = d.getFullYear();
  var saat = String(d.getHours()).padStart(2, '0');
  var dk = String(d.getMinutes()).padStart(2, '0');
  return gun + ' ' + ay + ' ' + yil + ' · ' + saat + ':' + dk;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Anonim kullanıcı adı üretici ---------- */
var USERNAME_ADJECTIVES = [
  'Velvet', 'Static', 'Neon', 'Purple', 'Crimson', 'Electric', 'Silent',
  'Golden', 'Frozen', 'Wild', 'Cosmic', 'Retro', 'Midnight', 'Solar',
  'Rusty', 'Hollow', 'Amber', 'Lucid', 'Feral', 'Indigo'
];
var USERNAME_NOUNS = [
  'Tape', 'Fox', 'Riff', 'Echo', 'Wolf', 'Comet', 'Drift', 'Spark',
  'Raven', 'Nova', 'Pulse', 'Shadow', 'Beat', 'Storm', 'Vinyl',
  'Falcon', 'Ember', 'Ghost', 'Circuit', 'Meadow'
];

function generateAnonymousUsername() {
  var adj = USERNAME_ADJECTIVES[Math.floor(Math.random() * USERNAME_ADJECTIVES.length)];
  var noun = USERNAME_NOUNS[Math.floor(Math.random() * USERNAME_NOUNS.length)];
  var num = Math.floor(Math.random() * 90) + 10; // 10-99
  return adj + noun + num;
}

/* ---------- Modal yardımcıları ---------- */
function openModalEl(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
  modalEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
}

function closeModalEl(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  modalEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overflow-hidden');
}

function isPastDate(isoString) {
  if (!isoString) return false;
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}
