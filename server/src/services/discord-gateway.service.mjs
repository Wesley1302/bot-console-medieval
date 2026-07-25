import WebSocket from 'ws';
import { env } from '../config/env.mjs';
import { logger } from '../utils/logger.mjs';
import { discordRequest } from './discord.service.mjs';
import { messageIndexRepository } from '../repositories/message-index.repository.mjs';
import { messageIndexService } from './message-index.service.mjs';
import { channelKind } from './channels.service.mjs';

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';
const INTENTS = 1 | 512 | 32768;

export function createDiscordGatewayService(dependencies = {}) {
  const deps = {
    WebSocket: dependencies.WebSocket || WebSocket,
    index: dependencies.index || messageIndexService,
    repository: dependencies.repository || messageIndexRepository,
    request: dependencies.request || discordRequest,
    token: dependencies.token || env.DISCORD_BOT_TOKEN,
    guildId: dependencies.guildId || env.DISCORD_GUILD_ID,
  };
  let socket = null;
  let heartbeat = null;
  let reconnect = null;
  let sequence = null;
  let stopped = true;

  function clearTimers() {
    clearInterval(heartbeat);
    clearTimeout(reconnect);
    heartbeat = null;
    reconnect = null;
  }

  async function handleDispatch(type, data) {
    if (data?.guild_id && String(data.guild_id) !== String(deps.guildId)) return;
    if (type === 'MESSAGE_CREATE') await deps.index.indexMessage(data);
    if (type === 'MESSAGE_UPDATE') {
      const full = await deps.request(`/channels/${data.channel_id}/messages/${data.id}`);
      await deps.index.indexMessage(full);
    }
    if (type === 'MESSAGE_DELETE') await deps.index.removeMessages([data.id]);
    if (type === 'MESSAGE_DELETE_BULK') await deps.index.removeMessages(data.ids || []);
    if (['CHANNEL_CREATE', 'CHANNEL_UPDATE', 'THREAD_CREATE', 'THREAD_UPDATE'].includes(type)) {
      const kind = channelKind(data.type);
      if (['category', 'text', 'announcement', 'forum', 'thread'].includes(kind)) {
        await deps.repository.upsertArea({
          id: String(data.id),
          guildId: deps.guildId,
          name: data.name || 'sem-nome',
          type: kind,
          parentId: data.parent_id || null,
          archived: Boolean(data.thread_metadata?.archived),
          accessible: true,
        });
      }
    }
    if (['CHANNEL_DELETE', 'THREAD_DELETE'].includes(type)) {
      await deps.repository.markAreaAccessible(String(data.id), false);
    }
  }

  function connect() {
    if (stopped || !deps.token || !deps.guildId) return;
    socket = new deps.WebSocket(GATEWAY_URL);
    socket.on('message', (raw) => {
      try {
        const packet = JSON.parse(String(raw));
        if (packet.s !== null && packet.s !== undefined) sequence = packet.s;
        if (packet.op === 10) {
          heartbeat = setInterval(() => {
            if (socket?.readyState === deps.WebSocket.OPEN) {
              socket.send(JSON.stringify({ op: 1, d: sequence }));
            }
          }, packet.d.heartbeat_interval);
          socket.send(JSON.stringify({
            op: 2,
            d: {
              token: deps.token,
              intents: INTENTS,
              properties: { os: process.platform, browser: 'bcm-worker', device: 'bcm-worker' },
            },
          }));
        }
        if (packet.op === 0) {
          handleDispatch(packet.t, packet.d).catch((error) => {
            logger.warn('gateway_event_failed', { event: packet.t, status: error.status || 500 });
          });
        }
        if ([7, 9].includes(packet.op)) socket?.close();
      } catch {
        logger.warn('gateway_packet_invalid');
      }
    });
    socket.on('close', () => {
      clearTimers();
      if (!stopped) reconnect = setTimeout(connect, 5_000);
    });
    socket.on('error', () => socket?.close());
  }

  function start() {
    if (!env.DISCORD_GATEWAY_ENABLED || !deps.token || !deps.guildId) return false;
    stopped = false;
    connect();
    logger.info('discord_gateway_started');
    return true;
  }

  function stop() {
    stopped = true;
    clearTimers();
    socket?.close();
    socket = null;
  }

  return { start, stop, handleDispatch };
}

export const discordGatewayService = createDiscordGatewayService();
