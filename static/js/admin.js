/* Windrop - Admin Dashboard */
(function() {
  'use strict';

  let currentAdminTab = 'list';

  function getAdminToken() {
    var token = sessionStorage.getItem('windrop_admin_token');
    if (!token) {
      token = prompt('Entrez le token administrateur:');
      if (token) {
        sessionStorage.setItem('windrop_admin_token', token);
      }
    }
    return token || '';
  }

  // Use the global escapeHtml from app.js, with fallback
  function esc(str) {
    if (typeof window.escapeHtml === 'function') {
      return window.escapeHtml(str);
    }
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.renderAdminPage = function() {
    // Ensure we have a token before proceeding
    getAdminToken();

    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="page container admin-page">' +
        '<h1 class="section-title">Administration</h1>' +
        '<div class="admin-tabs">' +
          '<button class="admin-tab active" data-tab="list">Giveaways</button>' +
          '<button class="admin-tab" data-tab="create">Creer</button>' +
          '<button class="admin-tab" data-tab="winners">Gagnants</button>' +
        '</div>' +
        '<div id="admin-content"></div>' +
      '</div>';

    document.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAdminTab = btn.getAttribute('data-tab');
        renderAdminTab();
      });
    });

    renderAdminTab();
  };

  function renderAdminTab() {
    switch (currentAdminTab) {
      case 'list': renderAdminList(); break;
      case 'create': renderAdminCreate(); break;
      case 'winners': renderAdminWinners(); break;
    }
  }

  async function renderAdminList() {
    const container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const giveaways = await adminApi('/api/admin/giveaways');
      const list = Array.isArray(giveaways) ? giveaways : [];

      container.innerHTML =
        '<table class="admin-table">' +
          '<thead><tr><th>ID</th><th>Titre</th><th>Prix</th><th>Participants</th><th>Statut</th><th>Actions</th></tr></thead>' +
          '<tbody>' +
            list.map(g =>
              '<tr>' +
                '<td data-label="ID">' + esc(g.id) + '</td>' +
                '<td data-label="Titre">' + esc(g.title) + '</td>' +
                '<td data-label="Prix">' + esc(g.price || 0) + ' EUR</td>' +
                '<td data-label="Participants">' + esc(g.current_participants || 0) + '</td>' +
                '<td data-label="Statut"><span class="status-badge status-' + esc(g.status) + '">' + esc(g.status) + '</span></td>' +
                '<td data-label="Actions">' +
                  (g.status === 'active' ? '<button class="btn btn-sm btn-primary" onclick="window.adminDraw(' + g.id + ')">Tirage</button> ' : '') +
                  '<button class="btn btn-sm btn-secondary" onclick="window.adminViewParticipants(' + g.id + ')">Voir</button> ' +
                  '<button class="btn btn-sm" style="background:var(--accent-red);color:#fff" onclick="window.adminDeleteGiveaway(' + g.id + ')">Supprimer</button>' +
                '</td>' +
              '</tr>'
            ).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun giveaway</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  }

  function renderAdminCreate() {
    const container = document.getElementById('admin-content');
    container.innerHTML =
      '<form id="admin-create-form" style="max-width:500px">' +
        '<div class="form-group"><label>Titre</label><input type="text" id="adm-title" required></div>' +
        '<div class="form-group"><label>Description</label><textarea id="adm-desc"></textarea></div>' +
        '<div class="form-group"><label>Prix (valeur du produit)</label><input type="number" id="adm-price" step="0.01" required></div>' +
        '<div class="form-group"><label>URL Image</label><input type="text" id="adm-image" placeholder="https://..."></div>' +
        '<div class="form-group"><label>URL Source (produit original)</label><input type="text" id="adm-source" placeholder="https://..."></div>' +
        '<div class="form-group"><label>Etat du produit</label>' +
          '<select id="adm-condition"><option value="neuf">Neuf</option><option value="comme neuf">Comme neuf</option><option value="bon etat">Bon etat</option><option value="correct">Correct</option></select>' +
        '</div>' +
        '<div class="form-group"><label>Date de fin</label><input type="datetime-local" id="adm-end"></div>' +
        '<div id="admin-create-feedback"></div>' +
        '<button type="submit" class="btn btn-primary">Creer le giveaway</button>' +
      '</form>';

    document.getElementById('admin-create-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const feedback = document.getElementById('admin-create-feedback');
      const data = {
        title: document.getElementById('adm-title').value.trim(),
        description: document.getElementById('adm-desc').value.trim(),
        price: parseFloat(document.getElementById('adm-price').value) || 0,
        image_url: document.getElementById('adm-image').value.trim(),
        source_url: document.getElementById('adm-source').value.trim(),
        condition: document.getElementById('adm-condition').value,
        end_time: document.getElementById('adm-end').value || null
      };

      if (!data.title) {
        feedback.innerHTML = '<div class="form-error">Le titre est requis</div>';
        return;
      }

      try {
        await adminApi('/api/admin/giveaways', { method: 'POST', body: JSON.stringify(data) });
        feedback.innerHTML = '<div class="success-msg">Giveaway cree avec succes !</div>';
        this.reset();
      } catch (err) {
        feedback.innerHTML = '<div class="form-error">' + esc(err.message) + '</div>';
      }
    });
  }

  async function renderAdminWinners() {
    const container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const winners = await adminApi('/api/winners');
      const list = Array.isArray(winners) ? winners : [];

      container.innerHTML =
        '<table class="admin-table">' +
          '<thead><tr><th>ID</th><th>Gagnant</th><th>Produit</th><th>Statut</th><th>Actions</th></tr></thead>' +
          '<tbody>' +
            list.map(w =>
              '<tr>' +
                '<td data-label="ID">' + esc(w.id) + '</td>' +
                '<td data-label="Gagnant">' + esc(w.username || 'N/A') + '</td>' +
                '<td data-label="Produit">' + esc(w.giveaway_title || 'N/A') + '</td>' +
                '<td data-label="Statut"><span class="shipping-badge shipping-' + esc(w.shipping_status || 'pending') + '">' + esc(w.shipping_status || 'pending') + '</span></td>' +
                '<td data-label="Actions">' +
                  '<select onchange="window.adminUpdateShipping(' + w.id + ', this.value)" style="padding:0.3rem;background:var(--bg-card);color:var(--text-white);border:1px solid var(--border-card);border-radius:4px">' +
                    '<option value="pending"' + (w.shipping_status === 'pending' ? ' selected' : '') + '>En attente</option>' +
                    '<option value="shipped"' + (w.shipping_status === 'shipped' ? ' selected' : '') + '>Expedie</option>' +
                    '<option value="delivered"' + (w.shipping_status === 'delivered' ? ' selected' : '') + '>Livre</option>' +
                  '</select>' +
                '</td>' +
              '</tr>'
            ).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun gagnant</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  }

  // Admin Actions
  window.adminDraw = async function(giveawayId) {
    if (!confirm('Effectuer le tirage au sort pour ce giveaway ?')) return;
    try {
      const result = await adminApi('/api/admin/giveaways/' + giveawayId + '/draw', { method: 'POST', body: '{}' });
      alert('Gagnant tire : ' + esc(result.winner ? result.winner.username || 'ID ' + result.winner.user_id : 'inconnu'));
      renderAdminList();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  window.adminDeleteGiveaway = async function(giveawayId) {
    if (!confirm('Supprimer ce giveaway ? Cette action est irreversible.')) return;
    try {
      await adminApi('/api/admin/giveaways/' + giveawayId, { method: 'DELETE' });
      renderAdminList();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  window.adminViewParticipants = async function(giveawayId) {
    const container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';
    try {
      const participants = await adminApi('/api/admin/giveaways/' + giveawayId + '/participants');
      const list = Array.isArray(participants) ? participants : [];
      container.innerHTML =
        '<button class="btn btn-secondary btn-sm mb-2" onclick="window.renderAdminPage();">Retour</button>' +
        '<h3 style="margin:1rem 0">Participants du giveaway #' + esc(giveawayId) + ' (' + esc(list.length) + ')</h3>' +
        '<table class="admin-table">' +
          '<thead><tr><th>Username</th><th>Email</th><th>Date</th></tr></thead>' +
          '<tbody>' +
            list.map(p =>
              '<tr>' +
                '<td data-label="Username">' + esc(p.username || 'N/A') + '</td>' +
                '<td data-label="Email">' + esc(p.email || 'N/A') + '</td>' +
                '<td data-label="Date">' + esc(p.created_at || '') + '</td>' +
              '</tr>'
            ).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p style="color:var(--text-secondary);margin-top:1rem">Aucun participant</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  };

  window.adminUpdateShipping = async function(winnerId, status) {
    try {
      await adminApi('/api/admin/winners/' + winnerId + '/shipping', {
        method: 'PUT',
        body: JSON.stringify({ status: status, proof_url: '' })
      });
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // Admin API helper with token
  async function adminApi(url, options = {}) {
    var token = getAdminToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    try {
      const res = await fetch(url, {
        headers: headers,
        ...options
      });
      if (res.status === 401) {
        // Token invalid, clear and prompt again
        sessionStorage.removeItem('windrop_admin_token');
        throw new Error('Token invalide. Rechargez la page pour reessayer.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      return data;
    } catch (err) {
      throw err;
    }
  }

})();
