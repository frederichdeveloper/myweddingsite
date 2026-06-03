/*
Funzioni:
- loadDB(): fetch('/matrimonio-db.json') → ritorna oggetto DB
- getTable(id): restituisce tavolo per id
- findTableByName(q): cerca per nome
- saveLocalCopy(db): salva una copia locale in localStorage (opzionale)
- loadLocalCopy(): legge localStorage se presente (utile per testing)
- assignGuestToTable(guestFullName, tableId): assegna (solo localmente)
- unassignGuestFromTable(guestFullName): rimuove assegnamento (solo localmente)
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

  function loadDB() {
    var local = loadLocalCopy();
    if (local) {
      dbCache = local;
      return Promise.resolve(dbCache);
    }
    return fetchJSON(DB_URL).then(function (d) {
      dbCache = d;
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
      localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
      dbCache = db;
      return true;
    } catch (e) {
      console.warn('Impossibile salvare localmente', e);
      return false;
    }
  }

  function clearLocalCopy() {
    localStorage.removeItem(LOCAL_KEY);
    dbCache = null;
  }

  function getTable(id) {
    if (!dbCache || !dbCache.tables || !dbCache.tables.items) return null;
    return dbCache.tables.items.find(function (t) { return t.id === Number(id); }) || null;
  }

  function findTableByName(q) {
    if (!dbCache || !dbCache.tables || !dbCache.tables.items) return null;
    q = String(q).trim().toLowerCase();
    return dbCache.tables.items.find(function (t) {
      return t.name.toLowerCase().indexOf(q) !== -1;
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
    var t = getTable(tableId);
    if (!t) return false;
    if (!t.guests) t.guests = [];
    if (t.guests.indexOf(guestFullName) !== -1) return false;
    if (t.guests.length >= (dbCache.tables.seatsPerTable || 10)) return false;
    t.guests.push(guestFullName);
    if (!dbCache.guests) dbCache.guests = [];
    if (dbCache.guests.indexOf(guestFullName) === -1) dbCache.guests.push(guestFullName);
    saveLocalCopy(dbCache);
    return true;
  }

  function unassignGuestFromTable(guestFullName) {
    if (!dbCache) return false;
    var removed = false;
    dbCache.tables.items.forEach(function (t) {
      var idx = t.guests ? t.guests.indexOf(guestFullName) : -1;
      if (idx !== -1) {
        t.guests.splice(idx, 1);
        removed = true;
      }
    });
    if (removed) saveLocalCopy(dbCache);
    return removed;
  }

  function addGuest(guestFullName) {
    if (!dbCache) dbCache = { guests: [] };
    if (!dbCache.guests) dbCache.guests = [];
    if (dbCache.guests.indexOf(guestFullName) === -1) {
      dbCache.guests.push(guestFullName);
      saveLocalCopy(dbCache);
      return true;
    }
    return false;
  }

  function removeGuest(guestFullName) {
    if (!dbCache || !dbCache.guests) return false;
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
    _rawUrl: DB_URL
  };

})(window);
