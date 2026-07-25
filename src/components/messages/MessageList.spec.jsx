import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from './MessageList.jsx';

const author = { id: 'user-1', username: 'usuario', displayName: 'Usuario', serverName: 'Usuario' };

function message(id, timestamp, content, authorOverride = author) {
  return {
    id,
    timestamp,
    content,
    author: authorOverride,
    attachments: [],
    embeds: [],
    stickers: [],
  };
}

describe('MessageList', () => {
  it('mostra o estado vazio', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText('Ainda não há mensagens aqui')).toBeInTheDocument();
  });

  it('agrupa mensagens consecutivas do mesmo autor no mesmo minuto', () => {
    render(<MessageList messages={[
      message('1', '2026-07-25T12:00:01.000Z', 'primeira'),
      message('2', '2026-07-25T12:00:45.000Z', 'segunda'),
      message('3', '2026-07-25T12:01:00.000Z', 'terceira'),
    ]} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('primeira')).toBeInTheDocument();
    expect(screen.getByText('segunda')).toBeInTheDocument();
    expect(screen.getByText('terceira')).toBeInTheDocument();
  });

  it('interrupcao por outro autor inicia novo grupo', () => {
    const other = { ...author, id: 'user-2', displayName: 'Outro', serverName: 'Outro' };
    render(<MessageList messages={[
      message('1', '2026-07-25T12:00:01.000Z', 'a'),
      message('2', '2026-07-25T12:00:02.000Z', 'b', other),
      message('3', '2026-07-25T12:00:03.000Z', 'c'),
    ]} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });
});
