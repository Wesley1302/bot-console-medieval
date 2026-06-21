export function Button({ children, className = '', type = 'button', ...props }) {
  return (
    <button className={`button ${className}`.trim()} type={type} {...props}>
      {children}
    </button>
  );
}
