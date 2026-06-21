function line(level, message, meta) {
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${suffix}`;
}

export const logger = {
  info(message, meta) {
    console.log(line('info', message, meta));
  },
  warn(message, meta) {
    console.warn(line('warn', message, meta));
  },
  error(message, meta) {
    console.error(line('error', message, meta));
  },
};
