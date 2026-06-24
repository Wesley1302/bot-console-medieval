export function insertAtCursor(text, insertion, selectionStart, selectionEnd = selectionStart) {
  const source = String(text || '');
  const token = String(insertion || '');
  const start = Math.min(source.length, Math.max(0, Number(selectionStart) || 0));
  const end = Math.min(source.length, Math.max(start, Number(selectionEnd) || start));
  const suffix = source.slice(end);
  const space = suffix.startsWith(' ') ? '' : ' ';

  return {
    value: `${source.slice(0, start)}${token}${space}${suffix}`,
    cursor: start + token.length + space.length,
  };
}
