import { discordRequest } from './discord.service.mjs';
import { messageIndexRepository } from '../repositories/message-index.repository.mjs';
import { messageIndexService } from './message-index.service.mjs';

export function createReconciliationService(dependencies = {}) {
  const deps = {
    repository: dependencies.repository || messageIndexRepository,
    index: dependencies.index || messageIndexService,
    request: dependencies.request || discordRequest,
  };

  async function run(limit = 100) {
    const candidates = await deps.repository.reconciliationCandidates(limit);
    const result = { checked: 0, updated: 0, removed: 0, areasChecked: 0, errors: 0 };
    for (const candidate of candidates) {
      try {
        const message = await deps.request(
          `/channels/${candidate.channelId}/messages/${candidate.discordMessageId}`,
        );
        await deps.index.indexMessage(message);
        result.updated += 1;
      } catch (error) {
        if (error.status === 404) {
          await deps.index.removeMessages([candidate.discordMessageId]);
          result.removed += 1;
        } else {
          result.errors += 1;
        }
      }
      result.checked += 1;
    }
    const areas = await deps.repository.listAreasForReconciliation(Math.min(limit, 50));
    for (const area of areas) {
      try {
        await deps.request(`/channels/${area.discordId}`);
        await deps.repository.markAreaAccessible(area.discordId, true);
      } catch (error) {
        if ([403, 404].includes(error.status)) {
          await deps.repository.markAreaAccessible(area.discordId, false);
        } else {
          result.errors += 1;
        }
      }
      result.areasChecked += 1;
    }
    return result;
  }

  return { run };
}

export const reconciliationService = createReconciliationService();
