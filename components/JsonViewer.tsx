import React from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface JsonViewerProps {
  data: unknown;
  title?: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, title = 'Response' }) => {
  const [copied, setCopied] = React.useState(false);
  
  const handleCopy = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No data to display</p>
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="glass-subtle border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground/90">{title}</h3>
          <button
            onClick={handleCopy}
            className="btn-ghost p-2 rounded-md flex items-center gap-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-thin p-4">
        <pre className="code-viewer">
          <code className="text-xs leading-relaxed">{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};

export default JsonViewer;