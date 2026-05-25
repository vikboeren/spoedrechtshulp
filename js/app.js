// ===== EMAIL CONFIGURATIE =====
const EMAIL_CONFIG = {
  publicKey:  'AjC1aOiOrUoy_0r-k',
  serviceId:  'service_d5o9cir',
  templateId: 'template_uyc8vio'
};

// EmailJS variabelen in uw template:
// {{onderwerp}}  — Rijbewijs of Auto inbeslagname
// {{naam}}       — Naam van de aanvrager
// {{telefoon}}   — Telefoonnummer
// {{email}}      — E-mailadres
// {{contacttijd}} — Voorkeur contactmoment
// {{antwoorden}} — Samenvatting van de antwoorden

// ===== VRAGENLIJSTEN =====
const TRIAGE_FLOWS = {
  rijbewijs: {
    label: '🪪 Rijbewijs Inbeslagname',
    intro: 'Ik ga u een aantal korte vragen stellen om uw situatie goed in kaart te brengen. Dit helpt ons u direct de juiste juridische hulp te bieden.',
    questions: [
      { id: 'timing', text: 'Wanneer is uw rijbewijs in beslag genomen?', options: ['Vandaag', 'Afgelopen week', 'Meer dan een week geleden'] },
      { id: 'reason', text: 'Wat was de aanleiding voor de inbeslagname?', options: ['Rijden onder invloed (alcohol of drugs)', 'Te hoge snelheid / gevaarlijk rijgedrag', 'Medische ongeschiktheid (CBR)', 'Anders of onbekend'] },
      { id: 'document', text: 'Heeft u een officieel vorderingsbesluit of schriftelijk besluit ontvangen?', options: ['Ja, ik heb het besluit', 'Nee, nog niet ontvangen', 'Ik weet het niet'] },
      { id: 'history', text: 'Is dit de eerste keer dat uw rijbewijs wordt ingevorderd?', options: ['Ja, dit is de eerste keer', 'Nee, dit is eerder ook gebeurd'] },
    ]
  },
  auto: {
    label: '🚗 Auto Inbeslagname',
    intro: 'Ik ga u een aantal korte vragen stellen om uw situatie goed in kaart te brengen. Dit helpt ons u direct de juiste juridische hulp te bieden.',
    questions: [
      { id: 'timing', text: 'Wanneer is uw auto in beslag genomen?', options: ['Vandaag', 'Afgelopen week', 'Meer dan een week geleden'] },
      { id: 'authority', text: 'Door welke instantie is uw auto in beslag genomen?', options: ['Politie (strafrecht of verkeersovertreding)', 'Belastingdienst of CJIB', 'Deurwaarder (schulden)', 'Andere instantie of onbekend'] },
      { id: 'document', text: 'Heeft u een officieel inbeslagnamebesluit of procesverbaal ontvangen?', options: ['Ja', 'Nee', 'Ik weet het niet'] },
      { id: 'criminal', text: 'Is de inbeslagname gerelateerd aan een strafrechtelijk onderzoek?', options: ['Ja', 'Nee', 'Ik weet het niet'] },
    ]
  }
};

// ===== BEVEILIGING =====
function sanitize(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;').trim();
}
function checkRateLimit() {
  const key = 'sr_submissions', limit = 3;
  const count = parseInt(sessionStorage.getItem(key) || '0');
  if (count >= limit) return false;
  sessionStorage.setItem(key, count + 1);
  return true;
}

// ===== HAMBURGER MENU =====
function toggleMenu() {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburger');
  links.classList.toggle('open');
  btn.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburger');
  if (links && !links.contains(e.target) && btn && !btn.contains(e.target)) {
    links.classList.remove('open');
    btn.classList.remove('open');
  }
});

// ===== COOKIE CONSENT =====
(function () {
  const consent = localStorage.getItem('cookie-consent');
  const banner  = document.getElementById('cookie-banner');
  if (consent && banner) banner.classList.add('hidden');
})();

function acceptCookies() {
  localStorage.setItem('cookie-consent', 'accepted');
  const b = document.getElementById('cookie-banner');
  if (b) b.classList.add('hidden');
}
function declineCookies() {
  localStorage.setItem('cookie-consent', 'declined');
  const b = document.getElementById('cookie-banner');
  if (b) b.classList.add('hidden');
}

// ===== INITIALISATIE =====
emailjs.init(EMAIL_CONFIG.publicKey);

let state = { topic: null, questionIndex: 0, answers: {}, phase: 'idle' };

const chatSection  = document.getElementById('chat-section');
const chatBody     = document.getElementById('chat-body');
const chatProgress = document.getElementById('chat-progress');
const progressFill = document.getElementById('progress-fill');
const progressLabel= document.getElementById('progress-label');
const chatBadge    = document.getElementById('chat-topic-badge');

function scrollBottom() {
  if (chatBody) setTimeout(() => chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: 'smooth' }), 60);
}

function addBotMsg(text, delayMs = 900) {
  return new Promise(resolve => {
    const typing = document.createElement('div');
    typing.className = 'msg msg-bot typing-bubble';
    typing.innerHTML = `<div class="msg-avatar">⚖</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
    chatBody.appendChild(typing);
    scrollBottom();
    setTimeout(() => {
      typing.remove();
      const el = document.createElement('div');
      el.className = 'msg msg-bot';
      el.innerHTML = `<div class="msg-avatar">⚖</div><div class="msg-bubble">${text}</div>`;
      chatBody.appendChild(el);
      scrollBottom();
      resolve();
    }, delayMs);
  });
}

function addUserMsg(text) {
  const el = document.createElement('div');
  el.className = 'msg msg-user';
  el.innerHTML = `<div class="msg-bubble">${text}</div>`;
  chatBody.appendChild(el);
  scrollBottom();
}

function showOptions(options, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'options-wrap';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => { wrap.remove(); onSelect(opt); });
    wrap.appendChild(btn);
  });
  chatBody.appendChild(wrap);
  scrollBottom();
}

function updateProgress(current, total) {
  progressFill.style.width = (current / total * 100) + '%';
  progressLabel.textContent = current < total ? `Stap ${current} van ${total}` : 'Bijna klaar…';
}

function startTriage(topic) {
  state = { topic, questionIndex: 0, answers: {}, phase: 'triage' };
  const flow = TRIAGE_FLOWS[topic];
  chatBadge.textContent = flow.label;
  chatBadge.style.display = 'flex';
  chatProgress.style.display = 'flex';
  updateProgress(0, flow.questions.length);
  chatBody.innerHTML = '';
  chatSection.style.display = 'block';
  setTimeout(() => chatSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  setTimeout(async () => {
    await addBotMsg(flow.intro, 700);
    await askQuestion(0);
  }, 500);
}

async function askQuestion(index) {
  const flow = TRIAGE_FLOWS[state.topic];
  if (index >= flow.questions.length) { await showContactForm(); return; }
  const q = flow.questions[index];
  updateProgress(index + 1, flow.questions.length);
  await addBotMsg(q.text);
  showOptions(q.options, async answer => {
    state.answers[q.id] = answer;
    addUserMsg(answer);
    await askQuestion(index + 1);
  });
}

async function showContactForm() {
  updateProgress(TRIAGE_FLOWS[state.topic].questions.length, TRIAGE_FLOWS[state.topic].questions.length);
  state.phase = 'contact';
  await addBotMsg('Bedankt voor uw antwoorden! Op basis hiervan kunnen wij u direct koppelen aan een gespecialiseerde advocaat. Vul hieronder uw contactgegevens in om een gratis consult in te plannen.');
  await new Promise(r => setTimeout(r, 300));
  const wrap = document.createElement('div');
  wrap.className = 'msg msg-bot contact-form-wrap';
  wrap.innerHTML = `
    <div class="msg-avatar">⚖</div>
    <div class="contact-form-bubble">
      <h3>Uw contactgegevens</h3>
      <p>Wij nemen binnen 24 uur contact met u op voor een gratis intake.</p>
      <form id="contact-form" class="form-row" novalidate>
        <input id="cf-honeypot" name="website" type="text" style="display:none;" tabindex="-1" autocomplete="off" />
        <div class="form-field">
          <label for="cf-name">Volledige naam *</label>
          <input id="cf-name" type="text" placeholder="Jan de Vries" required />
        </div>
        <div class="form-field">
          <label for="cf-phone">Telefoonnummer *</label>
          <input id="cf-phone" type="tel" placeholder="06 12 34 56 78" required />
        </div>
        <div class="form-field">
          <label for="cf-email">E-mailadres *</label>
          <input id="cf-email" type="email" placeholder="jan@voorbeeld.nl" required />
        </div>
        <div class="form-field">
          <label for="cf-time">Wanneer kunnen wij u het beste bereiken?</label>
          <select id="cf-time">
            <option value="Geen voorkeur">Geen voorkeur</option>
            <option value="Ochtend (9:00–12:00)">Ochtend (9:00 – 12:00)</option>
            <option value="Middag (12:00–17:00)">Middag (12:00 – 17:00)</option>
            <option value="Avond (17:00–20:00)">Avond (17:00 – 20:00)</option>
          </select>
        </div>
        <button type="submit" class="form-submit-btn" id="submit-btn">Consult aanvragen →</button>
      </form>
    </div>
  `;
  chatBody.appendChild(wrap);
  scrollBottom();
  document.getElementById('contact-form').addEventListener('submit', handleContactSubmit);
}

async function handleContactSubmit(e) {
  e.preventDefault();
  if (document.getElementById('cf-honeypot').value) return;
  if (!checkRateLimit()) {
    alert('U heeft het maximale aantal aanvragen bereikt. Bel ons direct: 06 82 75 67 89.');
    return;
  }
  const name  = sanitize(document.getElementById('cf-name').value);
  const phone = sanitize(document.getElementById('cf-phone').value);
  const email = sanitize(document.getElementById('cf-email').value);
  const time  = sanitize(document.getElementById('cf-time').value);
  let valid = true;
  ['cf-name', 'cf-phone', 'cf-email'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.style.borderColor = '#e63946'; valid = false; }
    else el.style.borderColor = '';
  });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('cf-email').style.borderColor = '#e63946';
    valid = false;
  }
  if (!valid) return;
  const btn = document.getElementById('submit-btn');
  btn.textContent = 'Verzenden…';
  btn.disabled = true;
  const flow = TRIAGE_FLOWS[state.topic];
  const antwoorden = flow.questions.map(q => `${q.text}\n→ ${state.answers[q.id] || '—'}`).join('\n\n');
  const templateParams = { onderwerp: flow.label, naam: name, telefoon: phone, email, contacttijd: time, antwoorden };
  try {
    await emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, templateParams);
    e.target.closest('.contact-form-wrap').remove();
    addUserMsg(`${name} — ${phone} — ${email}`);
    setTimeout(() => showSuccess(name), 400);
  } catch (err) {
    console.error('EmailJS fout:', err);
    btn.textContent = 'Probeer opnieuw';
    btn.disabled = false;
  }
  state.phase = 'done';
  chatProgress.style.display = 'none';
  chatBadge.style.display = 'none';
}

async function showSuccess(name) {
  const el = document.createElement('div');
  el.className = 'msg msg-bot';
  el.innerHTML = `
    <div class="msg-avatar">⚖</div>
    <div class="success-bubble">
      <div class="success-icon">✅</div>
      <h3>Aanvraag ontvangen, ${name.split(' ')[0]}!</h3>
      <p>Wij nemen binnen <strong>24 uur</strong> contact met u op voor een gratis intake. In spoedsituaties kunt u ons altijd direct bereiken via WhatsApp.</p>
    </div>
  `;
  chatBody.appendChild(el);
  scrollBottom();
}

// ===== TOEGANKELIJKHEID =====
document.querySelectorAll('.topic-card').forEach(card => {
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') startTriage(card.id.replace('card-', ''));
  });
});
