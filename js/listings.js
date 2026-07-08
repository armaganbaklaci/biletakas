// ============================================================
// biletakas — İlanlar (Listings)
// ============================================================

var _allListings = []; // ekranda gösterilen aktif ilanların önbelleği
const EVENT_GRACE_HOURS = 4;

function getSellPayoutFieldValue(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function getSellPayoutFormData() {
  return {
    full_name: getSellPayoutFieldValue('sell-payout-full-name'),
    iban: getSellPayoutFieldValue('sell-payout-iban'),
    account_name: getSellPayoutFieldValue('sell-payout-account-name'),
    bank_name: getSellPayoutFieldValue('sell-payout-bank-name'),
    phone: getSellPayoutFieldValue('sell-payout-phone'),
    email: getSellPayoutFieldValue('sell-payout-email')
  };
}

function populateSellPayoutForm(payout) {
  var fields = [
    ['sell-payout-full-name', payout && payout.full_name ? payout.full_name : ''],
    ['sell-payout-iban', payout && payout.iban ? payout.iban : ''],
    ['sell-payout-account-name', payout && payout.account_name ? payout.account_name : ''],
    ['sell-payout-bank-name', payout && payout.bank_name ? payout.bank_name : ''],
    ['sell-payout-phone', payout && payout.phone ? payout.phone : ''],
    ['sell-payout-email', payout && payout.email ? payout.email : '']
  ];

  fields.forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el) el.value = pair[1];
  });
}

function validateSellerPayoutInfo(data) {
  return !!(data && data.full_name && data.iban && data.phone && data.email);
}

async function loadSellerPayoutInfo() {
  if (!sb || !AppState.user) return null;

  var res = await sb
    .from('seller_payout_methods')
    .select('*')
    .eq('user_id', AppState.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    console.error('[biletakas] Payout bilgileri çekilemedi:', res.error);
    return null;
  }

  return res.data || null;
}

async function saveSellerPayoutInfo(data) {
  if (!sb || !AppState.user) {
    return { data: null, error: new Error('Giriş yapmalısınız.') };
  }

  if (!validateSellerPayoutInfo(data)) {
    return { data: null, error: null };
  }

  var existingRes = await sb
    .from('seller_payout_methods')
    .select('id')
    .eq('user_id', AppState.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRes.error) {
    return { data: null, error: existingRes.error };
  }

  var payload = {
    user_id: AppState.user.id,
    full_name: data.full_name,
    iban: data.iban,
    account_name: data.account_name || null,
    bank_name: data.bank_name || null,
    phone: data.phone,
    email: data.email,
    is_verified: false,
    payout_status: 'pending'
  };

  var res = existingRes.data
    ? await sb.from('seller_payout_methods').update(payload).eq('id', existingRes.data.id).select().single()
    : await sb.from('seller_payout_methods').insert(payload).select().single();

  if (res.error) {
    return { data: null, error: res.error };
  }

  return { data: res.data, error: null };
}

/* ---------- Veri çekme ---------- */
async function fetchActiveListings() {
  if (!sb) return [];


 // Etkinlikten sonraki 8 saate kadar ilanlar görünmeye devam etsin
const cutoffIso = new Date(
  Date.now() - EVENT_GRACE_HOURS * 60 * 60 * 1000
).toISOString();

var res = await sb
  .from('listings')
  .select('*, seller:profiles(id, username, display_name, avatar_url, created_at, email_verified, phone_verified, instagram_verified, admin_verified, sales_count, purchase_count, average_rating, review_count)')
  .eq('status', 'active')
  .gte('event_datetime', cutoffIso)
  .order('event_datetime', { ascending: true });

  if (res.error) {
    console.error('[biletakas] İlanlar çekilemedi:', res.error);
    showToast('İlanlar yüklenirken bir sorun oluştu.');
    return [];
  }
  return res.data || [];
}

async function loadAndRenderListings() {
  var container = document.getElementById('listings');
  if (!container) return;
  container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">İlanlar yükleniyor…</p>';

  _allListings = await fetchActiveListings();
  renderListings(_allListings);
  filterListings(); // arama/filtre kutusundaki mevcut değere göre uygula
}

/* ---------- Render ---------- */
function trustBadge(active, activeLabel, inactiveLabel) {
  if (active) {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">' +
      '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' +
      activeLabel + '</span>';
  }
  return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-500 text-[11px] font-medium">' +
    inactiveLabel + '</span>';
}

function createListingCardHtml(listing) {
  var seller = listing.seller || {};
  var sellerName = escapeHtml(seller.display_name || seller.username || 'Kullanıcı');
  var sellerId = seller.id || '';
  var sellerRating = Number(seller.average_rating || 0);
  var sellerReviewCount = Number(seller.review_count || 0);
  var priceLabel = formatPrice(listing.price);
  var dateLabel = formatEventDate(listing.event_datetime);
  var searchBlob = [listing.artist, listing.venue, listing.city].filter(Boolean).join(' ').toLowerCase();

  var badges = [
    trustBadge(!!seller.email_verified, 'E-posta doğrulandı', 'E-posta doğrulanmadı'),
    trustBadge(!!seller.phone_verified, 'Telefon doğrulandı', 'Telefon doğrulanmadı'),
    trustBadge(!!seller.instagram_verified, 'Instagram doğrulandı', 'Instagram doğrulanmadı'),
  ].join('');

  var adminBadge = seller.admin_verified
    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-accent-light text-[11px] font-semibold">🏅 Yönetici onaylı</span>'
    : '';

  var salesBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-700 text-zinc-300 text-[11px] font-medium">🎟️ ' + escapeHtml(formatSalesCountLabel(seller.sales_count || 0)) + '</span>';
  var purchaseBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-700 text-zinc-300 text-[11px] font-medium">🛒 ' + (seller.purchase_count || 0) + ' alış</span>';
  var ratingBadge = sellerReviewCount > 0
    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-700 text-zinc-300 text-[11px] font-medium">⭐ ' + sellerRating.toFixed(1) + ' (' + sellerReviewCount + ')</span>'
    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-700 text-zinc-400 text-[11px] font-medium">⭐ Değerlendirme yok</span>';

  return (
    '<article class="listing-card overflow-hidden rounded-2xl bg-surface-800 border border-white/5 shadow-card hover:border-accent/25 transition-all duration-300" data-search="' + escapeHtml(searchBlob) + '">' +
      '<div class="h-0.5 bg-gradient-to-r from-accent via-violet-500 to-accent-light"></div>' +
      '<div class="p-4">' +
        '<div class="flex items-start justify-between gap-2 mb-3">' +
          '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15 text-accent-light text-xs font-semibold">' +
            '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
            dateLabel +
          '</span>' +
          '<button type="button" class="btn-favorite p-2 -mr-1 -mt-1 rounded-full text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" aria-label="Favorilere ekle" data-artist="' + escapeHtml(listing.artist) + '">' +
            '<svg class="w-5 h-5 favorite-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>' +
          '</button>' +
        '</div>' +
        '<h3 class="font-display text-xl font-bold text-white leading-tight">' + escapeHtml(listing.artist) + '</h3>' +
        '<div class="mt-2 space-y-1">' +
          '<p class="flex items-center gap-2 text-sm text-zinc-300">' +
            '<svg class="w-4 h-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>' +
            escapeHtml(listing.venue) +
          '</p>' +
          '<p class="flex items-center gap-2 text-sm text-zinc-400">' +
            '<svg class="w-4 h-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' +
            escapeHtml(listing.city) +
          '</p>' +
          '<p class="flex items-center gap-2 text-sm text-zinc-400">' +
            '<svg class="w-4 h-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' +
            'Satıcı: ' +
            '<button type="button" class="btn-open-profile font-medium text-zinc-300 hover:text-white hover:underline transition-colors" data-profile-id="' + escapeHtml(sellerId) + '">' + sellerName + '</button>' +
          '</p>' +
          (listing.description ? '<p class="mt-1 text-sm text-zinc-500 leading-relaxed">' + escapeHtml(listing.description) + '</p>' : '') +
        '</div>' +
        '<div class="mt-3 flex flex-wrap gap-1.5">' +
          '<span class="px-2 py-0.5 rounded-md bg-surface-700 text-zinc-300 text-xs font-medium">' + escapeHtml(listing.ticket_type || '') + '</span>' +
          '<span class="px-2 py-0.5 rounded-md bg-surface-700 text-zinc-300 text-xs font-medium">' + Number(listing.quantity || 1) + ' bilet</span>' +
        '</div>' +
        '<div class="mt-3 flex flex-wrap items-center gap-1.5">' +
          badges + adminBadge + salesBadge + purchaseBadge + ratingBadge +
        '</div>' +
        '<div class="mt-3 flex flex-wrap items-center gap-2">' +
          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">' +
            '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>' +
            'Güvenli Havuz' +
          '</span>' +
        '</div>' +
        '<div class="mt-4 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">' +
          '<div>' +
            '<p class="text-[11px] uppercase tracking-wide text-zinc-500">Liste fiyatı</p>' +
            '<p class="text-2xl font-bold text-white">' + priceLabel + '</p>' +
            '<p class="text-xs text-zinc-500">bilet başına</p>' +
          '</div>' +
          '<div class="flex gap-2">' +
            '<button type="button" class="btn-offer flex-1 py-2.5 rounded-xl bg-gradient-to-r from-accent to-violet-600 text-white text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all" data-listing-id="' + listing.id + '" data-artist="' + escapeHtml(listing.artist) + '" data-price="' + listing.price + '">Teklif Ver</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}

function renderListings(listings) {
  var container = document.getElementById('listings');
  if (!container) return;

  if (!listings || listings.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Şu anda aktif ilan bulunmuyor.</p>';
    return;
  }

  container.innerHTML = listings.map(createListingCardHtml).join('');

  // Favori butonları (client-side mock, kalıcı değil)
  container.querySelectorAll('.btn-favorite').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var active = btn.classList.toggle('is-favorite');
      var icon = btn.querySelector('.favorite-icon');
      var artist = btn.getAttribute('data-artist');
      if (active) {
        btn.classList.remove('text-zinc-500');
        btn.classList.add('text-rose-400', 'bg-rose-500/10');
        btn.setAttribute('aria-label', 'Favorilerden çıkar');
        icon.setAttribute('fill', 'currentColor');
        showToast(artist + ' favorilere eklendi.');
      } else {
        btn.classList.add('text-zinc-500');
        btn.classList.remove('text-rose-400', 'bg-rose-500/10');
        btn.setAttribute('aria-label', 'Favorilere ekle');
        icon.setAttribute('fill', 'none');
        showToast(artist + ' favorilerden çıkarıldı.');
      }
    });
  });

  // Teklif ver butonlarını bağla
  container.querySelectorAll('.btn-offer').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var listingId = btn.getAttribute('data-listing-id');
      var artist = btn.getAttribute('data-artist');
      var price = btn.getAttribute('data-price');
      requireAuth(function () {
        openOfferModal(listingId, artist, price);
      });
    });
  });

  container.querySelectorAll('.btn-open-profile').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var profileId = btn.getAttribute('data-profile-id');
      if (!profileId) return;
      if (typeof openProfileModal === 'function') {
        openProfileModal(profileId);
      }
    });
  });
}

/* ---------- Arama / Filtre (mevcut arayüzle uyumlu) ---------- */
function filterListings() {
  var searchInput = document.getElementById('search-input');
  var noResults = document.getElementById('no-results');
  if (!searchInput) return;

  var query = searchInput.value.trim().toLowerCase();
  var cards = document.querySelectorAll('#listings .listing-card');
  var visibleCount = 0;

  cards.forEach(function (card) {
    var haystack = card.getAttribute('data-search') || card.textContent.toLowerCase();
    var match = !query || haystack.indexOf(query) !== -1;
    card.classList.toggle('hidden', !match);
    if (match) visibleCount++;
  });

  if (noResults) noResults.classList.toggle('hidden', visibleCount > 0 || cards.length === 0);
}

/* ---------- İlan Oluşturma (Bilet Sat) ---------- */
async function openSellModal() {
  var modal = document.getElementById('sell-modal');
  var form = document.getElementById('sell-form');
  if (form) form.reset();
  populateSellPayoutForm(null);
  openModalEl(modal);

  if (sb && AppState.user) {
    var payout = await loadSellerPayoutInfo();
    populateSellPayoutForm(payout);
  }
}

function closeSellModal() {
  var modal = document.getElementById('sell-modal');
  closeModalEl(modal);
}

async function submitNewListing(formData) {
  if (!sb || !AppState.user) throw new Error('Giriş yapmalısınız.');

  var payoutData = getSellPayoutFormData();
  if (!validateSellerPayoutInfo(payoutData)) {
    throw new Error('Satış yapabilmek için IBAN, telefon ve e-posta bilgilerini tamamlamalısın.');
  }

  var payoutSave = await saveSellerPayoutInfo(payoutData);
  if (payoutSave.error) {
    throw new Error('Payout bilgileri kaydedilemedi.');
  }

  var payload = {
    seller_id: AppState.user.id,
    artist: formData.artist,
    venue: formData.venue,
    city: formData.city,
    event_datetime: formData.eventDatetime,
    ticket_type: formData.ticketType,
    quantity: formData.quantity,
    price: formData.price,
    description: formData.description || null,
    status: 'pending',
  };

  const { data: sessionData } = await sb.auth.getSession();
  console.log("SESSION =", sessionData.session);
  console.log("AUTH USER ID =", sessionData.session?.user?.id);
  console.log("PAYLOAD SELLER ID =", payload.seller_id);

  var res = await sb.from('listings').insert(payload);
  if (res.error) throw res.error;
  return true;
}

function wireListingsUI() {
  var btnSellHeader = document.getElementById('btn-sell');
  var btnSellMobile = document.getElementById('btn-sell-mobile');
  var sellClose = document.getElementById('sell-close');
  var sellBackdrop = document.getElementById('sell-backdrop');
  var sellCancel = document.getElementById('sell-cancel');
  var sellForm = document.getElementById('sell-form');
  var searchInput = document.getElementById('search-input');

  function triggerSell() {
    requireAuth(openSellModal);
  }

  if (btnSellHeader) btnSellHeader.addEventListener('click', function (e) { e.preventDefault(); triggerSell(); });
  if (btnSellMobile) btnSellMobile.addEventListener('click', function (e) { e.preventDefault(); triggerSell(); });
  if (sellClose) sellClose.addEventListener('click', closeSellModal);
  if (sellBackdrop) sellBackdrop.addEventListener('click', closeSellModal);
  if (sellCancel) sellCancel.addEventListener('click', closeSellModal);
  if (searchInput) searchInput.addEventListener('input', filterListings);

  document.querySelectorAll('.filter-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var filter = chip.getAttribute('data-filter') || '';
      searchInput.value = filter;
      document.querySelectorAll('.filter-chip').forEach(function (c) {
        c.classList.remove('bg-accent', 'text-white');
        c.classList.add('bg-surface-800', 'border', 'border-white/10', 'text-zinc-300');
      });
      chip.classList.add('bg-accent', 'text-white');
      chip.classList.remove('bg-surface-800', 'border', 'border-white/10', 'text-zinc-300');
      filterListings();
    });
  });

  if (sellForm) {
    sellForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var submitBtn = document.getElementById('sell-submit');
      var errorEl = document.getElementById('sell-error');
      errorEl.classList.add('hidden');

      var dateVal = document.getElementById('sell-date').value; // datetime-local
      var formData = {
        artist: document.getElementById('sell-artist').value.trim(),
        venue: document.getElementById('sell-venue').value.trim(),
        city: document.getElementById('sell-city').value.trim(),
        eventDatetime: dateVal ? new Date(dateVal).toISOString() : null,
        ticketType: document.getElementById('sell-ticket-type').value.trim(),
        quantity: Number(document.getElementById('sell-quantity').value),
        price: Number(document.getElementById('sell-price').value),
        description: document.getElementById('sell-description').value.trim(),
      };

        if (!formData.artist || !formData.venue || !formData.city || !formData.eventDatetime || !formData.ticketType || !formData.quantity || !formData.price) {
        errorEl.textContent = 'Lütfen tüm zorunlu alanları doldurun.';
        errorEl.classList.remove('hidden');
        return;
      }

      const cutoffTime = new Date(
        Date.now() - EVENT_GRACE_HOURS * 60 * 60 * 1000
      );

      if (new Date(formData.eventDatetime) < cutoffTime) {
        errorEl.textContent = 'Bu etkinlik için ilan verme süresi dolmuş.';
        errorEl.classList.remove('hidden');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-60');
      try {
        await submitNewListing(formData);
        closeSellModal();
        showToast('İlanınız alındı! Onaylandıktan sonra ana sayfada görünecek.');
      } catch (err) {
        errorEl.textContent = (err && err.message) || 'İlan oluşturulurken bir hata oluştu.';
        errorEl.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60');
      }
    });
  }
}
