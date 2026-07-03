// ============================================================
// biletakas — Admin Panel
// ============================================================

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
      '<div class="rounded-xl bg-surface-700/60 border border-white/5 p-3.5">' +
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
    btn.addEventListener('click', function () { handleListingDecision(btn.getAttribute('data-listing-id'), 'active'); });
  });
  container.querySelectorAll('.btn-admin-reject').forEach(function (btn) {
    btn.addEventListener('click', function () { handleListingDecision(btn.getAttribute('data-listing-id'), 'rejected'); });
  });
}

async function handleListingDecision(listingId, newStatus) {
  if (!sb) return;
  var res = await sb.from('listings').update({ status: newStatus }).eq('id', listingId);
  if (res.error) {
    showToast('İşlem başarısız oldu.');
    return;
  }
  showToast(newStatus === 'active' ? 'İlan onaylandı.' : 'İlan reddedildi.');
  var pending = await fetchPendingListings();
  renderPendingListings(pending);
  if (newStatus === 'active') {
    loadAndRenderListings();
  }
}

function openAdminModal() {
  if (!AppState.profile || !AppState.profile.admin_verified) {
    showToast('Bu bölüm sadece yöneticiler içindir.');
    return;
  }
  var modal = document.getElementById('admin-modal');
  var list = document.getElementById('admin-pending-list');
  list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
  openModalEl(modal);
  fetchPendingListings().then(renderPendingListings);
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

  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('admin-modal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeAdminModal();
  });
}
