import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { LoginScreen } from './LoginScreen.jsx';

describe('LoginScreen', () => {
  it('mantem entrada desabilitada sem senha e envia com Enter', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen onLogin={onLogin} />);

    const button = screen.getByRole('button', { name: /Entrar no Conselho/i });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Senha'), 'senha-local');
    expect(button).toBeEnabled();
    await user.keyboard('{Enter}');
    expect(onLogin).toHaveBeenCalledWith('senha-local');
  });

  it('mostra erro retornado pelo login', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockRejectedValue(new Error('Senha inválida.'));
    render(<LoginScreen onLogin={onLogin} />);
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: /Entrar no Conselho/i }));
    expect(await screen.findByText('Senha inválida.')).toBeInTheDocument();
  });
});
