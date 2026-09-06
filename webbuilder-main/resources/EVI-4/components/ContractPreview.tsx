'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Simple syntax highlighter for Solidity
const highlightSolidity = (code: string) => {
  // Basic syntax highlighting for Solidity
  const keywords = [
    'contract', 'function', 'returns', 'return', 'if', 'else', 'for', 'while', 'do',
    'break', 'continue', 'true', 'false', 'address', 'uint', 'int', 'bool', 'string',
    'bytes', 'mapping', 'struct', 'event', 'emit', 'modifier', 'view', 'pure', 'payable',
    'constructor', 'public', 'private', 'internal', 'external', 'memory', 'storage',
    'calldata', 'import', 'pragma', 'is', 'interface', 'library', 'using', 'as'
  ];

  // Add word boundaries to keywords for exact matching
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  
  // Highlight comments
  let highlighted = code
    .replace(/\/\*[\s\S]*?\*\//g, '<span class="text-gray-500 italic">$&</span>')
    .replace(/\/\/(.*?)(?=\n|$)/g, '<span class="text-gray-500 italic">$&</span>');

  // Highlight strings
  highlighted = highlighted
    .replace(/"(?:\\.|[^"\\])*"/g, '<span class="text-green-600">$&</span>')
    .replace(/'(?:\\.|[^'\\])*'/g, '<span class="text-green-600">$&</span>');

  // Highlight numbers
  highlighted = highlighted
    .replace(/\b(\d+)\b/g, '<span class="text-blue-600">$1</span>');

  // Highlight keywords
  highlighted = highlighted
    .replace(keywordRegex, '<span class="text-purple-600 font-medium">$1</span>');

  // Highlight function definitions
  highlighted = highlighted
    .replace(/(function\s+)(\w+)\s*\(/g, '$1<span class="text-blue-600 font-medium">$2</span>(');

  return highlighted;
};

type ContractPreviewProps = {
  sourceCode: string;
  className?: string;
};

export function ContractPreview({ sourceCode, className }: ContractPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState('');

  useEffect(() => {
    setHighlightedCode(highlightSolidity(sourceCode));
  }, [sourceCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative rounded-lg border bg-background', className)}>
      <div className="flex justify-between items-center px-4 py-2 border-b">
        <span className="text-sm font-mono text-muted-foreground">contract.sol</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <div className="overflow-auto max-h-[500px] p-4">
        <pre className="font-mono text-sm leading-relaxed">
          <code 
            className="block whitespace-pre"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  );
}
