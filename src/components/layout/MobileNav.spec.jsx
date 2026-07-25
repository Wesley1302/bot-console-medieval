import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { MobileNav } from './MobileNav.jsx';

describe('MobileNav', () => {
  it('marca canais quando o drawer esta aberto', () => {
    render(<MobileNav activeView="console" channelsOpen onChangeView={vi.fn()} onToggleChannels={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Canais/i })).toHaveClass('is-active');
    expect(screen.getByRole('button', { name: /Console/i })).not.toHaveClass('is-active');
  });

  it('dispara a navegacao e a abertura de canais', async () => {
    const user = userEvent.setup();
    const onChangeView = vi.fn();
    const onToggleChannels = vi.fn();
    render(<MobileNav onChangeView={onChangeView} onToggleChannels={onToggleChannels} />);
    await user.click(screen.getByRole('button', { name: /Baixar/i }));
    await user.click(screen.getByRole('button', { name: /Canais/i }));
    expect(onChangeView).toHaveBeenCalledWith('downloads');
    expect(onToggleChannels).toHaveBeenCalledTimes(1);
  });

  it('abre a nova aba de IA', async () => {
    const user = userEvent.setup();
    const onChangeView = vi.fn();
    render(<MobileNav onChangeView={onChangeView} onToggleChannels={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^IA$/i }));
    expect(onChangeView).toHaveBeenCalledWith('ai');
  });
});
