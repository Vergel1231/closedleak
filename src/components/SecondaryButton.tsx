import { Link } from 'react-router-dom';

interface SecondaryButtonProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export function SecondaryButton({ to, children, className = '' }: SecondaryButtonProps) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center rounded-xl border border-ink-600 px-6 py-3 text-base font-semibold text-ink-100 hover:bg-ink-800 hover:border-primary-400 hover:text-primary-400 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-ink-900 ${className}`}
    >
      {children}
    </Link>
  );
}
