import React from 'react';

/**
 * Espaco reservado durante o carregamento.
 *
 * Usa os tokens de superficie para acompanhar o tema - com bg-slate-200 fixo,
 * o esqueleto acendia em branco no tema escuro.
 */

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-6 w-full', count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        role="presentation"
        className={`animate-pulse bg-superficie-sutil rounded-lg ${className}`}
      />
    ))}
  </>
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-superficie-alta p-5 rounded-xl border border-borda shadow-card animate-pulse space-y-4">
    <div className="flex justify-between items-center">
      <div className="h-4 bg-superficie-sutil rounded w-1/3" />
      <div className="h-8 w-8 bg-superficie-sutil rounded-full" />
    </div>
    <div className="h-8 bg-superficie-sutil rounded w-1/2" />
    <div className="h-3 bg-superficie-sutil rounded w-2/3" />
  </div>
);
