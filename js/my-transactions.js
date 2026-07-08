// ============================================================
// biletakas — Kullanıcı İşlemlerim
// ============================================================

var _myTransactionsCache = [];
var _myTransactionReviewsCache = {};

async function fetchMyTransactions() {
  if (!sb || !AppState.user) return [];
  return fetchUserTransactions(AppState.user.id);
}

async function fetchMyTransactionReviews(transactions) {
  if (!sb || !AppState.user) return {};

  var ids = (transactions || [])
    .map(function (txn) { return txn.id; })
    .filter(Boolean);

  if (!ids.length) return {};

  var res = await sb
    .from('profile_reviews')
    .select('transaction_id, reviewed_user_id, rating, review_text, created_at')
    .eq('reviewer_id', AppState.user.id)
    .in('transaction_id', ids)
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error('[biletakas] İşlem değerlendirmeleri çekilemedi:', res.error);
    return {};
  }

  var map = {};
  (res.data || []).forEach(function (review) {
    if (review && review.transaction_id) map[review.transaction_id] = review;
  });
  return map;
}

async function refreshMyTransactionsModal() {
  var transactions = await fetchMyTransactions();
  _myTransactionReviewsCache = await fetchMyTransactionReviews(transactions);
  renderMyTransactions(transactions, _myTransactionReviewsCache);
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

function renderBuyerDisputeSection(txn) {
  if (txn.buyer_id !== AppState.user.id) return '';
  if (txn.dispute_status === 'under_review' && txn.dispute_requested_at) {
    return (
      '<div class="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">' +
        '<p class="text-[11px] font-medium text-amber-300 mb-2">Ek kanıt istendi</p>' +
        '<p class="text-[11px] text-zinc-400 mb-2">İtirazın incelenmesi için ek dosya yükleyebilirsin.</p>' +
        '<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="txn-dispute-evidence-file w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-surface-600 file:text-white file:text-xs file:font-semibold" data-id="' + txn.id + '">' +
        '<button type="button" class="btn-txn-upload-dispute-evidence mt-3 w-full py-2.5 rounded-lg bg-amber-600/90 text-white text-xs font-semibold hover:bg-amber-600 transition-all" data-id="' + txn.id + '">Ek Kanıt Yükle</button>' +
      '</div>'
    );
  }

  if (!canBuyerOpenDispute(txn)) {
    if (txn.dispute_status && txn.dispute_status !== 'none') {
      return '<p class="mt-3 text-xs text-amber-300">İtiraz durumu: ' + escapeHtml(txn.dispute_reason || 'İşlem inceleniyor') + '</p>';
    }
    return '';
  }

  var options = [
    ['invalid_ticket', 'Bilet geçersizdi'],
    ['left_at_gate', 'Kapıda kaldım'],
    ['used_before', 'Bilet daha önce kullanılmıştı'],
    ['wrong_ticket', 'Yanlış bilet gönderildi'],
    ['other', 'Diğer']
  ];

  return (
    '<div class="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">' +
      '<p class="text-[11px] font-medium text-amber-300 mb-2">Sorun Bildir</p>' +
      '<p class="text-[11px] text-zinc-400 mb-2">Etkinlikten sonra itiraz oluşturabilirsin.</p>' +
      '<select class="txn-dispute-category w-full rounded-lg bg-surface-700 border border-white/10 px-3 py-2 text-xs text-zinc-200" data-id="' + txn.id + '">' +
        '<option value="">Sorun nedenini seçin</option>' +
        options.map(function (pair) {
          return '<option value="' + pair[0] + '">' + escapeHtml(pair[1]) + '</option>';
        }).join('') +
      '</select>' +
      '<textarea class="txn-dispute-description mt-2 w-full rounded-lg bg-surface-700 border border-white/10 px-3 py-2 text-xs text-zinc-200" rows="3" data-id="' + txn.id + '" placeholder="Kısaca ne olduğunu yazın..."></textarea>' +
      '<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="txn-dispute-file mt-2 w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-surface-600 file:text-white file:text-xs file:font-semibold" data-id="' + txn.id + '">' +
      '<button type="button" class="btn-txn-open-dispute mt-3 w-full py-2.5 rounded-lg bg-amber-600/90 text-white text-xs font-semibold hover:bg-amber-600 transition-all" data-id="' + txn.id + '">Sorun Bildir</button>' +
    '</div>'
  );
}

function renderTransactionReviewSection(txn, reviewMap) {
  if (!txn || txn.completion_status !== 'completed') return '';

  var reviewedUserId = txn.buyer_id === AppState.user.id ? txn.seller_id : txn.buyer_id;
  var existingReview = reviewMap && reviewMap[txn.id] ? reviewMap[txn.id] : null;

  if (existingReview) {
    return (
      '<div class="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">' +
        '<p class="text-xs font-semibold text-emerald-300 mb-1">Değerlendirmeniz kaydedildi</p>' +
        '<p class="text-sm text-white">' + renderReviewStars(existingReview.rating) + '</p>' +
        (existingReview.review_text ? '<p class="mt-2 text-xs text-emerald-100/90 leading-relaxed">' + escapeHtml(existingReview.review_text) + '</p>' : '') +
      '</div>'
    );
  }

  return (
    '<form class="txn-review-form mt-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3" data-id="' + txn.id + '" data-reviewed-user-id="' + reviewedUserId + '">' +
      '<p class="text-xs font-semibold text-violet-300 mb-2">Karşı tarafı değerlendir</p>' +
      '<label class="block text-[11px] text-zinc-400 mb-1">Yıldız</label>' +
      '<select class="txn-review-rating w-full rounded-lg bg-surface-700 border border-white/10 px-3 py-2 text-sm text-white">' +
        '<option value="5">5 - Mükemmel</option>' +
        '<option value="4">4 - İyi</option>' +
        '<option value="3">3 - Orta</option>' +
        '<option value="2">2 - Zayıf</option>' +
        '<option value="1">1 - Kötü</option>' +
      '</select>' +
      '<label class="block text-[11px] text-zinc-400 mt-3 mb-1">Kısa yorum</label>' +
      '<textarea class="txn-review-text w-full rounded-lg bg-surface-700 border border-white/10 px-3 py-2 text-sm text-white" rows="3" maxlength="240" placeholder="Kısa yorum yazın..."></textarea>' +
      '<button type="submit" class="btn-txn-submit-review mt-3 w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-accent text-white text-xs font-semibold hover:brightness-110 transition-all">Değerlendirmeyi Gönder</button>' +
    '</form>'
  );
}

function renderReviewStars(rating) {
  var value = Math.max(0, Math.min(5, Number(rating) || 0));
  return '★'.repeat(value) + '<span class="text-zinc-600">' + '★'.repeat(5 - value) + '</span>';
}

function renderMyTransactions(transactions, reviewMap) {
  var container = document.getElementById('my-transactions-list');
  if (!container) return;

  _myTransactionsCache = transactions || [];
  _myTransactionReviewsCache = reviewMap || _myTransactionReviewsCache || {};

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
        renderBuyerDisputeSection(txn) +
        renderTransactionReviewSection(txn, _myTransactionReviewsCache) +
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

  document.querySelectorAll('.btn-txn-upload-dispute-evidence').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleBuyerAdditionalDisputeEvidence(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.txn-dispute-category').forEach(function (select) {
    select.addEventListener('change', function () {
      var id = select.getAttribute('data-id');
      var relatedText = document.querySelector('.txn-dispute-description[data-id="' + id + '"]');
      if (relatedText && select.value === 'other' && !relatedText.value.trim()) {
        relatedText.focus();
      }
    });
  });

  document.querySelectorAll('.txn-review-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleTransactionReviewSubmit(form.getAttribute('data-id'));
    });
  });
}

async function handleTransactionReviewSubmit(transactionId) {
  var form = document.querySelector('.txn-review-form[data-id="' + transactionId + '"]');
  if (!form) return;

  var txn = _myTransactionsCache.find(function (item) { return item.id === transactionId; });
  if (!txn || txn.completion_status !== 'completed') {
    showToast('Bu işlem için değerlendirme yapılamıyor.');
    return;
  }

  var ratingEl = form.querySelector('.txn-review-rating');
  var textEl = form.querySelector('.txn-review-text');
  var rating = Number(ratingEl ? ratingEl.value : 0);
  var reviewText = textEl ? textEl.value.trim() : '';
  var reviewedUserId = form.getAttribute('data-reviewed-user-id');

  if (!rating || rating < 1 || rating > 5) {
    showToast('Lütfen 1-5 arası yıldız seçin.');
    return;
  }

  var reviewBtn = form.querySelector('.btn-txn-submit-review');
  if (reviewBtn) {
    reviewBtn.disabled = true;
    reviewBtn.classList.add('opacity-60');
  }

  try {
    var res = await sb.from('profile_reviews').insert({
      reviewed_user_id: reviewedUserId,
      reviewer_id: AppState.user.id,
      transaction_id: transactionId,
      rating: rating,
      review_text: reviewText || null
    }).select().single();

    if (res.error || !res.data) {
      if (res.error && String(res.error.message || '').toLowerCase().indexOf('duplicate') !== -1) {
        showToast('Bu işlem için zaten değerlendirme yapılmış.');
      } else {
        showToast((res.error && res.error.message) || 'Değerlendirme kaydedilemedi.');
      }
      return;
    }

    showToast('Değerlendirmeniz kaydedildi.');
    await refreshMyTransactionsModal();
  } finally {
    if (reviewBtn) {
      reviewBtn.disabled = false;
      reviewBtn.classList.remove('opacity-60');
    }
  }
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
    await refreshMyTransactionsModal();
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
    await refreshMyTransactionsModal();
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
  await refreshMyTransactionsModal();
}

async function handleBuyerOpenDispute(transactionId) {
  var categoryInput = document.querySelector('.txn-dispute-category[data-id="' + transactionId + '"]');
  var descriptionInput = document.querySelector('.txn-dispute-description[data-id="' + transactionId + '"]');
  var fileInput = document.querySelector('.txn-dispute-file[data-id="' + transactionId + '"]');
  var category = categoryInput ? categoryInput.value : '';
  var description = descriptionInput ? descriptionInput.value : '';
  var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

  var btn = document.querySelector('.btn-txn-open-dispute[data-id="' + transactionId + '"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
  }

  try {
    var res = await openBuyerDispute(transactionId, category, description, file);
    if (res.error || !res.data) {
      showToast((res.error && res.error.message) || 'Sorun bildirimi oluşturulamadı.');
      return;
    }
    showToast('Sorun bildirimi oluşturuldu. Admin inceleyecek.');
    await refreshMyTransactionsModal();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
    }
  }
}

async function handleBuyerAdditionalDisputeEvidence(transactionId) {
  var fileInput = document.querySelector('.txn-dispute-evidence-file[data-id="' + transactionId + '"]');
  var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

  if (!file) {
    showToast('Lütfen bir kanıt dosyası seçin.');
    return;
  }

  var btn = document.querySelector('.btn-txn-upload-dispute-evidence[data-id="' + transactionId + '"]');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60');
  }

  try {
    var res = await uploadAdditionalDisputeEvidence(transactionId, file);
    if (res.error || !res.data) {
      showToast((res.error && res.error.message) || 'Ek kanıt yüklenemedi.');
      return;
    }
    showToast('Ek kanıt yüklendi.');
    await refreshMyTransactionsModal();
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
  await refreshMyTransactionsModal();
}

function openMyTransactionsModal() {
  requireAuth(async function () {
    var modal = document.getElementById('my-transactions-modal');
    var list = document.getElementById('my-transactions-list');
    list.innerHTML = '<p class="text-center text-sm text-zinc-500 py-8">Yükleniyor…</p>';
    openModalEl(modal);
    await refreshMyTransactionsModal();
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
