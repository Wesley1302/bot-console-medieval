import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiPanel } from './AiPanel.jsx';
import {
  cancelAiQuery, createAiQuery, getAiQueries, getAiQuery,
} from '../../api/ai.api.js';

vi.mock('../../api/ai.api.js', () => ({
  cancelAiQuery: vi.fn(),
  createAiQuery: vi.fn(),
  getAiQueries: vi.fn(),
  getAiQuery: vi.fn(),
}));

describe('AiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiQueries.mockResolvedValue({ queries: [] });
    cancelAiQuery.mockResolvedValue({});
    createAiQuery.mockResolvedValue({});
    getAiQuery.mockResolvedValue({});
  });

  it('mostra canais e foruns sem categoria sem selecionar o grupo virtual', async () => {
    render(<AiPanel channelTree={{
      categories: [
        {
          id: 'uncategorized',
          name: 'SEM CATEGORIA',
          type: 'category',
          virtual: true,
          channels: [
            { id: 'text-1', name: 'teste-bot', type: 'text' },
            { id: 'forum-1', name: 'docs', type: 'forum' },
          ],
        },
      ],
      activeThreads: [{ id: 'thread-1', name: 'Topico ativo', type: 'thread' }],
    }}
    />);

    expect(await screen.findByRole('checkbox', { name: /teste-bot/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /docs/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Topico ativo/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /SEM CATEGORIA/i })).not.toBeInTheDocument();
    expect(screen.getByText('SEM CATEGORIA')).toBeInTheDocument();
  });

  it('envia o modo comunicado junto das orientacoes do operador', async () => {
    const user = userEvent.setup();
    createAiQuery.mockResolvedValue({ queryId: 'query-1', status: 'queued' });
    getAiQuery.mockResolvedValue({
      query: { id: 'query-1', status: 'queued', outputMode: 'announcement' },
    });
    render(<AiPanel channelTree={{
      categories: [{
        id: 'uncategorized',
        name: 'SEM CATEGORIA',
        virtual: true,
        channels: [{ id: 'text-1', name: 'administracao', type: 'text' }],
      }],
      activeThreads: [],
    }}
    />);

    await user.click(await screen.findByRole('checkbox', { name: /administracao/i }));
    await user.click(screen.getByRole('button', { name: 'Comunicado' }));
    await user.type(
      screen.getByLabelText('Orientacoes do comunicado'),
      'Crie um aviso detalhado sobre a nova regra.',
    );
    await user.click(screen.getByRole('button', { name: /Gerar comunicado/i }));

    await waitFor(() => expect(createAiQuery).toHaveBeenCalledWith(expect.objectContaining({
      outputMode: 'announcement',
      prompt: 'Crie um aviso detalhado sobre a nova regra.',
    })));
  });
});
