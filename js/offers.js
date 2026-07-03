// ============================================================
// biletakas — Teklif Sistemi (Offers)
// ============================================================

var _currentOfferListing = { id: null, artist: '', price: 0 };

/* ---------- Teklif Modalı (Teklif Ver) ---------- */
function openOfferModal(listingId, artist, price) {
  _currentOfferListing = { id: listingId, artist: artist, price: Number(price) };

  var modal = document.getElementById('offer-modal');
  var subtitle = document.getElementById('offer-modal-subtitle');
  var listPriceHint = document.getElementById('offer-list-price');
  var amountInput = document.getElementById('offer-amount');

  subtitle.textContent = artist + ' — Liste fiyatı: ' + formatPrice(price);
  listPriceHint.textContent = 'İlan fiyatının altında bir teklif verebilirsiniz.';
  amountInput.value = '';

  openModalEl(modal);
  amountInput.focus();
}

function closeOfferModal() {
  var modal = document.getElementById('offer-modal');
  closeModalEl(modal);
}

async function submitOffer(amount) {
  if (!sb || !AppState.user) throw new Error('Giriş yapmalısınız.');
  if (!_currentOfferListing.id) throw new Error('İlan bulunamadı.');

  var expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  var res = await sb.from('offers').insert({
    listing_id: _currentOfferListing.id,
    buyer_id: AppState.user.id,
    amount: amount,
    status: 'pending',
    expires_at: expiresAt,
  }).select().single();

  if (res.error) throw res.error;
  return res.data;
}

function wireOfferModalUI() {
  var offerForm = document.getElementById('offer-form');
  var offerClose = document.getElementById('offer-close');
  var offerBackdrop = document.getElementById('offer-backdrop');
  var offerCancel = document.getElementById('offer-cancel');

  if (offerClose) offerClose.addEventListener('click', closeOfferModal);
  if (offerBackdrop) offerBackdrop.addEventListener('click', closeOfferModal);
  if (offerCancel) offerCancel.addEventListener('click', closeOfferModal);

  if (offerForm) {
    offerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var amountInput = document.getElementById('offer-amount');
      var amount = Number(amountInput.value);
      if (!amount || amount <= 0) {
        amountInput.focus();
        return;
      }
      var submitBtn = offerForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-60');
      try {
        await submitOffer(amount);
        closeOfferModal();
        showToast(_currentOfferListing.artist + ' için ' + formatPrice(amount) + ' teklifiniz gönderildi.');
      } catch (err) {
        showToast((err && err.message) || 'Teklif gönderilirken bir hata oluştu.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60');
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('offer-modal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeOfferModal();
  });
}

/* ---------- Tekliflerim (satıcıya gelen teklifler) ---------- */
async function fetchReceivedOffers() {
  if (!sb || !AppState.user) return [];

  var listingsRes = await sb.from('listings').select('id, artist, price').eq('seller_id', AppState.user.id);
  if (listingsRes.error || !listingsRes.data || listingsRes.data.length === 0) return [];

  var listingIds = listingsRes.data.map(function (l) { return l.id; });
  var listingsById = {};
  listingsRes.data.forEach(function (l) { listingsById[l.id] = l; });

  var offersRes = await sb
    .from('offers')
    .select('*, buyer:profiles(username, display_name)')
    .in('listing_id', listingIds)
    .order('created_at', { ascending: false });

  if (offersRes.error) {
    console.error('[biletakas] Teklifler çekilemedi:', offersRes.error);
    return [];
  }

  return (offersRes.data || []).map(function (o) {
    o._listing = listingsById[o.listing_id];
    return o;
  });
}

function offerStatusLabel(status) {
  switch (status) {
    case 'accepted': return { text: 'Kabul edildi', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'rejected': return { text: 'Reddedildi', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    case 'expired': return { text: 'Süresi doldu', cls: 'bg-white/5 text-zinc-500 border-white/10' };
    default: return { text: 'Beklemede', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' };
  }
}

function renderReceivedOffers(offers) {
  var container = document.getElementById('my-offers-list');
  if (!container) return;

  if (!offers || offers.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Henüz gelen teklif yok.</p>';
    return;
  }

  container.innerHTML = offers.map(function (o) {
    var listing = o._listing || {};
    var buyer = o.buyer || {};
    var status = offerStatusLabel(o.status);
    var buyerName = escapeHtml(buyer.display_name || buyer.username || 'Kullanıcı');
    var actions = o.status === 'pending'
      ? '<div class="mt-3 flex gap-2">' +
          '<button type="button" class="btn-offer-accept flex-1 py-2 rounded-lg bg-emerald-600/90 text-white text-xs font-semibold hover:bg-emerald-600 transition-all" data-offer-id="' + o.id + '">Kabul Et</button>' +
          '<button type="button" class="btn-offer-reject flex-1 py-2 rounded-lg bg-surface-700 border border-white/10 text-white text-xs font-semibold hover:bg-surface-600 transition-all" data-offer-id="' + o.id + '">Reddet</button>' +
        '</div>'
      : '';

    return (
      '<div class="rounded-xl bg-surface-700/60 border border-white/5 p-3.5">' +
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

  container.querySelectorAll('.btn-offer-accept').forEach(function (btn) {
    btn.addEventListener('click', function () { handleOfferDecision(btn.getAttribute('data-offer-id'), 'accepted'); });
  });
  container.querySelectorAll('.btn-offer-reject').forEach(function (btn) {
    btn.addEventListener('click', function () { handleOfferDecision(btn.getAttribute('data-offer-id'), 'rejected'); });
  });
}

async function handleOfferDecision(offerId, decision) {
  if (!sb) return;
  var res = await sb.from('offers').update({ status: decision }).eq('id', offerId);
  if (res.error) {
    showToast('İşlem başarısız oldu.');
    return;
  }
  showToast(decision === 'accepted' ? 'Teklif kabul edildi.' : 'Teklif reddedildi.');
  var offers = await fetchReceivedOffers();
  renderReceivedOffers(offers);
}

function openMyOffersModal() {
  requireAuth(async function () {
    var modal = document.getElementById('my-offers-modal');
    var list = document.getElementById('my-offers-list');
    list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
    openModalEl(modal);
    var offers = await fetchReceivedOffers();
    renderReceivedOffers(offers);
  });
}

function closeMyOffersModal() {
  var modal = document.getElementById('my-offers-modal');
  closeModalEl(modal);
}

function wireMyOffersUI() {
  var btnOpen = document.getElementById('btn-my-offers');
  var btnClose = document.getElementById('my-offers-close');
  var backdrop = document.getElementById('my-offers-backdrop');

  if (btnOpen) btnOpen.addEventListener('click', openMyOffersModal);
  if (btnClose) btnClose.addEventListener('click', closeMyOffersModal);
  if (backdrop) backdrop.addEventListener('click', closeMyOffersModal);

  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('my-offers-modal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeMyOffersModal();
  });
}
