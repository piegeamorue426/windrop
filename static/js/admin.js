/* Windrop - Admin Dashboard */
(function() {
  'use strict';

  let currentAdminTab = 'list';

  window.renderAdminPage = function() {
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
                '<td data-label="ID">' + g.id + '</td>' +
                '<td data-label="Titre">' + g.title + '</td>' +
                '<td data-label="Prix">' + (g.price || 0) + ' EUR</td>' +
                '<td data-label="Participants">' + (g.current_participants || 0) + '</td>' +
                '<td data-label="Statut"><span class="status-badge status-' + g.status + '">' + g.status + '</span></td>' +
                '<td data-label="Actions">' +
                  (g.status === 'active' ? '<button class="btn btn-sm btn-primary" onclick="window.adminDraw(' + g.id + ')">Tirage</button> ' : '') +
                  '<button class="btn btn-sm btn-secondary" onclick="window.adminViewParticipants(' + g.id + ')">Voir</button>' +
                '</td>' +
              '</tr>'
            ).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun giveaway</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + err.message + '</div>';
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
        feedback.innerHTML = '<div class="form-error">' + err.message + '</div>';
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
                '<td data-label="ID">' + w.id + '</td>' +
                '<td data-label="Gagnant">' + (w.username || 'N/A') + '</td>' +
                '<td data-label="Produit">' + (w.giveaway_title || 'N/A') + '</td>' +
                '<td data-label="Statut"><span class="shipping-badge shipping-' + (w.shipping_status || 'pending') + '">' + (w.shipping_status || 'pending') + '</span></td>' +
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
      container.innerHTML = '<div class="error-msg">Erreur: ' + err.message + '</div>';
    }
  }

  // Admin Actions
  window.adminDraw = async function(giveawayId) {
    if (!confirm('Effectuer le tirage au sort pour ce giveaway ?')) return;
    try {
      const result = await adminApi('/api/admin/giveaways/' + giveawayId + '/draw', { method: 'POST', body: '{}' });
      alert('Gagnant tire : ' + (result.winner ? result.winner.username || 'ID ' + result.winner.user_id : 'inconnu'));
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
        '<button class="btn btn-secondary btn-sm mb-2" onclick="window.renderAdminPage(); document.querySelector('.admin-tab[data-tab=list]').click();">Retour</button>' +
        '<h3 style="margin:1rem 0">Participants du giveaway #' + giveawayId + ' (' + list.length + ')</h3>' +
        '<table class="admin-table">' +
          '<thead><tr><th>Username</th><th>Email</th><th>Date</th></tr></thead>' +
          '<tbody>' +
            list.map(p =>
              '<tr>' +
                '<td data-label="Username">' + (p.username || 'N/A') + '</td>' +
                '<td data-label="Email">' + (p.email || 'N/A') + '</td>' +
                '<td data-label="Date">' + (p.created_at || '') + '</td>' +
              '</tr>'
            ).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p style="color:var(--text-secondary);margin-top:1rem">Aucun participant</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + err.message + '</div>';
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

  // Admin API helper
  async function adminApi(url, options = {}) {
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

})();
