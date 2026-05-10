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
          '<button class="admin-tab' + (currentAdminTab === 'list' ? ' active' : '') + '" data-tab="list">Giveaways</button>' +
          '<button class="admin-tab' + (currentAdminTab === 'create' ? ' active' : '') + '" data-tab="create">Creer</button>' +
          '<button class="admin-tab' + (currentAdminTab === 'winners' ? ' active' : '') + '" data-tab="winners">Gagnants</button>' +
          '<button class="admin-tab' + (currentAdminTab === 'messages' ? ' active' : '') + '" data-tab="messages">Messages</button>' +
          '<button class="admin-tab' + (currentAdminTab === 'infos' ? ' active' : '') + '" data-tab="infos">Infos</button>' +
        '</div>' +
        '<div id="admin-content"></div>' +
      '</div>';

    document.querySelectorAll('.admin-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.admin-tab').forEach(function(b) { b.classList.remove('active'); });
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
      case 'messages': renderAdminMessages(); break;
      case 'infos': renderAdminInfos(); break;
    }
  }

  async function renderAdminList() {
    const container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const giveaways = await adminApi('/api/admin/giveaways');
      const list = Array.isArray(giveaways) ? giveaways : [];

      container.innerHTML =
        '<div style="margin-bottom:1rem"><button class="btn btn-secondary btn-sm" onclick="window.adminRefreshList()">Rafraichir</button></div>' +
        '<table class="admin-table">' +
          '<thead><tr><th>ID</th><th>Image</th><th>Titre</th><th>Prix</th><th>Participants</th><th>Statut</th><th>Actions</th></tr></thead>' +
          '<tbody>' +
            list.map(function(g) {
              var thumbSrc = g.image_url || '/static/images/placeholder.svg';
              return '<tr>' +
                '<td data-label="ID">' + esc(g.id) + '</td>' +
                '<td data-label="Image"><img src="' + esc(thumbSrc) + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px" onerror="this.src=\'/static/images/placeholder.svg\'"></td>' +
                '<td data-label="Titre">' + esc(g.title) + '</td>' +
                '<td data-label="Prix">' + esc(g.price || 0) + ' EUR</td>' +
                '<td data-label="Participants">' + esc(g.current_participants || 0) + '</td>' +
                '<td data-label="Statut"><span class="status-badge status-' + esc(g.status) + '">' + esc(g.status) + '</span></td>' +
                '<td data-label="Actions">' +
                  (g.status === 'active' ? '<button class="btn btn-draw" onclick="window.adminDraw(' + g.id + ')">LANCER LE TIRAGE</button> ' : '') +
                  (g.status === 'active' ? '<button class="btn btn-sm btn-warning" onclick="window.adminCloseGiveaway(' + g.id + ')">Fermer</button> ' : '') +
                  '<button class="btn btn-sm btn-secondary" onclick="window.adminEditGiveaway(' + g.id + ')">Editer</button> ' +
                  '<button class="btn btn-sm btn-secondary" onclick="window.adminViewParticipants(' + g.id + ')">Voir</button> ' +
                  '<button class="btn btn-sm btn-danger" onclick="window.adminDeleteGiveaway(' + g.id + ')">Supprimer</button>' +
                '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun giveaway</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  }

  window.adminRefreshList = function() {
    renderAdminList();
  };

  function renderAdminCreate() {
    const container = document.getElementById('admin-content');
    container.innerHTML =
      '<form id="admin-create-form" style="max-width:500px">' +
        '<div class="form-group"><label>Titre</label><input type="text" id="adm-title" required></div>' +
        '<div class="form-group"><label>Description</label><textarea id="adm-desc"></textarea></div>' +
        '<div class="form-group"><label>Prix (valeur du produit)</label><input type="number" id="adm-price" step="0.01" required></div>' +
        '<div class="form-group"><label>Image du produit</label>' +
          '<input type="file" id="adm-image-file" accept="image/*" style="margin-bottom:0.5rem">' +
          '<div id="adm-image-preview" style="margin:0.5rem 0"></div>' +
          '<input type="text" id="adm-image" placeholder="ou coller un lien URL (https://...)">' +
        '</div>' +
        '<div class="form-group"><label>URL Source (produit original)</label><input type="text" id="adm-source" placeholder="https://..."></div>' +
        '<div class="form-group"><label>Etat du produit</label>' +
          '<select id="adm-condition"><option value="neuf">Neuf</option><option value="comme neuf">Comme neuf</option><option value="bon etat">Bon etat</option><option value="correct">Correct</option></select>' +
        '</div>' +
        '<div class="form-group"><label>Date de fin du giveaway</label>' +
          '<input type="datetime-local" id="adm-end" style="margin-bottom:0.5rem">' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">' +
            '<button type="button" class="btn-quick-time" data-hours="1">+1h</button>' +
            '<button type="button" class="btn-quick-time" data-hours="6">+6h</button>' +
            '<button type="button" class="btn-quick-time" data-hours="24">+24h</button>' +
            '<button type="button" class="btn-quick-time" data-hours="48">+48h</button>' +
            '<button type="button" class="btn-quick-time" data-hours="72">+3 jours</button>' +
            '<button type="button" class="btn-quick-time" data-hours="168">+7 jours</button>' +
          '</div>' +
          '<div id="adm-end-preview" style="margin-top:0.5rem;font-size:0.85rem;color:var(--accent)"></div>' +
        '</div>' +
        '<div class="form-group"><label>Max participants (optionnel)</label><input type="number" id="adm-max-participants" placeholder="ex: 100 (laisser vide = illimite)" min="2"></div>' +
        '<div id="admin-create-feedback"></div>' +
        '<button type="submit" class="btn btn-primary">Creer le giveaway</button>' +
      '</form>';

    // Quick time buttons
    document.querySelectorAll('.btn-quick-time').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var hours = parseInt(this.getAttribute('data-hours'));
        var d = new Date();
        d.setHours(d.getHours() + hours);
        // Format for datetime-local input (YYYY-MM-DDTHH:MM)
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        document.getElementById('adm-end').value = year + '-' + month + '-' + day + 'T' + h + ':' + m;
        updateEndPreview();
      });
    });

    // End date preview
    document.getElementById('adm-end').addEventListener('change', updateEndPreview);
    function updateEndPreview() {
      var val = document.getElementById('adm-end').value;
      var preview = document.getElementById('adm-end-preview');
      if (!val) { preview.textContent = ''; return; }
      var d = new Date(val);
      var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      preview.textContent = 'Termine le: ' + d.toLocaleDateString('fr-FR', options);
    }

    // Handle file preview
    document.getElementById('adm-image-file').addEventListener('change', function() {
      var preview = document.getElementById('adm-image-preview');
      if (this.files && this.files[0]) {
        preview.innerHTML = '<img src="' + URL.createObjectURL(this.files[0]) + '" style="max-width:100px;max-height:100px;border-radius:4px">';
      } else {
        preview.innerHTML = '';
      }
    });

    document.getElementById('admin-create-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var feedback = document.getElementById('admin-create-feedback');
      var imageUrl = document.getElementById('adm-image').value.trim();
      var fileInput = document.getElementById('adm-image-file');

      // Upload file if selected
      if (fileInput.files && fileInput.files[0]) {
        try {
          feedback.innerHTML = '<div style="color:var(--text-secondary)">Upload de l\'image...</div>';
          imageUrl = await uploadImage(fileInput.files[0]);
        } catch (err) {
          feedback.innerHTML = '<div class="form-error">Erreur upload: ' + esc(err.message) + '</div>';
          return;
        }
      }

      var data = {
        title: document.getElementById('adm-title').value.trim(),
        description: document.getElementById('adm-desc').value.trim(),
        price: parseFloat(document.getElementById('adm-price').value) || 0,
        image_url: imageUrl,
        source_url: document.getElementById('adm-source').value.trim(),
        condition: document.getElementById('adm-condition').value,
        end_time: document.getElementById('adm-end').value || null,
        max_participants: parseInt(document.getElementById('adm-max-participants').value) || null
      };

      if (!data.title) {
        feedback.innerHTML = '<div class="form-error">Le titre est requis</div>';
        return;
      }

      try {
        await adminApi('/api/admin/giveaways', { method: 'POST', body: JSON.stringify(data) });
        feedback.innerHTML = '<div class="success-msg">Giveaway cree avec succes !</div>';
        this.reset();
        document.getElementById('adm-image-preview').innerHTML = '';
        // Auto-switch to list tab
        setTimeout(function() { currentAdminTab = 'list'; window.renderAdminPage(); }, 1000);
      } catch (err) {
        feedback.innerHTML = '<div class="form-error">' + esc(err.message) + '</div>';
      }
    });
  }

  async function uploadImage(file) {
    var token = getAdminToken();
    var formData = new FormData();
    formData.append('image', file);

    var res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur upload');
    return data.url;
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
            list.map(function(w) {
              return '<tr>' +
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
                  ' <button class="btn btn-sm btn-danger" onclick="window.adminDeleteWinner(' + w.id + ')">Supprimer</button>' +
                '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun gagnant</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  }

  async function renderAdminMessages() {
    const container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const messages = await adminApi('/api/admin/messages');
      const list = Array.isArray(messages) ? messages : [];

      container.innerHTML =
        '<table class="admin-table">' +
          '<thead><tr><th>Date</th><th>Nom</th><th>Email</th><th>Message</th></tr></thead>' +
          '<tbody>' +
            list.map(function(m) {
              var dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
              return '<tr>' +
                '<td data-label="Date">' + esc(dateStr) + '</td>' +
                '<td data-label="Nom">' + esc(m.name) + '</td>' +
                '<td data-label="Email">' + esc(m.email) + '</td>' +
                '<td data-label="Message">' + esc(m.message) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucun message</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  }

  async function renderAdminInfos() {
    const container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const participants = await adminApi('/api/admin/all-participants');
      const list = Array.isArray(participants) ? participants : [];

      // Compute stats
      var ipSet = {};
      var emailSet = {};
      var fpSet = {};
      var ipToUsers = {};

      list.forEach(function(p) {
        var ip = p.ip_address || '';
        var email = p.email || '';
        var fp = p.fingerprint || '';
        var username = p.username || '';

        if (ip) {
          ipSet[ip] = true;
          if (!ipToUsers[ip]) ipToUsers[ip] = {};
          if (username) ipToUsers[ip][username] = true;
        }
        if (email) emailSet[email.toLowerCase()] = true;
        if (fp) fpSet[fp] = true;
      });

      var uniqueIps = Object.keys(ipSet).length;
      var uniqueEmails = Object.keys(emailSet).length;
      var uniqueFingerprints = Object.keys(fpSet).length;

      // Find suspicious IPs (same IP with multiple usernames)
      var suspiciousIps = {};
      Object.keys(ipToUsers).forEach(function(ip) {
        if (Object.keys(ipToUsers[ip]).length > 1) {
          suspiciousIps[ip] = true;
        }
      });

      // Build summary
      var summary = '<div style="margin:1rem 0;padding:0.75rem 1rem;background:var(--bg-card);border:1px solid var(--border-card);border-radius:8px;display:flex;flex-wrap:wrap;gap:1.5rem">' +
        '<span><strong>' + esc(list.length) + '</strong> participations</span>' +
        '<span><strong>' + esc(uniqueIps) + '</strong> IPs uniques</span>' +
        '<span><strong>' + esc(uniqueEmails) + '</strong> emails uniques</span>' +
        '<span><strong>' + esc(uniqueFingerprints) + '</strong> appareils uniques</span>' +
        (Object.keys(suspiciousIps).length > 0 ? '<span style="color:#ff4444"><strong>' + esc(Object.keys(suspiciousIps).length) + '</strong> IPs suspectes</span>' : '') +
      '</div>';

      container.innerHTML =
        '<h3 style="margin:1rem 0">Toutes les participations</h3>' +
        summary +
        '<table class="admin-table">' +
          '<thead><tr><th>#</th><th>Pseudo</th><th>Email</th><th>IP</th><th>Appareil</th><th>Giveaway</th><th>Date</th></tr></thead>' +
          '<tbody>' +
            list.map(function(p, idx) {
              var ip = p.ip_address || '';
              var isSuspicious = ip && suspiciousIps[ip];
              var ipStyle = isSuspicious ? ' style="color:#ff4444;font-weight:bold"' : '';
              var usernameStyle = isSuspicious ? ' style="color:#ff4444"' : '';
              var fp = p.fingerprint || '';
              var fpDisplay = fp ? (fp.length > 10 ? fp.substring(0, 10) + '...' : fp) : 'N/A';
              var dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
              return '<tr>' +
                '<td data-label="#">' + (idx + 1) + '</td>' +
                '<td data-label="Pseudo"' + usernameStyle + '>' + esc(p.username || 'N/A') + '</td>' +
                '<td data-label="Email">' + esc(p.email || 'N/A') + '</td>' +
                '<td data-label="IP"' + ipStyle + '>' + esc(ip || 'N/A') + '</td>' +
                '<td data-label="Appareil" title="' + esc(fp) + '">' + esc(fpDisplay) + '</td>' +
                '<td data-label="Giveaway">' + esc(p.giveaway_title || 'N/A') + '</td>' +
                '<td data-label="Date">' + esc(dateStr) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
        (list.length === 0 ? '<p class="text-center" style="color:var(--text-secondary)">Aucune participation</p>' : '');
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  }

  // Admin Actions
  window.adminDraw = async function(giveawayId) {
    if (!confirm('Effectuer le tirage au sort pour ce giveaway ?')) return;
    try {
      var result = await adminApi('/api/admin/giveaways/' + giveawayId + '/draw', { method: 'POST', body: '{}' });
      alert('Gagnant tire : ' + (result.winner ? result.winner.username || 'ID ' + result.winner.user_id : 'inconnu'));
      renderAdminList();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  window.adminCloseGiveaway = async function(giveawayId) {
    if (!confirm('Fermer ce giveaway ? Il sera marque comme expire.')) return;
    try {
      await adminApi('/api/admin/giveaways/' + giveawayId, {
        method: 'PUT',
        body: JSON.stringify({ status: 'expired' })
      });
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

  window.adminEditGiveaway = async function(giveawayId) {
    var container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      var giveaways = await adminApi('/api/admin/giveaways');
      var g = null;
      for (var i = 0; i < giveaways.length; i++) {
        if (giveaways[i].id === giveawayId) { g = giveaways[i]; break; }
      }
      if (!g) {
        container.innerHTML = '<div class="error-msg">Giveaway introuvable</div>';
        return;
      }

      var endTimeVal = '';
      if (g.end_time) {
        // Convert ISO to datetime-local format
        var dt = g.end_time.replace('T', 'T').slice(0, 16);
        endTimeVal = dt;
      }

      container.innerHTML =
        '<button class="btn btn-secondary btn-sm mb-2" onclick="window.renderAdminPage();">Retour</button>' +
        '<h3 style="margin:1rem 0">Editer le giveaway #' + esc(giveawayId) + '</h3>' +
        '<form id="admin-edit-form" style="max-width:500px">' +
          '<div class="form-group"><label>Titre</label><input type="text" id="edit-title" value="' + esc(g.title || '') + '" required></div>' +
          '<div class="form-group"><label>Description</label><textarea id="edit-desc">' + esc(g.description || '') + '</textarea></div>' +
          '<div class="form-group"><label>Prix (valeur du produit)</label><input type="number" id="edit-price" step="0.01" value="' + esc(g.price || 0) + '" required></div>' +
          '<div class="form-group"><label>Image du produit</label>' +
            '<input type="file" id="edit-image-file" accept="image/*" style="margin-bottom:0.5rem">' +
            '<div id="edit-image-preview" style="margin:0.5rem 0">' + (g.image_url ? '<img src="' + esc(g.image_url) + '" style="max-width:100px;max-height:100px;border-radius:4px">' : '') + '</div>' +
            '<input type="text" id="edit-image" value="' + esc(g.image_url || '') + '" placeholder="ou coller un lien URL (https://...)">' +
          '</div>' +
          '<div class="form-group"><label>URL Source (produit original)</label><input type="text" id="edit-source" value="' + esc(g.source_url || '') + '" placeholder="https://..."></div>' +
          '<div class="form-group"><label>Etat du produit</label>' +
            '<select id="edit-condition">' +
              '<option value="neuf"' + (g.condition === 'neuf' ? ' selected' : '') + '>Neuf</option>' +
              '<option value="comme neuf"' + (g.condition === 'comme neuf' ? ' selected' : '') + '>Comme neuf</option>' +
              '<option value="bon etat"' + (g.condition === 'bon etat' ? ' selected' : '') + '>Bon etat</option>' +
              '<option value="correct"' + (g.condition === 'correct' ? ' selected' : '') + '>Correct</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group"><label>Max participants</label><input type="number" id="edit-max-participants" value="' + esc(g.max_participants || '') + '" placeholder="Illimite si vide"></div>' +
          '<div class="form-group"><label>Date de fin</label><input type="datetime-local" id="edit-end" value="' + esc(endTimeVal) + '"></div>' +
          '<div class="form-group"><label>Statut</label>' +
            '<select id="edit-status">' +
              '<option value="active"' + (g.status === 'active' ? ' selected' : '') + '>Active</option>' +
              '<option value="expired"' + (g.status === 'expired' ? ' selected' : '') + '>Expire</option>' +
              '<option value="ended"' + (g.status === 'ended' ? ' selected' : '') + '>Termine</option>' +
            '</select>' +
          '</div>' +
          '<div id="admin-edit-feedback"></div>' +
          '<button type="submit" class="btn btn-primary">Sauvegarder</button>' +
        '</form>';

      // Handle file preview
      document.getElementById('edit-image-file').addEventListener('change', function() {
        var preview = document.getElementById('edit-image-preview');
        if (this.files && this.files[0]) {
          preview.innerHTML = '<img src="' + URL.createObjectURL(this.files[0]) + '" style="max-width:100px;max-height:100px;border-radius:4px">';
        }
      });

      document.getElementById('admin-edit-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var feedback = document.getElementById('admin-edit-feedback');
        var imageUrl = document.getElementById('edit-image').value.trim();
        var fileInput = document.getElementById('edit-image-file');

        // Upload file if selected
        if (fileInput.files && fileInput.files[0]) {
          try {
            feedback.innerHTML = '<div style="color:var(--text-secondary)">Upload de l\'image...</div>';
            imageUrl = await uploadImage(fileInput.files[0]);
          } catch (err) {
            feedback.innerHTML = '<div class="form-error">Erreur upload: ' + esc(err.message) + '</div>';
            return;
          }
        }

        var data = {
          title: document.getElementById('edit-title').value.trim(),
          description: document.getElementById('edit-desc').value.trim(),
          price: parseFloat(document.getElementById('edit-price').value) || 0,
          image_url: imageUrl,
          source_url: document.getElementById('edit-source').value.trim(),
          condition: document.getElementById('edit-condition').value,
          max_participants: parseInt(document.getElementById('edit-max-participants').value) || null,
          end_time: document.getElementById('edit-end').value || null,
          status: document.getElementById('edit-status').value
        };

        if (!data.title) {
          feedback.innerHTML = '<div class="form-error">Le titre est requis</div>';
          return;
        }

        try {
          await adminApi('/api/admin/giveaways/' + giveawayId, { method: 'PUT', body: JSON.stringify(data) });
          feedback.innerHTML = '<div class="success-msg">Giveaway mis a jour !</div>';
          setTimeout(function() { currentAdminTab = 'list'; window.renderAdminPage(); }, 1000);
        } catch (err) {
          feedback.innerHTML = '<div class="form-error">' + esc(err.message) + '</div>';
        }
      });
    } catch (err) {
      container.innerHTML = '<div class="error-msg">Erreur: ' + esc(err.message) + '</div>';
    }
  };

  window.adminViewParticipants = async function(giveawayId) {
    var container = document.getElementById('admin-content');
    container.innerHTML = '<div class="loading">Chargement...</div>';
    try {
      var participants = await adminApi('/api/admin/giveaways/' + giveawayId + '/participants');
      var list = Array.isArray(participants) ? participants : [];

      // Count unique IPs
      var ipCounts = {};
      list.forEach(function(p) {
        var ip = p.ip_address || '';
        if (ip) {
          ipCounts[ip] = (ipCounts[ip] || 0) + 1;
        }
      });
      var uniqueIps = Object.keys(ipCounts).length;

      // Build summary
      var summary = '<div style="margin:1rem 0;padding:0.75rem 1rem;background:var(--bg-card);border:1px solid var(--border-card);border-radius:8px;display:inline-block">' +
        '<strong>' + esc(list.length) + ' participants</strong> | <strong>' + esc(uniqueIps) + ' IPs uniques</strong>' +
      '</div>';

      container.innerHTML =
        '<button class="btn btn-secondary btn-sm mb-2" onclick="window.renderAdminPage();">Retour</button>' +
        '<h3 style="margin:1rem 0">Participants du giveaway #' + esc(giveawayId) + '</h3>' +
        summary +
        '<table class="admin-table">' +
          '<thead><tr><th>#</th><th>Pseudo</th><th>Email</th><th>IP</th><th>Appareil</th><th>Date</th></tr></thead>' +
          '<tbody>' +
            list.map(function(p, idx) {
              var ip = p.ip_address || '';
              var isDuplicateIp = ip && ipCounts[ip] > 1;
              var ipStyle = isDuplicateIp ? ' style="color:#ff4444;font-weight:bold"' : '';
              var fp = p.fingerprint || '';
              var fpDisplay = fp ? (fp.length > 10 ? fp.substring(0, 10) + '...' : fp) : 'N/A';
              var dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
              return '<tr>' +
                '<td data-label="#">' + (idx + 1) + '</td>' +
                '<td data-label="Pseudo">' + esc(p.username || 'N/A') + '</td>' +
                '<td data-label="Email">' + esc(p.email || 'N/A') + '</td>' +
                '<td data-label="IP"' + ipStyle + '>' + esc(ip || 'N/A') + '</td>' +
                '<td data-label="Appareil" title="' + esc(fp) + '">' + esc(fpDisplay) + '</td>' +
                '<td data-label="Date">' + esc(dateStr) + '</td>' +
              '</tr>';
            }).join('') +
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

  window.adminDeleteWinner = async function(winnerId) {
    if (!confirm('Supprimer ce gagnant ? Le giveaway sera remis en statut actif.')) return;
    try {
      await adminApi('/api/admin/winners/' + winnerId, { method: 'DELETE' });
      renderAdminWinners();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // Admin API helper with token
  async function adminApi(url, options) {
    options = options || {};
    var token = getAdminToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    try {
      var res = await fetch(url, {
        headers: headers,
        method: options.method || 'GET',
        body: options.body || undefined
      });
      if (res.status === 401) {
        // Token invalid, clear and prompt again
        sessionStorage.removeItem('windrop_admin_token');
        throw new Error('Token invalide. Rechargez la page pour reessayer.');
      }
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      return data;
    } catch (err) {
      throw err;
    }
  }

})();
