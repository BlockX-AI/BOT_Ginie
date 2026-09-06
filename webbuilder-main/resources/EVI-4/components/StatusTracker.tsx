'use client';

import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'generating' | 'compiling' | 'ready' | 'deploying' | 'deployed' | 'failed';

const statusSteps = [
  { id: 'generating', label: 'Generating' },
  { id: 'compiling', label: 'Compiling' },
  { id: 'ready', label: 'Ready' },
  { id: 'deploying', label: 'Deploying' },
  { id: 'deployed', label: 'Deployed' },
];

type StatusTrackerProps = {
  status: Status;
  error?: string | null;
  className?: string;
};

export function StatusTracker({ status, error, className }: StatusTrackerProps) {
  const currentStepIndex = Math.max(0, 
    statusSteps.findIndex(step => step.id === status) || 0
  );

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      <div className="flex justify-between mb-2">
        {statusSteps.map((step, index) => {
          const isCompleted = index < currentStepIndex || status === 'deployed';
          const isCurrent = status === step.id || (status === 'deployed' && index === statusSteps.length - 1);
          const isFailed = status === 'failed' && index === currentStepIndex;

          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div className="relative">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                    isFailed && 'bg-destructive text-destructive-foreground'
                  )}
                >
                  {isFailed ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                {index < statusSteps.length - 1 && (
                  <div 
                    className={cn(
                      'absolute top-4 -right-1/2 w-full h-0.5',
                      isCompleted ? 'bg-green-500' : 'bg-muted'
                    )}
                  />
                )}
              </div>
              <span className={cn(
                'text-xs mt-2 text-center',
                (isCurrent || isCompleted) ? 'font-medium' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
