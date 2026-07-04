(function (global) {
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz7sBJCme08YlGCJchKxldy0yVSUwkIfUK79OolP4N0ynBHjSjlcIBX_z0NE2g4IXXOSQ/exec';
  var LOCAL_KEY = 'matrimonio_db_local';
  var dbCache = null;

  function normalizeText(s) { return String(s || '').trim(); }

  function normalizePhone(phone) {
    var p = String(phone || '').trim();
    if (!p) return '';
    p = p.replace(/[^\d+]/g, '');
    if (p.indexOf('+') === 0) p = p.substring(1);
    return p;
  }

  function isConfiguredUrl() { return !!SCRIPT_URL && SCRIPT_URL.indexOf('IL_TUO_DEPLOY_ID') === -1; }
  function createEmptyDb() { return normalizeDb({ tables: { items: [], seatsPerTable: 10, count: 0 }, guests: [] }); }

  function normalizeGuestEntry(g) {
    if (typeof g === 'string') return { name: normalizeText(g), phone: '' };
    if (g && typeof g === 'object') {
      return {
        name: normalizeText(g.nome || g.name || ''),
        phone: normalizePhone(g.phone || g.telefono || g.tel || '')
      };
    }
    return { name: '', phone: '' };
  }

  function normalizeDb(db) {
    if (!db) db = {};
    if (!db.tables) db.tables = {};
    if (!Array.isArray(db.tables.items)) db.tables.items = [];
    if (typeof db.tables.seatsPerTable !== 'number') db.tables.seatsPerTable = 10;
    if (typeof db.tables.count !== 'number') db.tables.count = db.tables.items.length;
    if (!Array.isArray(db.guests)) db.guests = [];

    db.tables.items.forEach(function (t, i) {
      if (typeof t.id !== 'number') t.id = i + 1;
      if (!t.name && t.nome) t.name = t.nome;
      if (!t.name) t.name = 'Tavolo ' + t.id;
      if (!Array.isArray(t.guests)) {
        if (Array.isArray(t.posti)) t.guests = t.posti.slice();
        else t.guests = [];
      }
      t.guests = t.guests.map(function (g) {
        if (typeof g === 'string') return normalizeText(g);
        if (g && typeof g === 'object') return normalizeText(g.nome || g.name || '');
        return '';
      }).filter(Boolean);
    });

    db.guests = db.guests.map(normalizeGuestEntry).filter(function (g) { return g.name; });

    var merged = {};
    var order = [];
    db.guests.forEach(function (g) {
      var key = g.name.toLowerCase();
      if (!merged[key]) {
        merged[key] = { name: g.name, phone: g.phone || '' };
        order.push(key);
      } else if (!merged[key].phone && g.phone) {
        merged[key].phone = g.phone;
      }
    });
    db.guests = order.map(function (key) { return merged[key]; });

    db.tables.count = db.tables.items.length;
    return db;
  }

  function cloneDb(db) { return normalizeDb(JSON.parse(JSON.stringify(db || {}))); }

  function loadLocalCopy() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      return normalizeDb(JSON.parse(raw));
    } catch (e) { return null; }
  }

  function saveLocalCopy(db) {
    try {
      dbCache = cloneDb(db);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(dbCache));
      return true;
    } catch (e) {
      console.warn('Impossibile salvare localmente', e);
      return false;
    }
  }

  function clearLocalCopy() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (e) {}
    dbCache = null;
  }

  function loadDB() {
    if (!isConfiguredUrl()) {
      dbCache = loadLocalCopy() || createEmptyDb();
      return Promise.resolve(dbCache);
    }

    return fetch(SCRIPT_URL + '?action=load', { method: 'GET', cache: 'no-store', redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('Errore caricamento DB'); return r.text(); })
      .then(function (text) {
        var data = JSON.parse(text);
        dbCache = normalizeDb(data);
        saveLocalCopy(dbCache);
        return dbCache;
      })
      .catch(function (err) {
        console.warn('Caricamento remoto fallito, uso cache locale', err);
        dbCache = loadLocalCopy() || createEmptyDb();
        return dbCache;
      });
  }

  function syncToRemote(db) {
    var payload = cloneDb(db || dbCache || createEmptyDb());
    dbCache = payload;
    saveLocalCopy(payload);

    if (!isConfiguredUrl()) return Promise.resolve({ ok: true, localOnly: true });

    return fetch(SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'save', db: payload })
    })
    .then(function (r) { if (!r.ok) throw new Error('Errore salvataggio remoto'); return r.text(); })
    .then(function (text) { try { return JSON.parse(text); } catch (e) { return { ok: true, raw: text }; } });
  }

  function getTable(id) {
    if (!dbCache || !dbCache.tables || !Array.isArray(dbCache.tables.items)) return null;
    return dbCache.tables.items.find(function (t) { return Number(t.id) === Number(id); }) || null;
  }

  function findTableByName(q) {
    if (!dbCache || !dbCache.tables || !Array.isArray(dbCache.tables.items)) return null;
    q = normalizeText(q).toLowerCase();
    if (!q) return null;
    return dbCache.tables.items.find(function (t) { return String(t.name || '').toLowerCase().indexOf(q) !== -1; }) || null;
  }

  function getAllTables() { return (dbCache && dbCache.tables && Array.isArray(dbCache.tables.items)) ? dbCache.tables.items : []; }

  function getGuests() { return (dbCache && Array.isArray(dbCache.guests)) ? dbCache.guests : []; }

  function findGuestByName(guestFullName) {
    guestFullName = normalizeText(guestFullName).toLowerCase();
    if (!guestFullName || !dbCache || !Array.isArray(dbCache.guests)) return null;
    return dbCache.guests.find(function (g) { return g.name.toLowerCase() === guestFullName; }) || null;
  }

  function getGuestPhone(guestFullName) {
    var g = findGuestByName(guestFullName);
    return g ? (g.phone || '') : '';
  }

  function ensureDb() { if (!dbCache) dbCache = createEmptyDb(); return dbCache; }

  function removeGuestFromAllTables(guestFullName) {
    guestFullName = normalizeText(guestFullName);
    if (!guestFullName || !dbCache || !dbCache.tables || !Array.isArray(dbCache.tables.items)) return false;
    var removed = false;
    dbCache.tables.items.forEach(function (t) {
      if (!Array.isArray(t.guests)) t.guests = [];
      var idx = t.guests.indexOf(guestFullName);
      if (idx !== -1) { t.guests.splice(idx, 1); removed = true; }
    });
    return removed;
  }

  function renameGuestEverywhere(oldName, newName) {
    oldName = normalizeText(oldName);
    newName = normalizeText(newName);
    if (!oldName || !newName || oldName === newName) return false;
    if (!dbCache || !dbCache.tables || !Array.isArray(dbCache.tables.items)) return false;
    dbCache.tables.items.forEach(function (t) {
      if (!Array.isArray(t.guests)) return;
      var idx = t.guests.indexOf(oldName);
      if (idx !== -1) t.guests[idx] = newName;
    });
    return true;
  }

  function isGuestAssigned(guestFullName) {
    guestFullName = normalizeText(guestFullName);
    if (!guestFullName || !dbCache || !dbCache.tables || !Array.isArray(dbCache.tables.items)) return false;
    return dbCache.tables.items.some(function (t) { return Array.isArray(t.guests) && t.guests.indexOf(guestFullName) !== -1; });
  }

  function assignGuestToTable(guestFullName, tableId) {
    ensureDb();
    guestFullName = normalizeText(guestFullName);
    if (!guestFullName) return false;
    var t = getTable(tableId);
    if (!t) return false;
    if (!Array.isArray(t.guests)) t.guests = [];
    var cap = (dbCache.tables && dbCache.tables.seatsPerTable) ? dbCache.tables.seatsPerTable : 10;
    if (t.guests.length >= cap) return false;
    removeGuestFromAllTables(guestFullName);
    t.guests.push(guestFullName);
    if (!Array.isArray(dbCache.guests)) dbCache.guests = [];
    if (!findGuestByName(guestFullName)) dbCache.guests.push({ name: guestFullName, phone: '' });
    dbCache = normalizeDb(dbCache);
    saveLocalCopy(dbCache);
    return true;
  }

  function unassignGuestFromTable(guestFullName) {
    if (!dbCache || !dbCache.tables || !Array.isArray(dbCache.tables.items)) return false;
    guestFullName = normalizeText(guestFullName);
    if (!guestFullName) return false;
    var removed = removeGuestFromAllTables(guestFullName);
    if (removed) saveLocalCopy(dbCache);
    return removed;
  }

  function addGuest(guestFullName, phone) {
    ensureDb();
    guestFullName = normalizeText(guestFullName);
    if (!guestFullName) return false;
    if (!Array.isArray(dbCache.guests)) dbCache.guests = [];
    if (findGuestByName(guestFullName)) return false;
    dbCache.guests.push({ name: guestFullName, phone: normalizePhone(phone) });
    dbCache = normalizeDb(dbCache);
    saveLocalCopy(dbCache);
    return true;
  }

  function updateGuest(oldName, newName, phone) {
    ensureDb();
    oldName = normalizeText(oldName);
    newName = normalizeText(newName);
    if (!oldName || !newName) return false;
    var g = findGuestByName(oldName);
    if (!g) return false;
    renameGuestEverywhere(oldName, newName);
    g.name = newName;
    g.phone = normalizePhone(phone);
    dbCache = normalizeDb(dbCache);
    saveLocalCopy(dbCache);
    return true;
  }

  function removeGuest(guestFullName) {
    ensureDb();
    if (!Array.isArray(dbCache.guests)) return false;
    guestFullName = normalizeText(guestFullName);
    if (!guestFullName) return false;
    var idx = dbCache.guests.findIndex(function (g) { return g.name.toLowerCase() === guestFullName.toLowerCase(); });
    if (idx === -1) return false;
    dbCache.guests.splice(idx, 1);
    removeGuestFromAllTables(guestFullName);
    saveLocalCopy(dbCache);
    return true;
  }

  function setSeatsPerTable(n) {
    ensureDb();
    n = parseInt(n, 10);
    if (!Number.isFinite(n)) return false;
    n = Math.min(Math.max(n, 1), 20);
    dbCache.tables.seatsPerTable = n;
    saveLocalCopy(dbCache);
    return true;
  }

  function setTablesCount(n) {
    ensureDb();
    n = parseInt(n, 10);
    if (!Number.isFinite(n)) return false;
    n = Math.min(Math.max(n, 1), 30);
    var items = dbCache.tables.items;
    while (items.length < n) items.push({ id: items.length + 1, name: 'Tavolo ' + (items.length + 1), guests: [] });
    if (items.length > n) {
      items = items.slice(0, n);
      dbCache.tables.items = items;
      dbCache.tables.items.forEach(function (t, i) { t.id = i + 1; });
    }
    dbCache.tables.count = dbCache.tables.items.length;
    saveLocalCopy(dbCache);
    return true;
  }

  function resetDb(tablesCount, seatsPerTable) {
    dbCache = createEmptyDb();
    if (typeof tablesCount === 'number') setTablesCount(tablesCount);
    if (typeof seatsPerTable === 'number') setSeatsPerTable(seatsPerTable);
    saveLocalCopy(dbCache);
    return cloneDb(dbCache);
  }

  global.MatrimonioDB = {
    loadDB: loadDB,
    loadLocalCopy: loadLocalCopy,
    saveLocalCopy: saveLocalCopy,
    clearLocalCopy: clearLocalCopy,
    getTable: getTable,
    findTableByName: findTableByName,
    getAllTables: getAllTables,
    getGuests: getGuests,
    findGuestByName: findGuestByName,
    getGuestPhone: getGuestPhone,
    isGuestAssigned: isGuestAssigned,
    assignGuestToTable: assignGuestToTable,
    unassignGuestFromTable: unassignGuestFromTable,
    addGuest: addGuest,
    updateGuest: updateGuest,
    removeGuest: removeGuest,
    setSeatsPerTable: setSeatsPerTable,
    setTablesCount: setTablesCount,
    resetDb: resetDb,
    syncToRemote: syncToRemote,
    normalizeDb: normalizeDb,
    normalizePhone: normalizePhone
  };
})(window);