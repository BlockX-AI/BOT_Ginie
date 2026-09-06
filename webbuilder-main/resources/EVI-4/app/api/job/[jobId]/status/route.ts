import { NextResponse } from 'next/server';
import { jobStatusMap } from '@/lib/jobStatus';

/*
===============================================================================
 DEMO API ROUTE (Mock)
-------------------------------------------------------------------------------
 This mocked status endpoint is for local UI demos only and returns a simplified
 shape different from the production backend documented in docs/AI_Deployment_API.md.
 The main pipeline UI uses the centralized client in lib/api.ts to talk to the
 real backend; do not rely on this mock in production code.
===============================================================================
*/

// Re-export with dynamic configuration
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // If the job doesn't exist in our map, create a new one
    if (!jobStatusMap.has(jobId)) {
      jobStatusMap.set(jobId, {
        status: 'generating',
        updatedAt: new Date().toISOString()
      });

      // Simulate status progression
      setTimeout(() => {
        const job = jobStatusMap.get(jobId);
        if (job) {
          job.status = 'compiling';
          job.updatedAt = new Date().toISOString();
        }
      }, 2000);

      setTimeout(() => {
        const job = jobStatusMap.get(jobId);
        if (job) {
          job.status = 'ready';
          job.updatedAt = new Date().toISOString();
          job.sourceCode = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract GeneratedContract {\n    string public greeting = \"Hello, World!\";\n\n    function setGreeting(string memory _greeting) public {\n        greeting = _greeting;\n    }\n}`;
        }
      }, 4000);
    }
    
    const job = jobStatusMap.get(jobId);
    
    return NextResponse.json({
      jobId,
      status: job?.status || 'failed',
      updatedAt: job?.updatedAt || new Date().toISOString(),
      sourceCode: job?.sourceCode
    });

  } catch (error) {
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: 'Failed to check job status' },
      { status: 500 }
    );
  }
}
