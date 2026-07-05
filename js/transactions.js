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
  RECEIPT_UPLOADED: 'receipt_uploaded',
  RECEIVED: 'payment_received',
  REJECTED: 'payment_rejected',
  REFUNDED: 'refunded'
};

var TICKET_STATUS = {
  WAITING_UPLOAD: 'waiting_ticket_upload',
  UPLOADED: 'ticket_uploaded',
  VERIFIED: 'ticket_verified',
  SENT_TO_BUYER: 'ticket_sent_to_buyer',
  RELEASED_TO_BUYER: 'ticket_released_to_buyer',
  // geriye dönük
  WAITING: 'waiting_ticket',
  RECEIVED: 'ticket_received',
  DELIVERED: 'delivered_to_buyer'
};

var COMPLETION_STATUS = {
  MONEY_SENT_TO_SELLER: 'money_sent_to_seller',
  PENDING: 'pending',
  BUYER_CONFIRMED: 'buyer_confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

var PAYOUT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SENT: 'sent',
  FAILED: 'failed'
};

var PAYOUT_STATUS_LABELS = {
  pending: 'Beklemede',
  processing: 'İşleniyor',
  sent: 'Gönderildi',
  failed: 'Başarısız'
};

var TRANSACTION_ADMIN_ACTIONS = {
  TICKET_VERIFIED: 'ticket_verified',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_REJECTED: 'payment_rejected',
  RELEASE_TICKET_TO_BUYER: 'release_ticket_to_buyer',
  TICKET_SENT_TO_BUYER: 'ticket_sent_to_buyer',
  MONEY_SENT_TO_SELLER: 'money_sent_to_seller',
  BUYER_CONFIRMED: 'buyer_confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUND_APPROVED: 'refund_approved',
  REFUND_REJECTED: 'refund_rejected',
  BUYER_REFUNDED: 'buyer_refunded',
  SELLER_PAID: 'seller_paid',
  // geriye dönük alias
  TICKET_RECEIVED: 'ticket_verified',
  DELIVERED_TO_BUYER: 'ticket_sent_to_buyer'
};

var TRANSACTION_LOG_ACTIONS = {
  ticket_uploaded: 'transaction_ticket_uploaded',
  ticket_verified: 'transaction_ticket_verified',
  receipt_uploaded: 'transaction_receipt_uploaded',
  buyer_payment_notified: 'transaction_buyer_payment_notified',
  payment_received: 'transaction_payment_received',
  payment_rejected: 'transaction_payment_rejected',
  release_ticket_to_buyer: 'transaction_ticket_released_to_buyer',
  ticket_sent_to_buyer: 'transaction_ticket_sent_to_buyer',
  buyer_confirmed: 'transaction_buyer_confirmed',
  money_sent_to_seller: 'transaction_money_sent_to_seller',
  refund_approved: 'transaction_refund_approved',
  refund_rejected: 'transaction_refund_rejected',
  buyer_refunded: 'transaction_buyer_refunded',
  seller_paid: 'transaction_seller_paid',
  completed: 'transaction_completed',
  cancelled: 'transaction_cancelled',
  // geriye dönük
  ticket_received: 'transaction_ticket_verified',
  delivered_to_buyer: 'transaction_ticket_sent_to_buyer'
};

var TRANSACTION_LOG_MESSAGES = {
  ticket_uploaded: 'Satıcı bilet yükledi',
  ticket_verified: 'Bilet doğrulandı',
  receipt_uploaded: 'Alıcı dekont yükledi',
  buyer_payment_notified: 'Alıcı ödeme yaptığını bildirdi',
  payment_received: 'Ödeme geldi',
  payment_rejected: 'Ödeme reddedildi',
  release_ticket_to_buyer: 'Bilet alıcıya açıldı',
  ticket_sent_to_buyer: 'Alıcıya gönderildi',
  buyer_confirmed: 'Alıcı onayladı',
  money_sent_to_seller: 'Satıcıya para gönderildi',
  refund_approved: 'İade onayı verildi',
  refund_rejected: 'İade reddedildi',
  buyer_refunded: 'Alıcıya iade yapıldı',
  seller_paid: 'Satıcıya ödeme yapıldı',
  completed: 'İşlem tamamlandı',
  cancelled: 'İşlem iptal edildi'
};

var PAYMENT_STATUS_LABELS = {
  waiting_payment: 'Ödeme bekleniyor',
  receipt_uploaded: 'Dekont yüklendi',
  payment_received: 'Ödeme geldi',
  payment_rejected: 'Ödeme reddedildi',
  refunded: 'İade edildi'
};

var TICKET_STATUS_LABELS = {
  waiting_ticket_upload: 'Bilet yüklemesi bekleniyor',
  ticket_uploaded: 'Bilet yüklendi',
  ticket_verified: 'Bilet doğrulandı',
  ticket_sent_to_buyer: 'Alıcıya gönderildi',
  ticket_released_to_buyer: 'Bilet alıcıya açıldı',
  waiting_ticket: 'Bilet bekleniyor',
  ticket_received: 'Bilet alındı',
  delivered_to_buyer: 'Alıcıya gönderildi'
};

var COMPLETION_STATUS_LABELS = {
  pending: 'Devam ediyor',
  buyer_confirmed: 'Alıcı onayladı',
  money_sent_to_seller: 'Para satıcıya gönderildi',
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
  { value: 'money_sent_to_seller', label: 'Satıcıya para gönderildi' },
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
  'buyer_total_amount',
  'service_fee',
  'platform_commission',
  'seller_payout_amount',
  'payout_iban',
  'payout_account_name',
  'payout_receipt_path',
  'payout_sent_at',
  'payout_status',
  'dispute_status',
  'dispute_reason',
  'dispute_evidence_path',
  'dispute_created_at',
  'admin_note',
  'receipt_file_path',
  'receipt_uploaded_at',
  'payment_note',
  'ticket_file_path',
  'ticket_uploaded_at',
  'ticket_verified_at',
  'ticket_delivered_at',
  'buyer_payment_notified_at',
  'created_at',
  'updated_at',
  'listing:listings(id, artist, venue, city, price)',
  'buyer:profiles!buyer_id(username, display_name)',
  'seller:profiles!seller_id(username, display_name)'
].join(', ');

function txnPaymentStatusBadge(status) {
  var classes = {
    waiting_payment: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    receipt_uploaded: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    payment_received: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    payment_rejected: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
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
    ticket_released_to_buyer: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
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
    money_sent_to_seller: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    cancelled: 'bg-red-500/10 border-red-500/30 text-red-300'
  };
  return badgeHtml(COMPLETION_STATUS_LABELS[status] || status, classes[status]);
}

function badgeHtml(text, cls) {
  return '<span class="px-2 py-1 rounded-lg text-xs border ' + (cls || 'bg-zinc-800 border-white/10 text-zinc-300') + '">' + escapeHtml(text || '-') + '</span>';
}

function getTransactionPricingBreakdown(txn) {
  var baseAmount = 0;
  if (txn && txn.listing && txn.listing.price != null) {
    baseAmount = Number(txn.listing.price);
  } else if (txn && txn.buyer_total_amount != null) {
    baseAmount = Number(txn.buyer_total_amount);
  } else if (txn && txn.amount != null) {
    baseAmount = Number(txn.amount);
  }

  var buyerTotalAmount = Number(txn && txn.buyer_total_amount != null ? txn.buyer_total_amount : baseAmount);
  if (!isFinite(buyerTotalAmount)) buyerTotalAmount = 0;

  var serviceFee = Number(txn && txn.service_fee != null ? txn.service_fee : 0);
  var platformCommission = Number(txn && txn.platform_commission != null ? txn.platform_commission : 0);
  var sellerPayoutAmount = Number(txn && txn.seller_payout_amount != null ? txn.seller_payout_amount : 0);

  if (buyerTotalAmount > 0 && (!serviceFee || !platformCommission || !sellerPayoutAmount)) {
    serviceFee = Number((buyerTotalAmount * 0.05).toFixed(2));
    platformCommission = Number((buyerTotalAmount * 0.05).toFixed(2));
    sellerPayoutAmount = Number((buyerTotalAmount - serviceFee - platformCommission).toFixed(2));
  }

  return {
    buyerTotalAmount: Number(buyerTotalAmount.toFixed(2)),
    serviceFee: Number(serviceFee.toFixed(2)),
    platformCommission: Number(platformCommission.toFixed(2)),
    sellerPayoutAmount: Number(sellerPayoutAmount.toFixed(2))
  };
}

function renderTransactionPricingSummaryHtml(txn, variant) {
  if (!txn) return '';

  var breakdown = getTransactionPricingBreakdown(txn);

  var buyerTitle = 'Alıcının ödeyeceği';
  var sellerTitle = 'Satıcının eline geçecek';

  return (
    '<div class="mt-3 rounded-xl border border-white/10 bg-surface-800/70 p-3">' +
      '<div class="grid grid-cols-2 gap-2 text-xs">' +
        '<div class="rounded-lg bg-black/20 p-2">' +
          '<p class="text-[10px] uppercase tracking-wide text-zinc-500">' + escapeHtml(buyerTitle) + '</p>' +
          '<p class="mt-1 text-sm font-semibold text-white">' + formatTransactionAmount(breakdown.buyerTotalAmount) + '</p>' +
        '</div>' +
        '<div class="rounded-lg bg-black/20 p-2">' +
          '<p class="text-[10px] uppercase tracking-wide text-zinc-500">' + escapeHtml(sellerTitle) + '</p>' +
          '<p class="mt-1 text-sm font-semibold text-emerald-300">' + formatTransactionAmount(breakdown.sellerPayoutAmount) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">' +
        '<span class="rounded-lg bg-black/20 px-2 py-1">Platform komisyonu (%5): ' + formatTransactionAmount(breakdown.platformCommission) + '</span>' +
        '<span class="rounded-lg bg-black/20 px-2 py-1">İşlem ücreti: ' + formatTransactionAmount(breakdown.serviceFee) + '</span>' +
      '</div>' +
    '</div>'
  );
}

function payoutStatusBadgeHtml(status) {
  var label = PAYOUT_STATUS_LABELS[status] || status || 'Beklemede';
  var cls = {
    pending: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300',
    processing: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    sent: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    failed: 'bg-rose-500/10 border-rose-500/30 text-rose-300'
  }[status] || 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300';
  return badgeHtml(label, cls);
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

function canBuyerAccessTicket(txn) {
  if (!txn || !txn.ticket_file_path) return false;
  if (txn.payment_status !== PAYMENT_STATUS.RECEIVED) return false;
  return txn.ticket_status === TICKET_STATUS.SENT_TO_BUYER
    || txn.ticket_status === TICKET_STATUS.RELEASED_TO_BUYER
    || txn.ticket_status === TICKET_STATUS.DELIVERED;
}

function getUserFacingTransactionStatus(txn) {
  if (!txn) return { text: '-', cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300' };

  if (txn.payment_status === PAYMENT_STATUS.REFUNDED) {
    return { text: 'İade edildi', cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300' };
  }

  if (txn.dispute_status === 'open' || txn.dispute_status === 'under_review') {
    return { text: 'Sorun bildirildi', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300' };
  }

  if (txn.completion_status === COMPLETION_STATUS.CANCELLED) {
    return { text: 'İptal edildi', cls: 'bg-red-500/10 border-red-500/30 text-red-300' };
  }

  if (txn.completion_status === COMPLETION_STATUS.COMPLETED) {
    return { text: 'Tamamlandı', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' };
  }

  if (txn.completion_status === COMPLETION_STATUS.MONEY_SENT_TO_SELLER) {
    return { text: 'Satıcıya para gönderildi', cls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' };
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

  if (txn.payment_status === PAYMENT_STATUS.RECEIPT_UPLOADED) {
    return { text: 'Dekont yüklendi – onay bekleniyor', cls: 'bg-sky-500/10 border-sky-500/30 text-sky-300' };
  }

  if (txn.buyer_payment_notified_at && txn.payment_status === PAYMENT_STATUS.WAITING) {
    return { text: 'Ödeme onayı bekleniyor', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' };
  }

  if (txn.payment_status === PAYMENT_STATUS.REJECTED) {
    return { text: 'Ödeme reddedildi', cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300' };
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
  var isDisputeOpen = !!txn.dispute_status && txn.dispute_status !== 'none' && txn.dispute_status !== 'resolved' && txn.dispute_status !== 'rejected';

  return {
    ticket_verified: isActive
      && txn.ticket_status === TICKET_STATUS.UPLOADED
      && !!txn.ticket_file_path
      && !txn.ticket_verified_at,

    payment_received: isActive
      && isTicketVerified(txn)
      && !!txn.receipt_file_path
      && !!txn.buyer_payment_notified_at
      && txn.payment_status === PAYMENT_STATUS.RECEIPT_UPLOADED,

    payment_rejected: isActive
      && isTicketVerified(txn)
      && !!txn.receipt_file_path
      && (txn.payment_status === PAYMENT_STATUS.RECEIPT_UPLOADED || txn.payment_status === PAYMENT_STATUS.WAITING),

    release_ticket_to_buyer: isActive
      && !!txn.ticket_file_path
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && isTicketVerified(txn)
      && txn.ticket_status !== TICKET_STATUS.SENT_TO_BUYER
      && txn.ticket_status !== TICKET_STATUS.RELEASED_TO_BUYER
      && txn.ticket_status !== TICKET_STATUS.DELIVERED,

    ticket_sent_to_buyer: isActive
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && isTicketVerified(txn)
      && txn.ticket_status !== TICKET_STATUS.SENT_TO_BUYER
      && txn.ticket_status !== TICKET_STATUS.RELEASED_TO_BUYER
      && txn.ticket_status !== TICKET_STATUS.DELIVERED,

    buyer_confirmed: isActive
      && (txn.ticket_status === TICKET_STATUS.SENT_TO_BUYER || txn.ticket_status === TICKET_STATUS.DELIVERED)
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && txn.completion_status === COMPLETION_STATUS.PENDING,

    money_sent_to_seller: isActive
      && txn.payment_status === PAYMENT_STATUS.RECEIVED
      && !isDisputeOpen
      && txn.completion_status !== COMPLETION_STATUS.MONEY_SENT_TO_SELLER,

    refund_approved: isActive
      && !!txn.dispute_reason
      && !!txn.dispute_status
      && txn.dispute_status !== 'none'
      && txn.dispute_status !== 'under_review'
      && txn.dispute_status !== 'rejected'
      && txn.dispute_status !== 'resolved',

    refund_rejected: isActive
      && !!txn.dispute_reason
      && !!txn.dispute_status
      && txn.dispute_status !== 'none'
      && txn.dispute_status !== 'rejected'
      && txn.dispute_status !== 'resolved',

    buyer_refunded: isActive
      && !!txn.dispute_reason
      && !!txn.dispute_status
      && txn.dispute_status !== 'none'
      && txn.dispute_status !== 'rejected'
      && txn.dispute_status !== 'resolved'
      && txn.payment_status !== PAYMENT_STATUS.REFUNDED,

    seller_paid: isActive
      && !!txn.dispute_reason
      && !!txn.dispute_status
      && txn.dispute_status !== 'none'
      && txn.dispute_status !== 'rejected'
      && txn.dispute_status !== 'resolved'
      && txn.payout_status !== PAYOUT_STATUS.SENT,

    completed: isActive
      && txn.completion_status === COMPLETION_STATUS.MONEY_SENT_TO_SELLER,

    cancelled: isActive
  };
}
async function fetchTransactionSellerPayoutInfo(userId) {
  if (!sb || !userId) return null;
  var res = await sb
    .from('seller_payout_methods')
    .select('full_name, iban, account_name, bank_name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    console.error('[biletakas] Payout bilgisi çekilemedi:', res.error);
    return null;
  }

  return res.data || null;
}

async function getUpdatesForAdminAction(action, txn) {
  var now = new Date().toISOString();

  switch (action) {
    case TRANSACTION_ADMIN_ACTIONS.TICKET_VERIFIED:
    case 'ticket_verified':
      return {
        ticket_status: TICKET_STATUS.VERIFIED,
        ticket_verified_at: now
      };

    case TRANSACTION_ADMIN_ACTIONS.PAYMENT_RECEIVED:
    case 'payment_received':
      return {
        payment_status: PAYMENT_STATUS.RECEIVED
      };

    case TRANSACTION_ADMIN_ACTIONS.PAYMENT_REJECTED:
    case 'payment_rejected':
      return {
        payment_status: PAYMENT_STATUS.REJECTED
      };

    case TRANSACTION_ADMIN_ACTIONS.RELEASE_TICKET_TO_BUYER:
    case 'release_ticket_to_buyer':
      return {
        ticket_status: TICKET_STATUS.RELEASED_TO_BUYER,
        ticket_delivered_at: now
      };

    case TRANSACTION_ADMIN_ACTIONS.TICKET_SENT_TO_BUYER:
    case 'ticket_sent_to_buyer':
      return {
        ticket_status: TICKET_STATUS.SENT_TO_BUYER,
        ticket_delivered_at: now
      };

    case TRANSACTION_ADMIN_ACTIONS.BUYER_CONFIRMED:
    case 'buyer_confirmed':
      return {
        completion_status: COMPLETION_STATUS.BUYER_CONFIRMED
      };

    case 'money_sent_to_seller':
      var payoutUpdates = {
        completion_status: COMPLETION_STATUS.MONEY_SENT_TO_SELLER,
        payout_status: PAYOUT_STATUS.SENT,
        payout_sent_at: now
      };

      if (txn) {
        var breakdown = getTransactionPricingBreakdown(txn);
        payoutUpdates.buyer_total_amount = breakdown.buyerTotalAmount;
        payoutUpdates.service_fee = breakdown.serviceFee;
        payoutUpdates.platform_commission = breakdown.platformCommission;
        payoutUpdates.seller_payout_amount = breakdown.sellerPayoutAmount;

        if (!txn.payout_iban && txn.seller_id) {
          var payoutInfo = await fetchTransactionSellerPayoutInfo(txn.seller_id);
          if (payoutInfo) {
            payoutUpdates.payout_iban = payoutInfo.iban || null;
            payoutUpdates.payout_account_name = payoutInfo.account_name || payoutInfo.full_name || null;
          }
        }
      }

      return payoutUpdates;

    case TRANSACTION_ADMIN_ACTIONS.REFUND_APPROVED:
    case 'refund_approved':
      return {
        dispute_status: 'under_review',
        payout_status: PAYOUT_STATUS.PROCESSING
      };

    case TRANSACTION_ADMIN_ACTIONS.REFUND_REJECTED:
    case 'refund_rejected':
      return {
        dispute_status: 'rejected',
        payout_status: PAYOUT_STATUS.PENDING
      };

    case TRANSACTION_ADMIN_ACTIONS.BUYER_REFUNDED:
    case 'buyer_refunded':
      return {
        payment_status: PAYMENT_STATUS.REFUNDED,
        completion_status: COMPLETION_STATUS.CANCELLED,
        dispute_status: 'resolved',
        payout_status: PAYOUT_STATUS.FAILED
      };

    case TRANSACTION_ADMIN_ACTIONS.SELLER_PAID:
    case 'seller_paid':
      return {
        completion_status: COMPLETION_STATUS.COMPLETED,
        dispute_status: 'resolved',
        payout_status: PAYOUT_STATUS.SENT,
        payout_sent_at: now
      };

    case TRANSACTION_ADMIN_ACTIONS.COMPLETED:
    case 'completed':
      return {
        completion_status: COMPLETION_STATUS.COMPLETED
      };

    case TRANSACTION_ADMIN_ACTIONS.CANCELLED:
    case 'cancelled':
      return {
        completion_status: COMPLETION_STATUS.CANCELLED
      };

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
        || txn.ticket_status === TICKET_STATUS.RELEASED_TO_BUYER
        || txn.ticket_status === TICKET_STATUS.DELIVERED;
    case 'money_sent_to_seller':
      return txn.completion_status === COMPLETION_STATUS.MONEY_SENT_TO_SELLER;
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

function renderTransactionStepper(txn) {
  if (!txn) return '';

  var steps = [
    { key: 'ticket', label: 'Bilet', done: !!txn.ticket_file_path || isTicketVerified(txn) },
    { key: 'payment', label: 'Ödeme', done: txn.payment_status === PAYMENT_STATUS.RECEIVED || txn.payment_status === PAYMENT_STATUS.RECEIPT_UPLOADED || txn.payment_status === PAYMENT_STATUS.REFUNDED },
    { key: 'delivery', label: 'Teslim', done: txn.ticket_status === TICKET_STATUS.SENT_TO_BUYER || txn.ticket_status === TICKET_STATUS.RELEASED_TO_BUYER || txn.ticket_status === TICKET_STATUS.DELIVERED || txn.completion_status === COMPLETION_STATUS.COMPLETED },
    { key: 'complete', label: 'Tamam', done: txn.completion_status === COMPLETION_STATUS.COMPLETED || txn.completion_status === COMPLETION_STATUS.CANCELLED }
  ];

  var items = steps.map(function (step) {
    var isDone = step.done;
    var cls = isDone
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-zinc-800/80 text-zinc-400 border-white/10';
    return '<div class="flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + cls + '"><span class="h-2 w-2 rounded-full ' + (isDone ? 'bg-emerald-400' : 'bg-zinc-500') + '"></span>' + escapeHtml(step.label) + '</div>';
  }).join('');

  return '<div class="mt-3 flex flex-wrap gap-2">' + items + '</div>';
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

async function applyAdminTransactionAction(transactionId, action, currentTxn, logFn) {
  var updates = await getUpdatesForAdminAction(action, currentTxn);
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

  if (res.data) {
    if (action === 'payment_received') {
      await writeTransactionNotification(res.data.id, res.data.seller_id, 'payment_approved', 'Ödeme onaylandı', 'Ödemeniz doğrulandı. Bilet teslim süreci başlatıldı.');
    } else if (action === 'release_ticket_to_buyer') {
      await writeTransactionNotification(res.data.id, res.data.buyer_id, 'ticket_released', 'Bilet açıldı', 'Biletiniz platform üzerinden erişilebilir hale geldi.');
    } else if (action === 'refund_approved') {
      await writeTransactionNotification(res.data.id, res.data.buyer_id, 'refund_approved', 'İade onaylandı', 'İade talebiniz onaylandı.');
    } else if (action === 'money_sent_to_seller' || action === 'seller_paid') {
      await writeTransactionNotification(res.data.id, res.data.seller_id, 'seller_paid', 'Ödeme gönderildi', 'Satıcı payout işlemi tamamlandı.');
    }
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

function validateReceiptFile(file) {
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

function buildReceiptStoragePath(transactionId, fileName) {
  var ext = (fileName.split('.').pop() || 'bin').toLowerCase();
  var safeExt = TICKET_ALLOWED_EXTENSIONS.indexOf(ext) !== -1 ? ext : 'bin';
  return transactionId + '/receipt-' + Date.now() + '.' + safeExt;
}

function buildDisputeEvidenceStoragePath(transactionId, fileName) {
  var ext = (fileName.split('.').pop() || 'bin').toLowerCase();
  var safeExt = TICKET_ALLOWED_EXTENSIONS.indexOf(ext) !== -1 ? ext : 'bin';
  return transactionId + '/dispute-' + Date.now() + '.' + safeExt;
}

async function uploadPayoutReceipt(transactionId, file) {
  if (!sb || !AppState.user) {
    return { data: null, error: new Error('Giriş yapmalısınız.') };
  }

  var validationError = validateReceiptFile(file);
  if (validationError) return { data: null, error: new Error(validationError) };

  var ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  var safeExt = TICKET_ALLOWED_EXTENSIONS.indexOf(ext) !== -1 ? ext : 'bin';
  var storagePath = transactionId + '/payout-' + Date.now() + '.' + safeExt;
  var uploadRes = await sb.storage
    .from('transaction-receipts')
    .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });

  if (uploadRes.error) return { data: null, error: uploadRes.error };

  return updateTransactionFields(transactionId, {
    payout_receipt_path: storagePath
  });
}

async function openBuyerDispute(transactionId, reason, file) {
  if (!sb || !AppState.user) {
    return { data: null, error: new Error('Giriş yapmalısınız.') };
  }

  var trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    return { data: null, error: new Error('Lütfen bir sorun nedeni yazın.') };
  }

  var storagePath = null;
  if (file) {
    var validationError = validateReceiptFile(file);
    if (validationError) return { data: null, error: new Error(validationError) };
    storagePath = buildDisputeEvidenceStoragePath(transactionId, file.name);
    var uploadRes = await sb.storage
      .from('transaction-receipts')
      .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });
    if (uploadRes.error) return { data: null, error: uploadRes.error };
  }

  var now = new Date().toISOString();
  var res = await updateTransactionFields(transactionId, {
    dispute_reason: trimmedReason,
    dispute_evidence_path: storagePath,
    dispute_status: 'open',
    dispute_created_at: now,
    payout_status: PAYOUT_STATUS.PROCESSING
  });

  if (res.error || !res.data) return res;

  await writeTransactionLog(
    'refund_approved',
    'Alıcı sorun bildirdi — ' + (res.data.transaction_code || ''),
    {
      transaction_id: res.data.id,
      transaction_code: res.data.transaction_code,
      dispute_reason: trimmedReason,
      dispute_status: 'open'
    }
  );

  await writeTransactionNotification(
    res.data.id,
    res.data.seller_id,
    'dispute_opened',
    'Sorun bildirimi',
    'Alıcı bir sorun bildirdi. Admin inceleyecek.'
  );

  return res;
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

async function uploadBuyerReceipt(transactionId, file, paymentNote) {
  if (!sb || !AppState.user) {
    return { data: null, error: new Error('Giriş yapmalısınız.') };
  }

  var validationError = validateReceiptFile(file);
  if (validationError) return { data: null, error: new Error(validationError) };

  var storagePath = buildReceiptStoragePath(transactionId, file.name);
  var uploadRes = await sb.storage
    .from('transaction-receipts')
    .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });

  if (uploadRes.error) return { data: null, error: uploadRes.error };

  var now = new Date().toISOString();
  var updateRes = await updateTransactionFields(transactionId, {
    receipt_file_path: storagePath,
    receipt_uploaded_at: now,
    payment_note: paymentNote || null,
    payment_status: PAYMENT_STATUS.RECEIPT_UPLOADED
  });

  if (updateRes.error || !updateRes.data) return updateRes;

  await writeTransactionLog(
    'receipt_uploaded',
    'Alıcı dekont yükledi — ' + (updateRes.data.transaction_code || ''),
    {
      transaction_id: updateRes.data.id,
      transaction_code: updateRes.data.transaction_code,
      receipt_file_path: storagePath
    }
  );

  await writeTransactionNotification(
    updateRes.data.id,
    updateRes.data.seller_id,
    'receipt_uploaded',
    'Dekont yüklendi',
    'Alıcı dekont yükledi. Admin onayı bekleniyor.'
  );

  return updateRes;
}

async function buyerNotifyPayment(transactionId) {
  if (!sb || !AppState.user) {
    return { data: null, error: new Error('Giriş yapmalısınız.') };
  }

  var transactionRes = await sb
    .from('transactions')
    .select('id, receipt_file_path, payment_status')
    .eq('id', transactionId)
    .maybeSingle();

  if (transactionRes.error || !transactionRes.data) {
    return { data: null, error: transactionRes.error || new Error('İşlem bulunamadı.') };
  }

  if (!transactionRes.data.receipt_file_path) {
    return { data: null, error: new Error('Önce dekont yüklemeniz gerekiyor.') };
  }

  var now = new Date().toISOString();
  var res = await updateTransactionFields(transactionId, {
    buyer_payment_notified_at: now,
    payment_status: PAYMENT_STATUS.RECEIPT_UPLOADED
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

  await writeTransactionNotification(
    res.data.id,
    res.data.seller_id,
    'payment_notice',
    'Ödeme bildirimi',
    'Alıcı ödeme yaptığını bildirdi. Admin inceleyecek.'
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

async function getReceiptSignedUrl(filePath, expiresIn) {
  if (!sb || !filePath) return null;

  var res = await sb.storage
    .from('transaction-receipts')
    .createSignedUrl(filePath, expiresIn || 3600);

  if (res.error) {
    console.error('[biletakas] Dekont URL oluşturulamadı:', res.error);
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

async function writeTransactionNotification(transactionId, userId, type, title, message) {
  if (!sb || !transactionId || !userId || !type || !title || !message) return;

  try {
    await sb.from('notifications').insert({
      user_id: userId,
      transaction_id: transactionId,
      type: type,
      title: title,
      message: message
    });
  } catch (err) {
    console.warn('[biletakas] Bildirim kaydedilemedi:', err);
  }
}

function renderIbanCardHtml(txn) {
  if (!canShowIbanToBuyer(txn)) return '';

  var iban = typeof BILETAKAS_IBAN !== 'undefined' ? BILETAKAS_IBAN : {};
  var breakdown = getTransactionPricingBreakdown(txn);
  return (
    '<div class="mt-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-accent/10 border border-emerald-500/20 p-3.5">' +
      '<p class="text-xs font-semibold text-emerald-300 mb-2">Ödeme Bilgileri (IBAN)</p>' +
      '<p class="text-sm text-white font-medium">' + escapeHtml(iban.accountName || 'Biletakas') + '</p>' +
      '<p class="text-sm text-zinc-300 mt-1">' + escapeHtml(iban.bank || '') + '</p>' +
      '<p class="text-base font-mono font-bold text-white mt-2 tracking-wide">' + escapeHtml(iban.iban || '') + '</p>' +
      '<p class="text-xs text-zinc-400 mt-2">Toplam ödenecek: <span class="text-white font-semibold">' + formatTransactionAmount(breakdown.buyerTotalAmount) + '</span></p>' +
      '<p class="text-xs text-zinc-500 mt-1">Alıcının ödeyeceği: <span class="text-emerald-300">' + formatTransactionAmount(breakdown.sellerPayoutAmount) + '</span></p>' +
      '<p class="text-xs text-zinc-500 mt-1">' + escapeHtml(iban.descriptionHint || 'Açıklamaya işlem kodunu yazın.') + '</p>' +
      '<p class="text-xs text-accent-light mt-1 font-mono">' + escapeHtml(txn.transaction_code) + '</p>' +
    '</div>'
  );
}
