import { NextResponse } from 'next/server';
import { jobStatusMap } from '@/lib/jobStatus';

/*
===============================================================================
 DEMO API ROUTE (Mock)
-------------------------------------------------------------------------------
 This endpoint simulates smart contract generation for UI demos only.
 It does NOT talk to the production backend documented in docs/AI_Deployment_API.md
 and is NOT used by the main pipeline page (`app/pipeline/page.tsx`), which uses
 the centralized client in `lib/api.ts` to call the real backend.

 Keep this file for sandboxing and UI demonstrations; do not rely on it in prod.
===============================================================================
*/

// Re-export with dynamic configuration
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Generate a random job ID
    const jobId = Math.random().toString(36).substring(2, 9);
    
    // Initialize the job
    jobStatusMap.set(jobId, {
      status: 'generating',
      updatedAt: new Date().toISOString()
    });

    // Simulate AI generation with timeouts to update status
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
        job.sourceCode = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n/**\n * @title ${prompt.split(' ').slice(0, 5).join(' ')}...\n * @dev Generated based on prompt: ${prompt}\n */\n\ncontract GeneratedContract {\n    string public greeting = \"Hello, World!\";\n\n    function setGreeting(string memory _greeting) public {\n        greeting = _greeting;\n    }\n}`;
      }
    }, 4000);

    return NextResponse.json({
      jobId,
      status: 'generating',
      message: 'Contract generation started',
      checkStatusAfter: 2, // seconds
      statusUrl: `/api/job/${jobId}/status`
    });

  } catch (error) {
    console.error('Error generating contract:', error);
    return NextResponse.json(
      { error: 'Failed to generate contract' },
      { status: 500 }
    );
  }
}
