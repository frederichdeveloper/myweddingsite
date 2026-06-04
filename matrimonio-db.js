(function (global) {
  var SCRIPT_URL = 'INCOLLA_QUI_URL_APPS_SCRIPT_EXEC';
  var LOCAL_KEY = 'matrimonio_db_local';
  var dbCache = null;

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
        if (typeof g === 'string') return g.trim();
        if (g && typeof g === 'object') return String(g.nome || g.name || '').trim();
        return '';
      }).filter(Boolean);
    });

    db.guests = db.guests.map(function (g) {
      if (typeof g === 'string') return g.trim();
      if (g && typeof g === 'object') return String(g.nome || g.name || '').trim();
      return '';
    }).filter(Boolean);

    db.tables.count = db.tables.items.length;
    return db;
  }

  function loadLocalCopy() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      return normalizeDb(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function saveLocalCopy(db) {
    try {
      dbCache = normalizeDb(JSON.parse(JSON.stringify(db || {})));
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
    return fetch(SCRIPT_URL + '?action=load', {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    })
    .then(function (r) {
      if (!r.ok) throw new Error('Errore caricamento DB');
      return r.text();
    })
    .then(function (text) {
      var data = JSON.parse(text);
      dbCache = normalizeDb(data);
      saveLocalCopy(dbCache);
      return dbCache;
    })
    .catch(function (err) {
      console.warn('Caricamento remoto fallito, uso cache locale', err);
      var local = loadLocalCopy();
      if (local) {
        dbCache = local;
        return dbCache;
      }
      dbCache = normalizeDb({ tables: { items: [], seatsPerTable: 10, count: 0 }, guests: [] });
      return dbCache;
    });
  }

  function syncToRemote(db) {
    var payload = normalizeDb(JSON.parse(JSON.stringify(db || dbCache || {})));
    dbCache = payload;
    saveLocalCopy(payload);

    return fetch(SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'save',
        db: payload
      })
    })
    .then(function (r) {
      if (!r.ok) throw new Error('Errore salvataggio remoto');
      return r.text();
    })
    .then(function (text) {
      return JSON.parse(text);
    });
  }

  function getTable(id) {
    if (!dbCache || !dbCache.tables || !dbCache.tables.items) return null;
    return dbCache.tables.items.find(function (t) {
      return t.id === Number(id);
    }) || null;
  }

  function findTableByName(q) {
    if (!dbCache || !dbCache.tables || !dbCache.tables.items) return null;
    q = String(q || '').trim().toLowerCase();
    if (!q) return null;
    return dbCache.tables.items.find(function (t) {
      return String(t.name || '').toLowerCase().indexOf(q) !== -1;
    }) || null;
  }

  function getAllTables() {
    return (dbCache && dbCache.tables && dbCache.tables.items) ? dbCache.tables.items : [];
  }

  function getGuests() {
    return (dbCache && dbCache.guests) ? dbCache.guests : [];
  }

  function assignGuestToTable(guestFullName, tableId) {
    if (!dbCache) return false;
    guestFullName = String(guestFullName || '').trim();
    if (!guestFullName) return false;

    var t = getTable(tableId);
    if (!t) return false;
    if (!Array.isArray(t.guests)) t.guests = [];
    if (t.guests.indexOf(guestFullName) !== -1) return false;

    var cap = (dbCache.tables && dbCache.tables.seatsPerTable) ? dbCache.tables.seatsPerTable : 10;
    if (t.guests.length >= cap) return false;

    t.guests.push(guestFullName);
    if (!Array.isArray(dbCache.guests)) dbCache.guests = [];
    if (dbCache.guests.indexOf(guestFullName) === -1) dbCache.guests.push(guestFullName);

    saveLocalCopy(dbCache);
    return true;
  }

  function unassignGuestFromTable(guestFullName) {
    if (!dbCache || !dbCache.tables || !Array.isArray(dbCache.tables.items)) return false;
    guestFullName = String(guestFullName || '').trim();
    if (!guestFullName) return false;

    var removed = false;
    dbCache.tables.items.forEach(function (t) {
      if (!Array.isArray(t.guests)) t.guests = [];
      var idx = t.guests.indexOf(guestFullName);
      if (idx !== -1) {
        t.guests.splice(idx, 1);
        removed = true;
      }
    });

    if (removed) saveLocalCopy(dbCache);
    return removed;
  }

  function addGuest(guestFullName) {
    guestFullName = String(guestFullName || '').trim();
    if (!guestFullName) return false;

    if (!dbCache) dbCache = normalizeDb({
      tables: { items: [], seatsPerTable: 10, count: 0 },
      guests: []
    });

    if (!Array.isArray(dbCache.guests)) dbCache.guests = [];
    if (dbCache.guests.indexOf(guestFullName) !== -1) return false;

    dbCache.guests.push(guestFullName);
    saveLocalCopy(dbCache);
    return true;
  }

  function removeGuest(guestFullName) {
    if (!dbCache || !Array.isArray(dbCache.guests)) return false;
    guestFullName = String(guestFullName || '').trim();
    if (!guestFullName) return false;

    var idx = dbCache.guests.indexOf(guestFullName);
    if (idx === -1) return false;

    dbCache.guests.splice(idx, 1);
    unassignGuestFromTable(guestFullName);
    saveLocalCopy(dbCache);
    return true;
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
    assignGuestToTable: assignGuestToTable,
    unassignGuestFromTable: unassignGuestFromTable,
    addGuest: addGuest,
    removeGuest: removeGuest,
    syncToRemote: syncToRemote,
    normalizeDb: normalizeDb
  };
})(window);