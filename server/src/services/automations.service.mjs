import fs from 'node:fs/promises';
import path from 'node:path';
import { messagesService as productionMessagesService } from './messages.service.mjs';
import { createId as productionCreateId } from '../utils/ids.mjs';
import { logger as productionLogger } from '../utils/logger.mjs';

const validActions = new Set(['pause', 'resume', 'cancel']);
const statusOrder = new Map([['running', 0], ['paused', 1], ['error', 2], ['done', 3], ['cancelled', 4]]);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateAutomationId(automationId) {
  const id = String(automationId || '');
  if (!id.startsWith('automation_') || id.includes('/') || id.includes('\\')) throw httpError('Automacao invalida.', 400);
  return id;
}

function createServiceDependencies(dependencies = {}) {
  return {
    fs: dependencies.fs || fs,
    root: dependencies.root || path.join(process.cwd(), 'server', 'automations'),
    messages: dependencies.messages || productionMessagesService,
    createId: dependencies.createId || productionCreateId,
    now: dependencies.now || (() => new Date()),
    setTimer: dependencies.setTimer || setTimeout,
    clearTimer: dependencies.clearTimer || clearTimeout,
    logger: dependencies.logger || productionLogger,
  };
}

function iso(now) { return new Date(now()).toISOString(); }

function normalizeScheduleAt(value, now) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) throw httpError('Data e hora do agendamento sao obrigatorias.', 400);
  if (date.getTime() <= now().getTime()) throw httpError('Agendamento precisa estar no futuro.', 400);
  return date.toISOString();
}

function stableDeliveryKey(automationId, messageId) {
  return `${automationId}:${messageId}`;
}

export function validateAutomationInput(input, options = {}) {
  const now = options.now || (() => new Date());
  if (!input || typeof input !== 'object') throw httpError('Payload obrigatorio.', 400);
  const channelId = String(input.channelId || '').trim();
  if (!channelId) throw httpError('Canal obrigatorio.', 400);
  const mode = input.mode === 'scheduled' ? 'scheduled' : 'sequence';
  if (!Array.isArray(input.messages)) throw httpError('Mensagens devem ser uma lista.', 400);
  if (input.messages.length < 1) throw httpError('Informe ao menos uma mensagem.', 400);
  if (mode === 'scheduled' && input.messages.length !== 1) throw httpError('Agendamento aceita uma mensagem por vez.', 400);
  if (input.messages.length > 100) throw httpError('Informe no maximo 100 mensagens.', 400);
  const interval = Number(input.intervalSeconds);
  const intervalSeconds = mode === 'scheduled' ? 0 : Math.trunc(interval);
  if (mode !== 'scheduled') {
    if (!Number.isFinite(interval)) throw httpError('Intervalo obrigatorio.', 400);
    if (intervalSeconds < 1) throw httpError('Intervalo minimo e 1 segundo.', 400);
    if (intervalSeconds > 86400) throw httpError('Intervalo maximo e 86400 segundos.', 400);
  }
  return {
    mode,
    channelId,
    channelName: input.channelName ? String(input.channelName).trim() || null : null,
    intervalSeconds,
    scheduledAt: mode === 'scheduled' ? normalizeScheduleAt(input.scheduledAt, now) : null,
    messages: input.messages.map((message, index) => {
      if (typeof message !== 'string') throw httpError(`Mensagem ${index + 1} precisa ser texto.`, 400);
      if (!message.trim()) throw httpError(`Mensagem ${index + 1} esta vazia.`, 400);
      return { id: `message_${index + 1}`, position: index, content: message.trim(), status: 'queued', discordMessageId: null, discordMessageIds: [], sentAt: null, error: null };
    }),
  };
}

export function createAutomationsService(dependencies = {}) {
  const deps = createServiceDependencies(dependencies);
  const automations = new Map();
  const timers = new Map();
  const inFlight = new Set();

  const filePath = (id) => {
    const safeId = validateAutomationId(id);
    const resolved = path.resolve(deps.root, `${safeId}.json`);
    if (!resolved.startsWith(`${path.resolve(deps.root)}${path.sep}`)) throw httpError('Automacao invalida.', 400);
    return resolved;
  };

  const currentMessage = (automation) => automation.messages[automation.currentIndex] || null;
  const complete = (automation) => {
    if (automation.currentIndex >= automation.messages.length || automation.messages.every((message) => message.status === 'sent')) {
      if (!['paused', 'cancelled'].includes(automation.status)) automation.status = 'done';
      automation.currentIndex = automation.messages.length;
      automation.nextRunAt = null;
      automation.completedAt ||= iso(deps.now);
      return true;
    }
    return false;
  };

  function normalizeLoaded(raw) {
    const automation = { ...raw, mode: raw.mode === 'scheduled' ? 'scheduled' : 'sequence' };
    automation.messages = (raw.messages || []).map((message, index) => ({
      id: message.id || `message_${index + 1}`,
      position: message.position ?? index,
      content: String(message.content || ''),
      status: message.status === 'sending' ? 'queued' : (message.status || 'queued'),
      deliveryKey: message.deliveryKey || stableDeliveryKey(automation.id, message.id || `message_${index + 1}`),
      discordMessageId: message.discordMessageId || null,
      discordMessageIds: Array.isArray(message.discordMessageIds) ? message.discordMessageIds : (message.discordMessageId ? [message.discordMessageId] : []),
      sentAt: message.sentAt || null,
      error: message.error || null,
    }));
    automation.currentIndex = Math.max(0, Number(automation.currentIndex) || 0);
    return automation;
  }

  async function saveAutomation(automation) {
    await deps.fs.mkdir(deps.root, { recursive: true });
    const target = filePath(automation.id);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await deps.fs.writeFile(temp, JSON.stringify(automation, null, 2));
    await deps.fs.rename(temp, target);
    return automation;
  }

  async function loadAutomationFile(file) { return normalizeLoaded(JSON.parse(await deps.fs.readFile(file, 'utf8'))); }

  async function loadAutomations() {
    await deps.fs.mkdir(deps.root, { recursive: true });
    const entries = await deps.fs.readdir(deps.root, { withFileTypes: true });
    automations.clear();
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const automation = await loadAutomationFile(path.join(deps.root, entry.name));
        automations.set(automation.id, automation);
      } catch (error) { deps.logger.warn('Ignorando arquivo de automacao invalido.', { file: entry.name, reason: error.message }); }
    }
    return [...automations.values()];
  }

  function cancelAutomationTimer(id) {
    const timer = timers.get(String(id));
    if (timer) deps.clearTimer(timer);
    timers.delete(String(id));
  }

  function scheduleAutomation(automation) {
    cancelAutomationTimer(automation.id);
    if (automation.status !== 'running') return;
    if (complete(automation)) { saveAutomation(automation).catch((error) => deps.logger.warn('Falha ao salvar automacao concluida.', { reason: error.message })); return; }
    const delay = Math.max(0, new Date(automation.nextRunAt || deps.now()).getTime() - deps.now().getTime());
    const timer = deps.setTimer(() => { timers.delete(automation.id); runAutomationTick(automation.id).catch((error) => deps.logger.error('Erro inesperado em tick de automacao.', { id: automation.id, reason: error.message })); }, delay);
    timers.set(automation.id, timer);
  }

  async function initAutomations() {
    const loaded = await loadAutomations();
    for (const automation of loaded) {
      if (automation.status === 'running') { await saveAutomation(automation); scheduleAutomation(automation); }
    }
    deps.logger.info(`Automacoes carregadas: ${loaded.length}`);
    return loaded;
  }

  function getAutomation(id) {
    const safeId = validateAutomationId(id);
    const automation = automations.get(safeId);
    if (!automation) throw httpError('Automacao nao encontrada.', 404);
    return automation;
  }

  function getAutomationSummary(automation) {
    const messages = automation.messages || [];
    return { ...automation, totalMessages: messages.length, totalCharacters: messages.reduce((total, message) => total + message.content.length, 0), sentCount: messages.filter((message) => message.status === 'sent').length, errorCount: messages.filter((message) => message.status === 'error').length, queuedCount: messages.filter((message) => ['queued', 'sending'].includes(message.status)).length, preview: messages.slice(0, 3).map((message) => message.content.length > 120 ? `${message.content.slice(0, 117)}...` : message.content) };
  }

  function listAutomations() { return [...automations.values()].map(getAutomationSummary).sort((a, b) => (statusOrder.get(a.status) ?? 9) - (statusOrder.get(b.status) ?? 9) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); }

  async function createAutomation(input) {
    const valid = validateAutomationInput(input, { now: deps.now });
    const channelInfo = await deps.messages.assertMessageableChannel(valid.channelId);
    const timestamp = iso(deps.now);
    const automation = { id: deps.createId('automation'), mode: valid.mode, channelId: valid.channelId, channelName: valid.channelName || channelInfo.name || null, status: 'running', intervalSeconds: valid.intervalSeconds, scheduledAt: valid.scheduledAt, currentIndex: 0, messages: valid.messages.map((message) => ({ ...message, id: deps.createId('message'), deliveryKey: null })), createdAt: timestamp, startedAt: valid.mode === 'scheduled' ? null : timestamp, nextRunAt: valid.mode === 'scheduled' ? valid.scheduledAt : timestamp, completedAt: null, lastError: null };
    automation.messages.forEach((message) => { message.deliveryKey = stableDeliveryKey(automation.id, message.id); });
    automations.set(automation.id, automation);
    await saveAutomation(automation);
    scheduleAutomation(automation);
    return automation;
  }

  async function runAutomationTick(id) {
    const automation = automations.get(String(id));
    if (!automation || automation.status !== 'running' || inFlight.has(automation.id)) return;
    inFlight.add(automation.id);
    try {
      const message = currentMessage(automation);
      if (!message) { complete(automation); cancelAutomationTimer(automation.id); await saveAutomation(automation); return; }
      message.status = 'sending'; message.error = null; await saveAutomation(automation);
      try {
        const result = await deps.messages.sendMessage({ channelId: automation.channelId, content: message.content, files: [], allowedMentions: { parse: ['users', 'roles', 'everyone'] }, deliveryKey: message.deliveryKey });
        const ids = (result.messages || [result.message]).filter(Boolean).map((item) => item.id).filter(Boolean);
        message.discordMessageIds = [...new Set([...(message.discordMessageIds || []), ...ids])];
        message.discordMessageId = message.discordMessageIds.at(-1) || null;
        message.status = 'sent'; message.sentAt = iso(deps.now); message.error = null;
        automation.startedAt ||= message.sentAt; automation.currentIndex += 1; automation.lastError = null;
        if (complete(automation)) { cancelAutomationTimer(automation.id); await saveAutomation(automation); return; }
        if (automation.status === 'running') { automation.nextRunAt = new Date(deps.now().getTime() + automation.intervalSeconds * 1000).toISOString(); await saveAutomation(automation); scheduleAutomation(automation); }
        else { automation.nextRunAt = null; await saveAutomation(automation); }
      } catch (error) {
        message.status = 'error'; message.error = error.message || 'Falha ao enviar mensagem.'; automation.lastError = message.error; automation.nextRunAt = null;
        if (automation.status === 'running') automation.status = 'error';
        else message.status = 'error';
        cancelAutomationTimer(automation.id); await saveAutomation(automation);
      }
    } finally { inFlight.delete(automation.id); }
  }

  async function updateAutomationAction(id, actionInput) {
    const action = String(actionInput || '');
    if (!validActions.has(action)) throw httpError('Acao invalida. Use pause, resume ou cancel.', 400);
    const automation = getAutomation(id);
    if (action === 'pause') {
      if (automation.status !== 'running') throw httpError('Apenas automacoes em execucao podem ser pausadas.', 400);
      automation.status = 'paused'; automation.nextRunAt = null; cancelAutomationTimer(automation.id); await saveAutomation(automation); return automation;
    }
    if (action === 'resume') {
      if (!['paused', 'error'].includes(automation.status)) throw httpError('Apenas automacoes pausadas ou com erro podem ser retomadas.', 400);
      if (complete(automation)) { await saveAutomation(automation); return automation; }
      const message = currentMessage(automation); if (message?.status === 'error') { message.status = 'queued'; message.error = null; }
      automation.status = 'running'; automation.lastError = null; automation.nextRunAt = automation.mode === 'scheduled' && automation.scheduledAt && new Date(automation.scheduledAt) > deps.now() ? automation.scheduledAt : iso(deps.now()); automation.completedAt = null;
      await saveAutomation(automation); scheduleAutomation(automation); return automation;
    }
    if (['done', 'cancelled'].includes(automation.status)) throw httpError('Automacao ja esta finalizada.', 400);
    automation.status = 'cancelled'; automation.completedAt = iso(deps.now); automation.nextRunAt = null; cancelAutomationTimer(automation.id); await saveAutomation(automation); return automation;
  }

  async function deleteAutomation(id) { const automation = getAutomation(id); cancelAutomationTimer(automation.id); automations.delete(automation.id); await deps.fs.rm(filePath(automation.id), { force: true }); return { ok: true, deleted: { automationId: automation.id } }; }

  return { initAutomations, listAutomations, getAutomation, createAutomation, updateAutomationAction, deleteAutomation, saveAutomation, loadAutomationFile, loadAutomations, scheduleAutomation, cancelAutomationTimer, runAutomationTick, getAutomationSummary, validateAutomationInput, ensureAutomationCanBeDeleted: () => true, _state: { automations, timers, inFlight } };
}

export const automationsService = createAutomationsService();
export const { initAutomations, listAutomations, getAutomation, createAutomation, updateAutomationAction, deleteAutomation, saveAutomation, loadAutomationFile, loadAutomations, scheduleAutomation, cancelAutomationTimer, runAutomationTick, getAutomationSummary, ensureAutomationCanBeDeleted } = automationsService;
