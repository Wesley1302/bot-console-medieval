export function Toast({ children, tone = 'default' }) {
  return <div className={`toast toast--${tone}`} role="status">{children}</div>;
}
