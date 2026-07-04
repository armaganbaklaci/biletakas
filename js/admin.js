// ============================================================
// biletakas — Admin Panel
// ============================================================

var _adminUsersCache = {};

var ADMIN_TAB_LOADERS = {
  dashboard: loadDashboardTab,
  pending: loadPendingTab,
  offers: loadOffersTab,
  users: loadUsersTab,
  history: loadHistoryTab,
  logs: loadLogsTab,
};

/* ---------- Ortak: admin log kaydı ---------- */
async function logAdminAction(action, targetType, targetId, details) {
  if (!sb || !AppState.user) return;
  var res = await sb.from('admin_logs').insert({
    admin_id: AppState.user.id,
    action: action,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    details: details || null,
  });
  if (res.error) {
    console.error('[biletakas] Log kaydı oluşturulamadı:', res.error);
  }
}

/* ============================================================
   1) DASHBOARD
   ============================================================ */
async function fetchDashboardStats() {
  var stats = { totalListings: 0, pendingListings: 0, totalOffers: 0, totalUsers: 0 };
  if (!sb) return stats;

  var totalListingsRes = await sb.from('listings').select('id', { count: 'exact', head: true });
  if (totalListingsRes.error) console.error('[biletakas] Toplam ilan sayısı alınamadı:', totalListingsRes.error);
  else stats.totalListings = totalListingsRes.count || 0;

  var pendingListingsRes = await sb.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (pendingListingsRes.error) console.error('[biletakas] Bekleyen ilan sayısı alınamadı:', pendingListingsRes.error);
  else stats.pendingListings = pendingListingsRes.count || 0;

  var totalOffersRes = await sb.from('offers').select('id', { count: 'exact', head: true });
  if (totalOffersRes.error) console.error('[biletakas] Toplam teklif sayısı alınamadı:', totalOffersRes.error);
  else stats.totalOffers = totalOffersRes.count || 0;

  var totalUsersRes = await sb.from('profiles').select('id', { count: 'exact', head: true });
  if (totalUsersRes.error) console.error('[biletakas] Kullanıcı sayısı alınamadı:', totalUsersRes.error);
  else stats.totalUsers = totalUsersRes.count || 0;

  return stats;
}

function renderDashboardStats(stats) {
  var elTotalListings = document.getElementById('stat-total-listings');
  var elPendingListings = document.getElementById('stat-pending-listings');
  var elTotalOffers = document.getElementById('stat-total-offers');
  var elTotalUsers = document.getElementById('stat-total-users');

  if (elTotalListings) elTotalListings.textContent = stats.totalListings;
  if (elPendingListings) elPendingListings.textContent = stats.pendingListings;
  if (elTotalOffers) elTotalOffers.textContent = stats.totalOffers;
  if (elTotalUsers) elTotalUsers.textContent = stats.totalUsers;
}

async function loadDashboardTab() {
  var stats = await fetchDashboardStats();
  renderDashboardStats(stats);
}

/* ============================================================
   2) BEKLEYEN İLANLAR
   ============================================================ */
async function fetchPendingListings() {
  if (!sb) return [];
  var res = await sb
    .from('listings')
    .select('*, seller:profiles(username, display_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (res.error) {
    console.error('[biletakas] Bekleyen ilanlar çekilemedi:', res.error);
    return [];
  }
  return res.data || [];
}

function renderPendingListings(listings) {
  var container = document.getElementById('admin-pending-list');
  if (!container) return;

  if (!listings || listings.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Onay bekleyen ilan yok.</p>';
    return;
  }

  container.innerHTML = listings.map(function (l) {
    var seller = l.seller || {};
    var sellerName = escapeHtml(seller.display_name || seller.username || 'Kullanıcı');
    return (
      '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<p class="text-sm font-semibold text-white">' + escapeHtml(l.artist) + '</p>' +
            '<p class="text-xs text-zinc-500 mt-0.5">' + escapeHtml(l.venue) + ' · ' + escapeHtml(l.city) + '</p>' +
            '<p class="text-xs text-zinc-500">' + formatEventDate(l.event_datetime) + '</p>' +
            '<p class="text-xs text-zinc-500 mt-1">İlan sahibi: ' + sellerName + '</p>' +
          '</div>' +
          '<p class="text-lg font-bold text-white shrink-0">' + formatPrice(l.price) + '</p>' +
        '</div>' +
        (l.description ? '<p class="mt-2 text-xs text-zinc-500 leading-relaxed">' + escapeHtml(l.description) + '</p>' : '') +
        '<div class="mt-3 flex gap-2">' +
          '<button type="button" class="btn-admin-approve flex-1 py-2 rounded-lg bg-emerald-600/90 text-white text-xs font-semibold hover:bg-emerald-600 transition-all" data-listing-id="' + l.id + '">Onayla</button>' +
          '<button type="button" class="btn-admin-reject flex-1 py-2 rounded-lg bg-surface-700 border border-white/10 text-white text-xs font-semibold hover:bg-surface-600 transition-all" data-listing-id="' + l.id + '">Reddet</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  container.querySelectorAll('.btn-admin-approve').forEach(function (btn) {
    btn.addEventListener('click', function () { handleListingDecision(btn.getAttribute('data-listing-id'), 'approve'); });
  });
  container.querySelectorAll('.btn-admin-reject').forEach(function (btn) {
    btn.addEventListener('click', function () { handleListingDecision(btn.getAttribute('data-listing-id'), 'reject'); });
  });
}

async function handleListingDecision(listingId, decision) {
  if (!sb) return;

  var payload;
  var reason = null;

  if (decision === 'reject') {
    reason = window.prompt('Reddetme sebebini girin:');
    if (reason === null) return;
    reason = reason.trim();
    if (!reason) {
      showToast('Reddetme sebebi girmelisiniz.');
      return;
    }
    payload = { status: 'rejected', rejection_reason: reason };
  } else {
    payload = { status: 'active', rejection_reason: null };
  }

  var res = await sb.from('listings').update(payload).eq('id', listingId);
  if (res.error) {
    console.error('[biletakas] İlan güncellenemedi:', res.error);
    alert('İşlem başarısız oldu.');
    return;
  }

  await logAdminAction(decision === 'reject' ? 'listing_reject' : 'listing_approve', 'listing', listingId, reason);
  showToast(decision === 'reject' ? 'İlan reddedildi.' : 'İlan onaylandı.');

  var pending = await fetchPendingListings();
  renderPendingListings(pending);
  loadDashboardTab();
  loadHistoryTab();
  loadLogsTab();
  if (decision === 'approve') loadAndRenderListings();
}

function loadPendingTab() {
  var list = document.getElementById('admin-pending-list');
  if (list) list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
  fetchPendingListings().then(renderPendingListings);
}

/* ============================================================
   3) TEKLİFLER
   ============================================================ */
async function fetchAllOffers() {
  if (!sb) return [];
  var res = await sb
    .from('offers')
    .select('*, listing:listings(id, artist, price, status), buyer:profiles(username, display_name)')
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error('[biletakas] Teklifler çekilemedi:', res.error);
    return [];
  }
  return res.data || [];
}

function renderAdminOffersList(offers) {
  var container = document.getElementById('admin-offers-list');
  if (!container) return;

  if (!offers || offers.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Henüz hiç teklif yok.</p>';
    return;
  }

  container.innerHTML = offers.map(function (o) {
    var listing = o.listing || {};
    var buyer = o.buyer || {};
    var status = offerStatusLabel(o.status);
    var buyerName = escapeHtml(buyer.display_name || buyer.username || 'Kullanıcı');
    var actions = o.status === 'pending'
      ? '<div class="mt-3 flex gap-2">' +
          '<button type="button" class="btn-admin-offer-accept flex-1 py-2 rounded-lg bg-emerald-600/90 text-white text-xs font-semibold hover:bg-emerald-600 transition-all" data-offer-id="' + o.id + '" data-listing-id="' + o.listing_id + '">Kabul Et</button>' +
          '<button type="button" class="btn-admin-offer-reject flex-1 py-2 rounded-lg bg-surface-700 border border-white/10 text-white text-xs font-semibold hover:bg-surface-600 transition-all" data-offer-id="' + o.id + '" data-listing-id="' + o.listing_id + '">Reddet</button>' +
        '</div>'
      : '';

    return (
      '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<p class="text-sm font-semibold text-white">' + escapeHtml(listing.artist || 'İlan') + '</p>' +
            '<p class="text-xs text-zinc-500 mt-0.5">Teklif eden: ' + buyerName + '</p>' +
          '</div>' +
          '<span class="shrink-0 px-2 py-0.5 rounded-md border text-[11px] font-medium ' + status.cls + '">' + status.text + '</span>' +
        '</div>' +
        '<div class="mt-2 flex items-center justify-between">' +
          '<p class="text-lg font-bold text-white">' + formatPrice(o.amount) + '</p>' +
          '<p class="text-[11px] text-zinc-500">Liste: ' + formatPrice(listing.price) + '</p>' +
        '</div>' +
        actions +
      '</div>'
    );
  }).join('');

  container.querySelectorAll('.btn-admin-offer-accept').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleAdminOfferDecision(btn.getAttribute('data-offer-id'), btn.getAttribute('data-listing-id'), 'accept');
    });
  });
  container.querySelectorAll('.btn-admin-offer-reject').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleAdminOfferDecision(btn.getAttribute('data-offer-id'), btn.getAttribute('data-listing-id'), 'reject');
    });
  });
}

async function handleAdminOfferDecision(offerId, listingId, decision) {
  if (!sb) return;

  if (decision === 'reject') {
    var res = await sb.from('offers').update({ status: 'rejected' }).eq('id', offerId);
    if (res.error) {
      console.error('[biletakas] Teklif güncellenemedi:', res.error);
      alert('İşlem başarısız oldu.');
      return;
    }
    await logAdminAction('offer_reject', 'offer', offerId, null);
    showToast('Teklif reddedildi.');
  } else {
    var acceptRes = await sb.from('offers').update({ status: 'accepted' }).eq('id', offerId);
    if (acceptRes.error) {
      console.error('[biletakas] Teklif kabul edilemedi:', acceptRes.error);
      alert('İşlem başarısız oldu.');
      return;
    }
    await logAdminAction('offer_accept', 'offer', offerId, null);

    var listingRes = await sb.from('listings').update({ status: 'reserved' }).eq('id', listingId);
    if (listingRes.error) {
      console.error('[biletakas] İlan rezerve edilemedi:', listingRes.error);
    } else {
      await logAdminAction('listing_reserve', 'listing', listingId, 'Kabul edilen teklif nedeniyle ilan rezerve edildi.');
    }

    var othersRes = await sb.from('offers').update({ status: 'rejected' }).eq('listing_id', listingId).eq('status', 'pending').neq('id', offerId);
    if (othersRes.error) {
      console.error('[biletakas] Diğer teklifler reddedilemedi:', othersRes.error);
    } else {
      await logAdminAction('offer_auto_reject', 'listing', listingId, 'Kabul edilen teklif nedeniyle aynı ilana ait diğer bekleyen teklifler otomatik reddedildi.');
    }

    showToast('Teklif kabul edildi, ilan rezerve edildi.');
  }

  var offers = await fetchAllOffers();
  renderAdminOffersList(offers);
  loadHistoryTab();
  loadDashboardTab();
  loadLogsTab();
}

function loadOffersTab() {
  var list = document.getElementById('admin-offers-list');
  if (list) list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
  fetchAllOffers().then(renderAdminOffersList);
}

/* ============================================================
   4) KULLANICILAR
   ============================================================ */
async function fetchAllUsers() {
  if (!sb) return [];
  var res = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (res.error) {
    console.error('[biletakas] Kullanıcılar çekilemedi:', res.error);
    return [];
  }
  return res.data || [];
}

function adminBoolPill(label, value) {
  var cls = value ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-zinc-500 border-white/10';
  return '<span class="px-2 py-0.5 rounded-md border text-[11px] font-medium ' + cls + '">' + label + '</span>';
}

function renderAdminUsersList(users) {
  var container = document.getElementById('admin-users-list');
  if (!container) return;

  _adminUsersCache = {};
  (users || []).forEach(function (u) { _adminUsersCache[u.id] = u; });

  if (!users || users.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Hiç kullanıcı yok.</p>';
    return;
  }

  container.innerHTML = users.map(function (u) {
    var name = escapeHtml(u.display_name || u.username || 'Kullanıcı');
    var badges = [
      adminBoolPill('E-posta', u.email_verified),
      adminBoolPill('Telefon', u.phone_verified),
      adminBoolPill('Instagram', u.instagram_verified),
      adminBoolPill('Güvenilir', u.trusted_seller),
      adminBoolPill('Banlı', u.is_banned),
      adminBoolPill('Admin', u.is_admin),
    ].join(' ');

    var adminButtons = '';
    if (!u.is_admin) {
      adminButtons =
        '<button type="button" class="btn-admin-user-trust flex-1 py-2 rounded-lg bg-surface-700 border border-white/10 text-white text-xs font-semibold hover:bg-surface-600 transition-all" data-user-id="' + u.id + '">' +
          (u.trusted_seller ? 'Güvenilir Kaldır' : 'Güvenilir Yap') +
        '</button>' +
        '<button type="button" class="btn-admin-user-ban flex-1 py-2 rounded-lg ' + (u.is_banned ? 'bg-surface-700 border border-white/10' : 'bg-rose-600/90') + ' text-white text-xs font-semibold hover:brightness-110 transition-all" data-user-id="' + u.id + '">' +
          (u.is_banned ? 'Ban Kaldır' : 'Banla') +
        '</button>';
    }

    return (
      '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<p class="text-sm font-semibold text-white">' + name + '</p>' +
            '<p class="text-xs text-zinc-500 mt-0.5">Satış: ' + (u.sales_count || 0) + ' · Alış: ' + (u.purchase_count || 0) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="mt-2 flex flex-wrap gap-1.5">' + badges + '</div>' +
        '<div class="mt-3 flex gap-2">' +
          adminButtons +
          '<button type="button" class="btn-admin-user-view flex-1 py-2 rounded-lg bg-surface-700 border border-white/10 text-white text-xs font-semibold hover:bg-surface-600 transition-all" data-user-id="' + u.id + '">Profili Gör</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  container.querySelectorAll('.btn-admin-user-trust').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var u = _adminUsersCache[btn.getAttribute('data-user-id')];
      if (u) toggleUserTrusted(u.id, !u.trusted_seller);
    });
  });
  container.querySelectorAll('.btn-admin-user-ban').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var u = _adminUsersCache[btn.getAttribute('data-user-id')];
      if (u) toggleUserBanned(u.id, !u.is_banned);
    });
  });
  container.querySelectorAll('.btn-admin-user-view').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var u = _adminUsersCache[btn.getAttribute('data-user-id')];
      if (u) viewUserProfile(u);
    });
  });
}

async function toggleUserTrusted(userId, newVal) {
  if (!sb) return;
  var res = await sb.from('profiles').update({ trusted_seller: newVal }).eq('id', userId);
  if (res.error) {
    console.error('[biletakas] Kullanıcı güncellenemedi:', res.error);
    alert('İşlem başarısız oldu.');
    return;
  }
  await logAdminAction(newVal ? 'user_trust' : 'user_untrust', 'user', userId, null);
  showToast(newVal ? 'Kullanıcı güvenilir yapıldı.' : 'Güvenilir rozeti kaldırıldı.');
  var users = await fetchAllUsers();
  renderAdminUsersList(users);
  loadLogsTab();
}

async function toggleUserBanned(userId, newVal) {
  if (!sb) return;
  var res = await sb.from('profiles').update({ is_banned: newVal }).eq('id', userId);
  if (res.error) {
    console.error('[biletakas] Kullanıcı güncellenemedi:', res.error);
    alert('İşlem başarısız oldu.');
    return;
  }
  await logAdminAction(newVal ? 'user_ban' : 'user_unban', 'user', userId, null);
  showToast(newVal ? 'Kullanıcı banlandı.' : 'Ban kaldırıldı.');
  var users = await fetchAllUsers();
  renderAdminUsersList(users);
  loadLogsTab();
}

function viewUserProfile(user) {
  var lines = [
    'Kullanıcı adı: ' + (user.username || '-'),
    'Görünen ad: ' + (user.display_name || '-'),
    'E-posta doğrulandı: ' + (user.email_verified ? 'Evet' : 'Hayır'),
    'Telefon doğrulandı: ' + (user.phone_verified ? 'Evet' : 'Hayır'),
    'Instagram doğrulandı: ' + (user.instagram_verified ? 'Evet' : 'Hayır'),
    'Güvenilir satıcı: ' + (user.trusted_seller ? 'Evet' : 'Hayır'),
    'Banlı: ' + (user.is_banned ? 'Evet' : 'Hayır'),
    'Admin: ' + (user.is_admin ? 'Evet' : 'Hayır'),
    'Satış sayısı: ' + (user.sales_count || 0),
    'Alış sayısı: ' + (user.purchase_count || 0),
    'Kayıt tarihi: ' + formatEventDate(user.created_at),
  ];
  alert(lines.join('\n'));
}

function loadUsersTab() {
  var list = document.getElementById('admin-users-list');
  if (list) list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
  fetchAllUsers().then(renderAdminUsersList);
}

/* ============================================================
   5) İLAN GEÇMİŞİ
   ============================================================ */
async function fetchListingHistory() {
  if (!sb) return [];
  var res = await sb
    .from('listings')
    .select('*, seller:profiles(username, display_name)')
    .neq('status', 'pending')
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error('[biletakas] İlan geçmişi çekilemedi:', res.error);
    return [];
  }
  return res.data || [];
}

function adminListingStatusBadge(status) {
  switch (status) {
    case 'active': return { text: 'Aktif', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'rejected': return { text: 'Reddedildi', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    case 'sold': return { text: 'Satıldı', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' };
    case 'reserved': return { text: 'Rezerve', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'archived': return { text: 'Arşivlendi', cls: 'bg-white/5 text-zinc-500 border-white/10' };
    default: return { text: status, cls: 'bg-white/5 text-zinc-400 border-white/10' };
  }
}

function renderListingHistory(listings) {
  var container = document.getElementById('admin-history-list');
  if (!container) return;

  if (!listings || listings.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Henüz ilan geçmişi yok.</p>';
    return;
  }

  container.innerHTML = listings.map(function (l) {
    var seller = l.seller || {};
    var sellerName = escapeHtml(seller.display_name || seller.username || 'Kullanıcı');
    var badge = adminListingStatusBadge(l.status);
    var rejectionInfo = (l.status === 'rejected' && l.rejection_reason)
      ? '<p class="mt-1.5 text-xs text-rose-400/90">Sebep: ' + escapeHtml(l.rejection_reason) + '</p>'
      : '';

    var actions = '<div class="mt-3 flex gap-2 flex-wrap">';
    if (l.status !== 'active') {
      actions += '<button type="button" class="btn-admin-history-activate flex-1 py-2 rounded-lg bg-emerald-600/90 text-white text-xs font-semibold hover:bg-emerald-600 transition-all" data-listing-id="' + l.id + '">Aktif Yap</button>';
    }
    if (l.status !== 'archived') {
      actions += '<button type="button" class="btn-admin-history-archive flex-1 py-2 rounded-lg bg-surface-700 border border-white/10 text-white text-xs font-semibold hover:bg-surface-600 transition-all" data-listing-id="' + l.id + '">Arşivle</button>';
    }
    actions += '<button type="button" class="btn-admin-history-delete flex-1 py-2 rounded-lg bg-rose-600/90 text-white text-xs font-semibold hover:bg-rose-600 transition-all" data-listing-id="' + l.id + '">Sil</button>';
    actions += '</div>';

    return (
      '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<p class="text-sm font-semibold text-white">' + escapeHtml(l.artist) + '</p>' +
            '<p class="text-xs text-zinc-500 mt-0.5">' + escapeHtml(l.venue) + ' · ' + escapeHtml(l.city) + '</p>' +
            '<p class="text-xs text-zinc-500">' + formatEventDate(l.event_datetime) + '</p>' +
            '<p class="text-xs text-zinc-500 mt-1">İlan sahibi: ' + sellerName + '</p>' +
          '</div>' +
          '<div class="flex flex-col items-end gap-1.5 shrink-0">' +
            '<span class="px-2 py-0.5 rounded-md border text-[11px] font-medium ' + badge.cls + '">' + badge.text + '</span>' +
            '<p class="text-lg font-bold text-white">' + formatPrice(l.price) + '</p>' +
          '</div>' +
        '</div>' +
        rejectionInfo +
        actions +
      '</div>'
    );
  }).join('');

  container.querySelectorAll('.btn-admin-history-activate').forEach(function (btn) {
    btn.addEventListener('click', function () { handleAdminListingAction(btn.getAttribute('data-listing-id'), 'activate'); });
  });
  container.querySelectorAll('.btn-admin-history-archive').forEach(function (btn) {
    btn.addEventListener('click', function () { handleAdminListingAction(btn.getAttribute('data-listing-id'), 'archive'); });
  });
  container.querySelectorAll('.btn-admin-history-delete').forEach(function (btn) {
    btn.addEventListener('click', function () { handleAdminListingAction(btn.getAttribute('data-listing-id'), 'delete'); });
  });
}

async function handleAdminListingAction(listingId, action) {
  if (!sb) return;

  if (action === 'delete') {
    if (!window.confirm('Bu ilanı kalıcı olarak silmek istediğinize emin misiniz?')) return;
    var delRes = await sb.from('listings').delete().eq('id', listingId);
    if (delRes.error) {
      console.error('[biletakas] İlan silinemedi:', delRes.error);
      alert('İşlem başarısız oldu.');
      return;
    }
    await logAdminAction('listing_delete', 'listing', listingId, null);
    showToast('İlan silindi.');
  } else {
    var newStatus = action === 'activate' ? 'active' : 'archived';
    var payload = { status: newStatus };
    if (newStatus === 'active') payload.rejection_reason = null;

    var res = await sb.from('listings').update(payload).eq('id', listingId);
    if (res.error) {
      console.error('[biletakas] İlan güncellenemedi:', res.error);
      alert('İşlem başarısız oldu.');
      return;
    }
    await logAdminAction(action === 'activate' ? 'listing_activate' : 'listing_archive', 'listing', listingId, null);
    showToast(action === 'activate' ? 'İlan aktif yapıldı.' : 'İlan arşivlendi.');
  }

  var history = await fetchListingHistory();
  renderListingHistory(history);
  loadDashboardTab();
  loadLogsTab();
  loadAndRenderListings();
}

function loadHistoryTab() {
  var list = document.getElementById('admin-history-list');
  if (list) list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
  fetchListingHistory().then(renderListingHistory);
}

/* ============================================================
   6) İŞLEM GEÇMİŞİ (admin_logs)
   ============================================================ */
async function fetchAdminLogs() {
  if (!sb) return [];
  var res = await sb
    .from('admin_logs')
    .select('*, admin:profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (res.error) {
    console.error('[biletakas] İşlem geçmişi çekilemedi:', res.error);
    return [];
  }
  return res.data || [];
}

function renderAdminLogsList(logs) {
  var container = document.getElementById('admin-logs-list');
  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Henüz işlem kaydı yok.</p>';
    return;
  }

  container.innerHTML = logs.map(function (log) {
    var admin = log.admin || {};
    var adminName = escapeHtml(admin.display_name || admin.username || 'Bilinmeyen yönetici');
    return (
      '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<p class="text-sm font-semibold text-white">' + escapeHtml(log.action) + '</p>' +
            '<p class="text-xs text-zinc-500 mt-0.5">Hedef: ' + escapeHtml(log.target_type) + (log.target_id ? ' #' + escapeHtml(log.target_id) : '') + '</p>' +
            '<p class="text-xs text-zinc-500">Yönetici: ' + adminName + '</p>' +
          '</div>' +
          '<p class="text-[11px] text-zinc-500 shrink-0">' + formatEventDate(log.created_at) + '</p>' +
        '</div>' +
        (log.details ? '<p class="mt-2 text-xs text-zinc-500 leading-relaxed">' + escapeHtml(log.details) + '</p>' : '') +
      '</div>'
    );
  }).join('');
}

function loadLogsTab() {
  var list = document.getElementById('admin-logs-list');
  if (list) list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
  fetchAdminLogs().then(renderAdminLogsList);
}

/* ============================================================
   Modal & Tab Yönetimi
   ============================================================ */
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
    var active = btn.getAttribute('data-admin-tab') === tab;
    btn.classList.toggle('border-accent', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('border-transparent', !active);
    btn.classList.toggle('text-zinc-500', !active);
  });
  document.querySelectorAll('.admin-panel').forEach(function (panel) {
    panel.classList.add('hidden');
  });
  var panel = document.getElementById('admin-panel-' + tab);
  if (panel) panel.classList.remove('hidden');

  if (ADMIN_TAB_LOADERS[tab]) ADMIN_TAB_LOADERS[tab]();
}

function openAdminModal() {
  if (!AppState.profile || !AppState.profile.is_admin) {
    showToast('Bu bölüm sadece yöneticiler içindir.');
    return;
  }
  var modal = document.getElementById('admin-modal');
  openModalEl(modal);
  switchAdminTab('dashboard');
}

function closeAdminModal() {
  var modal = document.getElementById('admin-modal');
  closeModalEl(modal);
}

function wireAdminUI() {
  var btnOpen = document.getElementById('btn-admin-panel');
  var btnClose = document.getElementById('admin-close');
  var backdrop = document.getElementById('admin-backdrop');

  if (btnOpen) btnOpen.addEventListener('click', openAdminModal);
  if (btnClose) btnClose.addEventListener('click', closeAdminModal);
  if (backdrop) backdrop.addEventListener('click', closeAdminModal);

  document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchAdminTab(btn.getAttribute('data-admin-tab')); });
  });

  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('admin-modal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeAdminModal();
  });
}
