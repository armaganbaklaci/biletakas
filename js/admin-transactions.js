// ============================================================
// biletakas — Admin Transactions Sekmesi
// ============================================================

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


var _allAdminTransactions = [];
var _sellerPayoutCache = {};

function isDisputedTransaction(txn) {
  return !!txn && ((txn.dispute_status && txn.dispute_status !== 'none') || !!txn.dispute_reason || !!txn.dispute_category);
}

function formatDisputeCategoryLabel(value) {
  var labels = {
    invalid_ticket: 'Bilet geçersizdi',
    left_at_gate: 'Kapıda kaldım',
    used_before: 'Bilet daha önce kullanılmıştı',
    wrong_ticket: 'Yanlış bilet gönderildi',
    other: 'Diğer'
  };
  return labels[value] || value || 'Belirtilmedi';
}

async function fetchSellerPayoutInfoForUser(userId) {
  if (!sb || !userId) return null;
  if (_sellerPayoutCache[userId]) return _sellerPayoutCache[userId];

  var res = await sb
    .from('seller_payout_methods')
    .select('full_name, iban, account_name, bank_name, phone, email, is_verified, payout_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    console.error('[biletakas] Satıcı payout bilgisi çekilemedi:', res.error);
    return null;
  }

  _sellerPayoutCache[userId] = res.data || null;
  return _sellerPayoutCache[userId];
}

async function hydrateAdminTransactionSellerPayouts(transactions) {
  if (!Array.isArray(transactions)) return;

  for (var i = 0; i < transactions.length; i++) {
    var txn = transactions[i];
    if (!txn || !txn.seller_id || txn._sellerPayout) continue;
    txn._sellerPayout = await fetchSellerPayoutInfoForUser(txn.seller_id);
  }
}

async function loadAdminTransactions() {
  var container = document.getElementById('admin-transactions-list');
  if (!container) return;

  _allAdminTransactions = await fetchAllTransactions();
  await hydrateAdminTransactionSellerPayouts(_allAdminTransactions);
  renderAdminTransactionsShell();
  renderAdminTransactions();
}

async function loadAdminDisputes() {
  var container = document.getElementById('admin-disputes-list');
  if (!container) return;

  if (!_allAdminTransactions.length) {
    _allAdminTransactions = await fetchAllTransactions();
    await hydrateAdminTransactionSellerPayouts(_allAdminTransactions);
  }

  renderAdminDisputesShell();
  renderAdminDisputes();
}

function renderAdminTransactionsShell() {
  var container = document.getElementById('admin-transactions-list');
  if (!container) return;

  container.innerHTML =
    '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4 mb-2 grid md:grid-cols-2 gap-3">' +
      '<input id="txn-search" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm" placeholder="İşlem kodu, kullanıcı veya sanatçı ara...">' +
      '<select id="txn-filter" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm">' +
        TRANSACTION_FILTER_OPTIONS.map(function (opt) {
          return '<option value="' + opt.value + '">' + escapeHtml(opt.label) + '</option>';
        }).join('') +
      '</select>' +
    '</div>' +
    '<div id="txn-results" class="grid gap-4"></div>';

  var searchEl = document.getElementById('txn-search');
  var filterEl = document.getElementById('txn-filter');

  if (searchEl) searchEl.addEventListener('input', renderAdminTransactions);
  if (filterEl) filterEl.addEventListener('change', renderAdminTransactions);
}

function renderAdminTransactions() {
  var resultsEl = document.getElementById('txn-results');
  if (!resultsEl) return;

  var q = (document.getElementById('txn-search')?.value || '').trim();
  var filter = document.getElementById('txn-filter')?.value || 'all';

  var rows = _allAdminTransactions.filter(function (txn) {
    return matchesTransactionSearch(txn, q) && matchesTransactionFilter(txn, filter);
  });

  resultsEl.innerHTML = rows.length
    ? rows.map(createAdminTransactionHtml).join('')
    : '<p class="text-zinc-500">Filtreye uygun işlem yok.</p>';

  wireAdminTransactionEvents();
}

function renderAdminDisputesShell() {
  var container = document.getElementById('admin-disputes-list');
  if (!container) return;

  container.innerHTML =
    '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4 mb-2 grid md:grid-cols-2 gap-3">' +
      '<input id="dispute-search" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm" placeholder="İtiraz kodu, kullanıcı veya sanatçı ara...">' +
      '<select id="dispute-filter" class="rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm">' +
        '<option value="all">Tümü</option>' +
        '<option value="open">Açık</option>' +
        '<option value="under_review">İncelemede</option>' +
        '<option value="resolved">Çözüldü</option>' +
        '<option value="rejected">Reddedildi</option>' +
      '</select>' +
    '</div>' +
    '<div id="dispute-results" class="grid gap-4"></div>';

  var searchEl = document.getElementById('dispute-search');
  var filterEl = document.getElementById('dispute-filter');
  if (searchEl) searchEl.addEventListener('input', renderAdminDisputes);
  if (filterEl) filterEl.addEventListener('change', renderAdminDisputes);
}

function renderAdminDisputes() {
  var resultsEl = document.getElementById('dispute-results');
  if (!resultsEl) return;

  var q = (document.getElementById('dispute-search')?.value || '').trim();
  var filter = document.getElementById('dispute-filter')?.value || 'all';

  var rows = _allAdminTransactions.filter(function (txn) {
    var statusMatch = filter === 'all' || txn.dispute_status === filter;
    return isDisputedTransaction(txn) && statusMatch && matchesTransactionSearch(txn, q);
  });

  resultsEl.innerHTML = rows.length
    ? rows.map(createAdminDisputeHtml).join('')
    : '<p class="text-zinc-500">İtiraz kaydı bulunamadı.</p>';

  wireAdminTransactionEvents();
}

function createAdminDisputeHtml(txn) {
  var listing = txn.listing || {};
  var buyer = txn.buyer || {};
  var seller = txn.seller || {};
  var sellerPayout = txn._sellerPayout || {};
  var actions = getEnabledAdminActions(txn);
  var categoryLabel = formatDisputeCategoryLabel(txn.dispute_category);

  function actionBtn(key, label, colorClass) {
    var enabled = actions[key];
    var disabledCls = enabled ? '' : ' opacity-40 cursor-not-allowed';
    var disabledAttr = enabled ? '' : ' disabled';
    return '<button type="button" class="btn-txn-action px-3 py-2 rounded-lg text-xs font-semibold ' + colorClass + disabledCls + '" data-id="' + txn.id + '" data-action="' + key + '"' + disabledAttr + '>' + escapeHtml(label) + '</button>';
  }

  return (
    '<div class="rounded-xl bg-zinc-900 border border-amber-500/20 p-4" data-transaction-id="' + txn.id + '">' +
      '<div class="flex flex-col lg:flex-row lg:justify-between gap-4">' +
        '<div class="flex-1">' +
          '<div class="flex flex-wrap items-center gap-2 mb-1">' +
            '<h3 class="text-lg font-bold font-mono">' + escapeHtml(txn.transaction_code) + '</h3>' +
            txnCompletionStatusBadge(txn.completion_status) +
            txnPaymentStatusBadge(txn.payment_status) +
            txnTicketStatusBadge(txn.ticket_status) +
          '</div>' +
          '<p class="text-sm text-zinc-400">Sanatçı: <span class="text-white">' + escapeHtml(listing.artist || '-') + '</span></p>' +
          '<p class="text-sm text-zinc-400">Alıcı: ' + escapeHtml(profileDisplayName(buyer)) + ' · Satıcı: ' + escapeHtml(profileDisplayName(seller)) + '</p>' +
          '<div class="mt-2 flex flex-wrap gap-2">' +
            '<span class="px-2 py-1 rounded-lg text-xs border bg-amber-500/10 border-amber-500/20 text-amber-300">İtiraz</span>' +
            '<span class="px-2 py-1 rounded-lg text-xs border bg-zinc-800 border-white/10 text-zinc-300">' + escapeHtml(categoryLabel) + '</span>' +
          '</div>' +
          '<p class="text-xs text-zinc-500 mt-2">Açılma: ' + formatTransactionDate(txn.dispute_created_at || txn.updated_at || txn.created_at) + '</p>' +
          (txn.dispute_requested_at ? '<p class="text-xs text-zinc-500">Ek kanıt istendi: ' + formatTransactionDate(txn.dispute_requested_at) + '</p>' : '') +
          (txn.dispute_description ? '<p class="text-sm text-zinc-300 mt-3">Açıklama: ' + escapeHtml(txn.dispute_description) + '</p>' : '') +
          (txn.dispute_reason ? '<p class="text-sm text-zinc-300 mt-2">Detay: ' + escapeHtml(txn.dispute_reason) + '</p>' : '') +
          (txn.dispute_evidence_path ? '<div class="mt-3"><button type="button" class="btn-txn-view-dispute px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold" data-path="' + escapeHtml(txn.dispute_evidence_path) + '">Kanıtı Gör / İndir</button></div>' : '') +
        '</div>' +
        '<div class="lg:text-right">' +
          '<p class="text-2xl font-bold">' + formatTransactionAmount(getTransactionPricingBreakdown(txn).buyerTotalAmount) + '</p>' +
          '<p class="text-sm text-emerald-300">Net satıcı: ' + formatTransactionAmount(getTransactionPricingBreakdown(txn).sellerPayoutAmount) + '</p>' +
        '</div>' +
      '</div>' +
      (sellerPayout.iban || sellerPayout.phone || sellerPayout.email
        ? '<div class="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">' +
            '<p class="text-[11px] uppercase tracking-wide text-emerald-300 font-semibold mb-1">Satıcı Payout Bilgileri</p>' +
            (sellerPayout.full_name ? '<p class="text-white">' + escapeHtml(sellerPayout.full_name) + '</p>' : '') +
            (sellerPayout.iban ? '<p class="text-zinc-300 mt-1">IBAN: ' + escapeHtml(sellerPayout.iban) + '</p>' : '') +
            (sellerPayout.account_name ? '<p class="text-zinc-300">Hesap Adı: ' + escapeHtml(sellerPayout.account_name) + '</p>' : '') +
            (sellerPayout.bank_name ? '<p class="text-zinc-300">Banka: ' + escapeHtml(sellerPayout.bank_name) + '</p>' : '') +
            (sellerPayout.phone ? '<p class="text-zinc-300">Telefon: ' + escapeHtml(sellerPayout.phone) + '</p>' : '') +
            (sellerPayout.email ? '<p class="text-zinc-300">E-posta: ' + escapeHtml(sellerPayout.email) + '</p>' : '') +
          '</div>'
        : '') +
      '<div class="mt-4 flex flex-wrap gap-2">' +
        actionBtn('buyer_refunded', 'İade Et', 'bg-rose-700 hover:bg-rose-600') +
        actionBtn('seller_paid', 'Satıcıya Ödeme Yap', 'bg-emerald-600 hover:bg-emerald-500') +
        actionBtn('request_additional_evidence', 'Ek Kanıt İste', 'bg-amber-600 hover:bg-amber-500') +
      '</div>' +
    '</div>'
  );
}

function createAdminTransactionHtml(txn) {
  var listing = txn.listing || {};
  var buyer = txn.buyer || {};
  var seller = txn.seller || {};
  var sellerPayout = txn._sellerPayout || {};
  var actions = getEnabledAdminActions(txn);
  var payoutStatusLabel = txn.payout_status ? payoutStatusBadgeHtml(txn.payout_status) : '';
  var breakdown = getTransactionPricingBreakdown(txn);

  function actionBtn(key, label, colorClass) {
    var enabled = actions[key];
    var disabledCls = enabled ? '' : ' opacity-40 cursor-not-allowed';
    var disabledAttr = enabled ? '' : ' disabled';
    return '<button type="button" class="btn-txn-action px-3 py-2 rounded-lg text-xs font-semibold ' + colorClass + disabledCls + '" data-id="' + txn.id + '" data-action="' + key + '"' + disabledAttr + '>' + escapeHtml(label) + '</button>';
  }

  return (
    '<div class="rounded-xl bg-zinc-900 border border-white/10 p-4" data-transaction-id="' + txn.id + '">' +
      '<div class="flex flex-col lg:flex-row lg:justify-between gap-4">' +
        '<div class="flex-1">' +
          '<div class="flex flex-wrap items-center gap-2 mb-1">' +
            '<h3 class="text-lg font-bold font-mono">' + escapeHtml(txn.transaction_code) + '</h3>' +
            txnCompletionStatusBadge(txn.completion_status) +
          '</div>' +
          '<p class="text-sm text-zinc-400">Sanatçı: <span class="text-white">' + escapeHtml(listing.artist || '-') + '</span></p>' +
          '<p class="text-sm text-zinc-400">Alıcı: ' + escapeHtml(profileDisplayName(buyer)) + ' · Satıcı: ' + escapeHtml(profileDisplayName(seller)) + '</p>' +
          '<div class="mt-2 flex flex-wrap gap-2">' +
            txnPaymentStatusBadge(txn.payment_status) +
            txnTicketStatusBadge(txn.ticket_status) +
            '<span class="px-2 py-1 rounded-lg text-xs border bg-zinc-800 border-white/10 text-zinc-300">' + escapeHtml(PAYMENT_METHOD_LABELS[txn.payment_method] || txn.payment_method) + '</span>' +
          '</div>' +
          '<p class="text-xs text-zinc-500 mt-2">Oluşturulma: ' + formatTransactionDate(txn.created_at) + '</p>' +
          (txn.ticket_uploaded_at ? '<p class="text-xs text-zinc-500">Bilet yüklendi: ' + formatTransactionDate(txn.ticket_uploaded_at) + '</p>' : '') +
          (txn.ticket_verified_at ? '<p class="text-xs text-emerald-500/80">Bilet doğrulandı: ' + formatTransactionDate(txn.ticket_verified_at) + '</p>' : '') +
          (txn.buyer_payment_notified_at ? '<p class="text-xs text-yellow-500/80">Alıcı ödeme bildirdi: ' + formatTransactionDate(txn.buyer_payment_notified_at) + '</p>' : '') +
        '</div>' +
        '<div class="lg:text-right">' +
          '<p class="text-2xl font-bold">' + formatTransactionAmount(breakdown.buyerTotalAmount) + '</p>' +
          '<p class="text-sm text-emerald-300">Net satıcı: ' + formatTransactionAmount(breakdown.sellerPayoutAmount) + '</p>' +
        '</div>' +
      '</div>' +
      (txn.ticket_file_path
        ? '<div class="mt-3 flex flex-wrap gap-2">' +
            '<button type="button" class="btn-txn-view-ticket px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold" data-id="' + txn.id + '" data-path="' + escapeHtml(txn.ticket_file_path) + '">Bileti Gör / İndir</button>' +
          '</div>'
        : '<p class="mt-3 text-xs text-zinc-500">Henüz bilet dosyası yüklenmedi.</p>') +
      (txn.receipt_file_path
        ? '<div class="mt-3 flex flex-wrap gap-2">' +
            '<button type="button" class="btn-txn-view-receipt px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold" data-id="' + txn.id + '" data-path="' + escapeHtml(txn.receipt_file_path) + '">Dekontu Gör / İndir</button>' +
          '</div>'
        : '<p class="mt-3 text-xs text-zinc-500">Henüz dekont yüklenmedi.</p>') +
      (txn.payment_note ? '<p class="mt-2 text-xs text-zinc-400">Dekont notu: ' + escapeHtml(txn.payment_note) + '</p>' : '') +
      (txn.dispute_reason ? '<div class="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm">' +
        '<p class="text-[11px] uppercase tracking-wide text-amber-300 font-semibold mb-1">Dispute / İade Bilgisi</p>' +
        '<p class="text-white">' + escapeHtml(txn.dispute_reason) + '</p>' +
        (txn.dispute_evidence_path ? '<button type="button" class="btn-txn-view-dispute mt-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold" data-path="' + escapeHtml(txn.dispute_evidence_path) + '">Kanıtı Gör / İndir</button>' : '') +
        (txn.dispute_created_at ? '<p class="text-[11px] text-zinc-400 mt-2">Açılma: ' + formatTransactionDate(txn.dispute_created_at) + '</p>' : '') +
      '</div>' : '') +
      (sellerPayout.iban || sellerPayout.phone || sellerPayout.email
        ? '<div class="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">' +
            '<p class="text-[11px] uppercase tracking-wide text-emerald-300 font-semibold mb-1">Satıcı Payout Bilgileri</p>' +
            (sellerPayout.full_name ? '<p class="text-white">' + escapeHtml(sellerPayout.full_name) + '</p>' : '') +
            (sellerPayout.iban ? '<p class="text-zinc-300 mt-1">IBAN: ' + escapeHtml(sellerPayout.iban) + '</p>' : '') +
            (sellerPayout.account_name ? '<p class="text-zinc-300">Hesap Adı: ' + escapeHtml(sellerPayout.account_name) + '</p>' : '') +
            (sellerPayout.bank_name ? '<p class="text-zinc-300">Banka: ' + escapeHtml(sellerPayout.bank_name) + '</p>' : '') +
            (sellerPayout.phone ? '<p class="text-zinc-300">Telefon: ' + escapeHtml(sellerPayout.phone) + '</p>' : '') +
            (sellerPayout.email ? '<p class="text-zinc-300">E-posta: ' + escapeHtml(sellerPayout.email) + '</p>' : '') +
          '</div>'
        : '') +
      renderTransactionPricingSummaryHtml(txn, 'admin') +
      renderTransactionStepper(txn) +
      '<div class="mt-3 rounded-lg border border-white/10 bg-zinc-950/70 p-3">' +
        '<div class="flex items-center justify-between gap-2">' +
          '<p class="text-[11px] uppercase tracking-wide text-zinc-400 font-semibold">Payout durumu</p>' +
          (payoutStatusLabel || '') +
        '</div>' +
        '<label class="mt-3 block text-[11px] font-medium text-zinc-400">Payout dekontu (PDF/JPG/PNG)</label>' +
        '<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="txn-payout-receipt-file mt-2 w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-surface-600 file:text-white file:text-xs file:font-semibold" data-id="' + txn.id + '">' +
      '</div>' +
      '<div class="mt-4 flex flex-wrap gap-2">' +
        actionBtn('refund_approved', '✓ İade Onayla', 'bg-amber-600 hover:bg-amber-500') +
        actionBtn('refund_rejected', '✕ İade Reddet', 'bg-rose-600 hover:bg-rose-500') +
        actionBtn('buyer_refunded', '↩ Alıcıya İade Yap', 'bg-rose-700 hover:bg-rose-600') +
        actionBtn('seller_paid', '✓ Satıcıya Ödeme Yap', 'bg-emerald-600 hover:bg-emerald-500') +
        actionBtn('ticket_verified', '✓ Bilet Doğrulandı', 'bg-indigo-600 hover:bg-indigo-500') +
        actionBtn('payment_received', '✓ Ödeme Geldi', 'bg-emerald-600 hover:bg-emerald-500') +
        actionBtn('payment_rejected', '✕ Ödeme Reddedildi', 'bg-rose-600 hover:bg-rose-500') +
        actionBtn('release_ticket_to_buyer', '🔓 Bileti Alıcıya Aç', 'bg-violet-600 hover:bg-violet-500') +
        actionBtn('buyer_confirmed', '✓ Alıcı Girişi Onayladı', 'bg-blue-600 hover:bg-blue-500') +
        actionBtn('money_sent_to_seller', '✓ Satıcıya ödeme gönderildi', 'bg-indigo-600 hover:bg-indigo-500') +
        actionBtn('completed', '✓ İşlem Tamamlandı', 'bg-emerald-700 hover:bg-emerald-600') +
        actionBtn('cancelled', '✓ İptal', 'bg-red-600 hover:bg-red-500') +
      '</div>' +
      '<div class="mt-4 border-t border-white/5 pt-4">' +
        '<label class="block text-xs font-medium text-zinc-400 mb-2">Admin Notu</label>' +
        '<div class="flex flex-col sm:flex-row gap-2">' +
          '<textarea class="txn-admin-note flex-1 rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm min-h-[72px]" data-id="' + txn.id + '" placeholder="Örn. WhatsApp üzerinden doğrulandı.">' + escapeHtml(txn.admin_note || '') + '</textarea>' +
          '<button type="button" class="btn-txn-note px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold shrink-0" data-id="' + txn.id + '">Notu Kaydet</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function wireAdminTransactionEvents() {
  const TXN_CONFIRM_MESSAGES = {
  ticket_verified: 'Bileti doğruladığına emin misin?',
  payment_received: 'Ödemenin geldiğine emin misin?',
  payment_rejected: 'Ödemeyi reddetmek istediğine emin misin?',
  release_ticket_to_buyer: 'Bileti alıcıya açmak istediğine emin misin?',
  ticket_sent_to_buyer: 'Bileti alıcıya gönderildi olarak işaretlemek istediğine emin misin?',
  buyer_confirmed: 'Alıcının işlemi onayladığına emin misin?',
  completed: 'İşlemi tamamlamak istediğine emin misin?',
  cancelled: 'İşlemi iptal etmek istediğine emin misin?'
};

document.querySelectorAll('.btn-txn-action').forEach(function (btn) {
  if (btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', function () {
    const action = btn.dataset.action;
    const message = TXN_CONFIRM_MESSAGES[action];

    if (message && !window.confirm(message)) return;

    handleAdminTransactionAction(btn.dataset.id, action);
  });
});

  document.querySelectorAll('.btn-txn-note').forEach(function (btn) {
  if (btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
    btn.addEventListener('click', function () {
      handleSaveTransactionNote(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-view-ticket').forEach(function (btn) {
  if (btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
    btn.addEventListener('click', function () {
      handleViewTicketFile(btn.getAttribute('data-path'));
    });
  });

  document.querySelectorAll('.btn-txn-view-receipt').forEach(function (btn) {
  if (btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
    btn.addEventListener('click', function () {
      handleViewReceiptFile(btn.getAttribute('data-path'));
    });
  });

  document.querySelectorAll('.btn-txn-view-dispute').forEach(function (btn) {
  if (btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
    btn.addEventListener('click', function () {
      handleViewDisputeEvidenceFile(btn.getAttribute('data-path'));
    });
  });
}

async function handleAdminTransactionAction(transactionId, action) {
  if (!transactionId || !action) return;

  var txn = _allAdminTransactions.find(function (t) { return t.id === transactionId; });
  var enabled = getEnabledAdminActions(txn);
  if (!enabled[action]) return;

  if (action === 'cancelled') {
    var ok = confirm('Bu işlemi iptal etmek istediğinize emin misiniz?');
    if (!ok) return;
  }

  if (action === 'money_sent_to_seller') {
    var payoutFileInput = document.querySelector('.txn-payout-receipt-file[data-id="' + transactionId + '"]');
    if (payoutFileInput && payoutFileInput.files && payoutFileInput.files[0]) {
      var payoutReceiptRes = await uploadPayoutReceipt(transactionId, payoutFileInput.files[0]);
      if (payoutReceiptRes.error || !payoutReceiptRes.data) {
        alert('Payout dekontu yüklenemedi: ' + ((payoutReceiptRes.error && payoutReceiptRes.error.message) || 'Bilinmeyen hata'));
        return;
      }
    }
  }

  var res = await applyAdminTransactionAction(transactionId, action, txn, addLog);
  if (res.error || !res.data) {
    alert('İşlem güncellenemedi: ' + ((res.error && res.error.message) || 'Bilinmeyen hata'));
    return;
  }

  var idx = _allAdminTransactions.findIndex(function (t) { return t.id === transactionId; });
  if (idx !== -1) _allAdminTransactions[idx] = res.data;

  renderAdminTransactions();

  if (typeof loadAdminLogs === 'function') loadAdminLogs();
  if (typeof loadAdminStats === 'function') loadAdminStats();
}

async function handleSaveTransactionNote(transactionId) {
  var textarea = document.querySelector('.txn-admin-note[data-id="' + transactionId + '"]');
  if (!textarea) return;

  var res = await saveTransactionAdminNote(transactionId, textarea.value.trim());
  if (res.error || !res.data) {
    alert('Not kaydedilemedi: ' + ((res.error && res.error.message) || 'Bilinmeyen hata'));
    return;
  }

  var idx = _allAdminTransactions.findIndex(function (t) { return t.id === transactionId; });
  if (idx !== -1) _allAdminTransactions[idx] = res.data;

  textarea.value = res.data.admin_note || '';
}

async function handleViewTicketFile(filePath) {
  if (!filePath) {
    alert('Bilet dosyası bulunamadı.');
    return;
  }

  var url = await getTicketSignedUrl(filePath, 3600);
  if (!url) {
    alert('Bilet dosyası açılamadı.');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
async function handleViewDisputeEvidenceFile(filePath) {
  if (!filePath) {
    alert('Kanıt dosyası bulunamadı.');
    return;
  }

  var url = await getReceiptSignedUrl(filePath, 3600);
  if (!url) {
    alert('Kanıt dosyası açılamadı.');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
async function handleViewReceiptFile(filePath) {
  if (!filePath) {
    alert('Dekont dosyası bulunamadı.');
    return;
  }

  var url = await getReceiptSignedUrl(filePath, 3600);
  if (!url) {
    alert('Dekont dosyası açılamadı.');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}