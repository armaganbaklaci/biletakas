// ============================================================
// biletakas — Uygulama Başlangıcı
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  wireAuthUI();
  wireListingsUI();
  wireOfferModalUI();
  wireMyOffersUI();
  wireAdminUI();

  initAuth();
  loadAndRenderListings();
});
