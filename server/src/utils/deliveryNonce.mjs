import { createHash } from 'node:crypto';

export function deliveryNonce(automationId, messageId, chunkIndex = 0) {
  const source = [String(automationId), String(messageId), String(chunkIndex)].join(':');
  return createHash('sha256').update(source).digest('hex').slice(0, 24);
}
