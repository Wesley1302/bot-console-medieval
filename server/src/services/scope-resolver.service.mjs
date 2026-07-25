import { env } from '../config/env.mjs';
import {
  listActiveThreads,
  listForumThreads,
  listGuildChannels,
  normalizeChannel,
} from './channels.service.mjs';

const selectableTypes = new Set(['category', 'text', 'announcement', 'forum', 'thread']);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizedTarget(target, areas) {
  const id = String(target?.id || '').trim();
  if (!id) throw httpError('Cada alvo precisa de um ID.');
  const area = areas.get(id);
  const type = target?.type || area?.type;
  if (!selectableTypes.has(type)) throw httpError('Tipo de alvo invalido.');
  return area || { id, name: String(target?.name || id), type, parentId: null };
}

export function createScopeResolver(dependencies = {}) {
  const deps = {
    listGuildChannels: dependencies.listGuildChannels || listGuildChannels,
    listActiveThreads: dependencies.listActiveThreads || listActiveThreads,
    listThreads: dependencies.listThreads || listForumThreads,
    guildId: dependencies.guildId || env.DISCORD_GUILD_ID,
  };

  async function resolve(selectedTargets) {
    if (!Array.isArray(selectedTargets) || selectedTargets.length < 1) {
      throw httpError('Selecione ao menos um local do servidor.');
    }

    const [rawChannels, rawActiveThreads] = await Promise.all([
      deps.listGuildChannels(),
      deps.listActiveThreads(),
    ]);
    const channels = rawChannels.map((channel) => normalizeChannel(channel));
    const activeThreads = rawActiveThreads.map((thread) => normalizeChannel(thread));
    const areas = new Map([...channels, ...activeThreads].map((area) => [area.id, area]));
    const selected = selectedTargets.map((target) => normalizedTarget(target, areas));
    const resolvedChannels = new Map();
    const resolvedThreads = new Map();
    const inaccessibleTargets = [];
    const warnings = [];

    async function addThreads(parent) {
      try {
        const payload = await deps.listThreads(parent.id);
        for (const thread of payload.threads || []) resolvedThreads.set(thread.id, thread);
        warnings.push(...(payload.warnings || []).map((warning) => `${parent.name}: ${warning}`));
      } catch (error) {
        inaccessibleTargets.push({ id: parent.id, name: parent.name, type: parent.type, reason: error.message });
      }
    }

    for (const target of selected) {
      if (target.type === 'thread') {
        resolvedThreads.set(target.id, target);
        continue;
      }
      if (['text', 'announcement'].includes(target.type)) {
        resolvedChannels.set(target.id, target);
        await addThreads(target);
        continue;
      }
      if (target.type === 'forum') {
        await addThreads(target);
        continue;
      }

      const children = channels.filter((area) => area.parentId === target.id);
      for (const child of children) {
        if (['text', 'announcement'].includes(child.type)) {
          resolvedChannels.set(child.id, child);
          await addThreads(child);
        } else if (child.type === 'forum') {
          await addThreads(child);
        }
      }
    }

    for (const thread of activeThreads) {
      if (resolvedChannels.has(thread.parentId)) resolvedThreads.set(thread.id, thread);
    }

    return {
      guildId: deps.guildId,
      selectedTargets: selected,
      resolvedChannels: [...resolvedChannels.values()],
      resolvedThreads: [...resolvedThreads.values()],
      inaccessibleTargets,
      warnings: [...new Set(warnings)],
    };
  }

  return { resolve };
}

export const scopeResolverService = createScopeResolver();
