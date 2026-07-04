// ============================================================
// biletakas — Kullanıcı İşlemlerim
// ============================================================

async function fetchMyTransactions() {
  if (!sb || !AppState.user) return [];
  return fetchUserTransactions(AppState.user.id);
}

function renderMyTransactions(transactions) {
  var container = document.getElementById('my-transactions-list');
  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Henüz işleminiz yok.</p>';
    return;
  }

  container.innerHTML = transactions.map(function (txn) {
    var listing = txn.listing || {};
    var status = getUserFacingTransactionStatus(txn);
    var role = txn.buyer_id === AppState.user.id ? 'Alıcı' : 'Satıcı';

    return (
      '<div class="rounded-xl bg-surface-700/60 border border-white/5 p-3.5">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<p class="text-sm font-mono font-semibold text-accent-light">' + escapeHtml(txn.transaction_code) + '</p>' +
            '<p class="text-sm font-semibold text-white mt-1">' + escapeHtml(listing.artist || 'İlan') + '</p>' +
            '<p class="text-xs text-zinc-500 mt-0.5">' + role + '</p>' +
          '</div>' +
          '<span class="shrink-0 px-2 py-0.5 rounded-md border text-[11px] font-medium ' + status.cls + '">' + escapeHtml(status.text) + '</span>' +
        '</div>' +
        '<div class="mt-2 flex items-center justify-between">' +
          '<p class="text-lg font-bold text-white">' + formatPrice(txn.amount) + '</p>' +
          '<p class="text-[11px] text-zinc-500">' + formatTransactionDate(txn.created_at) + '</p>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function openMyTransactionsModal() {
  requireAuth(async function () {
    var modal = document.getElementById('my-transactions-modal');
    var list = document.getElementById('my-transactions-list');
    list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
    openModalEl(modal);
    var transactions = await fetchMyTransactions();
    renderMyTransactions(transactions);
  });
}

function closeMyTransactionsModal() {
  var modal = document.getElementById('my-transactions-modal');
  closeModalEl(modal);
}

function wireMyTransactionsUI() {
  var btnOpen = document.getElementById('btn-my-transactions');
  var btnClose = document.getElementById('my-transactions-close');
  var backdrop = document.getElementById('my-transactions-backdrop');

  if (btnOpen) btnOpen.addEventListener('click', openMyTransactionsModal);
  if (btnClose) btnClose.addEventListener('click', closeMyTransactionsModal);
  if (backdrop) backdrop.addEventListener('click', closeMyTransactionsModal);

  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('my-transactions-modal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeMyTransactionsModal();
  });
}
