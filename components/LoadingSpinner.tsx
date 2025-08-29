import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className }) => {
  if (className) {
    return <Loader2 className={cn("animate-spin", className)} aria-label="Loading" />;
  }
  
  return (
    <div className="flex justify-center items-center py-4">
      <Loader2 className="w-6 h-6 animate-spin text-blue-accent" aria-label="Loading" />
    </div>
  );
};

export default LoadingSpinner;
