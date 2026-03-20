import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
