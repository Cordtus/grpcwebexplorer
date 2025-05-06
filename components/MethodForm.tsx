// components/MethodForm.tsx
import React, { useState, useEffect } from 'react';
import { Service, Method, Field } from './GrpcExplorerApp';
import LoadingSpinner from './LoadingSpinner';
import { getExampleValue, getExampleArrayValue } from '@/utils/grpcHelpers';
import styles from './MethodForm.module.css';

interface MethodFormProps {
  service: Service | null;
  method: Method | null;
  onExecute: (params: Record<string, any>) => void;
  isLoading?: boolean;
  hideButtons?: boolean;
}

const MethodForm: React.FC<MethodFormProps> = ({ 
  service, 
  method,
  onExecute,
  isLoading = false,
  hideButtons = false 
}) => {
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [jsonMode, setJsonMode] = useState<boolean>(false);
  const [jsonInput, setJsonInput] = useState<string>('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Initialize form with example values when method changes
  useEffect(() => {
    if (!method) return;

    setFormState({});
    setFormErrors({});
    setJsonError(null);
    setJsonMode(false);

    const exampleData: Record<string, any> = {};

    if (method.fields?.length) {
      method.fields.forEach(field => {
        exampleData[field.name] = field.repeated
          ? getExampleArrayValue(field.type)
          : getExampleValue(field.type);
      });
    }

    setJsonInput(JSON.stringify(exampleData, null, 2));
  }, [method]);

  if (!service || !method) return null;

  const handleInputChange = (fieldName: string, value: string, field: Field) => {
    let parsedValue: any = value;
    if (value === '') parsedValue = undefined;
    else if (["int32", "int64", "uint32", "uint64"].includes(field.type)) {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue)) return setFormErrors(prev => ({ ...prev, [fieldName]: 'Must be a valid number' }));
    } else if (["float", "double"].includes(field.type)) {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) return setFormErrors(prev => ({ ...prev, [fieldName]: 'Must be a valid number' }));
    } else if (field.type === 'bool') parsedValue = value === 'true';

    setFormErrors(prev => { const next = { ...prev }; delete next[fieldName]; return next; });
    setFormState(prev => ({ ...prev, [fieldName]: parsedValue }));
  };

  const handleArrayChange = (fieldName: string, index: number, value: string, field: Field) => {
    let parsedValue: any = value;
    if (["int32", "int64", "uint32", "uint64"].includes(field.type)) parsedValue = parseInt(value, 10);
    else if (["float", "double"].includes(field.type)) parsedValue = parseFloat(value);
    else if (field.type === 'bool') parsedValue = value === 'true';

    setFormState(prev => {
      const currentArray = Array.isArray(prev[fieldName]) ? [...prev[fieldName]] : [];
      currentArray[index] = parsedValue;
      return { ...prev, [fieldName]: currentArray };
    });
  };

  const addArrayItem = (fieldName: string) => {
    setFormState(prev => ({ ...prev, [fieldName]: [...(prev[fieldName] || []), ''] }));
  };

  const removeArrayItem = (fieldName: string, index: number) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).filter((_: any, i: number) => i !== index),
    }));
  };

  const handleJsonInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(e.target.value);
    try {
      JSON.parse(e.target.value);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON format');
    }
  };

  const toggleJsonMode = () => {
    if (!jsonMode) {
      if (Object.keys(formState).length === 0 && method?.fields && method.fields.length > 0) {
        const exampleData: Record<string, any> = {};
        method.fields.forEach(field => {
          exampleData[field.name] = field.repeated ? getExampleArrayValue(field.type) : getExampleValue(field.type);
        });
        setJsonInput(JSON.stringify(exampleData, null, 2));
      } else {
        setJsonInput(JSON.stringify(formState, null, 2));
      }
    } else {
      try {
        const parsedJson = JSON.parse(jsonInput);
        setFormState(parsedJson);
        setJsonError(null);
      } catch {
        setJsonError('Cannot switch to form mode: Invalid JSON format');
        return;
      }
    }
    setJsonMode(!jsonMode);
  };

  const handleSubmit = () => {
    if (Object.keys(formErrors).length > 0) return;
    if (jsonMode) {
      try {
        const parsedJson = JSON.parse(jsonInput);
        onExecute(parsedJson);
      } catch {
        setJsonError('Invalid JSON format');
      }
    } else {
      onExecute(formState);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-2 bg-dark-highlight border-b border-dark-border">
        <div className="text-sm text-text-primary font-medium">Request Parameters</div>
        <button 
          className="px-2 py-1 text-xs bg-dark-bg border border-dark-border rounded hover:bg-dark-highlight transition-colors"
          onClick={toggleJsonMode}
          disabled={jsonMode && jsonError !== null || isLoading}
        >
          {jsonMode ? 'Form Mode' : 'JSON Mode'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center flex-grow p-8">
          <LoadingSpinner size="md" />
          <p className="mt-4 text-text-secondary">Processing...</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto p-4">
            {jsonMode ? (
              <div className="h-full flex flex-col">
                <textarea 
                  className={`flex-1 min-h-[200px] p-3 bg-dark-bg border ${jsonError ? 'border-error-red' : 'border-dark-border'} rounded font-mono text-sm resize-none`}
                  value={jsonInput} 
                  onChange={handleJsonInputChange} 
                  placeholder="Enter JSON request parameters..." 
                />
                {jsonError && <div className="mt-2 text-sm text-error-red">{jsonError}</div>}
              </div>
            ) : (
              <div className="space-y-4">
                {method.fields?.length ? method.fields.map(field => (
                  <div key={field.name} className="pb-3 border-b border-dark-border last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium text-text-primary">{field.name}</label>
                      <span className="text-xs px-1.5 py-0.5 bg-dark-bg rounded text-text-secondary font-mono">
                        {field.repeated ? `${field.type}[]` : field.type}
                      </span>
                    </div>
                    
                    {field.options && (
                      <div className="mb-2 p-2 bg-dark-bg rounded text-xs text-text-secondary font-mono overflow-x-auto">
                        {field.options}
                      </div>
                    )}
                    
                    {field.repeated ? (
                      <div className="space-y-2">
                        {(formState[field.name] || []).map((value: any, index: number) => (
                          <div key={index} className="flex gap-2">
                            <input 
                              type="text" 
                              value={value} 
                              onChange={(e) => handleArrayChange(field.name, index, e.target.value, field)} 
                              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm outline-none focus:border-blue-accent" 
                              placeholder={`Enter ${field.type}...`} 
                            />
                            <button 
                              className="w-8 flex items-center justify-center bg-dark-bg border border-dark-border rounded hover:bg-dark-highlight text-error-red" 
                              onClick={() => removeArrayItem(field.name, index)} 
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button 
                          className="w-full py-1.5 border border-dashed border-dark-border rounded text-xs text-text-secondary hover:bg-dark-highlight transition-colors" 
                          onClick={() => addArrayItem(field.name)} 
                          type="button"
                        >
                          + Add Item
                        </button>
                      </div>
                    ) : (
                      <div>
                        {field.type === 'bool' ? (
                          <select 
                            value={formState[field.name] || ''} 
                            onChange={(e) => handleInputChange(field.name, e.target.value, field)} 
                            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm outline-none focus:border-blue-accent"
                          >
                            <option value="">Select...</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input 
                            type={["int32", "int64", "uint32", "uint64", "float", "double"].includes(field.type) ? 'number' : 'text'} 
                            value={formState[field.name] || ''} 
                            onChange={(e) => handleInputChange(field.name, e.target.value, field)} 
                            className={`w-full px-3 py-2 bg-dark-bg border ${formErrors[field.name] ? 'border-error-red' : 'border-dark-border'} rounded text-sm outline-none focus:border-blue-accent`}
                            placeholder={`Enter ${field.type}...`} 
                          />
                        )}
                        {formErrors[field.name] && <div className="mt-1 text-xs text-error-red">{formErrors[field.name]}</div>}
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="py-8 text-center text-text-secondary">
                    No parameters required
                  </div>
                )}
              </div>
            )}
          </div>

          {!hideButtons && (
            <div className="p-4 bg-dark-highlight border-t border-dark-border flex justify-end">
              <button
                className={`px-4 py-2 rounded text-white font-medium ${isLoading || (jsonMode && jsonError) || Object.keys(formErrors).length > 0 ? 'bg-blue-accent opacity-50 cursor-not-allowed' : 'bg-blue-accent hover:bg-blue-accent-hover'}`}
                onClick={handleSubmit}
                disabled={isLoading || (jsonMode && jsonError !== null) || Object.keys(formErrors).length > 0}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <LoadingSpinner size="sm" color="#ffffff" />
                    <span className="ml-2">Executing...</span>
                  </span>
                ) : (
                  'Execute'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MethodForm;