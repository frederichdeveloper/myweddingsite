/*
Funzioni:
- loadDB(): fetch('/matrimonio-db.json') → ritorna oggetto DB
- getTable(id): restituisce tavolo per id
- findTableByName(q): cerca per nome
- saveLocalCopy(db): salva una copia locale in localStorage (opzionale)
- loadLocalCopy(): legge localStorage se presente (utile per testing)
- assignGuestToTable(guestFullName, tableId): assegna (solo localmente)
- unassignGuestFromTable(guestFullName): rimuove assegnamento (solo localmente)
- syncToRemote(): placeholder per implementare salvataggio remoto (JSONbin/Firebase)
*/

(function (global) {
var DB_URL = '/matrimonio-db.json';
var LOCAL_KEY = 'matrimonio_db_local';
var dbCache = null;

function fetchJSON(url) {
return fetch(url, { cache: 'no-store' }).then(function (r) {
if (!r.ok) throw new Error('Impossibile caricare ' + url);
return r.json();
});
}

function loadDB() {
// Prima prova a caricare la copia locale (modifiche non condivise)
var local = loadLocalCopy();
if (local) {
dbCache = local;
return Promise.resolve(dbCache);
}
// Altrimenti fetch dal file JSON pubblico
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
if (!dbCache) return null;
return dbCache.tables.items.find(function (t) { return t.id === Number(id); }) || null;
}

function findTableByName(q) {
if (!dbCache) return null;
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
if (t.guests.indexOf(guestFullName) !== -1) return false; // già presente
if (t.guests.length >= (dbCache.tables.seatsPerTable || 10)) return false; // pieno
t.guests.push(guestFullName);
// mantiene anche lista globale ospiti se non presente
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
// non rimuovo dalla lista globale, lasciamo traccia
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
// rimuovi da eventuali tavoli
unassignGuestFromTable(guestFullName);
saveLocalCopy(dbCache);
return true;
}

// Placeholder per sincronizzazione remota (da implementare con API reali)
function syncToRemote() {
// Esempio: chiamare JSONbin / Firebase / Google Apps Script
return Promise.reject(new Error('syncToRemote non implementato. Usa JSONbin/Firebase/Sheets per salvare.'));
}

// Espongo l'API globale
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
