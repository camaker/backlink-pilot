function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function parseCsv(text) {
  const rows = [];
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < String(text || '').length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += char + next;
      i++;
      continue;
    }

    if (char === '"') inQuotes = !inQuotes;

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      if (current.trim() !== '') lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim() !== '') lines.push(current);
  if (!lines.length) return rows;

  const headers = parseCsvLine(lines[0]).map(header => header.trim());
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }

  return rows;
}
