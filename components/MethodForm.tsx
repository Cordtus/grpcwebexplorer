import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from './LoadingSpinner';
import { Send } from 'lucide-react';

export interface MethodFormProps {
  endpoint: string;
  service: string;
  method: string;
  onResponse: (response: any) => void;
}

const MethodForm: React.FC<MethodFormProps> = ({ endpoint, service, method, onResponse }) => {
  const [fields, setFields] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch method fields when method changes
  useEffect(() => {
    const fetchFields = async () => {
      if (!method || !service || !endpoint) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/grpc/method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, service, method }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch method fields: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        setFields(data.fields || []);
        // Initialize values for fields
        const initialValues: Record<string, any> = {};
        (data.fields || []).forEach((field: any) => {
          initialValues[field.name] = '';
        });
        setValues(initialValues);
      } catch (err) {
        console.error('Error fetching method fields:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch method fields');
        setFields([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [endpoint, service, method]);

  const handleChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setExecuting(true);
    setError(null);
    
    try {
      // Parse JSON values for object/array fields
      const parsedValues: Record<string, any> = {};
      for (const [key, value] of Object.entries(values)) {
        if (typeof value === 'string' && value.trim()) {
          const field = fields.find(f => f.name === key);
          if (field && (field.type.includes('{}') || field.type.includes('[]'))) {
            try {
              parsedValues[key] = JSON.parse(value);
            } catch {
              parsedValues[key] = value;
            }
          } else {
            parsedValues[key] = value;
          }
        } else {
          parsedValues[key] = value;
        }
      }

      const response = await fetch('/api/grpc/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          service,
          method,
          params: parsedValues,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      onResponse(data.response);
    } catch (err) {
      console.error('Error executing method:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute method');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold text-foreground">{method}</h3>
        <p className="text-sm text-muted-foreground mt-1">{service}</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleExecute} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="flex items-center gap-2">
              <span className="font-medium">{field.name}</span>
              <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
                {field.type}
              </span>
            </Label>
            
            {field.type.includes('{}') || field.type.includes('[]') ? (
              <Textarea
                id={field.name}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={`Enter JSON for ${field.type}`}
                className="font-mono text-sm bg-input/50 border-border focus:border-primary transition-colors"
                rows={4}
              />
            ) : (
              <Input
                id={field.name}
                type="text"
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={`Enter ${field.name}`}
                className="bg-input/50 border-border focus:border-primary transition-colors"
              />
            )}
            
            {field.description && (
              <p className="text-xs text-muted-foreground pl-2">
                {field.description}
              </p>
            )}
          </div>
        ))}

        <Button 
          type="submit" 
          disabled={executing} 
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          {executing ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Execute</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default MethodForm;