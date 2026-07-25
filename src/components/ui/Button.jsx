import { forwardRef } from 'react';

export const Button = forwardRef(function Button({ children, className = '', type = 'button', ...props }, ref) {
  return (
    <button ref={ref} className={`button ${className}`.trim()} type={type} {...props}>
      {children}
    </button>
  );
});
