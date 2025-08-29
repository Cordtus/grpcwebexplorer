'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Code, AlertCircle, Loader2 } from 'lucide-react';
import { ExpandableBlock } from './ExpandableBlock';
import { cn } from '@/lib/utils';

interface GrpcMethod {
  name: string;
  fullName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  options?: any;
  description?: string;
}

interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

interface MethodInstance {
  id: string;
  networkId: string;
  method: GrpcMethod;
  service: GrpcService;
  color: string;
  expanded?: boolean;
  params?: Record<string, any>;
}

interface MethodBlockProps {
  instance: MethodInstance;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onSelect: () => void;
  onUpdateParams: (params: Record<string, any>) => void;
  onExecute: () => void;
  isExecuting: boolean;
}

// Field type definitions for protobuf types
const PROTOBUF_TYPES = {
  // Scalar types
  'double': { type: 'number', validation: 'float', description: '64-bit floating point' },
  'float': { type: 'number', validation: 'float', description: '32-bit floating point' },
  'int32': { type: 'number', validation: 'integer', description: '32-bit signed integer' },
  'int64': { type: 'string', validation: 'bigint', description: '64-bit signed integer (as string)' },
  'uint32': { type: 'number', validation: 'unsigned', description: '32-bit unsigned integer' },
  'uint64': { type: 'string', validation: 'bigint', description: '64-bit unsigned integer (as string)' },
  'sint32': { type: 'number', validation: 'integer', description: '32-bit signed integer (efficient negative)' },
  'sint64': { type: 'string', validation: 'bigint', description: '64-bit signed integer (efficient negative)' },
  'fixed32': { type: 'number', validation: 'unsigned', description: '32-bit fixed unsigned' },
  'fixed64': { type: 'string', validation: 'bigint', description: '64-bit fixed unsigned' },
  'sfixed32': { type: 'number', validation: 'integer', description: '32-bit fixed signed' },
  'sfixed64': { type: 'string', validation: 'bigint', description: '64-bit fixed signed' },
  'bool': { type: 'boolean', validation: 'boolean', description: 'Boolean value' },
  'string': { type: 'string', validation: 'string', description: 'UTF-8 string' },
  'bytes': { type: 'string', validation: 'base64', description: 'Base64 encoded bytes' },
};

// Mock field extraction from request type (would come from reflection API)
function extractFieldsFromType(requestType: string): Field[] {
  // This would normally come from gRPC reflection
  // For now, return common patterns
  
  const fields: Field[] = [];
  
  // Common Cosmos SDK patterns
  if (requestType.includes('QueryBalanceRequest')) {
    fields.push(
      { name: 'address', type: 'string', required: true, description: 'The address to query balance for' },
      { name: 'denom', type: 'string', required: true, description: 'The denomination to query' }
    );
  } else if (requestType.includes('QueryAccountRequest')) {
    fields.push(
      { name: 'address', type: 'string', required: true, description: 'The address to query' }
    );
  } else if (requestType.includes('PageRequest')) {
    fields.push(
      { name: 'key', type: 'bytes', required: false, description: 'Key for pagination' },
      { name: 'offset', type: 'uint64', required: false, description: 'Offset for pagination' },
      { name: 'limit', type: 'uint64', required: false, description: 'Maximum number of results' },
      { name: 'count_total', type: 'bool', required: false, description: 'Count total results' },
      { name: 'reverse', type: 'bool', required: false, description: 'Reverse order' }
    );
  } else {
    // Default structure for unknown types
    fields.push(
      { name: 'request', type: 'object', required: false, description: 'Request payload (JSON)' }
    );
  }
  
  return fields;
}

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
  repeated?: boolean;
  nested?: Field[];
}

function FieldInput({ 
  field, 
  value, 
  onChange, 
  path = [] 
}: { 
  field: Field; 
  value: any; 
  onChange: (value: any) => void;
  path?: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [localValue, setLocalValue] = useState(value || '');

  const validateField = (val: any) => {
    const typeInfo = PROTOBUF_TYPES[field.type as keyof typeof PROTOBUF_TYPES];
    if (!typeInfo) return true;

    try {
      switch (typeInfo.validation) {
        case 'integer':
          if (val && !Number.isInteger(Number(val))) {
            setError('Must be an integer');
            return false;
          }
          break;
        case 'float':
          if (val && isNaN(Number(val))) {
            setError('Must be a number');
            return false;
          }
          break;
        case 'unsigned':
          if (val && Number(val) < 0) {
            setError('Must be positive');
            return false;
          }
          break;
        case 'boolean':
          if (val && !['true', 'false'].includes(val.toString().toLowerCase())) {
            setError('Must be true or false');
            return false;
          }
          break;
        case 'base64':
          if (val && !/^[A-Za-z0-9+/]*={0,2}$/.test(val)) {
            setError('Must be valid base64');
            return false;
          }
          break;
      }
      setError(null);
      return true;
    } catch {
      setError('Invalid value');
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    if (validateField(val)) {
      onChange(val);
    }
  };

  const typeInfo = PROTOBUF_TYPES[field.type as keyof typeof PROTOBUF_TYPES];
  const inputType = typeInfo?.type === 'number' ? 'number' : 
                    typeInfo?.type === 'boolean' ? 'checkbox' : 'text';

  if (field.type === 'object') {
    return (
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          {field.name}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <textarea
          value={localValue}
          onChange={handleChange}
          placeholder="Enter JSON object"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 font-mono"
          rows={4}
        />
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{field.description}</p>
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        {field.name}
        {field.required && <span className="text-red-500 ml-1">*</span>}
        <span className="ml-2 text-[10px] text-gray-500">({field.type})</span>
      </label>
      <input
        type={inputType}
        value={localValue}
        onChange={handleChange}
        placeholder={field.description}
        className={cn(
          "w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900",
          error ? "border-red-500" : "border-gray-200 dark:border-gray-700"
        )}
      />
      {!error && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{field.description}</p>
      )}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

export default function MethodBlock({
  instance,
  isSelected,
  onToggle,
  onRemove,
  onSelect,
  onUpdateParams,
  onExecute,
  isExecuting
}: MethodBlockProps) {
  const [params, setParams] = useState<Record<string, any>>(instance.params || {});
  
  // Extract fields from request type
  const fields = useMemo(() => 
    extractFieldsFromType(instance.method.requestType),
    [instance.method.requestType]
  );

  // Update parent when params change
  useEffect(() => {
    onUpdateParams(params);
  }, [params, onUpdateParams]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setParams(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const isValid = useMemo(() => {
    return fields.filter(f => f.required).every(f => params[f.name]);
  }, [fields, params]);

  return (
    <div onClick={onSelect} className="cursor-pointer">
      <ExpandableBlock
        title={instance.method.name}
        subtitle={`${instance.service.fullName}`}
        isExpanded={instance.expanded || false}
        onToggle={onToggle}
        color={instance.color}
        icon={<Code className="h-4 w-4" style={{ color: instance.color }} />}
        onRemove={onRemove}
        isActive={isSelected}
        className="transition-all"
        headerClassName={isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
      >
        <div className="space-y-4">
          {/* Stream indicators */}
          <div className="flex gap-2">
            {instance.method.requestStreaming && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Client streaming
              </span>
            )}
            {instance.method.responseStreaming && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                Server streaming
              </span>
            )}
            {!instance.method.requestStreaming && !instance.method.responseStreaming && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                Unary
              </span>
            )}
          </div>

          {/* Request/Response types */}
          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Request:</span>
              <code className="font-mono text-blue-600 dark:text-blue-400">
                {instance.method.requestType}
              </code>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Response:</span>
              <code className="font-mono text-green-600 dark:text-green-400">
                {instance.method.responseType}
              </code>
            </div>
          </div>

          {/* Parameter inputs */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Parameters</h4>
            {fields.map(field => (
              <FieldInput
                key={field.name}
                field={field}
                value={params[field.name]}
                onChange={(value) => handleFieldChange(field.name, value)}
              />
            ))}
          </div>

          {/* Execute button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            disabled={!isValid || isExecuting}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
              isValid && !isExecuting
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
            )}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Execute Method
              </>
            )}
          </button>

          {!isValid && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>Fill in required fields</span>
            </div>
          )}
        </div>
      </ExpandableBlock>
    </div>
  );
}