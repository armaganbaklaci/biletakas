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

async function loadAdminTransactions() {
  var container = document.getElementById('admin-transactions-list');
  if (!container) return;

  _allAdminTransactions = await fetchAllTransactions();
  renderAdminTransactionsShell();
  renderAdminTransactions();
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

function createAdminTransactionHtml(txn) {
  var listing = txn.listing || {};
  var buyer = txn.buyer || {};
  var seller = txn.seller || {};
  var actions = getEnabledAdminActions(txn);

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
          '<p class="text-2xl font-bold">' + formatTransactionAmount(txn.amount) + '</p>' +
        '</div>' +
      '</div>' +
      (txn.ticket_file_path
        ? '<div class="mt-3 flex flex-wrap gap-2">' +
            '<button type="button" class="btn-txn-view-ticket px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold" data-id="' + txn.id + '" data-path="' + escapeHtml(txn.ticket_file_path) + '">Bileti Gör / İndir</button>' +
          '</div>'
        : '<p class="mt-3 text-xs text-zinc-500">Henüz bilet dosyası yüklenmedi.</p>') +
      '<div class="mt-4 flex flex-wrap gap-2">' +
        actionBtn('ticket_verified', '✓ Bilet Doğrulandı', 'bg-indigo-600 hover:bg-indigo-500') +
        actionBtn('payment_received', '✓ Ödeme Geldi', 'bg-emerald-600 hover:bg-emerald-500') +
        actionBtn('ticket_sent_to_buyer', '✓ Alıcıya Gönderildi', 'bg-violet-600 hover:bg-violet-500') +
        actionBtn('buyer_confirmed', '✓ Alıcı Onayladı', 'bg-blue-600 hover:bg-blue-500') +
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
  ticket_sent_to_buyer: 'Bileti alıcıya gönderildi olarak işaretlemek istediğine emin misin?',
  buyer_confirmed: 'Alıcının işlemi onayladığına emin misin?',
  completed: 'İşlemi tamamlamak istediğine emin misin?',
  cancelled: 'İşlemi iptal etmek istediğine emin misin?'
};

document.querySelectorAll('.btn-txn-action').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const action = btn.dataset.action;
    const message = TXN_CONFIRM_MESSAGES[action];

    if (message && !window.confirm(message)) return;

    handleAdminTransactionAction(btn.dataset.id, action);
  });
});

  document.querySelectorAll('.btn-txn-note').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleSaveTransactionNote(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-view-ticket').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleViewTicketFile(btn.getAttribute('data-path'));
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

  var res = await applyAdminTransactionAction(transactionId, action, addLog);
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