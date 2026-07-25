function camelKey(key) {
  return key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

export function camelRow(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelKey(key), value]));
}

export function camelRows(rows = []) {
  return rows.map(camelRow);
}
