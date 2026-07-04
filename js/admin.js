// ============================================================
// biletakas — Admin Page
// ============================================================

document.addEventListener('DOMContentLoaded', initAdminPage);

async function initAdminPage() {
  const statusEl = document.getElementById('admin-status');
  const listEl = document.getElementById('admin-pending-list');

  if (!statusEl || !listEl) return;

  if (!sb) {
    statusEl.textContent = 'Supabase bağlantısı yok.';
    return;
  }

  const userRes = await sb.auth.getUser();
  const user = userRes.data.user;

  if (!user) {
    statusEl.textContent = 'Admin paneli için giriş yapmalısınız.';
    return;
  }

  const profileRes = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileRes.error || !profileRes.data || !profileRes.data.is_admin) {
    statusEl.textContent = 'Bu sayfaya erişim yetkiniz yok.';
    return;
  }

  statusEl.textContent = 'Admin olarak giriş yapıldı. Bekleyen ilanlar yükleniyor...';
  await loadPendingListings();
  await loadAdminOffers();
}

async function loadPendingListings() {
  const statusEl = document.getElementById('admin-status');
  const listEl = document.getElementById('admin-pending-list');

  const res = await sb
    .from('listings')
    .select('*, seller:profiles(username, display_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error(res.error);
    statusEl.textContent = 'Bekleyen ilanlar yüklenemedi.';
    return;
  }

  const listings = res.data || [];

  statusEl.textContent = `${listings.length} bekleyen ilan var.`;

  if (listings.length === 0) {
    listEl.innerHTML = '<p class="text-zinc-500">Onay bekleyen ilan yok.</p>';
    return;
  }

  listEl.innerHTML = listings.map(createListingHtml).join('');

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
      <div class="flex justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold">${esc(l.artist)}</h2>
          <p class="text-sm text-zinc-400">${esc(l.venue)} · ${esc(l.city)}</p>
          <p class="text-sm text-zinc-400">${formatDate(l.event_datetime)}</p>
          <p class="text-sm text-zinc-400">Satıcı: ${esc(sellerName)}</p>
          <p class="text-sm text-zinc-400">${Number(l.quantity || 1)} bilet · ${esc(l.ticket_type || '-')}</p>
          ${l.description ? `<p class="text-sm text-zinc-500 mt-2">${esc(l.description)}</p>` : ''}
        </div>

        <div class="text-right">
          <p class="text-xl font-bold">${Number(l.price || 0).toLocaleString('tr-TR')} TL</p>
          <div class="flex gap-2 mt-4">
            <button class="btn-approve px-3 py-2 rounded-lg bg-emerald-600 text-sm font-semibold" data-id="${l.id}">
              Onayla
            </button>
            <button class="btn-reject px-3 py-2 rounded-lg bg-red-600 text-sm font-semibold" data-id="${l.id}">
              Reddet
            </button>
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
    .select();

  console.log('UPDATE RESULT:', { data, error });

  if (error) {
    alert('İşlem başarısız: ' + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert('İşlem başarısız: Kayıt güncellenmedi. RLS/policy engelliyor olabilir.');
    return;
  }

  alert(status === 'active' ? 'İlan onaylandı.' : 'İlan reddedildi.');
  await loadPendingListings();
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

async function loadAdminOffers() {
  const offersEl = document.getElementById('admin-offers-list');
  if (!offersEl) return;

  const { data, error } = await sb
    .from('offers')
    .select(`
      *,
      listing:listings(artist, venue, city, price, seller_id),
      buyer:profiles(username, display_name)
    `)
    .order('created_at', { ascending: false });

  console.log('OFFERS:', { data, error });

  if (error) {
    offersEl.innerHTML = '<p class="text-red-400">Teklifler yüklenemedi.</p>';
    return;
  }

  const offers = data || [];

  if (offers.length === 0) {
    offersEl.innerHTML = '<p class="text-zinc-500">Henüz teklif yok.</p>';
    return;
  }

  offersEl.innerHTML = offers.map(createOfferHtml).join('');
}


function createOfferHtml(o) {
  const listing = o.listing || {};
  const buyer = o.buyer || {};
  const buyerName = buyer.display_name || buyer.username || 'Kullanıcı';

  return `
    <div class="rounded-xl bg-zinc-900 border border-white/10 p-4">
      <div class="flex justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold">${esc(listing.artist || 'İlan')}</h3>
          <p class="text-sm text-zinc-400">${esc(listing.venue || '-')} · ${esc(listing.city || '-')}</p>
          <p class="text-sm text-zinc-400">Alıcı: ${esc(buyerName)}</p>
          <p class="text-sm text-zinc-400">Durum: ${esc(o.status)}</p>
          <p class="text-sm text-zinc-500 mt-2">${formatDate(o.created_at)}</p>
        </div>

        <div class="text-right">
          <p class="text-xl font-bold">${Number(o.amount || 0).toLocaleString('tr-TR')} TL</p>
          <p class="text-sm text-zinc-500">İlan fiyatı: ${Number(listing.price || 0).toLocaleString('tr-TR')} TL</p>
        </div>
      </div>
    </div>
  `;
}
