'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rocket, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type DeployStatus = 'idle' | 'deploying' | 'deployed' | 'error';

type DeployButtonProps = {
  jobId: string;
  network?: string;
  disabled?: boolean;
  className?: string;
  onDeploy?: (result: any) => void;
  onError?: (error: Error) => void;
};

export function DeployButton({
  jobId,
  network = 'avalanche-fuji',
  disabled = false,
  className,
  onDeploy,
  onError,
}: DeployButtonProps) {
  const [status, setStatus] = useState<DeployStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const handleDeploy = async () => {
    try {
      setStatus('deploying');
      setError(null);

      const response = await fetch('/api/deploy-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, network }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deploy contract');
      }

      const data = await response.json();
      setStatus('deployed');
      setDeployedAddress(data.contractAddress);

      if (onDeploy) {
        onDeploy(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setStatus('error');
      setError(errorMessage);

      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    }
  };

  const getButtonState = () => {
    switch (status) {
      case 'deploying':
        return {
          variant: 'default' as const,
          children: 'Deploying...',
          icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
          disabled: true,
        };
      case 'deployed':
        return {
          variant: 'outline' as const,
          children: 'Deployed',
          icon: <CheckCircle className="mr-2 h-4 w-4 text-green-500" />,
          disabled: true,
        };
      case 'error':
        return {
          variant: 'destructive' as const,
          children: 'Error',
          icon: <AlertCircle className="mr-2 h-4 w-4" />,
          disabled: false,
        };
      default:
        return {
          variant: 'default' as const,
          children: 'Deploy Contract',
          icon: <Rocket className="mr-2 h-4 w-4" />,
          disabled: disabled || status !== 'idle',
        };
    }
  };

  const buttonState = getButtonState();

  return (
    <div className={className}>
      <Button
        onClick={handleDeploy}
        variant={buttonState.variant}
        disabled={buttonState.disabled}
        className="w-full sm:w-auto"
      >
        {buttonState.icon}
        {buttonState.children}
      </Button>

      {deployedAddress && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-900">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Contract deployed successfully!
          </p>
          <div className="mt-1 text-xs text-green-700 dark:text-green-300 break-all">
            Address: {deployedAddress}
          </div>
          <div className="mt-2">
            <a
              href={`https://testnet.snowtrace.io/address/${deployedAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 dark:text-green-400 hover:underline inline-flex items-center"
            >
              View on Blockscout →
            </a>
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-2 text-sm text-destructive">
          <p>{error}</p>
          <button
            onClick={handleDeploy}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
