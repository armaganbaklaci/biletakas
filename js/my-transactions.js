// ============================================================
// biletakas — Kullanıcı İşlemlerim
// ============================================================

var _myTransactionsCache = [];

async function fetchMyTransactions() {
  if (!sb || !AppState.user) return [];
  return fetchUserTransactions(AppState.user.id);
}

function renderSellerTicketSection(txn) {
  if (txn.seller_id !== AppState.user.id) return '';
  if (!canSellerUploadTicket(txn)) {
    if (txn.ticket_file_path && txn.ticket_uploaded_at) {
      return (
        '<div class="mt-3 border-t border-white/5 pt-3">' +
          '<p class="text-xs text-zinc-400">' +
            'Bilet yüklendi: ' + formatTransactionDate(txn.ticket_uploaded_at) +
            (isTicketVerified(txn) ? ' · Doğrulandı' : ' · Admin doğrulaması bekleniyor') +
          '</p>' +
          (txn.ticket_file_path
            ? '<button type="button" class="btn-txn-view-own-ticket mt-2 w-full py-2 rounded-lg bg-zinc-800 text-white text-xs font-semibold" data-id="' + txn.id + '">Bileti Gör / İndir</button>'
            : '') +
        '</div>'
      );
    }
    return '';
  }

  return (
    '<div class="mt-3 border-t border-white/5 pt-3">' +
      '<p class="text-xs font-medium text-zinc-300 mb-2">Bilet Dosyası Yükle</p>' +
      '<p class="text-[11px] text-zinc-500 mb-2">PDF, PNG, JPG veya JPEG · En fazla 10 MB</p>' +
      '<div class="flex flex-col sm:flex-row gap-2">' +
        '<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" ' +
          'class="txn-ticket-file flex-1 text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-surface-600 file:text-white file:text-xs file:font-semibold" ' +
          'data-id="' + txn.id + '">' +
        '<button type="button" class="btn-txn-upload shrink-0 py-2 px-3 rounded-lg bg-accent/90 text-white text-xs font-semibold hover:bg-accent transition-all" data-id="' + txn.id + '">' +
          (txn.ticket_file_path ? 'Yeniden Yükle' : 'Yükle') +
        '</button>' +
      '</div>' +
    '</div>'
  );
}

function renderBuyerPaymentSection(txn) {
  if (txn.buyer_id !== AppState.user.id) return '';
  if (txn.completion_status === 'cancelled') return '';

  var html = '';

  if (!isTicketVerified(txn)) {
    html += '<p class="mt-3 text-xs text-zinc-500">Ödeme bilgileri, bilet admin tarafından doğrulandıktan sonra görünecek.</p>';
    return html;
  }

  html += renderIbanCardHtml(txn);

  if (txn.payment_status === 'waiting_payment') {
    if (txn.receipt_file_path && txn.receipt_uploaded_at) {
      html += '<p class="mt-3 text-xs text-emerald-400">Dekont yüklendi. Admin onayı bekleniyor.</p>';
    } else {
      html += (
        '<div class="mt-3 rounded-xl border border-white/10 bg-surface-800/70 p-3">' +
          '<p class="text-[11px] font-medium text-zinc-300 mb-2">Dekont Yükle</p>' +
          '<p class="text-[11px] text-zinc-500 mb-2">PDF, PNG, JPG veya JPEG · En fazla 10 MB</p>' +
          '<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="txn-receipt-file w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-surface-600 file:text-white file:text-xs file:font-semibold" data-id="' + txn.id + '">' +
          '<textarea class="txn-receipt-note mt-2 w-full rounded-lg bg-surface-700 border border-white/10 px-3 py-2 text-xs text-zinc-200" rows="2" data-id="' + txn.id + '" placeholder="Ödeme notu (opsiyonel)"></textarea>' +
          '<button type="button" class="btn-txn-receipt mt-3 w-full py-2.5 rounded-lg bg-emerald-600/90 text-white text-xs font-semibold hover:bg-emerald-600 transition-all" data-id="' + txn.id + '">Dekontu Yükle</button>' +
        '</div>'
      );
    }
  }

  if (txn.payment_status === 'receipt_uploaded' && txn.receipt_file_path) {
    html += '<button type="button" class="btn-txn-paid mt-3 w-full py-2.5 rounded-lg bg-emerald-600/90 text-white text-xs font-semibold hover:bg-emerald-600 transition-all" data-id="' + txn.id + '">Ödeme Yaptım</button>';
  }

  if (!txn.dispute_reason && txn.completion_status === 'pending') {
    html += (
      '<div class="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">' +
        '<p class="text-[11px] font-medium text-amber-300 mb-2">Sorun Bildir</p>' +
        '<textarea class="txn-dispute-reason w-full rounded-lg bg-surface-700 border border-white/10 px-3 py-2 text-xs text-zinc-200" rows="3" data-id="' + txn.id + '" placeholder="Örn. Bilet kapıda okutulmadı, farklı bilet geldi..."></textarea>' +
        '<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="txn-dispute-file mt-2 w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-surface-600 file:text-white file:text-xs file:font-semibold" data-id="' + txn.id + '">' +
        '<button type="button" class="btn-txn-open-dispute mt-3 w-full py-2.5 rounded-lg bg-amber-600/90 text-white text-xs font-semibold hover:bg-amber-600 transition-all" data-id="' + txn.id + '">Sorun Bildir / Bilet Kapıda Okutulmadı</button>' +
      '</div>'
    );
  }

  if (txn.dispute_reason) {
    html += '<p class="mt-3 text-xs text-amber-300">Sorun bildirimi: ' + escapeHtml(txn.dispute_reason) + '</p>';
  }

  if (canBuyerAccessTicket(txn) && txn.completion_status === 'pending') {
    html += (
      '<button type="button" class="btn-txn-download-ticket mt-3 w-full py-2.5 rounded-lg bg-violet-600/90 text-white text-xs font-semibold hover:bg-violet-600 transition-all" data-id="' + txn.id + '">' +
        'Bileti İndir' +
      '</button>'
    );
  }

  if ((txn.ticket_status === 'ticket_sent_to_buyer' || txn.ticket_status === 'delivered_to_buyer')
      && txn.payment_status === 'payment_received'
      && txn.completion_status === 'pending') {
    html += (
      '<button type="button" class="btn-txn-confirm mt-3 w-full py-2.5 rounded-lg bg-blue-600/90 text-white text-xs font-semibold hover:bg-blue-600 transition-all" data-id="' + txn.id + '">' +
        'Bileti Aldım, Onaylıyorum' +
      '</button>'
    );
  }

  return html;
}

function renderMyTransactions(transactions) {
  var container = document.getElementById('my-transactions-list');
  if (!container) return;

  _myTransactionsCache = transactions || [];

  if (!transactions || transactions.length === 0) {
    container.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Henüz işleminiz yok.</p>';
    return;
  }

  container.innerHTML = transactions.map(function (txn) {
    var listing = txn.listing || {};
    var status = getUserFacingTransactionStatus(txn);
    var role = txn.buyer_id === AppState.user.id ? 'Alıcı' : 'Satıcı';

    var stepperHtml = renderTransactionStepper(txn);

    return (
      '<div class="rounded-xl bg-surface-700/60 border border-white/5 p-3.5" data-transaction-id="' + txn.id + '">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<p class="text-sm font-mono font-semibold text-accent-light">' + escapeHtml(txn.transaction_code) + '</p>' +
            '<p class="text-sm font-semibold text-white mt-1">' + escapeHtml(listing.artist || 'İlan') + '</p>' +
            '<p class="text-xs text-zinc-500 mt-0.5">' + role + '</p>' +
          '</div>' +
          '<span class="shrink-0 px-2 py-0.5 rounded-md border text-[11px] font-medium ' + status.cls + '">' + escapeHtml(status.text) + '</span>' +
        '</div>' +
        '<div class="mt-2 flex items-center justify-between">' +
          '<p class="text-lg font-bold text-white">' + formatPrice(getTransactionPricingBreakdown(txn).buyerTotalAmount) + '</p>' +
          '<p class="text-[11px] text-zinc-500">' + formatTransactionDate(txn.created_at) + '</p>' +
        '</div>' +
        stepperHtml +
        renderTransactionPricingSummaryHtml(txn, txn.seller_id === AppState.user.id ? 'seller' : 'buyer') +
        renderSellerTicketSection(txn) +
        renderBuyerPaymentSection(txn) +
      '</div>'
    );
  }).join('');

  wireMyTransactionEvents();
}

function wireMyTransactionEvents() {
  document.querySelectorAll('.btn-txn-upload').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleSellerTicketUpload(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-paid').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleBuyerPaymentNotify(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-receipt').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleBuyerReceiptUpload(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-confirm').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleBuyerConfirmReceipt(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-view-own-ticket').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleViewOwnTicketFile(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-download-ticket').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleBuyerDownloadTicket(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.btn-txn-open-dispute').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleBuyerOpenDispute(btn.getAttribute('data-id'));
    });
  });
}

async function handleSellerTicketUpload(transactionId) {
  var fileInput = document.querySelector('.txn-ticket-file[data-id="' + transactionId + '"]');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast('Lütfen bir bilet dosyası seçin.');
    return;
  }

  var btn = document.querySelector('.btn-txn-upload[data-id="' + transactionId + '"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
  }

  try {
    var res = await uploadSellerTicket(transactionId, fileInput.files[0]);
    if (res.error || !res.data) {
      showToast((res.error && res.error.message) || 'Bilet yüklenemedi.');
      return;
    }
    showToast('Bilet yüklendi. Admin doğrulaması bekleniyor.');
    var transactions = await fetchMyTransactions();
    renderMyTransactions(transactions);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
    }
  }
}

async function handleBuyerReceiptUpload(transactionId) {
  var fileInput = document.querySelector('.txn-receipt-file[data-id="' + transactionId + '"]');
  var noteInput = document.querySelector('.txn-receipt-note[data-id="' + transactionId + '"]');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast('Lütfen bir dekont dosyası seçin.');
    return;
  }

  var btn = document.querySelector('.btn-txn-receipt[data-id="' + transactionId + '"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
  }

  try {
    var res = await uploadBuyerReceipt(transactionId, fileInput.files[0], noteInput ? noteInput.value.trim() : '');
    if (res.error || !res.data) {
      showToast((res.error && res.error.message) || 'Dekont yüklenemedi.');
      return;
    }
    showToast('Dekont yüklendi. Admin onayı bekleniyor.');
    var transactions = await fetchMyTransactions();
    renderMyTransactions(transactions);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
    }
  }
}

async function handleViewOwnTicketFile(transactionId) {
  var txn = _myTransactionsCache.find(function (item) { return item.id === transactionId; });
  if (!txn || !txn.ticket_file_path) {
    showToast('Bilet dosyası bulunamadı.');
    return;
  }

  var url = await getTicketSignedUrl(txn.ticket_file_path, 3600);
  if (!url) {
    showToast('Bilet dosyası açılamadı.');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

async function handleBuyerDownloadTicket(transactionId) {
  var txn = _myTransactionsCache.find(function (item) { return item.id === transactionId; });
  if (!txn || !canBuyerAccessTicket(txn) || !txn.ticket_file_path) {
    showToast('Bilet şu anda indirilemez.');
    return;
  }

  var url = await getTicketSignedUrl(txn.ticket_file_path, 3600);
  if (!url) {
    showToast('Bilet dosyası açılamadı.');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

async function handleBuyerPaymentNotify(transactionId) {
  var ok = confirm('Ödemeyi yaptığınızı onaylıyor musunuz? Admin banka hareketini kontrol edecek.');
  if (!ok) return;

  var res = await buyerNotifyPayment(transactionId);
  if (res.error || !res.data) {
    showToast((res.error && res.error.message) || 'Bildirim gönderilemedi.');
    return;
  }

  showToast('Ödeme bildirimin alındı. Admin onayı bekleniyor.');
  var transactions = await fetchMyTransactions();
  renderMyTransactions(transactions);
}

async function handleBuyerOpenDispute(transactionId) {
  var reasonInput = document.querySelector('.txn-dispute-reason[data-id="' + transactionId + '"]');
  var fileInput = document.querySelector('.txn-dispute-file[data-id="' + transactionId + '"]');
  var reason = reasonInput ? reasonInput.value : '';
  var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

  var btn = document.querySelector('.btn-txn-open-dispute[data-id="' + transactionId + '"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
  }

  try {
    var res = await openBuyerDispute(transactionId, reason, file);
    if (res.error || !res.data) {
      showToast((res.error && res.error.message) || 'Sorun bildirimi oluşturulamadı.');
      return;
    }
    showToast('Sorun bildirimi oluşturuldu. Admin inceleyecek.');
    var transactions = await fetchMyTransactions();
    renderMyTransactions(transactions);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
    }
  }
}

async function handleBuyerConfirmReceipt(transactionId) {
  var ok = confirm('Bileti aldığınızı ve işlemi onayladığınızı beyan ediyor musunuz?');
  if (!ok) return;

  var res = await updateTransactionFields(transactionId, {
    completion_status: 'buyer_confirmed'
  });

  if (res.error || !res.data) {
    showToast((res.error && res.error.message) || 'Onay kaydedilemedi.');
    return;
  }

  await writeTransactionLog(
    'buyer_confirmed',
    'Alıcı bileti aldığını onayladı — ' + (res.data.transaction_code || ''),
    { transaction_id: res.data.id, transaction_code: res.data.transaction_code }
  );

  showToast('Onayınız kaydedildi.');
  var transactions = await fetchMyTransactions();
  renderMyTransactions(transactions);
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
