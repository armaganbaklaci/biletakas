// ============================================================
// biletakas — Uygulama Başlangıcı
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  wireAuthUI();
  wireListingsUI();
  wireOfferModalUI();
  wireMyOffersUI();

  if (typeof wireAdminUI === 'function') {
    wireAdminUI();
  }

  initAuth();
  loadAndRenderListings();
});