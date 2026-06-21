export function Sidebar({ children, open = false }) {
  return (
    <aside className={open ? 'sidebar is-open' : 'sidebar'} aria-label="Navegacao principal">
      <div className="sidebar__brand">
        <strong>BCM</strong>
        <span>Servidor Discord</span>
      </div>
      {children}
    </aside>
  );
}
