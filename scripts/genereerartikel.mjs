// Genereert maandelijks een nieuw juridisch artikel in de huisstijl van
// SpoedRechtshulp met de Anthropic API (Claude). Schrijft een nieuwe
// <slug>.html pagina, voegt een kaart toe aan artikelen.html en breidt
// (indien aanwezig) sitemap.xml uit.
//
// Vereist de omgevingsvariabele ANTHROPIC_API_KEY (in GitHub als Secret).

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("ANTHROPIC_API_KEY ontbreekt. Stel deze in als GitHub Secret.");
  process.exit(1);
}

const SITE = "https://www.spoedrechtshulp.nl";
const VANDAAG = new Date().toISOString().slice(0, 10);

// Bestaande pagina's — zodat de AI geen dubbel onderwerp kiest.
const bestaandePaginas = readdirSync(".")
  .filter((f) => f.endsWith(".html"))
  .join(", ");

// ===== JSON-schema voor gegarandeerd geldige output =====
const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "slug", "categorie", "tag", "metaTitle", "metaDescription", "keywords",
    "heroTitle", "heroSub", "bodyHtml", "faq", "kaartTitel", "kaartOmschrijving",
  ],
  properties: {
    slug: { type: "string" },
    categorie: { type: "string", enum: ["rijbewijs", "auto"] },
    tag: { type: "string" },
    metaTitle: { type: "string" },
    metaDescription: { type: "string" },
    keywords: { type: "string" },
    heroTitle: { type: "string" },
    heroSub: { type: "string" },
    bodyHtml: { type: "string" },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["vraag", "antwoord"],
        properties: {
          vraag: { type: "string" },
          antwoord: { type: "string" },
        },
      },
    },
    kaartTitel: { type: "string" },
    kaartOmschrijving: { type: "string" },
  },
};

const systeem = `Je bent een Nederlandse jurist en SEO-copywriter voor SpoedRechtshulp Advocaten, gespecialiseerd in strafrechtelijke inbeslagname van rijbewijs en auto. Je schrijft feitelijk correcte, professionele artikelen op basis van Nederlands recht (o.a. art. 164 WVW, art. 552a Sv, art. 94 en 94a Sv). Je maakt geen valse beloftes en geeft geen garanties op de uitkomst van een procedure.`;

const gebruiker = `Schrijf één nieuw, uniek juridisch artikel (long-tail zoekterm) over rijbewijs- of auto-inbeslagname voor de kennisbank van spoedrechtshulp.nl.

Kies een concreet onderwerp dat NOG NIET is behandeld. Reeds bestaande pagina's: ${bestaandePaginas}.

Eisen:
- 700 tot 1000 woorden, in het Nederlands, u-vorm.
- "bodyHtml" bevat ALLEEN de artikeltekst als HTML: <h2>, <h3>, <p>, <ul>/<li> en <strong>. Geen <html>, <head>, <script>, <style> of afbeeldingen. Begin met een <p>-inleiding, daarna kopjes.
- Noem waar relevant de juiste wetsartikelen en termijnen.
- "slug": korte kebab-case zonder .html (bijv. "rijbewijs-terugvragen-bij-om").
- "categorie": "rijbewijs" of "auto".
- "tag": "Rijbewijs" of "Auto".
- "metaTitle": max ~60 tekens, eindigend op " | SpoedRechtshulp".
- "metaDescription": max ~155 tekens.
- "heroTitle": pakkende titel; je mag één woord in <em>...</em> cursiveren.
- "heroSub": 1-2 zinnen intro.
- "faq": 3 tot 4 relevante vraag/antwoord-paren.
- "kaartTitel" en "kaartOmschrijving": korte tekst voor de overzichtskaart (omschrijving max ~120 tekens).
Sluit af met een korte alinea die aanraadt vrijblijvend contact op te nemen met SpoedRechtshulp.`;

// ===== Anthropic API aanroepen (raw HTTP, geen dependencies) =====
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: systeem,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: gebruiker }],
  }),
});

if (!res.ok) {
  console.error("API-fout:", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
if (data.stop_reason === "refusal") {
  console.error("Verzoek geweigerd door de API.");
  process.exit(1);
}
const tekstblok = data.content.find((b) => b.type === "text");
const a = JSON.parse(tekstblok.text);

const slug = a.slug.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
const bestand = `${slug}.html`;
if (!slug || existsSync(bestand)) {
  console.error(`Ongeldige of bestaande slug: "${slug}". Gestopt.`);
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const parent = a.categorie === "auto"
  ? { label: "Auto Inbeslagname", href: "auto-inbeslagname.html" }
  : { label: "Rijbewijs Inbeslagname", href: "rijbewijs-inbeslagname.html" };

const faqSchemaJson = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: a.faq.map((f) => ({
    "@type": "Question",
    name: f.vraag,
    acceptedAnswer: { "@type": "Answer", text: f.antwoord },
  })),
}, null, 2);

const artikelSchemaJson = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: a.heroTitle.replace(/<[^>]+>/g, ""),
  description: a.metaDescription,
  author: { "@type": "Organization", name: "SpoedRechtshulp Advocaten" },
  publisher: { "@type": "Organization", name: "SpoedRechtshulp Advocaten", url: SITE },
  datePublished: VANDAAG,
  dateModified: VANDAAG,
}, null, 2);

const faqHtml = a.faq.map((f) => `        <details class="faq-item">
          <summary>${esc(f.vraag)}</summary>
          <div class="faq-body">${esc(f.antwoord)}</div>
        </details>`).join("\n");

// ===== Volledige HTML-pagina bouwen =====
const pagina = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(a.metaTitle)}</title>
  <meta name="description" content="${esc(a.metaDescription)}" />
  <meta name="keywords" content="${esc(a.keywords)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE}/${bestand}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${SITE}/${bestand}" />
  <meta property="og:title" content="${esc(a.metaTitle)}" />
  <meta property="og:description" content="${esc(a.metaDescription)}" />
  <meta property="og:site_name" content="SpoedRechtshulp" />

  <script type="application/ld+json">
${artikelSchemaJson}
  </script>
  <script type="application/ld+json">
${faqSchemaJson}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/styles.css" />
  <link rel="stylesheet" href="css/spoke.css" />
</head>
<body>

  <nav class="navbar">
    <div class="nav-inner">
      <a href="index.html" class="logo">
        <span class="logo-mark">SR</span>
        <span class="logo-text">Spoed<span class="logo-accent">Rechtshulp</span></span>
      </a>
      <nav class="nav-links" id="nav-links">
        <a href="rijbewijs-inbeslagname.html" class="nav-link">Rijbewijs Inbeslagname</a>
        <a href="auto-inbeslagname.html" class="nav-link">Auto Inbeslagname</a>
        <a href="artikelen.html" class="nav-link">Artikelen</a>
      </nav>
      <div class="nav-right">
        <button class="nav-hamburger" id="nav-hamburger" aria-label="Menu" onclick="toggleMenu()">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </nav>

  <section class="spoke-hero">
    <div class="spoke-hero-inner">
      <div class="spoke-breadcrumb">
        <a href="index.html">Home</a> <span>›</span>
        <a href="${parent.href}">${parent.label}</a> <span>›</span>
        <span>${esc(a.tag)}</span>
      </div>
      <div class="urgency-badge"><span class="badge-dot"></span> Juridische Gids</div>
      <h1 class="spoke-title">${a.heroTitle}</h1>
      <p class="spoke-sub">${esc(a.heroSub)}</p>
      <div class="spoke-cta-bar">
        <a class="spoke-cta-primary" href="${parent.href}">Start uw aanvraag direct <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
      </div>
    </div>
  </section>

  <div class="spoke-layout">
    <article class="spoke-article">
${a.bodyHtml}

      <h2>Veelgestelde vragen</h2>
      <div class="faq-list">
${faqHtml}
      </div>
    </article>
  </div>

  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-logo">
        <span class="logo-mark" style="font-size:.85rem;padding:6px 9px;">SR</span>
        <span class="logo-text" style="font-size:1rem;">Spoed<span class="logo-accent">Rechtshulp</span></span>
      </div>
      <div class="footer-credentials">
        <span>KvK: 88057283</span>
      </div>
      <div class="footer-links">
        <a href="privacy.html">Privacyverklaring</a>
      </div>
      <p class="footer-copy">&copy; 2026 SpoedRechtshulp Advocaten — Alle rechten voorbehouden</p>
    </div>
  </footer>

  <a href="https://wa.me/31682756789?text=Hallo%2C%20ik%20heb%20een%20juridische%20vraag." class="whatsapp-btn" target="_blank" rel="noopener" aria-label="Contact via WhatsApp">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
  </a>

  <script src="js/app.js"></script>
</body>
</html>
`;

writeFileSync(bestand, pagina);
console.log(`Nieuwe pagina geschreven: ${bestand}`);

// ===== Kaart toevoegen aan artikelen.html =====
if (existsSync("artikelen.html")) {
  let overzicht = readFileSync("artikelen.html", "utf8");
  const anker = a.categorie === "auto"
    ? '<div class="artikelen-lijst" id="auto-artikelen">'
    : '<div class="artikelen-lijst" id="rijbewijs-artikelen">';
  const kaart = `
      <a href="${bestand}" class="artikel-kaart">
        <span class="artikel-tag">${esc(a.tag)}</span>
        <span class="artikel-titel">${esc(a.kaartTitel)}</span>
        <span class="artikel-omschrijving">${esc(a.kaartOmschrijving)}</span>
        <span class="artikel-lees-meer">Lees meer →</span>
      </a>
`;
  if (overzicht.includes(anker)) {
    overzicht = overzicht.replace(anker, anker + kaart);
    writeFileSync("artikelen.html", overzicht);
    console.log("Kaart toegevoegd aan artikelen.html");
  } else {
    console.warn("Anker in artikelen.html niet gevonden — kaart niet toegevoegd.");
  }
}

// ===== URL toevoegen aan sitemap.xml (indien aanwezig) =====
if (existsSync("sitemap.xml")) {
  let sitemap = readFileSync("sitemap.xml", "utf8");
  const entry = `  <url>
    <loc>${SITE}/${bestand}</loc>
    <lastmod>${VANDAAG}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  if (!sitemap.includes(`${SITE}/${bestand}`)) {
    sitemap = sitemap.replace("</urlset>", entry + "</urlset>");
    writeFileSync("sitemap.xml", sitemap);
    console.log("URL toegevoegd aan sitemap.xml");
  }
}
