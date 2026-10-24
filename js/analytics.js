// ===== ANALYTICS + COOKIE CONSENT =====
// Google Analytics laadt pas nadat de bezoeker cookies heeft geaccepteerd (AVG/Telecommunicatiewet).
// Wordt in de <head> van elke pagina geladen, vóór js/app.js.

var GA_ID = 'G-8LLFKVFR7Q';

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

function getConsent() {
  try { return localStorage.getItem('cookie-consent'); } catch (e) { return null; }
}

function setConsent(value) {
  try { localStorage.setItem('cookie-consent', value); } catch (e) { /* geen opslag beschikbaar */ }
}

function loadAnalytics() {
  if (window.__gaLoaded) return;
  window.__gaLoaded = true;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });
}

if (getConsent() === 'accepted') loadAnalytics();

function hideCookieBanner() {
  var b = document.getElementById('cookie-banner');
  if (b) b.classList.add('hidden');
}

function acceptCookies() {
  setConsent('accepted');
  hideCookieBanner();
  loadAnalytics();
}

function declineCookies() {
  setConsent('declined');
  hideCookieBanner();
}

document.addEventListener('DOMContentLoaded', function () {
  // Banner op elke pagina tonen zolang er nog geen keuze is gemaakt
  // (bezoekers uit Google landen meestal op een subpagina, niet op de homepage).
  var banner = document.getElementById('cookie-banner');
  if (getConsent()) {
    if (banner) banner.classList.add('hidden');
  } else if (!banner) {
    var div = document.createElement('div');
    div.className = 'cookie-banner';
    div.id = 'cookie-banner';
    div.innerHTML =
      '<div class="cookie-inner">' +
        '<p>Wij gebruiken cookies om bezoekersstatistieken bij te houden. Lees onze <a href="privacy.html">privacyverklaring</a>.</p>' +
        '<div class="cookie-btns">' +
          '<button class="cookie-accept" type="button">Accepteren</button>' +
          '<button class="cookie-decline" type="button">Alleen noodzakelijk</button>' +
        '</div>' +
      '</div>';
    div.querySelector('.cookie-accept').addEventListener('click', acceptCookies);
    div.querySelector('.cookie-decline').addEventListener('click', declineCookies);
    document.body.appendChild(div);
  }

  // WhatsApp-kliks meten als lead-event
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me"]');
    if (a) gtag('event', 'whatsapp_click', { page_path: location.pathname });
  });
});
