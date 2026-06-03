 /*
Funzioni:
- loadDB(): fetch('/matrimonio-db.json') → ritorna oggetto DB
- getTable(id): restituisce tavolo per id
- findTableByName(q): cerca per nome
- saveLocalCopy(db): salva una copia locale in localStorage (opzionale)
- loadLocalCopy(): legge localStorage se presente (utile per testing)
- assignGuestToTable(guestFullName, tableId): assegna (solo localmente)
- unassignGuestFromTable(guestFullName): rimuove assegnamento (solo localmente)
- addGuest(guestFullName): aggiunge ospite al DB locale
- removeGuest(guestFullName): rimuove ospite dal DB locale
- syncToRemote(): salvataggio remoto su JSONbin
*/

(function (global) {
  var DB_URL = '/matrimonio-db.json';
  var LOCAL_KEY = 'matrimonio_db_local';
  var JSONBIN_URL = 'https://api.jsonbin.io/v3/b/6a200704f5f4af5e29b1d9d5';
  var JSONBIN_KEY = '6a200704f5f4af5e29b1d9d5';
  var dbCache = null;

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Impossibile caricare ' + url);
      return r.json();
    });
  }

  function normalizeDb(db) {
    if (!db) db = {};
    if (!db.tables) db.tables = {};
    if (!Array.isArray(db.tables.items)) db.tables.items = [];
    if (typeof db.tables.seatsPerTable !== 'number') db.tables.seatsPerTable = 10;
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

    return db;
  }

  function loadDB() {
    var local = loadLocalCopy();
    if (local) {
      dbCache = normalizeDb(local);
      return Promise.resolve(dbCache);
    }
    return fetchJSON(DB_URL).then(function (d) {
      dbCache = normalizeDb(d);
      return dbCache;
    });
  }

  function loadLocalCopy() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
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
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch (e) {}
    dbCache = null;
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

    if (!dbCache) dbCache = normalizeDb({ tables: { items: [], seatsPerTable: 10 }, guests: [] });
    if (!Array.isArray(dbCache.guests)) dbCache.guests = [];

    if (dbCache.guests.indexOf(guestFullName) === -1) {
      dbCache.guests.push(guestFullName);
      saveLocalCopy(dbCache);
      return true;
    }
    return false;
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

  function syncToRemote() {
    if (!dbCache) return Promise.reject(new Error('Nessun DB caricato'));

    return fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_KEY
      },
      body: JSON.stringify(dbCache)
    }).then(function (r) {
      if (!r.ok) throw new Error('Errore salvataggio JSONbin');
      return r.json();
    });
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
    normalizeDb: normalizeDb,
    _rawUrl: DB_URL
  };
})(window);
