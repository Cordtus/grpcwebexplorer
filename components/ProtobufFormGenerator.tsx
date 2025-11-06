'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

export interface MessageField {
  name: string;
  type: string;
  rule?: 'optional' | 'required' | 'repeated';
  defaultValue?: any;
  comment?: string;
  nested?: boolean;
  enumValues?: string[];
}

export interface MessageTypeDefinition {
  name: string;
  fullName: string;
  fields: MessageField[];
}

interface ProtobufFormGeneratorProps {
  messageType: MessageTypeDefinition;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  readonly?: boolean;
}

const ProtobufFormGenerator: React.FC<ProtobufFormGeneratorProps> = ({
  messageType,
  value,
  onChange,
  readonly = false,
}) => {
  // If no fields, show empty state (methods with no parameters)
  if (!messageType.fields || messageType.fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No input parameters required</p>
          <p className="text-xs mt-1">This method accepts an empty request</p>
        </div>
      </div>
    );
  }

  const handleFieldChange = (fieldName: string, fieldValue: any) => {
    onChange({
      ...value,
      [fieldName]: fieldValue,
    });
  };

  const handleArrayAdd = (fieldName: string) => {
    const currentArray = value[fieldName] || [];
    onChange({
      ...value,
      [fieldName]: [...currentArray, ''],
    });
  };

  const handleArrayRemove = (fieldName: string, index: number) => {
    const currentArray = value[fieldName] || [];
    onChange({
      ...value,
      [fieldName]: currentArray.filter((_: any, i: number) => i !== index),
    });
  };

  const handleArrayItemChange = (fieldName: string, index: number, itemValue: any) => {
    const currentArray = value[fieldName] || [];
    const newArray = [...currentArray];
    newArray[index] = itemValue;
    onChange({
      ...value,
      [fieldName]: newArray,
    });
  };

  return (
    <div className="space-y-4">
      {messageType.fields.map((field) => (
        <FieldInput
          key={field.name}
          field={field}
          value={value[field.name]}
          onChange={(v) => handleFieldChange(field.name, v)}
          onArrayAdd={() => handleArrayAdd(field.name)}
          onArrayRemove={(index) => handleArrayRemove(field.name, index)}
          onArrayItemChange={(index, v) => handleArrayItemChange(field.name, index, v)}
          readonly={readonly}
        />
      ))}
    </div>
  );
};

interface FieldInputProps {
  field: MessageField;
  value: any;
  onChange: (value: any) => void;
  onArrayAdd: () => void;
  onArrayRemove: (index: number) => void;
  onArrayItemChange: (index: number, value: any) => void;
  readonly?: boolean;
}

const FieldInput: React.FC<FieldInputProps> = ({
  field,
  value,
  onChange,
  onArrayAdd,
  onArrayRemove,
  onArrayItemChange,
  readonly = false,
}) => {
  const [expanded, setExpanded] = useState(true);

  // Repeated field (array)
  if (field.rule === 'repeated') {
    const arrayValue = value || [];
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </button>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {field.name}
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                ({field.type}[])
              </span>
            </label>
          </div>
          {!readonly && (
            <button
              onClick={onArrayAdd}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          )}
        </div>
        {field.comment && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{field.comment}</p>
        )}
        {expanded && (
          <div className="space-y-2 mt-2 max-h-96 overflow-y-auto">
            {arrayValue.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
                Empty array - click &quot;Add&quot; to add items
              </div>
            ) : (
              arrayValue.map((item: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <PrimitiveInput
                      type={field.type}
                      value={item}
                      onChange={(v) => onArrayItemChange(index, v)}
                      {...(field.enumValues && { enumValues: field.enumValues })}
                      readonly={readonly}
                      placeholder={`Item ${index + 1}`}
                    />
                  </div>
                  {!readonly && (
                    <button
                      onClick={() => onArrayRemove(index)}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Nested message field
  if (field.nested) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/30">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          {field.name}
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({field.type})
          </span>
        </label>
        {field.comment && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{field.comment}</p>
        )}
        <div className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
          Nested message - use JSON editor for complex types
        </div>
        <textarea
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value || ''}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              // Invalid JSON, don't update
            }
          }}
          readOnly={readonly}
          placeholder={`{"field": "value"}`}
          className={cn(
            "w-full px-3 py-2 rounded text-sm font-mono",
            "bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            readonly && "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
          )}
          rows={4}
        />
      </div>
    );
  }

  // Regular field
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
        {field.name}
        {field.rule === 'required' && (
          <span className="ml-1 text-red-500">*</span>
        )}
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          ({field.type})
        </span>
      </label>
      {field.comment && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{field.comment}</p>
      )}
      <PrimitiveInput
        type={field.type}
        value={value}
        onChange={onChange}
        {...(field.enumValues && { enumValues: field.enumValues })}
        readonly={readonly}
        placeholder={`Enter ${field.name}`}
      />
    </div>
  );
};

interface PrimitiveInputProps {
  type: string;
  value: any;
  onChange: (value: any) => void;
  enumValues?: string[];
  readonly?: boolean;
  placeholder?: string;
}

const PrimitiveInput: React.FC<PrimitiveInputProps> = ({
  type,
  value,
  onChange,
  enumValues,
  readonly = false,
  placeholder,
}) => {
  // Enum select
  if (enumValues && enumValues.length > 0) {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={readonly}
        className={cn(
          "w-full px-3 py-2 rounded text-sm",
          "bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          readonly && "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
        )}
      >
        <option value="">Select value...</option>
        {enumValues.map((enumValue) => (
          <option key={enumValue} value={enumValue}>
            {enumValue}
          </option>
        ))}
      </select>
    );
  }

  // Boolean checkbox
  if (type === 'bool') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
          disabled={readonly}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {value ? 'true' : 'false'}
        </span>
      </label>
    );
  }

  // Number input for numeric types
  if (['int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64', 'double', 'float'].includes(type)) {
    return (
      <input
        type="number"
        value={value || ''}
        onChange={(e) => {
          const numValue = type.includes('float') || type === 'double'
            ? parseFloat(e.target.value)
            : parseInt(e.target.value);
          onChange(isNaN(numValue) ? '' : numValue);
        }}
        readOnly={readonly}
        placeholder={placeholder || 'Enter number'}
        className={cn(
          "w-full px-3 py-2 rounded text-sm",
          "bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          readonly && "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
        )}
      />
    );
  }

  // Bytes as base64 textarea
  if (type === 'bytes') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readonly}
        placeholder={placeholder || 'Enter base64 encoded bytes'}
        className={cn(
          "w-full px-3 py-2 rounded text-sm font-mono",
          "bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          readonly && "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
        )}
        rows={3}
      />
    );
  }

  // String input (default)
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readonly}
      placeholder={placeholder || 'Enter text'}
      className={cn(
        "w-full px-3 py-2 rounded text-sm",
        "bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        readonly && "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
      )}
    />
  );
};

export default ProtobufFormGenerator;
