export function sanitizeFilename(value = 'file') {
  return String(value)
    .normalize('NFKD')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 100)
    .replace(/^-|-$/g, '') || 'file';
}
