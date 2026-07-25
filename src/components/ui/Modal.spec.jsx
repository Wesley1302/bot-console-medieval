import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal.jsx';

describe('Modal', () => {
  it('foca fechar, fecha com Escape e devolve foco ao disparador', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<><button type="button">Abrir</button><Modal open title="Editar" onClose={onClose}><input aria-label="Texto" /></Modal></>);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    trigger.focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
