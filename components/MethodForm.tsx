// components/MethodForm.tsx
import React, { useState, useEffect } from 'react';
import { Service, Method, Field } from './GrpcExplorerApp';
import styles from './MethodForm.module.css';

interface MethodFormProps {
  service: Service | null;
  method: Method | null;
  onExecute: (params: Record<string, any>) => void;
}

const MethodForm: React.FC<MethodFormProps> = ({ service, method, onExecute }) => {
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [jsonMode, setJsonMode] = useState<boolean>(false);
  const [jsonInput, setJsonInput] = useState<string>('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    // Reset form when method changes
    if (method) {
      setFormState({});
      setFormErrors({});
      setJsonInput('{}');
      setJsonError(null);
      setJsonMode(false);
    }
  }, [method]);

  if (!service || !method) {
    return null;
  }

  const getFieldDescription = (field: Field) => {
    if (field.options) {
      return `${field.options}`;
    }
    return '';
  };

  const handleInputChange = (fieldName: string, value: string, field: Field) => {
    let parsedValue: any = value;

    // Handle different types
    if (value === '') {
      parsedValue = undefined;
    } else if (field.type === 'int32' || field.type === 'int64' || field.type === 'uint32' || field.type === 'uint64') {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue)) {
        setFormErrors(prev => ({
          ...prev,
          [fieldName]: 'Must be a valid number',
        }));
        return;
      }
    } else if (field.type === 'float' || field.type === 'double') {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        setFormErrors(prev => ({
          ...prev,
          [fieldName]: 'Must be a valid number',
        }));
        return;
      }
    } else if (field.type === 'bool') {
      parsedValue = value === 'true';
    }

    // Clear errors
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });

    setFormState(prev => ({
      ...prev,
      [fieldName]: parsedValue,
    }));
  };

  const handleArrayChange = (fieldName: string, index: number, value: string, field: Field) => {
    let parsedValue: any = value;

    // Handle different types
    if (field.type === 'int32' || field.type === 'int64' || field.type === 'uint32' || field.type === 'uint64') {
      parsedValue = parseInt(value, 10);
    } else if (field.type === 'float' || field.type === 'double') {
      parsedValue = parseFloat(value);
    } else if (field.type === 'bool') {
      parsedValue = value === 'true';
    }

    setFormState(prev => {
      const currentArray = Array.isArray(prev[fieldName]) ? [...prev[fieldName]] : [];
      currentArray[index] = parsedValue;
      return {
        ...prev,
        [fieldName]: currentArray,
      };
    });
  };

  const addArrayItem = (fieldName: string) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: [...(prev[fieldName] || []), ''],
    }));
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
    } catch (err) {
      setJsonError('Invalid JSON format');
    }
  };

  const handleSubmit = () => {
    // Check for form errors
    if (Object.keys(formErrors).length > 0) {
      return;
    }

    // Submit either JSON input or form state
    if (jsonMode) {
      try {
        const parsedJson = JSON.parse(jsonInput);
        onExecute(parsedJson);
      } catch (err) {
        setJsonError('Invalid JSON format');
      }
    } else {
      onExecute(formState);
    }
  };

  const toggleJsonMode = () => {
    if (!jsonMode) {
      // Convert form state to JSON when switching to JSON mode
      setJsonInput(JSON.stringify(formState, null, 2));
    } else {
      // Parse JSON back to form state when switching to form mode
      try {
        const parsedJson = JSON.parse(jsonInput);
        setFormState(parsedJson);
        setJsonError(null);
      } catch (err) {
        setJsonError('Cannot switch to form mode: Invalid JSON format');
        return;
      }
    }
    setJsonMode(!jsonMode);
  };

  return (
    <div className={styles.container}>
    <div className={styles.header}>
    <div className={styles.headerTitle}>
    <h2>{method.name}</h2>
    <span className={styles.serviceName}>{service.service}</span>
    </div>
    <div className={styles.headerActions}>
    <button
    className={styles.modeToggle}
    onClick={toggleJsonMode}
    disabled={jsonMode && jsonError !== null}
    >
    {jsonMode ? 'Form Mode' : 'JSON Mode'}
    </button>
    </div>
    </div>

    <div className={styles.formContainer}>
    {jsonMode ? (
      <div className={styles.jsonContainer}>
      <textarea
      className={`${styles.jsonEditor} ${jsonError ? styles.jsonError : ''}`}
      value={jsonInput}
      onChange={handleJsonInputChange}
      placeholder="Enter JSON request parameters..."
      rows={20}
      />
      {jsonError && <div className={styles.errorMessage}>{jsonError}</div>}
      </div>
    ) : (
      <div className={styles.fieldsList}>
      {method.fields && method.fields.length > 0 ? (
        method.fields.map((field) => (
          <div key={field.name} className={styles.fieldContainer}>
          <label className={styles.fieldLabel}>
          {field.name}
          <span className={styles.fieldType}>
          {field.repeated ? `${field.type}[]` : field.type}
          </span>
          </label>
          {field.options && (
            <div className={styles.fieldDescription}>
            {getFieldDescription(field)}
            </div>
          )}

          {field.repeated ? (
            <div className={styles.arrayContainer}>
            {(formState[field.name] || []).map((value: any, index: number) => (
              <div key={index} className={styles.arrayItem}>
              <input
              type="text"
              value={value}
              onChange={(e) => handleArrayChange(field.name, index, e.target.value, field)}
              className={styles.input}
              placeholder={`Enter ${field.type}...`}
              />
              <button
              className={styles.removeButton}
              onClick={() => removeArrayItem(field.name, index)}
              type="button"
              >
              ×
              </button>
              </div>
            ))}
            <button
            className={styles.addButton}
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
              className={styles.select}
              >
              <option value="">Select...</option>
              <option value="true">true</option>
              <option value="false">false</option>
              </select>
            ) : (
              <input
              type={field.type === 'int32' || field.type === 'int64' || field.type === 'uint32' || field.type === 'uint64' || field.type === 'float' || field.type === 'double' ? 'number' : 'text'}
              value={formState[field.name] || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value, field)}
              className={`${styles.input} ${formErrors[field.name] ? styles.inputError : ''}`}
              placeholder={`Enter ${field.type}...`}
              />
            )}
            {formErrors[field.name] && (
              <div className={styles.errorMessage}>{formErrors[field.name]}</div>
            )}
            </div>
          )}
          </div>
        ))
      ) : (
        <div className={styles.emptyFields}>No parameters required</div>
      )}
      </div>
    )}
    </div>

    <div className={styles.actionsContainer}>
    <button
    className={styles.executeButton}
    onClick={handleSubmit}
    disabled={(jsonMode && jsonError !== null) || Object.keys(formErrors).length > 0}
    >
    Execute
    </button>
    </div>
    </div>
  );
};

export default MethodForm;
