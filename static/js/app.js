/* Windrop - Main SPA Application */
(function() {
  'use strict';

  // HTML Escape utility to prevent XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Make escapeHtml available globally for admin.js
  window.escapeHtml = escapeHtml;

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
    clearActivityFeed();
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
    var start = 0;
    var duration = 1200;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      el.textContent = Math.floor(progress * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    if (target > 0) requestAnimationFrame(step);
    else el.textContent = '0';
  }

  // Card HTML Generator
  function giveawayCard(g) {
    var imgSrc = escapeHtml(g.image_url || '/static/images/placeholder.svg');
    var ended = g.status === 'ended' || g.status === 'expired';
    var countdownText = formatCountdown(g.end_time);
    var timeExpired = countdownText === 'Termine';
    return '<div class="card" onclick="location.hash=\'#/giveaway/' + escapeHtml(g.id) + '\'" style="cursor:pointer">' +
      (ended ? '<span class="badge-ended">Termine</span>' : '') +
      (!ended && !timeExpired ? '<span class="badge-verified">&#9989; Verifie</span>' : '') +
      '<img class="card-image" src="' + imgSrc + '" alt="' + escapeHtml(g.title) + '" onerror="this.src=\'/static/images/placeholder.svg\'">' +
      '<div class="card-body">' +
        '<h3 class="card-title">' + escapeHtml(g.title) + '</h3>' +
        '<span class="card-price">' + escapeHtml(g.price || 0) + ' EUR</span>' +
        '<div class="card-meta">' +
          '<span class="card-participants">' + escapeHtml(g.current_participants || 0) + ' participants</span>' +
          ((ended || timeExpired) ? '<span class="card-countdown">Termine</span>' :
            '<span class="card-countdown" data-end-time="' + escapeHtml(g.end_time || '') + '">' + escapeHtml(countdownText) + '</span>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Intersection Observer for card entrance animations
  function observeCards() {
    var cards = document.querySelectorAll('.card');
    cards.forEach(function(c) { c.classList.add('card-enter'); });
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
      }, { threshold: 0.1 });
      cards.forEach(function(c) { obs.observe(c); });
    } else {
      cards.forEach(function(c) { c.classList.add('visible'); });
    }
  }

  // Real Activity Feed
  var activityFeedTimeout = null;
  var activityFeedContainer = null;

  function clearActivityFeed() {
    if (activityFeedTimeout) {
      clearTimeout(activityFeedTimeout);
      activityFeedTimeout = null;
    }
    if (activityFeedContainer && activityFeedContainer.parentNode) {
      activityFeedContainer.parentNode.removeChild(activityFeedContainer);
    }
    activityFeedContainer = null;
  }

  function startRealActivityFeed() {
    clearActivityFeed();
    fetch('/api/recent-activity')
      .then(function(res) { return res.json(); })
      .then(function(activities) {
        if (!Array.isArray(activities) || activities.length === 0) return;
        activityFeedContainer = document.createElement('div');
        activityFeedContainer.className = 'activity-feed';
        document.body.appendChild(activityFeedContainer);
        showRealToasts(activities, 0);
      })
      .catch(function() { /* silently ignore errors */ });
  }

  function showRealToasts(activities, index) {
    if (!activityFeedContainer || index >= activities.length) return;
    var item = activities[index];
    var toast = document.createElement('div');
    toast.className = 'activity-toast';
    toast.textContent = item.username + ' a participe a ' + item.giveaway_title;
    activityFeedContainer.appendChild(toast);
    setTimeout(function() {
      toast.classList.add('fade-out');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 4000);
    if (index + 1 < activities.length) {
      activityFeedTimeout = setTimeout(function() {
        showRealToasts(activities, index + 1);
      }, 5000);
    }
  }

  // PAGE: Home
  async function renderHome() {
    const app = getApp();
    app.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const [giveaways, stats, winners] = await Promise.all([
        api('/api/giveaways'),
        api('/api/stats'),
        api('/api/winners')
      ]);

      const featured = (Array.isArray(giveaways) ? giveaways : []).slice(0, 3);
      const winnersArray = Array.isArray(winners) ? winners : [];

      app.innerHTML =
        '<div class="page">' +
          '<section class="hero">' +
            '<h1><span class="highlight">Participez a des giveaways premium</span><br>a partir de 1 euro</h1>' +
            '<p>Selection aleatoire et securisee. Livraison gratuite en France.</p>' +
            '<a href="#/giveaways" class="btn btn-primary">Voir les giveaways</a>' +
            '<div class="hero-stats">' +
              '<div class="stat-item"><div class="stat-number" data-target="' + escapeHtml(stats.total_giveaways || 0) + '">0</div><div class="stat-label">Giveaways</div></div>' +
              '<div class="stat-item"><div class="stat-number" data-target="' + escapeHtml(stats.total_participants || 0) + '">0</div><div class="stat-label">Participants</div></div>' +
              '<div class="stat-item"><div class="stat-number" data-target="' + escapeHtml(stats.total_winners || 0) + '">0</div><div class="stat-label">Gagnants</div></div>' +
            '</div>' +
            '<div class="trust-badges-section">' +
              '<div class="trust-badge-item"><span class="trust-badge-icon">&#128274;</span><span class="trust-badge-label">Paiement securise</span></div>' +
              '<div class="trust-badge-item"><span class="trust-badge-icon">&#9989;</span><span class="trust-badge-label">Produits verifies</span></div>' +
              '<div class="trust-badge-item"><span class="trust-badge-icon">&#128666;</span><span class="trust-badge-label">Livraison offerte</span></div>' +
              '<div class="trust-badge-item"><span class="trust-badge-icon">&#127922;</span><span class="trust-badge-label">Selection aleatoire</span></div>' +
            '</div>' +
          '</section>' +
          '<section class="featured-section container">' +
            '<h2 class="section-title">Giveaways en cours</h2>' +
            '<p class="section-subtitle">Tentez votre chance maintenant</p>' +
            '<div class="card-grid">' + featured.map(giveawayCard).join('') + '</div>' +
            (featured.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun giveaway actif pour le moment</p>' : '') +
            '<div class="text-center mt-3"><a href="#/giveaways" class="btn btn-secondary">Voir tous les giveaways</a></div>' +
          '</section>' +
          (winnersArray.length > 0 ?
            '<section class="recent-winners-section container">' +
              '<h2 class="section-title">Derniers gagnants</h2>' +
              '<p class="section-subtitle">Ils ont tente leur chance</p>' +
              '<div class="winners-mini-grid">' + winnersArray.slice(0, 3).map(function(w) {
                return '<div class="winner-mini-card">' +
                  '<div class="winner-mini-avatar">' + escapeHtml((w.username || 'A')[0].toUpperCase()) + '</div>' +
                  '<div class="winner-mini-info"><div class="winner-mini-name">' + escapeHtml(w.username) + '</div><div class="winner-mini-product">' + escapeHtml(w.giveaway_title) + '</div></div>' +
                '</div>';
              }).join('') +
              '</div>' +
            '</section>' : '') +
        '</div>';

      // Animate stats
      document.querySelectorAll('.stat-number[data-target]').forEach(el => {
        animateCounter(el, parseInt(el.getAttribute('data-target')) || 0);
      });
      startCountdowns();
      observeCards();

      // Start real activity feed
      startRealActivityFeed();
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Erreur de chargement: ' + escapeHtml(err.message) + '</div>';
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
      observeCards();
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Erreur: ' + escapeHtml(err.message) + '</div>';
    }
  }

  // PAGE: Giveaway Detail
  async function renderGiveawayDetail(id) {
    const app = getApp();
    app.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const g = await api('/api/giveaways/' + id);
      var imgSrc = escapeHtml(g.image_url || '/static/images/placeholder.svg');
      var ended = g.status === 'ended' || g.status === 'expired';
      var countdownText = formatCountdown(g.end_time);
      var timeExpired = countdownText === 'Termine';
      var isFinished = ended || timeExpired;

      // Check if giveaway has a winner - show wheel animation
      if (g.status === 'ended' && g.winner_id) {
        try {
          var participants = await api('/api/giveaways/' + id + '/participants');
          var winners = await api('/api/winners');
          var winnerEntry = null;
          for (var i = 0; i < winners.length; i++) {
            if (winners[i].giveaway_id == id) {
              winnerEntry = winners[i];
              break;
            }
          }
          if (winnerEntry && participants.length > 0) {
            app.innerHTML =
              '<div class="page container detail-page">' +
                '<h1 class="section-title" style="margin-bottom:0.5rem">' + escapeHtml(g.title) + '</h1>' +
                '<p class="section-subtitle">Tirage au sort</p>' +
                '<div id="wheel-container" class="wheel-container"></div>' +
                '<div id="wheel-congrats" class="wheel-congrats" style="display:none">' +
                  '<div class="wheel-congrats-inner">' +
                    '<div class="wheel-congrats-icon">&#127942;</div>' +
                    '<div class="wheel-congrats-title">GAGNANT</div>' +
                    '<div class="wheel-congrats-name">' + escapeHtml(winnerEntry.username) + '</div>' +
                    '<div class="wheel-congrats-sub">Felicitations !</div>' +
                  '</div>' +
                '</div>' +
              '</div>';
            renderWinnerWheel(id, winnerEntry.username, participants);
            return;
          }
        } catch(e) {
          // Fall through to normal detail view if wheel data fails
        }
      }

      app.innerHTML =
        '<div class="page container detail-page">' +
          '<div class="detail-header">' +
            '<img class="detail-image" src="' + imgSrc + '" alt="' + escapeHtml(g.title) + '" onerror="this.src=\'/static/images/placeholder.svg\'">' +
            '<div class="detail-info">' +
              '<h1>' + escapeHtml(g.title) + '</h1>' +
              '<p>' + escapeHtml(g.description || 'Aucune description disponible.') + '</p>' +
              (g.source_url ? '<p><a href="' + escapeHtml(g.source_url) + '" target="_blank">Voir le produit original</a></p>' : '') +
              (g.condition ? '<p style="color:var(--text-secondary)">Etat: ' + escapeHtml(g.condition) + '</p>' : '') +
              '<div class="detail-stats">' +
                '<div class="detail-stat"><div class="detail-stat-value">' + escapeHtml(g.price || 0) + ' EUR</div><div class="detail-stat-label">Valeur</div></div>' +
                '<div class="detail-stat"><div class="detail-stat-value">' + escapeHtml(g.current_participants || 0) + '</div><div class="detail-stat-label">Participants</div></div>' +
                '<div class="detail-stat"><div class="detail-stat-value" ' + (!isFinished ? 'data-end-time="' + escapeHtml(g.end_time) + '"' : '') + '>' + (isFinished ? 'Termine' : escapeHtml(countdownText)) + '</div><div class="detail-stat-label">Temps restant</div></div>' +
              '</div>' +
              (!isFinished ? '<button class="btn btn-primary" onclick="window.showParticipateModal(' + g.id + ')">Participer - 1 euro</button>' :
                '<button class="btn btn-secondary" disabled>Giveaway termine</button>') +
            '</div>' +
          '</div>' +
          '<div class="detail-rules">' +
            '<h3>Regles du giveaway</h3>' +
            '<ul>' +
              '<li>Participation unique pour 1 euro</li>' +
              '<li>Une seule participation par personne et par giveaway</li>' +
              '<li>Le gagnant est selectionne de maniere aleatoire et securisee</li>' +
              '<li>Le gagnant est contacte par email et annonce sur la page Gagnants</li>' +
              '<li>Livraison offerte en France metropolitaine</li>' +
              '<li>Preuve d\'envoi visible pour chaque lot</li>' +
            '</ul>' +
          '</div>' +
        '</div>';
      startCountdowns();
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Giveaway introuvable</div>';
    }
  }

  // Winner Wheel Animation
  function renderWinnerWheel(giveawayId, winnerName, participants) {
    var container = document.getElementById('wheel-container');
    if (!container) return;

    var names = participants.map(function(p) { return p.username; });
    if (names.length === 0) return;

    // Ensure winner is in the list
    var winnerIndex = -1;
    for (var i = 0; i < names.length; i++) {
      if (names[i] === winnerName) { winnerIndex = i; break; }
    }
    if (winnerIndex === -1) {
      names.push(winnerName);
      winnerIndex = names.length - 1;
    }

    var numSegments = names.length;
    var segmentAngle = (2 * Math.PI) / numSegments;

    // Colors for segments
    var segmentColors = ['#1a0505', '#1f1f1f', '#0d0d0d', '#2a0a0a', '#151515', '#110303'];

    // Canvas setup
    var size = Math.min(container.clientWidth || 400, 500);
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.className = 'wheel-canvas';
    container.innerHTML = '';

    // Add pointer
    var pointer = document.createElement('div');
    pointer.className = 'wheel-pointer';
    pointer.innerHTML = '&#9660;';
    container.appendChild(pointer);
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var centerX = size / 2;
    var centerY = size / 2;
    var radius = (size / 2) - 10;

    // Calculate final angle: pointer is at top (3*PI/2 from positive x-axis)
    // We want the winner segment center to be at the top when rotation stops
    var winnerSegmentCenter = winnerIndex * segmentAngle + segmentAngle / 2;
    // The pointer is at top = -PI/2 (or 3PI/2)
    // Final rotation should place winner under the pointer
    var pointerAngle = -Math.PI / 2;
    var targetAngle = pointerAngle - winnerSegmentCenter;
    // Add multiple full rotations for visual effect
    var totalRotations = 8;
    var finalAngle = targetAngle + (totalRotations * 2 * Math.PI);

    // Animation parameters
    var startTime = null;
    var spinDuration = 7000; // 7 seconds total
    var currentAngle = 0;

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function drawWheel(angle) {
      ctx.clearRect(0, 0, size, size);

      // Draw outer ring glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 30, 30, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      for (var i = 0; i < numSegments; i++) {
        var startAngle = angle + i * segmentAngle;
        var endAngle = startAngle + segmentAngle;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = segmentColors[i % segmentColors.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 30, 30, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + segmentAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        var fontSize = Math.max(10, Math.min(14, 200 / numSegments));
        ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 30, 30, 0.5)';
        ctx.shadowBlur = 4;
        var displayName = names[i];
        if (displayName.length > 12) displayName = displayName.substring(0, 11) + '..';
        ctx.fillText(displayName, radius - 15, 0);
        ctx.restore();
      }

      // Draw center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
      ctx.fillStyle = '#0b0b0b';
      ctx.fill();
      ctx.strokeStyle = '#ff1e1e';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw center dot
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#ff1e1e';
      ctx.shadowColor = 'rgba(255, 30, 30, 0.8)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / spinDuration, 1);

      // Use easing for smooth slowdown
      var easedProgress = easeOutQuart(progress);
      currentAngle = easedProgress * finalAngle;

      drawWheel(currentAngle);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - show winner
        setTimeout(showWinnerCongrats, 500);
      }
    }

    function showWinnerCongrats() {
      var congratsEl = document.getElementById('wheel-congrats');
      if (congratsEl) {
        congratsEl.style.display = 'flex';
      }
      // Add glow to canvas
      canvas.classList.add('wheel-canvas-glow');
    }

    // Start animation after a short delay
    setTimeout(function() {
      requestAnimationFrame(animate);
    }, 500);
  }

  // Generate persistent browser fingerprint for anti-fraud
  // Uses localStorage to persist a unique device ID that survives page reloads
  function generateFingerprint() {
    // Layer 1: Persistent device ID (stored in localStorage)
    var deviceId = '';
    try {
      deviceId = localStorage.getItem('_wdid') || '';
      if (!deviceId) {
        // Generate a cryptographically random ID
        var arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        deviceId = Array.from(arr).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
        localStorage.setItem('_wdid', deviceId);
      }
    } catch(e) {
      deviceId = 'no_storage';
    }

    // Layer 2: Hardware fingerprint (harder to spoof)
    var hwData = [
      screen.width, screen.height, screen.colorDepth,
      navigator.language, navigator.platform,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      (navigator.deviceMemory || 0),
      navigator.maxTouchPoints || 0,
      screen.availWidth, screen.availHeight
    ].join('|');

    // Layer 3: Canvas fingerprint
    var canvasHash = '';
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      var ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Windrop', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('test123', 4, 17);
      canvasHash = canvas.toDataURL().slice(-50);
    } catch(e) {
      canvasHash = 'no_canvas';
    }

    // Combine all layers
    var combined = deviceId + '|' + hwData + '|' + canvasHash;

    // Hash it
    var hash = 0;
    for (var i = 0; i < combined.length; i++) {
      var char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    // Return deviceId + hash (deviceId is the persistent part)
    return deviceId + '_' + Math.abs(hash).toString(36);
  }

  // Participate Modal
  window.showParticipateModal = function(giveawayId) {
    // Check if already participated via localStorage marker
    var participatedKey = '_wp_' + giveawayId;
    if (localStorage.getItem(participatedKey)) {
      alert('Vous avez deja participe a ce giveaway depuis cet appareil.');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal">' +
        '<h2>Participer au giveaway</h2>' +
        '<p>Entrez vos informations pour participer</p>' +
        '<div class="form-group"><label>Nom d\'utilisateur</label><input type="text" id="modal-username" placeholder="Votre pseudo"></div>' +
        '<div class="form-group"><label>Email</label><input type="email" id="modal-email" placeholder="votre@email.com"></div>' +
        '<div id="modal-error" class="form-error" style="display:none"></div>' +
        '<div id="modal-success" style="display:none"></div>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.5rem">Le paiement de 1 euro sera active prochainement.</p>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" id="modal-cancel">Annuler</button>' +
          '<button class="btn btn-primary" id="modal-confirm">Participer (gratuit pendant le lancement)</button>' +
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
        var fingerprint = generateFingerprint();
        const result = await api('/api/giveaways/' + giveawayId + '/participate', {
          method: 'POST',
          body: JSON.stringify({ username: username, email: email, fingerprint: fingerprint })
        });
        // Mark as participated in localStorage (anti-fraud client-side)
        try { localStorage.setItem('_wp_' + giveawayId, '1'); } catch(e) {}
        successEl.innerHTML = '<div class="success-msg">Participation confirmee ! Bonne chance ' + escapeHtml(username) + ' !</div>';
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
              var statusClass = w.shipping_status === 'delivered' ? 'shipping-delivered' : (w.shipping_status === 'shipped' ? 'shipping-shipped' : 'shipping-pending');
              var statusText = w.shipping_status === 'delivered' ? 'Livre' : (w.shipping_status === 'shipped' ? 'Expedie' : 'En preparation');
              return '<div class="winner-card" onclick="location.hash=\'#/giveaway/' + escapeHtml(w.giveaway_id) + '\'" style="cursor:pointer">' +
                '<div class="winner-username">' + escapeHtml(w.username || 'Anonyme') + '</div>' +
                '<div class="winner-product">' + escapeHtml(w.giveaway_title || 'Produit') + '</div>' +
                '<div class="winner-date">' + escapeHtml(w.drawn_at ? new Date(w.drawn_at).toLocaleDateString('fr-FR') : '') + '</div>' +
                '<span class="shipping-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span>' +
                '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--accent)">&#127922; Voir le tirage</div>' +
              '</div>';
            }).join('') : '<p class="text-center" style="color:var(--text-secondary)">Aucun gagnant pour le moment</p>') +
          '</div>' +
        '</div>';
    } catch (err) {
      app.innerHTML = '<div class="error-msg">Erreur: ' + escapeHtml(err.message) + '</div>';
    }
  }

  // PAGE: How It Works
  function renderHowItWorks() {
    const app = getApp();
    const steps = [
      { num: '1', title: 'Choisir un giveaway', desc: 'Parcourez nos giveaways et choisissez le produit qui vous interesse.' },
      { num: '2', title: 'Valider sa participation', desc: 'Une participation coute 1 euro. Paiement securise. Vous ne pouvez participer qu\'une seule fois par giveaway.' },
      { num: '3', title: 'Attendre la selection', desc: 'Un compteur indique le temps restant avant la selection du gagnant.' },
      { num: '4', title: 'Selection du gagnant', desc: 'Le gagnant est selectionne de maniere aleatoire et securisee.' },
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
      { q: 'Comment fonctionne la selection ?', a: 'Le gagnant est selectionne par un algorithme aleatoire securise. Chaque participant a exactement la meme chance de gagner, quel que soit le moment de sa participation.' },
      { q: 'Pourquoi seulement 1 euro ?', a: 'Nous voulons que tout le monde puisse tenter sa chance. Le prix de 1 euro couvre les frais de fonctionnement et permet d\'acheter les produits mis en jeu.' },
      { q: 'Comment sont choisis les gagnants ?', a: 'Les gagnants sont selectionnes par un algorithme cryptographiquement securise. Chaque participant a exactement la meme chance de gagner.' },
      { q: 'C\'est securise ?', a: 'Nous utilisons des protocoles de securite standards pour proteger vos donnees. Aucune information bancaire n\'est stockee sur nos serveurs.' },
      { q: 'Combien de chances ai-je de gagner ?', a: 'Chaque participation donne une chance egale. Plus le nombre de participants est faible, plus vos chances sont elevees.' },
      { q: 'Quand a lieu la selection ?', a: 'Chaque giveaway a une date de fin affichee. La selection a lieu automatiquement a cette date. Un compteur est visible sur chaque giveaway.' },
      { q: 'Comment recevoir mon lot ?', a: 'Si vous gagnez, vous recevrez un email avec les instructions. La livraison est gratuite en France metropolitaine et le suivi est disponible dans votre espace.' },
      { q: 'Puis-je participer plusieurs fois ?', a: 'Non, une seule participation par personne et par giveaway. Notre systeme detecte automatiquement les tentatives multiples.' }
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

    document.getElementById('contact-form').addEventListener('submit', async function(e) {
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

      try {
        await api('/api/contact', {
          method: 'POST',
          body: JSON.stringify({ name: name, email: email, message: message })
        });
        feedback.innerHTML = '<div class="success-msg">Message envoye avec succes ! Nous vous repondrons rapidement.</div>';
        this.reset();
      } catch (err) {
        feedback.innerHTML = '<div class="form-error">' + escapeHtml(err.message) + '</div>';
      }
    });
  }

  // PAGE: Terms
  function renderTerms() {
    const app = getApp();
    app.innerHTML =
      '<div class="page container terms-page">' +
        '<h1 class="section-title">Mentions legales</h1>' +
        '<h2>Conditions generales d\'utilisation</h2>' +
        '<p>En utilisant la plateforme Windrop, vous acceptez les presentes conditions generales d\'utilisation. La participation aux giveaways est ouverte a toute personne majeure residant en France metropolitaine.</p>' +
        '<p>Chaque participation est facturee 1 euro. Ce montant est non remboursable. Le tirage au sort est effectue de maniere aleatoire a la date de fin indiquee sur chaque giveaway.</p>' +
        '<p>Le gagnant est notifie par email a l\'adresse fournie lors de l\'inscription. Il dispose de 7 jours pour confirmer ses coordonnees de livraison.</p>' +
        '<h2>Politique de confidentialite</h2>' +
        '<p>Nous collectons uniquement les informations necessaires au fonctionnement du service : nom d\'utilisateur et adresse email. Ces donnees ne sont jamais partagees avec des tiers.</p>' +
        '<p>Conformement au RGPD, vous disposez d\'un droit d\'acces, de modification et de suppression de vos donnees personnelles. Pour exercer ce droit, contactez-nous via le formulaire de contact.</p>' +
        '<h2>Responsabilite</h2>' +
        '<p>Windrop ne peut etre tenu responsable en cas de force majeure empechant la livraison des lots. Les produits sont livres dans l\'etat decrit sur la page du giveaway.</p>' +
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
