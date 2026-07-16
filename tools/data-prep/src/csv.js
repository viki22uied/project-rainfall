const fs = require('node:fs');

// ponytail: naive CSV, verified comma-free source fields. Swap to csv-parse if fields gain commas/quotes.
function readCsv(path) {
  const text = fs.readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
  return { header, rows };
}

function writeCsv(path, header, rows) {
  const out = [header.join(',')];
  for (const r of rows) out.push(header.map(h => r[h] ?? '').join(','));
  fs.writeFileSync(path, out.join('\n') + '\n', 'utf8');
}

module.exports = { readCsv, writeCsv };
