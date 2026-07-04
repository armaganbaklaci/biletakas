// ============================================================
// biletakas — Admin Page
// is_admin = panel yöneticisi
// admin_verified = kullanıcının sitedeki "admin onaylı" rozeti
// ============================================================

let currentAdmin = null;
let allUsers = [];
let allHistoryListings = [];
let allLogs = [];

const STATUS_LABELS = {
  pending: 'Bekliyor',
  active: 'Aktif',
  rejected: 'Reddedildi',
  sold: 'Satıldı',
  accepted: 'Kabul edildi',
  expired: 'Süresi doldu'
};

document.addEventListener('DOMContentLoaded', initAdminPage);

async function initAdminPage() {
  wireAdminTabs();

  const statusEl = document.getElementById('admin-status');
  if (!statusEl) return;

  if (!sb) {
    statusEl.textContent = 'Supabase bağlantısı yok.';
    return;
  }

  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;

  if (!user) {
    statusEl.textContent = 'Admin paneli için giriş yapmalısınız.';
    return;
  }

  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, username, display_name, is_admin')
    .eq('id', user.id)
    .single();

  if (error || !profile || !profile.is_admin) {
    statusEl.textContent = 'Bu sayfaya erişim yetkiniz yok. is_admin=true olmalı.';
    return;
  }

  currentAdmin = profile;
  statusEl.textContent = `Admin olarak giriş yapıldı: ${profile.display_name || profile.username}`;

  await Promise.all([
    loadAdminStats(),
    loadPendingListings(),
    loadAdminOffers(),
    loadAdminUsers(),
    loadListingHistory(),
    loadAdminLogs()
  ]);
}

// ------------------------------------------------------------
// Pending listings
// ------------------------------------------------------------
async function loadPendingListings() {
  const listEl = document.getElementById('admin-pending-list');
  if (!listEl) return;

  const { data, error } = await sb
    .from('listings')
    .select('*, seller:profiles(username, display_name, email_verified, phone_verified, instagram_verified, admin_verified, sales_count, purchase_count)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    listEl.innerHTML = '<p class="text-red-400">Bekleyen ilanlar yüklenemedi.</p>';
    return;
  }

  const listings = data || [];
  setStatus(`${listings.length} bekleyen ilan var.`);

  listEl.innerHTML = listings.length
    ? listings.map(createListingHtml).join('')
    : '<p class="text-zinc-500">Onay bekleyen ilan yok.</p>';

  document.querySelectorAll('.btn-approve').forEach((btn) => {
    btn.addEventListener('click', () => updateListingStatus(btn.dataset.id, 'active'));
  });

  document.querySelectorAll('.btn-reject').forEach((btn) => {
    btn.addEventListener('click', () => updateListingStatus(btn.dataset.id, 'rejected'));
  });
}

function createListingHtml(l) {
  const seller = l.seller || {};
  const sellerName = seller.display_name || seller.username || 'Kullanıcı';

  return `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <div class="flex flex-col md:flex-row md:justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold">${esc(l.artist)}</h2>
          <p class="text-sm text-zinc-400">${esc(l.venue)} · ${esc(l.city)}</p>
          <p class="text-sm text-zinc-400">${formatDate(l.event_datetime)}</p>
          <p class="text-sm text-zinc-400">Satıcı: ${esc(sellerName)}</p>
          <div class="mt-2 flex flex-wrap gap-2">${userBadges(seller, l.quantity)}</div>
          ${l.description ? `<p class="text-sm text-zinc-500 mt-3">${esc(l.description)}</p>` : ''}
        </div>
        <div class="md:text-right">
          <p class="text-xl font-bold">${money(l.price)} TL</p>
          <p class="text-sm text-zinc-500">${Number(l.quantity || 1)} bilet · ${esc(l.ticket_type || '-')}</p>
          <div class="flex gap-2 mt-4 md:justify-end">
            <button class="btn-approve px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold" data-id="${l.id}">Onayla</button>
            <button class="btn-reject px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold" data-id="${l.id}">Reddet</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function updateListingStatus(id, status) {
  const { data, error } = await sb
    .from('listings')
    .update({ status })
    .eq('id', id)
    .select('id, artist, status')
    .single();

  if (error || !data) {
    alert('İşlem başarısız: ' + (error?.message || 'Kayıt güncellenmedi.'));
    return;
  }

  await addLog('listing_status_update', `${data.artist} ilanı ${STATUS_LABELS[status] || status} yapıldı.`, {
    listing_id: id,
    new_status: status
  });

  await Promise.all([loadPendingListings(), loadListingHistory(), loadAdminStats(), loadAdminLogs()]);
}

// ------------------------------------------------------------
// Offers
// ------------------------------------------------------------
async function loadAdminOffers() {
  const offersEl = document.getElementById('admin-offers-list');
  if (!offersEl) return;

  const { data, error } = await sb
    .from('offers')
    .select('*, listing:listings(artist, venue, city, price, seller_id), buyer:profiles(username, display_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    offersEl.innerHTML = '<p class="text-red-400">Teklifler yüklenemedi.</p>';
    return;
  }

  const offers = data || [];
  offersEl.innerHTML = offers.length
    ? offers.map(createOfferHtml).join('')
    : '<p class="text-zinc-500">Henüz teklif yok.</p>';
}

function createOfferHtml(o) {
  const listing = o.listing || {};
  const buyer = o.buyer || {};
  const buyerName = buyer.display_name || buyer.username || 'Kullanıcı';

  return `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <div class="flex flex-col md:flex-row md:justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold">${esc(listing.artist || 'İlan')}</h3>
          <p class="text-sm text-zinc-400">${esc(listing.venue || '-')} · ${esc(listing.city || '-')}</p>
          <p class="text-sm text-zinc-400">Alıcı: ${esc(buyerName)}</p>
          <div class="mt-2">${statusBadge(o.status)}</div>
          <p class="text-sm text-zinc-500 mt-2">${formatDate(o.created_at)}</p>
        </div>
        <div class="md:text-right">
          <p class="text-xl font-bold">${money(o.amount)} TL</p>
          <p class="text-sm text-zinc-500">İlan fiyatı: ${money(listing.price)} TL</p>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// Users
// ------------------------------------------------------------
async function loadAdminUsers() {
  const el = document.getElementById('admin-users-list');
  if (!el) return;

  const { data, error } = await sb
    .from('profiles')
    .select('id, username, display_name, email_verified, phone_verified, instagram_verified, admin_verified, is_admin, sales_count, purchase_count, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    el.innerHTML = '<p class="text-red-400">Kullanıcılar yüklenemedi. is_admin kolonu eklenmemiş olabilir.</p>';
    return;
  }

  allUsers = data || [];

  el.innerHTML = `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4 mb-2">
      <input id="admin-user-search" class="w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm" placeholder="Kullanıcı ara...">
    </div>
    <div id="admin-users-results" class="grid gap-4"></div>
  `;

  document.getElementById('admin-user-search').addEventListener('input', renderUsers);
  renderUsers();
}

function renderUsers() {
  const resultsEl = document.getElementById('admin-users-results');
  const q = (document.getElementById('admin-user-search')?.value || '').toLowerCase().trim();

  const users = allUsers.filter((u) => {
    return !q || `${u.username || ''} ${u.display_name || ''}`.toLowerCase().includes(q);
  });

  resultsEl.innerHTML = users.length
    ? users.map(createUserHtml).join('')
    : '<p class="text-zinc-500">Kullanıcı bulunamadı.</p>';

  document.querySelectorAll('.btn-toggle-user').forEach((btn) => {
    btn.addEventListener('click', () => toggleUserField(btn.dataset.id, btn.dataset.field, btn.dataset.value === 'true'));
  });
}

function createUserHtml(u) {
  const name = u.display_name || u.username || 'Kullanıcı';
  const disableAdminButton = currentAdmin && currentAdmin.id === u.id;

  return `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-lg font-bold">${esc(name)}</h3>
            ${u.is_admin ? '<span class="text-xs px-2 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-200">Admin</span>' : ''}
            ${u.admin_verified ? '<span class="text-xs px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-200">Admin onaylı</span>' : ''}
          </div>
          <p class="text-sm text-zinc-400">@${esc(u.username || '-')} · Kayıt: ${formatDate(u.created_at)}</p>
          <div class="mt-3 flex flex-wrap gap-2">${userBadges(u)}</div>
        </div>

        <div class="flex flex-wrap gap-2 lg:justify-end">
          <button class="btn-toggle-user px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold" data-id="${u.id}" data-field="admin_verified" data-value="${!u.admin_verified}">
            ${u.admin_verified ? 'Admin onayı kaldır' : 'Admin onaylı yap'}
          </button>
          <button class="btn-toggle-user px-3 py-2 rounded-lg ${u.is_admin ? 'bg-red-700 hover:bg-red-600' : 'bg-purple-700 hover:bg-purple-600'} text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed" data-id="${u.id}" data-field="is_admin" data-value="${!u.is_admin}" ${disableAdminButton ? 'disabled' : ''}>
            ${u.is_admin ? 'Adminliği kaldır' : 'Admin yap'}
          </button>
        </div>
      </div>
    </div>
  `;
}

async function toggleUserField(id, field, value) {
  if (!['admin_verified', 'is_admin'].includes(field)) return;

  const { data, error } = await sb
    .from('profiles')
    .update({ [field]: value })
    .eq('id', id)
    .select('id, username, display_name, admin_verified, is_admin')
    .single();

  if (error || !data) {
    alert('Kullanıcı güncellenemedi: ' + (error?.message || 'Bilinmeyen hata'));
    return;
  }

  const targetName = data.display_name || data.username || data.id;
  const fieldName = field === 'is_admin' ? 'admin yetkisi' : 'admin onayı';
  await addLog('user_update', `${targetName} için ${fieldName} ${value ? 'açıldı' : 'kapatıldı'}.`, {
    target_user_id: id,
    field,
    value
  });

  await Promise.all([loadAdminUsers(), loadAdminStats(), loadAdminLogs()]);
}

// ------------------------------------------------------------
// Listing history
// ------------------------------------------------------------
async function loadListingHistory() {
  const el = document.getElementById('admin-listing-history');
  if (!el) return;

  const { data, error } = await sb
    .from('listings')
    .select('*, seller:profiles(username, display_name, email_verified, phone_verified, instagram_verified, admin_verified, sales_count, purchase_count)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    el.innerHTML = '<p class="text-red-400">İlan geçmişi yüklenemedi.</p>';
    return;
  }

  allHistoryListings = data || [];

  el.innerHTML = `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4 mb-2 grid md:grid-cols-2 gap-3">
      <input id="history-search" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm" placeholder="İlan, şehir, satıcı ara...">
      <select id="history-status" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm">
        <option value="all">Tümü</option>
        <option value="pending">Bekleyen</option>
        <option value="active">Aktif</option>
        <option value="sold">Satıldı</option>
        <option value="rejected">Reddedilen</option>
      </select>
    </div>
    <div id="history-results" class="grid gap-4"></div>
  `;

  document.getElementById('history-search').addEventListener('input', renderListingHistory);
  document.getElementById('history-status').addEventListener('change', renderListingHistory);
  renderListingHistory();
}

function renderListingHistory() {
  const resultsEl = document.getElementById('history-results');
  const q = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
  const status = document.getElementById('history-status')?.value || 'all';

  const rows = allHistoryListings.filter((l) => {
    const seller = l.seller || {};
    const text = `${l.artist || ''} ${l.venue || ''} ${l.city || ''} ${seller.username || ''} ${seller.display_name || ''}`.toLowerCase();
    return (status === 'all' || l.status === status) && (!q || text.includes(q));
  });

  resultsEl.innerHTML = rows.length
    ? rows.map(createHistoryHtml).join('')
    : '<p class="text-zinc-500">Filtreye uygun ilan yok.</p>';
}

function createHistoryHtml(l) {
  const seller = l.seller || {};
  const sellerName = seller.display_name || seller.username || 'Kullanıcı';

  return `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <div class="flex flex-col md:flex-row md:justify-between gap-4">
        <div>
          <div class="flex flex-wrap gap-2 items-center">
            <h3 class="text-lg font-bold">${esc(l.artist)}</h3>
            ${statusBadge(l.status)}
          </div>
          <p class="text-sm text-zinc-400">${esc(l.venue)} · ${esc(l.city)} · ${formatDate(l.event_datetime)}</p>
          <p class="text-sm text-zinc-400">Satıcı: ${esc(sellerName)}</p>
          <div class="mt-2 flex flex-wrap gap-2">${userBadges(seller, l.quantity)}</div>
          ${l.description ? `<p class="text-sm text-zinc-500 mt-3">${esc(l.description)}</p>` : ''}
        </div>
        <div class="md:text-right">
          <p class="text-xl font-bold">${money(l.price)} TL</p>
          <p class="text-sm text-zinc-500">${Number(l.quantity || 1)} bilet · ${esc(l.ticket_type || '-')}</p>
          <p class="text-xs text-zinc-600 mt-2">Oluşturulma: ${formatDate(l.created_at)}</p>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// Logs
// ------------------------------------------------------------
async function loadAdminLogs() {
  const el = document.getElementById('admin-logs-list');
  if (!el) return;

  const { data, error } = await sb
    .from('admin_logs')
    .select('*, admin:profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn(error);
    el.innerHTML = '<p class="text-zinc-500">İşlem geçmişi için admin_logs tablosunu SQL ile eklemelisin.</p>';
    return;
  }

  allLogs = data || [];

  el.innerHTML = `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4 mb-2 grid md:grid-cols-2 gap-3">
      <input id="logs-search" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm" placeholder="İşlem ara...">
      <select id="logs-type" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm">
        <option value="all">Tüm işlemler</option>
        <option value="listing_status_update">İlan işlemleri</option>
        <option value="user_update">Kullanıcı işlemleri</option>
      </select>
    </div>
    <div id="logs-results" class="grid gap-4"></div>
  `;

  document.getElementById('logs-search').addEventListener('input', renderLogs);
  document.getElementById('logs-type').addEventListener('change', renderLogs);
  renderLogs();
}

function renderLogs() {
  const resultsEl = document.getElementById('logs-results');
  const q = (document.getElementById('logs-search')?.value || '').toLowerCase().trim();
  const type = document.getElementById('logs-type')?.value || 'all';

  const rows = allLogs.filter((log) => {
    const admin = log.admin || {};
    const text = `${log.action || ''} ${log.message || ''} ${admin.username || ''} ${admin.display_name || ''}`.toLowerCase();
    return (type === 'all' || log.action === type) && (!q || text.includes(q));
  });

  resultsEl.innerHTML = rows.length
    ? rows.map(createLogHtml).join('')
    : '<p class="text-zinc-500">İşlem kaydı yok.</p>';
}

function createLogHtml(log) {
  const admin = log.admin || {};
  const adminName = admin.display_name || admin.username || 'Admin';
  return `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <div class="flex flex-col md:flex-row md:justify-between gap-2">
        <div>
          <p class="font-semibold">${esc(adminName)}</p>
          <p class="text-sm text-zinc-300">${esc(log.message || log.action || '-')}</p>
          <p class="text-xs text-zinc-500 mt-1">${esc(log.action || '-')}</p>
        </div>
        <p class="text-sm text-zinc-500">${formatDate(log.created_at)}</p>
      </div>
    </div>
  `;
}

async function addLog(action, message, meta = {}) {
  if (!currentAdmin) return;

  const { error } = await sb.from('admin_logs').insert({
    admin_id: currentAdmin.id,
    action,
    message,
    metadata: meta
  });

  if (error) console.warn('Log yazılamadı:', error.message);
}

// ------------------------------------------------------------
// Stats / Tabs / Helpers
// ------------------------------------------------------------
async function loadAdminStats() {
  const [listingsTotal, listingsPending, offersTotal, usersTotal] = await Promise.all([
    sb.from('listings').select('id', { count: 'exact', head: true }),
    sb.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('offers').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('id', { count: 'exact', head: true })
  ]);

  setText('stat-total-listings', listingsTotal.count ?? 0);
  setText('stat-pending-listings', listingsPending.count ?? 0);
  setText('stat-total-offers', offersTotal.count ?? 0);
  setText('stat-total-users', usersTotal.count ?? 0);
}

function wireAdminTabs() {
  const tabButtons = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabButtons.forEach((b) => {
        b.classList.remove('bg-purple-600');
        b.classList.add('bg-zinc-800');
      });

      btn.classList.remove('bg-zinc-800');
      btn.classList.add('bg-purple-600');

      panels.forEach((panel) => panel.classList.add('hidden'));
      document.getElementById(`tab-${target}`)?.classList.remove('hidden');
    });
  });
}

function userBadges(user = {}, ticketCount = null) {
  const badges = [
    boolBadge(user.email_verified, 'E-posta doğrulandı', 'E-posta doğrulanmadı'),
    boolBadge(user.phone_verified, 'Telefon doğrulandı', 'Telefon doğrulanmadı'),
    boolBadge(user.instagram_verified, 'Instagram doğrulandı', 'Instagram doğrulanmadı'),
    user.admin_verified ? '<span class="px-2 py-1 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">✓ Admin onaylı</span>' : ''
  ];

  if (ticketCount !== null) badges.unshift(`<span class="px-2 py-1 rounded-lg text-xs bg-zinc-800 border border-white/10">${Number(ticketCount || 1)} bilet</span>`);

  badges.push(`<span class="px-2 py-1 rounded-lg text-xs bg-zinc-800 border border-white/10">🎟 ${Number(user.sales_count || 0)} satış</span>`);
  badges.push(`<span class="px-2 py-1 rounded-lg text-xs bg-zinc-800 border border-white/10">🛒 ${Number(user.purchase_count || 0)} alış</span>`);

  return badges.filter(Boolean).join('');
}

function boolBadge(value, yes, no) {
  return value
    ? `<span class="px-2 py-1 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">✓ ${esc(yes)}</span>`
    : `<span class="px-2 py-1 rounded-lg text-xs bg-zinc-800 border border-white/10 text-zinc-400">${esc(no)}</span>`;
}

function statusBadge(status) {
  const classes = {
    pending: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    active: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    sold: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    rejected: 'bg-red-500/10 border-red-500/30 text-red-300',
    accepted: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    expired: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300'
  };
  return `<span class="px-2 py-1 rounded-lg text-xs border ${classes[status] || 'bg-zinc-800 border-white/10 text-zinc-300'}">${esc(STATUS_LABELS[status] || status || '-')}</span>`;
}

function setStatus(value) {
  const el = document.getElementById('admin-status');
  if (el) el.textContent = value;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function esc(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR');
}

function money(value) {
  return Number(value || 0).toLocaleString('tr-TR');
}
