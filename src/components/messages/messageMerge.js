function byTimestamp(a, b) {
  return new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
}

export function mergeLatestMessages(current, latest) {
  const incoming = new Map((latest || []).map((message) => [message.id, message]));
  const currentIds = new Set((current || []).map((message) => message.id));
  const older = (current || []).filter((message) => !incoming.has(message.id));
  const fresh = [...incoming.values()];
  if (!fresh.length) return [];
  const oldestFresh = Math.min(...fresh.map((message) => new Date(message.timestamp || 0).getTime()));
  return [...older.filter((message) => currentIds.has(message.id) && new Date(message.timestamp || 0).getTime() < oldestFresh), ...fresh].sort(byTimestamp);
}

export function prependOlderMessages(current, older) {
  const existing = new Set((current || []).map((message) => message.id));
  return [...(older || []).filter((message) => !existing.has(message.id)), ...(current || [])].sort(byTimestamp);
}
