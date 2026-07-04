// ============================================================
// biletakas — Transaction Sistemi (Ortak)
// Manuel IBAN + gelecekte IYZICO / PAYTR genişlemesi
// ============================================================

if (typeof escapeHtml !== 'function') {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

var PAYMENT_METHODS = {
  IBAN: 'IBAN',
  IYZICO: 'IYZICO',
  PAYTR: 'PAYTR'
};

var PAYMENT_STATUS = {
  WAITING: 'waiting_payment',
  RECEIVED: 'payment_received',
  REFUNDED: 'refunded'
};

var TICKET_STATUS = {
  WAITING_UPLOAD: 'waiting_ticket_upload',
  UPLOADED: 'ticket_uploaded',
  VERIFIED: 'ticket_verified',
  SENT_TO_BUYER: 'ticket_sent_to_buyer',
  // geriye dönük
  WAITING: 'waiting_ticket',
  RECEIVED: 'ticket_received',
  DELIVERED: 'delivered_to_buyer'
};

var COMPLETION_STATUS = {
  PENDING: 'pending',
  BUYER_CONFIRMED: 'buyer_confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

var TRANSACTION_ADMIN_ACTIONS = {
  TICKET_VERIFIED: 'ticket_verified',
  PAYMENT_RECEIVED: 'payment_received',
  TICKET_SENT_TO_BUYER: 'ticket_sent_to_buyer',
  BUYER_CONFIRMED: 'buyer_confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  // geriye dönük alias
  TICKET_RECEIVED: 'ticket_verified',
  DELIVERED_TO_BUYER: 'ticket_sent_to_buyer'
};

var TRANSACTION_LOG_ACTIONS = {
  ticket_uploaded: 'transaction_ticket_uploaded',
  ticket_verified: 'transaction_ticket_verified',
  buyer_payment_notified: 'transaction_buyer_payment_notified',
  payment_received: 'transaction_payment_received',
  ticket_sent_to_buyer: 'transaction_ticket_sent_to_buyer',
  buyer_confirmed: 'transaction_buyer_confirmed',
  completed: 'transaction_completed',
  cancelled: 'transaction_cancelled',
  // geriye dönük
  ticket_received: 'transaction_ticket_verified',
  delivered_to_buyer: 'transaction_ticket_sent_to_buyer'
};

var TRANSACTION_LOG_MESSAGES = {
  ticket_uploaded: 'Satıcı bilet yükledi',
  ticket_verified: 'Bilet doğrulandı',
  buyer_payment_notified: 'Alıcı ödeme yaptığını bildirdi',
  payment_received: 'Ödeme geldi',
  ticket_sent_to_buyer: 'Alıcıya gönderildi',
  buyer_confirmed: 'Alıcı onayladı',
  completed: 'İşlem tamamlandı',
  cancelled: 'İşlem iptal edildi'
};

var PAYMENT_STATUS_LABELS = {
  waiting_payment: 'Ödeme bekleniyor',
  payment_received: 'Ödeme geldi',
  refunded: 'İade edildi'
};

var TICKET_STATUS_LABELS = {
  waiting_ticket_upload: 'Bilet yüklemesi bekleniyor',
  ticket_uploaded: 'Bilet yüklendi',
  ticket_verified: 'Bilet doğrulandı',
  ticket_sent_to_buyer: 'Alıcıya gönderildi',
  waiting_ticket: 'Bilet bekleniyor',
  ticket_received: 'Bilet alındı',
  delivered_to_buyer: 'Alıcıya gönderildi'
};

var COMPLETION_STATUS_LABELS = {
  pending: 'Devam ediyor',
  buyer_confirmed: 'Alıcı onayladı',
  completed: 'Tamamlandı',
  cancelled: 'İptal'
};

var PAYMENT_METHOD_LABELS = {
  IBAN: 'IBAN',
  IYZICO: 'iyzico',
  PAYTR: 'PayTR'
};

var TRANSACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'Tümü' },
  { value: 'waiting_ticket_upload', label: 'Bilet yüklemesi bekleniyor' },
  { value: 'ticket_uploaded', label: 'Bilet doğrulama bekliyor' },
  { value: 'ticket_verified', label: 'Bilet doğrulandı' },
  { value: 'waiting_payment', label: 'Ödeme bekleniyor' },
  { value: 'payment_received', label: 'Ödeme geldi' },
  { value: 'ticket_sent_to_buyer', label: 'Alıcıya gönderildi' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal' }
];

var TRANSACTION_SELECT_FIELDS = [
  'id',
  'offer_id',
  'listing_id',
  'buyer_id',
  'seller_id',
  'amount',
  'transaction_code',
  'payment_method',
  'payment_status',
  'ticket_status',
  'completion_status',
  'admin_note',
  'ticket_file_path',
  'ticket_uploaded_at',
  'ticket_verified_at',
  'buyer_payment_notified_at',
  'created_at',
  'updated_at',
  'listing:listings(id, artist, venue, city)',
  'buyer:profiles!buyer_id(username, display_name)',
  'seller:profiles!seller_id(username, display_name)'
].join(', ');

function txnPaymentStatusBadge(status) {
  var classes = {
    waiting_payment: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    payment_received: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    refunded: 'bg-rose-500/10 border-rose-500/30 text-rose-300'
  };
  return badgeHtml(PAYMENT_STATUS_LABELS[status] || status, classes[status]);
}

function txnTicketStatusBadge(status) {
  var classes = {
    waiting_ticket_upload: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    ticket_uploaded: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    ticket_verified: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    ticket_sent_to_buyer: 'bg-violet-500/10 border-violet-500/30 text-violet-300',
    waiting_ticket: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    ticket_received: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    delivered_to_buyer: 'bg-violet-500/10 border-violet-500/30 text-violet-300'
  };
  return badgeHtml(TICKET_STATUS_LABELS[status] || status, classes[status]);
}

function txnCompletionStatusBadge(status) {
  var classes = {
    pending: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300',
    buyer_confirmed: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    completed: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    cancelled: 'bg-red-500/10 border-red-500/30 text-red-300'
  };
  return badgeHtml(COMPLETION_STATUS_LABELS[status] || status, classes[status]);
}

function badgeHtml(text, cls) {
  return '<span class="px-2 py-1 rounded-lg text-xs border ' + (cls || 'bg-zinc-800 border-white/10 text-zinc-300') + '">' + escapeHtml(text || '-') + '</span>';
}

function isTicketVerified(txn) {
  if (!txn) return false;
  return !!txn.ticket_verified_at || txn.ticket_status === TICKET_STATUS.VERIFIED
    || txn.ticket_status === TICKET_STATUS.SENT_TO_BUYER
    || txn.ticket_status === TICKET_STATUS.RECEIVED
    || txn.ticket_status === TICKET_STATUS.DELIVERED;
}

function canShowIbanToBuyer(txn) {
  if (!txn || txn.completion_status === COMPLETION_STATUS.CANCELLED) return false;
  return isTicketVerified(txn) && txn.payment_status === PAYMENT_STATUS.WAITING;
}

function canSellerUploadTicket(txn) {
  if (!txn || txn.completion_status !== COMPLETION_STATUS.PENDING) return false;
  return txn.ticket_status === TICKET_STATUS.WAITING_UPLOAD
    || txn.ticket_status === TICKET_STATUS.UPLOADED
    || txn.ticket_status === TICKET_STATUS.WAITING;
}

function getUserFacingTransactionStatus(txn) {
  if (!txn) return { text: '-', cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300' };

  if (txn.completion_status === COMPLETION_STATUS.CANCELLED) {
    return { text: 'İptal edildi', cls: 'bg-red-500/10 border-red-500/30 text-red-300' };
  }
  if (txn.completion_status === COMPLETION_STATUS.COMPLETED) {
    return { text: 'Tamamlandı', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' };
  }
  if (txn.completion_status === COMPLETION_STATUS.BUYER_CONFIRMED) {
    return { text: 'Alıcı onayladı', cls: 'bg-blue-500/10 border-blue-500/30 text-blue-300' };
  }
  if (txn.ticket_status === TICKET_STATUS.SENT_TO_BUYER || txn.ticket_status === TICKET_STATUS.DELIVERED) {
    return { text: 'Bilet alıcıya gönderildi', cls: 'bg-violet-500/10 border-violet-500/30 text-violet-300' };
  }
  if (txn.payment_status === PAYMENT_STATUS.RECEIVED && !isTicketVerified(txn)) {
    return { text: 'Ödeme alındı', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' };
  }
  if (txn.buyer_payment_notified_at && txn.payment_status === PAYMENT_STATUS.WAITING) {
    return { text: 'Ödeme onayı bekleniyor', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' };
  }
  if (canShowIbanToBuyer(txn)) {
    return { text: 'Ödeme bekleniyor', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' };
  }
  if (txn.ticket_status === TICKET_STATUS.UPLOADED || (txn.ticket_file_path && !isTicketVerified(txn))) {
    return { text: 'Bilet doğrulaması bekleniyor', cls: 'bg-sky-500/10 border-sky-500/30 text-sky-300' };
  }
  if (txn.ticket_status === TICKET_STATUS.WAITING_UPLOAD || txn.ticket_status === TICKET_STATUS.WAITING) {
    return { text: 'Bilet yüklemesi bekleniyor', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300' };
  }
  return { text: 'Devam ediyor', cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300' };
}

function getEnabledAdminActions(txn) {
  if (!txn) return {};

  var isActive = txn.completion_status !== COMPLETION_STATUS.COMPLETED
    && txn.completion_status !== COMPLETION_STATUS.CANCELLED;

  return {
    ticket_verified: isActive
      && txn.ticket_status === TICKET_STATUS.UPLOADED
      && !!txn.ticket_file_path
      && !txn.ticket_verified_at,
    payment_received: isActive
      && isTicketVerified(txn)
      && !!txn.buyer_payment_notified_at
      && txn.payment_status === PAYMENT_STATUS.WAITING,
    ticket_sent_to_buyer: isActive
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && isTicketVerified(txn)
      && txn.ticket_status !== TICKET_STATUS.SENT_TO_BUYER
      && txn.ticket_status !== TICKET_STATUS.DELIVERED,
    buyer_confirmed: isActive
      && (txn.ticket_status === TICKET_STATUS.SENT_TO_BUYER || txn.ticket_status === TICKET_STATUS.DELIVERED)
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && txn.completion_status === COMPLETION_STATUS.PENDING,
    completed: txn.completion_status === COMPLETION_STATUS.BUYER_CONFIRMED,
    cancelled: isActive
  };
}

function getUpdatesForAdminAction(action) {
  var now = new Date().toISOString();
  switch (action) {
    case TRANSACTION_ADMIN_ACTIONS.TICKET_VERIFIED:
    case 'ticket_verified':
      return { ticket_status: TICKET_STATUS.VERIFIED, ticket_verified_at: now };
    case TRANSACTION_ADMIN_ACTIONS.PAYMENT_RECEIVED:
    case 'payment_received':
      return { payment_status: PAYMENT_STATUS.RECEIVED };
    case TRANSACTION_ADMIN_ACTIONS.TICKET_SENT_TO_BUYER:
    case 'ticket_sent_to_buyer':
      return { ticket_status: TICKET_STATUS.SENT_TO_BUYER };
    case TRANSACTION_ADMIN_ACTIONS.BUYER_CONFIRMED:
    case 'buyer_confirmed':
      return { completion_status: COMPLETION_STATUS.BUYER_CONFIRMED };
    case TRANSACTION_ADMIN_ACTIONS.COMPLETED:
    case 'completed':
      return { completion_status: COMPLETION_STATUS.COMPLETED };
    case TRANSACTION_ADMIN_ACTIONS.CANCELLED:
    case 'cancelled':
      return { completion_status: COMPLETION_STATUS.CANCELLED };
    default:
      return null;
  }
}

function matchesTransactionFilter(txn, filter) {
  if (!txn || filter === 'all' || !filter) return true;

  switch (filter) {
    case 'waiting_ticket_upload':
      return txn.ticket_status === TICKET_STATUS.WAITING_UPLOAD
        || txn.ticket_status === TICKET_STATUS.WAITING;
    case 'ticket_uploaded':
      return txn.ticket_status === TICKET_STATUS.UPLOADED && !txn.ticket_verified_at;
    case 'ticket_verified':
      return isTicketVerified(txn) && txn.payment_status === PAYMENT_STATUS.WAITING
        && !txn.buyer_payment_notified_at;
    case 'waiting_payment':
      return txn.payment_status === PAYMENT_STATUS.WAITING
        && txn.completion_status !== COMPLETION_STATUS.CANCELLED
        && isTicketVerified(txn);
    case 'payment_received':
      return txn.payment_status === PAYMENT_STATUS.RECEIVED;
    case 'ticket_sent_to_buyer':
      return txn.ticket_status === TICKET_STATUS.SENT_TO_BUYER
        || txn.ticket_status === TICKET_STATUS.DELIVERED;
    case 'completed':
      return txn.completion_status === COMPLETION_STATUS.COMPLETED;
    case 'cancelled':
      return txn.completion_status === COMPLETION_STATUS.CANCELLED;
    default:
      return true;
  }
}

function matchesTransactionSearch(txn, query) {
  if (!query) return true;
  if (!txn) return false;

  var q = query.toLowerCase().trim();
  var listing = txn.listing || {};
  var buyer = txn.buyer || {};
  var seller = txn.seller || {};
  var haystack = [
    txn.transaction_code,
    listing.artist,
    buyer.username,
    buyer.display_name,
    seller.username,
    seller.display_name
  ].join(' ').toLowerCase();

  return haystack.indexOf(q) !== -1;
}

function formatTransactionDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR');
}

function formatTransactionAmount(value) {
  return Number(value || 0).toLocaleString('tr-TR') + ' TL';
}

function profileDisplayName(profile) {
  if (!profile) return 'Kullanıcı';
  return profile.display_name || profile.username || 'Kullanıcı';
}

async function fetchTransactionByOfferId(offerId) {
  if (!sb || !offerId) return null;

  var res = await sb
    .from('transactions')
    .select(TRANSACTION_SELECT_FIELDS)
    .eq('offer_id', offerId)
    .maybeSingle();

  if (res.error) {
    console.error('[biletakas] Transaction okunamadı:', res.error);
    return null;
  }
  return res.data;
}

async function fetchUserTransactions(userId) {
  if (!sb || !userId) return [];

  var res = await sb
    .from('transactions')
    .select(TRANSACTION_SELECT_FIELDS)
    .or('buyer_id.eq.' + userId + ',seller_id.eq.' + userId)
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error('[biletakas] Kullanıcı işlemleri çekilemedi:', res.error);
    return [];
  }
  return res.data || [];
}

async function fetchAllTransactions() {
  if (!sb) return [];

  var res = await sb
    .from('transactions')
    .select(TRANSACTION_SELECT_FIELDS)
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error('[biletakas] Admin işlemleri çekilemedi:', res.error);
    return [];
  }
  return res.data || [];
}

async function updateTransactionFields(transactionId, fields) {
  if (!sb || !transactionId || !fields) {
    return { data: null, error: new Error('Geçersiz güncelleme isteği.') };
  }

  return sb
    .from('transactions')
    .update(fields)
    .eq('id', transactionId)
    .select(TRANSACTION_SELECT_FIELDS)
    .single();
}

async function saveTransactionAdminNote(transactionId, note) {
  return updateTransactionFields(transactionId, { admin_note: note || null });
}

async function applyAdminTransactionAction(transactionId, action, logFn) {
  var updates = getUpdatesForAdminAction(action);
  if (!updates) {
    return { data: null, error: new Error('Geçersiz işlem.') };
  }

  var res = await updateTransactionFields(transactionId, updates);
  if (res.error || !res.data) return res;

  if (typeof logFn === 'function') {
    var txn = res.data;
    var listing = txn.listing || {};
    var logAction = TRANSACTION_LOG_ACTIONS[action] || 'transaction_update';
    var logMessage = (TRANSACTION_LOG_MESSAGES[action] || 'İşlem güncellendi')
      + ' — ' + (txn.transaction_code || '')
      + ' (' + (listing.artist || 'İlan') + ')';

    await logFn(logAction, logMessage, {
      transaction_id: txn.id,
      transaction_code: txn.transaction_code,
      offer_id: txn.offer_id,
      listing_id: txn.listing_id,
      action: action,
      payment_status: txn.payment_status,
      ticket_status: txn.ticket_status,
      completion_status: txn.completion_status
    });
  }

  return res;
}

function validateTicketFile(file) {
  if (!file) return 'Dosya seçilmedi.';
  if (file.size > TICKET_MAX_BYTES) return 'Dosya en fazla 10 MB olabilir.';

  var ext = (file.name.split('.').pop() || '').toLowerCase();
  if (TICKET_ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
    return 'Yalnızca PDF, PNG, JPG veya JPEG yükleyebilirsiniz.';
  }
  if (file.type && !TICKET_ALLOWED_TYPES[file.type]) {
    return 'Desteklenmeyen dosya türü.';
  }
  return null;
}

function buildTicketStoragePath(transactionId, fileName) {
  var ext = (fileName.split('.').pop() || 'bin').toLowerCase();
  var safeExt = TICKET_ALLOWED_EXTENSIONS.indexOf(ext) !== -1 ? ext : 'bin';
  return transactionId + '/ticket-' + Date.now() + '.' + safeExt;
}

async function uploadSellerTicket(transactionId, file) {
  if (!sb || !AppState.user) {
    return { data: null, error: new Error('Giriş yapmalısınız.') };
  }

  var validationError = validateTicketFile(file);
  if (validationError) return { data: null, error: new Error(validationError) };

  var storagePath = buildTicketStoragePath(transactionId, file.name);
  var uploadRes = await sb.storage
    .from(TICKET_STORAGE_BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });

  if (uploadRes.error) return { data: null, error: uploadRes.error };

  var now = new Date().toISOString();
  var updateRes = await updateTransactionFields(transactionId, {
    ticket_file_path: storagePath,
    ticket_uploaded_at: now,
    ticket_status: TICKET_STATUS.UPLOADED
  });

  if (updateRes.error || !updateRes.data) {
    return updateRes;
  }

  await writeTransactionLog(
    'ticket_uploaded',
    'Satıcı bilet yükledi — ' + (updateRes.data.transaction_code || ''),
    {
      transaction_id: updateRes.data.id,
      transaction_code: updateRes.data.transaction_code,
      ticket_file_path: storagePath
    }
  );

  return updateRes;
}

async function buyerNotifyPayment(transactionId) {
  if (!sb || !AppState.user) {
    return { data: null, error: new Error('Giriş yapmalısınız.') };
  }

  var now = new Date().toISOString();
  var res = await updateTransactionFields(transactionId, {
    buyer_payment_notified_at: now
  });

  if (res.error || !res.data) return res;

  await writeTransactionLog(
    'buyer_payment_notified',
    'Alıcı ödeme yaptığını bildirdi — ' + (res.data.transaction_code || ''),
    {
      transaction_id: res.data.id,
      transaction_code: res.data.transaction_code
    }
  );

  return res;
}

async function getTicketSignedUrl(filePath, expiresIn) {
  if (!sb || !filePath) return null;

  var res = await sb.storage
    .from(TICKET_STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresIn || 3600);

  if (res.error) {
    console.error('[biletakas] Bilet URL oluşturulamadı:', res.error);
    return null;
  }
  return res.data ? res.data.signedUrl : null;
}

async function writeTransactionLog(actionKey, message, metadata) {
  if (!sb || !AppState.user) return;

  var logAction = TRANSACTION_LOG_ACTIONS[actionKey] || 'transaction_update';
  await sb.from('admin_logs').insert({
    admin_id: AppState.user.id,
    action: logAction,
    message: message,
    metadata: metadata || {}
  });
}

function renderIbanCardHtml(txn) {
  if (!canShowIbanToBuyer(txn)) return '';

  var iban = typeof BILETAKAS_IBAN !== 'undefined' ? BILETAKAS_IBAN : {};
  return (
    '<div class="mt-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-accent/10 border border-emerald-500/20 p-3.5">' +
      '<p class="text-xs font-semibold text-emerald-300 mb-2">Ödeme Bilgileri (IBAN)</p>' +
      '<p class="text-sm text-white font-medium">' + escapeHtml(iban.accountName || 'Biletakas') + '</p>' +
      '<p class="text-sm text-zinc-300 mt-1">' + escapeHtml(iban.bank || '') + '</p>' +
      '<p class="text-base font-mono font-bold text-white mt-2 tracking-wide">' + escapeHtml(iban.iban || '') + '</p>' +
      '<p class="text-xs text-zinc-400 mt-2">Tutar: <span class="text-white font-semibold">' + formatPrice(txn.amount) + '</span></p>' +
      '<p class="text-xs text-zinc-500 mt-1">' + escapeHtml(iban.descriptionHint || 'Açıklamaya işlem kodunu yazın.') + '</p>' +
      '<p class="text-xs text-accent-light mt-1 font-mono">' + escapeHtml(txn.transaction_code) + '</p>' +
    '</div>'
  );
}
