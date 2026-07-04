// ============================================================
// biletakas — Transaction Sistemi (Ortak)
// Manuel IBAN + gelecekte IYZICO / PAYTR genişlemesi
// ============================================================

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
  PAYMENT_RECEIVED: 'payment_received',
  TICKET_RECEIVED: 'ticket_received',
  DELIVERED_TO_BUYER: 'delivered_to_buyer',
  BUYER_CONFIRMED: 'buyer_confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

var TRANSACTION_LOG_ACTIONS = {
  payment_received: 'transaction_payment_received',
  ticket_received: 'transaction_ticket_received',
  delivered_to_buyer: 'transaction_delivered_to_buyer',
  buyer_confirmed: 'transaction_buyer_confirmed',
  completed: 'transaction_completed',
  cancelled: 'transaction_cancelled'
};

var TRANSACTION_LOG_MESSAGES = {
  payment_received: 'Ödeme geldi',
  ticket_received: 'Bilet alındı',
  delivered_to_buyer: 'Alıcıya gönderildi',
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
  { value: 'waiting_payment', label: 'Ödeme bekleniyor' },
  { value: 'payment_received', label: 'Ödeme geldi' },
  { value: 'waiting_ticket', label: 'Bilet bekleniyor' },
  { value: 'delivered_to_buyer', label: 'Alıcıya gönderildi' },
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
  if (txn.ticket_status === TICKET_STATUS.DELIVERED) {
    return { text: 'Bilet alıcıya gönderildi', cls: 'bg-violet-500/10 border-violet-500/30 text-violet-300' };
  }
  if (txn.payment_status === PAYMENT_STATUS.WAITING) {
    return { text: 'Ödeme bekleniyor', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' };
  }
  if (txn.ticket_status === TICKET_STATUS.WAITING) {
    return { text: 'Bilet bekleniyor', cls: 'bg-sky-500/10 border-sky-500/30 text-sky-300' };
  }
  if (txn.ticket_status === TICKET_STATUS.RECEIVED) {
    return { text: 'Bilet hazırlanıyor', cls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' };
  }
  return { text: 'Devam ediyor', cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300' };
}

function getEnabledAdminActions(txn) {
  if (!txn) return {};

  var isActive = txn.completion_status !== COMPLETION_STATUS.COMPLETED
    && txn.completion_status !== COMPLETION_STATUS.CANCELLED;

  return {
    payment_received: isActive
      && txn.payment_status === PAYMENT_STATUS.WAITING,
    ticket_received: isActive
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && txn.ticket_status === TICKET_STATUS.WAITING,
    delivered_to_buyer: isActive
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && txn.ticket_status === TICKET_STATUS.RECEIVED,
    buyer_confirmed: isActive
      && txn.ticket_status === TICKET_STATUS.DELIVERED
      && txn.completion_status === COMPLETION_STATUS.PENDING,
    completed: txn.completion_status === COMPLETION_STATUS.BUYER_CONFIRMED,
    cancelled: isActive
  };
}

function getUpdatesForAdminAction(action) {
  switch (action) {
    case TRANSACTION_ADMIN_ACTIONS.PAYMENT_RECEIVED:
      return { payment_status: PAYMENT_STATUS.RECEIVED };
    case TRANSACTION_ADMIN_ACTIONS.TICKET_RECEIVED:
      return { ticket_status: TICKET_STATUS.RECEIVED };
    case TRANSACTION_ADMIN_ACTIONS.DELIVERED_TO_BUYER:
      return { ticket_status: TICKET_STATUS.DELIVERED };
    case TRANSACTION_ADMIN_ACTIONS.BUYER_CONFIRMED:
      return { completion_status: COMPLETION_STATUS.BUYER_CONFIRMED };
    case TRANSACTION_ADMIN_ACTIONS.COMPLETED:
      return { completion_status: COMPLETION_STATUS.COMPLETED };
    case TRANSACTION_ADMIN_ACTIONS.CANCELLED:
      return { completion_status: COMPLETION_STATUS.CANCELLED };
    default:
      return null;
  }
}

function matchesTransactionFilter(txn, filter) {
  if (!txn || filter === 'all' || !filter) return true;

  switch (filter) {
    case 'waiting_payment':
      return txn.payment_status === PAYMENT_STATUS.WAITING
        && txn.completion_status !== COMPLETION_STATUS.CANCELLED;
    case 'payment_received':
      return txn.payment_status === PAYMENT_STATUS.RECEIVED;
    case 'waiting_ticket':
      return txn.ticket_status === TICKET_STATUS.WAITING
        && txn.completion_status !== COMPLETION_STATUS.CANCELLED;
    case 'delivered_to_buyer':
      return txn.ticket_status === TICKET_STATUS.DELIVERED;
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
