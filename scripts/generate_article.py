import anthropic
import os
import re
from datetime import date
from pathlib import Path

REPO_DIR = Path(__file__).parent.parent

TOPICS = [
    (
        "rijbewijs-inleveren-hoe-lang.html",
        "Hoe Lang Duurt Rijbewijs Inbeslagname?",
        "Rijbewijs",
        "rijbewijs",
        "Hoe lang mag de politie en het OM uw rijbewijs inhouden? Alle termijnen op een rij en wat u kunt doen als de termijn wordt overschreden.",
    ),
    (
        "bezwaar-vorderingsbesluit.html",
        "Bezwaar Maken tegen het Vorderingsbesluit",
        "Rijbewijs",
        "rijbewijs",
        "Ontvangen u een vorderingsbesluit? Leer hoe u via een verzoekschrift of klaagschrift bezwaar maakt en uw rijbewijs terugkrijgt.",
    ),
    (
        "rijbewijs-terug-spoed.html",
        "Rijbewijs Spoed Terugkrijgen — Procedure",
        "Rijbewijs",
        "rijbewijs",
        "Uw rijbewijs op zo kort mogelijke termijn terugkrijgen. Welke spoedrouteprocedures bestaan er en hoe snel kan een advocaat handelen?",
    ),
    (
        "auto-inbeslagname-belastingdienst.html",
        "Auto Inbeslagname door de Belastingdienst",
        "Auto",
        "auto",
        "De belastingdienst heeft uw auto in beslag genomen wegens belastingschulden. Wat zijn uw rechten en hoe krijgt u uw auto terug?",
    ),
    (
        "rijbewijs-ongeldig-verklaard.html",
        "Rijbewijs Ongeldig Verklaard — Wat Nu?",
        "Rijbewijs",
        "rijbewijs",
        "Het CBR heeft uw rijbewijs ongeldig verklaard. Wat betekent dit, welke bezwaarmogelijkheden heeft u en hoe helpt een advocaat?",
    ),
    (
        "kosten-advocaat-rijbewijs.html",
        "Kosten Advocaat bij Rijbewijs Inbeslagname",
        "Rijbewijs",
        "rijbewijs",
        "Wat kost een advocaat bij rijbewijs inbeslagname? Alles over tarieven, toevoeging en gesubsidieerde rechtsbijstand.",
    ),
    (
        "recidive-rijbewijs-inbeslagname.html",
        "Recidive en Rijbewijs Inbeslagname",
        "Rijbewijs",
        "rijbewijs",
        "Eerder uw rijbewijs kwijtgeraakt en opnieuw betrapt? Wat zijn de gevolgen van recidive en welke juridische mogelijkheden blijven er over?",
    ),
    (
        "schadevergoeding-onterechte-inbeslagname.html",
        "Schadevergoeding bij Onterechte Inbeslagname",
        "Rijbewijs",
        "rijbewijs",
        "Bleek uw rijbewijs of auto ten onrechte in beslag genomen? Leer hoe u schadevergoeding kunt vorderen van de overheid.",
    ),
]


def pick_topic():
    for topic in TOPICS:
        if not (REPO_DIR / topic[0]).exists():
            return topic
    return None


def read_template():
    return (REPO_DIR / "rijbewijs-inbeslagname.html").read_text(encoding="utf-8")


def generate_article(filename, title, tag, triage, template):
    client = anthropic.Anthropic()
    today = date.today().isoformat()
    canonical = f"https://www.spoedrechtshulp.nl/{filename}"

    prompt = f"""Je bent een juridisch contentschrijver voor SpoedRechtshulp Advocaten (spoedrechtshulp.nl), gespecialiseerd in rijbewijs- en auto-inbeslagname.

Schrijf een volledig SEO-geoptimaliseerd HTML-artikel over: **{title}**

Gebruik EXACT dezelfde HTML-structuur als het onderstaande template. Pas alleen de inhoud aan (title, meta, h1, hero-tekst, artikel-tekst, FAQ's, sidebar, etc.).

Verplichte regels:
- Minimaal 800 woorden kwalitatieve juridische content in het Nederlands
- Canonical URL: {canonical}
- Alle WhatsApp-links: https://wa.me/31682756789
- KvK: 88057283 in de footer
- GEEN telefoonnummer vermelden
- GEEN e-mailadres vermelden
- GEEN Google Analytics script
- Chat sectie: startTriage('{triage}') in de scrollToChat-functie
- datePublished en dateModified: {today}
- Navbar bevat: <a href="artikelen.html" class="nav-link">Artikelen</a>
- Verwijs in de tekst naar gerelateerde pagina's op de site
- Minimaal 4 FAQ-items met bijbehorend FAQPage Schema.org JSON-LD blok
- Geef ALLEEN de volledige HTML terug, geen uitleg of markdown

TEMPLATE:
{template}"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    html = message.content[0].text.strip()
    # Verwijder eventuele markdown code-fences
    html = re.sub(r"^```html?\n?", "", html)
    html = re.sub(r"\n?```$", "", html)
    return html.strip()


def update_artikelen(filename, title, tag, description):
    path = REPO_DIR / "artikelen.html"
    content = path.read_text(encoding="utf-8")

    new_card = (
        f'\n      <a href="{filename}" class="artikel-kaart">\n'
        f'        <span class="artikel-tag">{tag}</span>\n'
        f'        <span class="artikel-titel">{title}</span>\n'
        f'        <span class="artikel-omschrijving">{description}</span>\n'
        f'        <span class="artikel-lees-meer">Lees meer &rarr;</span>\n'
        f"      </a>\n"
    )

    if tag == "Auto":
        marker = '    </div>\n\n  </div>\n\n  <!-- FOOTER -->'
    else:
        marker = '\n    </div>\n\n    <p class="artikelen-sectie-titel">Auto</p>'

    if marker in content:
        content = content.replace(marker, new_card + marker)
    else:
        # Fallback: voeg toe vóór de sluitende rijbewijs-lijst
        content = content.replace(
            '    </div>\n\n    <p class="artikelen-sectie-titel">Auto</p>',
            new_card + '    </div>\n\n    <p class="artikelen-sectie-titel">Auto</p>',
        )

    path.write_text(content, encoding="utf-8")


def update_sitemap(filename):
    path = REPO_DIR / "sitemap.xml"
    content = path.read_text(encoding="utf-8")
    today = date.today().isoformat()

    new_entry = (
        f"  <url>\n"
        f"    <loc>https://www.spoedrechtshulp.nl/{filename}</loc>\n"
        f"    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>monthly</changefreq>\n"
        f"    <priority>0.7</priority>\n"
        f"  </url>\n"
        f"</urlset>"
    )
    content = content.replace("</urlset>", new_entry)
    path.write_text(content, encoding="utf-8")


def main():
    topic = pick_topic()
    if not topic:
        print("Alle artikelen zijn al geschreven!")
        return

    filename, title, tag, triage, description = topic
    print(f"Genereer artikel: {title} ({filename})")

    template = read_template()
    html = generate_article(filename, title, tag, triage, template)

    output_path = REPO_DIR / filename
    output_path.write_text(html, encoding="utf-8")
    print(f"Artikel opgeslagen: {filename}")

    update_artikelen(filename, title, tag, description)
    print("artikelen.html bijgewerkt")

    update_sitemap(filename)
    print("sitemap.xml bijgewerkt")

    print(f"Klaar! Nieuw artikel: {title}")


if __name__ == "__main__":
    main()
