/* Windrop - Main SPA Application */
(function() {
  'use strict';

  // Router
  const routes = {
    '/': renderHome,
    '/giveaways': renderGiveaways,
    '/giveaway': renderGiveawayDetail,
    '/winners': renderWinners,
    '/how-it-works': renderHowItWorks,
    '/faq': renderFAQ,
    '/contact': renderContact,
    '/terms': renderTerms,
    '/admin': renderAdmin
  };

  let countdownIntervals = [];

  function clearCountdowns() {
    countdownIntervals.forEach(id => clearInterval(id));
    countdownIntervals = [];
  }

  // API Helper
  async function api(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      return data;
    } catch (err) {
      throw err;
    }
  }

  // Router Init
  function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    clearCountdowns();
    const hash = window.location.hash || '#/';
    const path = hash.slice(1);

    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });

    // Close mobile menu
    const navLinks = document.querySelector('.nav-links');
    const hamburger = document.querySelector('.hamburger');
    if (navLinks) navLinks.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');

    // Find matching route
    if (path.startsWith('/giveaway/')) {
      const id = path.split('/')[2];
      renderGiveawayDetail(id);
    } else if (path === '/admin') {
      if (typeof window.renderAdminPage === 'function') {
        window.renderAdminPage();
      } else {
        renderAdmin();
      }
    } else {
      const handler = routes[path] || renderHome;
      handler();
    }
  }

  function getApp() {
    return document.getElementById('app');
  }

  // Countdown Helper
  function formatCountdown(endTime) {
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const diff = end - now;
    if (diff <= 0) return 'Termine';
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    if (d > 0) return d + 'j ' + h + 'h ' + m + 'm ' + s + 's';
    return h + 'h ' + m + 'm ' + s + 's';
  }

  function startCountdowns() {
    const id = setInterval(() => {
      document.querySelectorAll('[data-end-time]').forEach(el => {
        el.textContent = formatCountdown(el.getAttribute('data-end-time'));
      });
    }, 1000);
    countdownIntervals.push(id);
  }

  // Animated Counter
  function animateCounter(el, target) {
    let current = 0;
    const step = Math.max(1, Math.floor(target / 40));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      el.textContent = current;
    }, 30);
  }

  // Card HTML Generator
  function giveawayCard(g) {
    const imgSrc = g.image_url || '/static/images/placeholder.svg';
    const ended = g.status === 'ended';
    return '<div class="card" onclick="location.hash='#/giveaway/' + g.id + ''" style="cursor:pointer">' +
      (ended ? '<span class="badge-ended">Termine</span>' : '') +
      '<img class="card-image" src="' + imgSrc + '" alt="' + g.title + '" onerror="this.src='/static/images/placeholder.svg'">' +
      '<div class="card-body">' +
        '<h3 class="card-title">' + g.title + '</h3>' +
        '<span class="card-price">' + (g.price || 0) + ' EUR</span>' +
        '<div class="card-meta">' +
          '<span class="card-participants">' + (g.current_participants || 0) + ' participants</span>' +
          (ended ? '<span class="card-countdown">Termine</span>' :
            '<span class="card-countdown" data-end-time="' + (g.end_time || '') + '">' + formatCountdown(g.end_time) + '</span>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // PAGE: Home
  async function renderHome() {
    const app = getApp();
    app.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const [giveaways, stats] = await Promise.all([
        api('/api/giveaways'),
        api('/api/stats')
      ]);

      const featured = (Array.isArray(giveaways) ? giveaways : []).slice(0, 3);

      app.innerHTML =
        '<div class="page">' +
          '<section class="hero">' +
            '<h1><span class="highlight">1 euro</span> = 1 chance de gagner<br>des produits reels</h1>' +
            '<p>Participez a nos giveaways pour seulement 1 euro. Tirage au sort transparent et livraison garantie.</p>' +
            '<a href="#/giveaways" class="btn btn-primary">Voir les giveaways</a>' +
            '<div class="hero-stats">' +
              '<div class="stat-item"><div class="stat-number" data-target="' + (stats.total_giveaways || 0) + '">0</div><div class="stat-label">Giveaways</div></div>' +
              '<div class="stat-item"><div class="stat-number" data-target="' + (stats.total_participants || 0) + '">0</div><div class="stat-label">Participants</div></div>' +
              '<div class="stat-item"><div class="stat-number" data-target="' + (stats.total_winners || 0) + '">0</div><div class="stat-label">Gagnants</div></div>' +
            '</div>' +
          '</section>' +
          '<section class="featured-section container">' +
            '<h2 class="section-title">Giveaways en cours</h2>' +
            '<p class="section-subtitle">Tentez votre chance maintenant</p>' +
            '<div class="card-grid">' + featured.map(giveawayCard).join('') + '</div>' +
            (featured.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun giveaway actif pour le moment</p>' : '') +
            '<div class="text-center mt-3"><a href="#/giveaways" class="btn btn-secondary">Voir tous les giveaways</a></div>' +
          '</section>' +
        '</div>';

      // Animate stats
      document.querySelectorAll('.stat-number[data-target]').forEach(el => {
        animateCounter(el, parseInt(el.getAttribute('data-target')) || 0);
      });
      startCountdowns();
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Erreur de chargement: ' + err.message + '</div>';
    }
  }

  // PAGE: Giveaways List
  async function renderGiveaways() {
    const app = getApp();
    app.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const giveaways = await api('/api/giveaways');
      const list = Array.isArray(giveaways) ? giveaways : [];

      app.innerHTML =
        '<div class="page container" style="padding:2rem 1rem">' +
          '<h1 class="section-title">Giveaways</h1>' +
          '<p class="section-subtitle">Participez pour seulement 1 euro</p>' +
          '<div class="card-grid">' +
            (list.length > 0 ? list.map(giveawayCard).join('') : '<p class="text-center" style="color:var(--text-secondary)">Aucun giveaway disponible</p>') +
          '</div>' +
        '</div>';
      startCountdowns();
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Erreur: ' + err.message + '</div>';
    }
  }

  // PAGE: Giveaway Detail
  async function renderGiveawayDetail(id) {
    const app = getApp();
    app.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const g = await api('/api/giveaways/' + id);
      const imgSrc = g.image_url || '/static/images/placeholder.svg';
      const ended = g.status === 'ended';

      app.innerHTML =
        '<div class="page container detail-page">' +
          '<div class="detail-header">' +
            '<img class="detail-image" src="' + imgSrc + '" alt="' + g.title + '" onerror="this.src='/static/images/placeholder.svg'">' +
            '<div class="detail-info">' +
              '<h1>' + g.title + '</h1>' +
              '<p>' + (g.description || 'Aucune description disponible.') + '</p>' +
              (g.source_url ? '<p><a href="' + g.source_url + '" target="_blank">Voir le produit original</a></p>' : '') +
              (g.condition ? '<p style="color:var(--text-secondary)">Etat: ' + g.condition + '</p>' : '') +
              '<div class="detail-stats">' +
                '<div class="detail-stat"><div class="detail-stat-value">' + (g.price || 0) + ' EUR</div><div class="detail-stat-label">Valeur</div></div>' +
                '<div class="detail-stat"><div class="detail-stat-value">' + (g.current_participants || 0) + '</div><div class="detail-stat-label">Participants</div></div>' +
                '<div class="detail-stat"><div class="detail-stat-value" ' + (!ended ? 'data-end-time="' + g.end_time + '"' : '') + '>' + (ended ? 'Termine' : formatCountdown(g.end_time)) + '</div><div class="detail-stat-label">Temps restant</div></div>' +
              '</div>' +
              (!ended ? '<button class="btn btn-primary" onclick="window.showParticipateModal(' + g.id + ')">Participer - 1 euro</button>' :
                '<button class="btn btn-secondary" disabled>Giveaway termine</button>') +
            '</div>' +
          '</div>' +
          '<div class="detail-rules">' +
            '<h3>Regles du giveaway</h3>' +
            '<ul>' +
              '<li>Participation unique pour 1 euro</li>' +
              '<li>Tirage au sort aleatoire et transparent</li>' +
              '<li>Le gagnant est contacte par email</li>' +
              '<li>Livraison offerte en France metropolitaine</li>' +
              '<li>Resultat annonce a la date de fin</li>' +
            '</ul>' +
          '</div>' +
        '</div>';
      startCountdowns();
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Giveaway introuvable</div>';
    }
  }

  // Participate Modal
  window.showParticipateModal = function(giveawayId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal">' +
        '<h2>Participer au giveaway</h2>' +
        '<p>Entrez vos informations pour participer (1 euro)</p>' +
        '<div class="form-group"><label>Nom d'utilisateur</label><input type="text" id="modal-username" placeholder="Votre pseudo"></div>' +
        '<div class="form-group"><label>Email</label><input type="email" id="modal-email" placeholder="votre@email.com"></div>' +
        '<div id="modal-error" class="form-error" style="display:none"></div>' +
        '<div id="modal-success" style="display:none"></div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" id="modal-cancel">Annuler</button>' +
          '<button class="btn btn-primary" id="modal-confirm">Payer 1 euro</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('#modal-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelector('#modal-confirm').onclick = async () => {
      const username = document.getElementById('modal-username').value.trim();
      const email = document.getElementById('modal-email').value.trim();
      const errorEl = document.getElementById('modal-error');
      const successEl = document.getElementById('modal-success');

      if (!username || !email) {
        errorEl.textContent = 'Veuillez remplir tous les champs';
        errorEl.style.display = 'block';
        return;
      }
      if (!email.includes('@')) {
        errorEl.textContent = 'Email invalide';
        errorEl.style.display = 'block';
        return;
      }

      try {
        errorEl.style.display = 'none';
        const result = await api('/api/giveaways/' + giveawayId + '/participate', {
          method: 'POST',
          body: JSON.stringify({ username: username, email: email })
        });
        successEl.innerHTML = '<div class="success-msg">Participation confirmee ! Bonne chance ' + username + ' !</div>';
        successEl.style.display = 'block';
        overlay.querySelector('.modal-actions').style.display = 'none';
        setTimeout(() => { overlay.remove(); handleRoute(); }, 2500);
      } catch (err) {
        errorEl.textContent = err.message || 'Erreur lors de la participation';
        errorEl.style.display = 'block';
      }
    };
  };

  // PAGE: Winners
  async function renderWinners() {
    const app = getApp();
    app.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const winners = await api('/api/winners');
      const list = Array.isArray(winners) ? winners : [];

      app.innerHTML =
        '<div class="page container" style="padding:2rem 1rem">' +
          '<h1 class="section-title">Gagnants</h1>' +
          '<p class="section-subtitle">Ils ont tente leur chance et gagne</p>' +
          '<div class="card-grid">' +
            (list.length > 0 ? list.map(w => {
              const statusClass = w.shipping_status === 'delivered' ? 'shipping-delivered' : (w.shipping_status === 'shipped' ? 'shipping-shipped' : 'shipping-pending');
              const statusText = w.shipping_status === 'delivered' ? 'Livre' : (w.shipping_status === 'shipped' ? 'Expedie' : 'En preparation');
              return '<div class="winner-card">' +
                '<div class="winner-username">' + (w.username || 'Anonyme') + '</div>' +
                '<div class="winner-product">' + (w.giveaway_title || 'Produit') + '</div>' +
                '<div class="winner-date">' + (w.drawn_at ? new Date(w.drawn_at).toLocaleDateString('fr-FR') : '') + '</div>' +
                '<span class="shipping-badge ' + statusClass + '">' + statusText + '</span>' +
              '</div>';
            }).join('') : '<p class="text-center" style="color:var(--text-secondary)">Aucun gagnant pour le moment</p>') +
          '</div>' +
        '</div>';
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Erreur: ' + err.message + '</div>';
    }
  }

  // PAGE: How It Works
  function renderHowItWorks() {
    const app = getApp();
    const steps = [
      { num: '1', title: 'Choisir un giveaway', desc: 'Parcourez nos giveaways et choisissez le produit qui vous interesse.' },
      { num: '2', title: 'Payer 1 euro', desc: 'La participation coute seulement 1 euro. Paiement securise et rapide.' },
      { num: '3', title: 'Attendre le tirage', desc: 'Un compteur indique le temps restant avant le tirage au sort.' },
      { num: '4', title: 'Tirage au sort', desc: 'Le gagnant est selectionne de maniere aleatoire et transparente.' },
      { num: '5', title: 'Livraison gratuite', desc: 'Le gagnant recoit son produit livre gratuitement en France.' }
    ];

    app.innerHTML =
      '<div class="page container" style="padding:2rem 1rem">' +
        '<h1 class="section-title">Comment ca marche</h1>' +
        '<p class="section-subtitle">5 etapes simples pour gagner</p>' +
        '<div class="steps-container">' +
          steps.map(s =>
            '<div class="step">' +
              '<div class="step-number">' + s.num + '</div>' +
              '<div class="step-content"><h3>' + s.title + '</h3><p>' + s.desc + '</p></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>';
  }

  // PAGE: FAQ
  function renderFAQ() {
    const app = getApp();
    const questions = [
      { q: 'Est-ce legal ?', a: 'Oui, notre plateforme respecte la legislation francaise sur les jeux concours. Chaque tirage est aleatoire et transparent.' },
      { q: 'Comment sont choisis les gagnants ?', a: 'Les gagnants sont selectionnes par un algorithme de tirage au sort cryptographiquement securise. Chaque participant a exactement la meme chance de gagner.' },
      { q: 'C'est securise ?', a: 'Nous utilisons des protocoles de securite standards pour proteger vos donnees. Aucune information bancaire n'est stockee sur nos serveurs.' },
      { q: 'Combien de chances ai-je de gagner ?', a: 'Chaque participation donne une chance egale. Plus le nombre de participants est faible, plus vos chances sont elevees.' },
      { q: 'Quand a lieu le tirage ?', a: 'Chaque giveaway a une date de fin affichee. Le tirage a lieu automatiquement a cette date. Un compteur est visible sur chaque giveaway.' },
      { q: 'Comment recevoir mon lot ?', a: 'Si vous gagnez, vous recevrez un email avec les instructions. La livraison est gratuite en France metropolitaine et le suivi est disponible dans votre espace.' },
      { q: 'Puis-je participer plusieurs fois ?', a: 'Oui, vous pouvez participer plusieurs fois au meme giveaway pour augmenter vos chances.' }
    ];

    app.innerHTML =
      '<div class="page container" style="padding:2rem 1rem">' +
        '<h1 class="section-title">Questions frequentes</h1>' +
        '<p class="section-subtitle">Tout ce que vous devez savoir</p>' +
        '<div class="faq-list">' +
          questions.map(q =>
            '<div class="faq-item">' +
              '<button class="faq-question"><span>' + q.q + '</span><span class="icon">+</span></button>' +
              '<div class="faq-answer"><p>' + q.a + '</p></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>';

    // Accordion behavior
    document.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.parentElement;
        item.classList.toggle('active');
      });
    });
  }

  // PAGE: Contact
  function renderContact() {
    const app = getApp();
    app.innerHTML =
      '<div class="page container" style="padding:2rem 1rem">' +
        '<h1 class="section-title">Contact</h1>' +
        '<p class="section-subtitle">Une question ? Ecrivez-nous</p>' +
        '<form class="contact-form" id="contact-form">' +
          '<div class="form-group"><label>Nom</label><input type="text" id="contact-name" placeholder="Votre nom" required></div>' +
          '<div class="form-group"><label>Email</label><input type="email" id="contact-email" placeholder="votre@email.com" required></div>' +
          '<div class="form-group"><label>Message</label><textarea id="contact-message" placeholder="Votre message..." required></textarea></div>' +
          '<div id="contact-feedback"></div>' +
          '<button type="submit" class="btn btn-primary" style="width:100%">Envoyer</button>' +
        '</form>' +
      '</div>';

    document.getElementById('contact-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const message = document.getElementById('contact-message').value.trim();
      const feedback = document.getElementById('contact-feedback');

      if (!name || !email || !message) {
        feedback.innerHTML = '<div class="form-error">Veuillez remplir tous les champs</div>';
        return;
      }
      if (!email.includes('@')) {
        feedback.innerHTML = '<div class="form-error">Email invalide</div>';
        return;
      }
      feedback.innerHTML = '<div class="success-msg">Message envoye avec succes ! Nous vous repondrons rapidement.</div>';
      this.reset();
    });
  }

  // PAGE: Terms
  function renderTerms() {
    const app = getApp();
    app.innerHTML =
      '<div class="page container terms-page">' +
        '<h1 class="section-title">Mentions legales</h1>' +
        '<h2>Conditions generales d'utilisation</h2>' +
        '<p>En utilisant la plateforme Windrop, vous acceptez les presentes conditions generales d'utilisation. La participation aux giveaways est ouverte a toute personne majeure residant en France metropolitaine.</p>' +
        '<p>Chaque participation est facturee 1 euro. Ce montant est non remboursable. Le tirage au sort est effectue de maniere aleatoire a la date de fin indiquee sur chaque giveaway.</p>' +
        '<p>Le gagnant est notifie par email a l'adresse fournie lors de l'inscription. Il dispose de 7 jours pour confirmer ses coordonnees de livraison.</p>' +
        '<h2>Politique de confidentialite</h2>' +
        '<p>Nous collectons uniquement les informations necessaires au fonctionnement du service : nom d'utilisateur et adresse email. Ces donnees ne sont jamais partagees avec des tiers.</p>' +
        '<p>Conformement au RGPD, vous disposez d'un droit d'acces, de modification et de suppression de vos donnees personnelles. Pour exercer ce droit, contactez-nous via le formulaire de contact.</p>' +
        '<h2>Responsabilite</h2>' +
        '<p>Windrop ne peut etre tenu responsable en cas de force majeure empechant la livraison des lots. Les produits sont livres dans l'etat decrit sur la page du giveaway.</p>' +
      '</div>';
  }

  // PAGE: Admin (fallback if admin.js not loaded)
  function renderAdmin() {
    const app = getApp();
    app.innerHTML = '<div class="loading">Chargement admin...</div>';
    // admin.js will override this
    if (typeof window.renderAdminPage === 'function') {
      window.renderAdminPage();
    }
  }

  // Mobile Menu Toggle
  function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
      });
    }
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initRouter();
  });

})();
