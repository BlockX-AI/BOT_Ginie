import { NextResponse } from 'next/server';
import { jobStatusMap } from '@/lib/jobStatus';

/*
===============================================================================
 DEMO API ROUTE (Mock)
-------------------------------------------------------------------------------
 This endpoint simulates deployment behavior for UI demos only.
 It is separate from the production backend documented in docs/AI_Deployment_API.md
 and is NOT used by the main pipeline page (`app/pipeline/page.tsx`), which calls
 the real backend via the centralized client in `lib/api.ts`.

 Keep this file for sandboxing and UI demonstrations; do not rely on it in prod.
===============================================================================
*/

// Re-export with dynamic configuration
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { sourceCode, jobId, network } = await request.json();

    // In a real implementation, you would:
    // 1. Compile the Solidity code
    // 2. Deploy to a blockchain network (e.g., Ethereum, Polygon, etc.)
    // 3. Return the transaction hash and contract address

    // For demo purposes, we'll simulate deployment
    const transactionHash = '0x' + Math.random().toString(16).substring(2, 66);
    const contractAddress = '0x' + Math.random().toString(16).substring(2, 42);

    // Update job status if jobId is provided
    if (jobId) {
      const job = jobStatusMap.get(jobId);
      if (job) {
        job.status = 'deploying';
        job.updatedAt = new Date().toISOString();

        // Simulate deployment completion
        setTimeout(() => {
          const job = jobStatusMap.get(jobId);
          if (job) {
            job.status = 'deployed';
            job.contractAddress = contractAddress;
            job.updatedAt = new Date().toISOString();
          }
        }, 3000);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Contract deployment started',
      transactionHash,
      contractAddress,
      explorerUrl: `https://basecamp.cloud.blockscout.com/address/${contractAddress}`,
      status: 'deploying',
      checkStatusAfter: 3 // seconds
    });

  } catch (error) {
    console.error('Error deploying contract:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to deploy contract',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
