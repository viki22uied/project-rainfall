const { doubleMetaphone } = require('double-metaphone');

// letters only, lowercased, no spaces — so "Girish Shetty" and "GirishShetty" converge
function normalizeName(raw) {
  return (raw || '').toLowerCase().replace(/[^a-z]/g, '');
}

// primary double-metaphone code of the normalized (space-free) name; the ER index
function phoneticKey(normalized) {
  return doubleMetaphone(normalized || '')[0];
}

module.exports = { normalizeName, phoneticKey };
