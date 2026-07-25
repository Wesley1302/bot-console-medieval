import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuildDirectory } from '../../server/src/services/guild-directory.service.mjs';

test('membros inline nao geram fetch individual', async () => {
  let calls = 0;
  const directory = createGuildDirectory({ guildId: 'guild', discordRequest: async () => { calls += 1; return { nick: 'remoto' }; } });
  const profiles = await directory.getMembers(['1', '2'], new Map([['1', { nick: 'Servidor 1', avatar: null }], ['2', { nick: null, avatar: null }]]));
  assert.equal(calls, 0);
  assert.equal(profiles.get('1').nick, 'Servidor 1');
});

test('requests simultaneas do mesmo membro compartilham Promise', async () => {
  let calls = 0;
  let release;
  const directory = createGuildDirectory({ guildId: 'guild', discordRequest: async () => { calls += 1; await new Promise((resolve) => { release = resolve; }); return { nick: 'Membro' }; } });
  const first = directory.getMember('1');
  const second = directory.getMember('1');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await Promise.all([first, second]), [{ nick: 'Membro', avatar: null }, { nick: 'Membro', avatar: null }]);
});

test('limita membros remotos a cinco requests simultaneas', async () => {
  let active = 0;
  let peak = 0;
  const directory = createGuildDirectory({ guildId: 'guild', discordRequest: async () => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 4)); active -= 1; return { nick: 'Membro' }; } });
  await directory.getMembers(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.equal(peak, 5);
});

test('roles usam cache compartilhado e invalidate força nova leitura', async () => {
  let calls = 0;
  const directory = createGuildDirectory({ guildId: 'guild', discordRequest: async (request) => { if (request.endsWith('/roles')) calls += 1; return [{ id: 'role', name: 'Cargo' }]; } });
  await Promise.all([directory.getRoles(), directory.getRoles()]);
  assert.equal(calls, 1);
  directory.invalidate();
  await directory.getRoles();
  assert.equal(calls, 2);
});
