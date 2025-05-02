// components/MethodForm.tsx
import React, { useState, useEffect } from 'react';
import { Service, Method, Field } from './GrpcExplorerApp';
import LoadingSpinner from './LoadingSpinner';
import styles from './MethodForm.module.css';

interface MethodFormProps {
  service: Service | null;
  method: Method | null;
  onExecute: (params: Record<string, any>) => void;
  isLoading?: boolean;
}

const MethodForm: React.FC<MethodFormProps> = ({
  service,
  method,
  onExecute,
  isLoading = false
}) => {
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [jsonMode, setJsonMode] = useState<boolean>(false);
  const [jsonInput, setJsonInput] = useState<string>('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isPanelMinimized, setIsPanelMinimized] = useState<boolean>(false);
  const [isPanelFullWidth, setIsPanelFullWidth] = useState<boolean>(false);

  const handleMinimizePanel = () => setIsPanelMinimized(!isPanelMinimized);
  const handleMaximizePanel = () => setIsPanelFullWidth(!isPanelFullWidth);
  const handleClosePanel = () => setIsPanelMinimized(true);

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

  const getExampleValue = (type: string): any => {
    switch (type) {
      case 'string': return "example";
      case 'int32':
      case 'int64':
      case 'uint32':
      case 'uint64': return 0;
      case 'float':
      case 'double': return 0.0;
      case 'bool': return false;
      default: return "";
    }
  };

  const getExampleArrayValue = (type: string): any[] => [getExampleValue(type)];

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
      if (Object.keys(formState).length === 0 && method?.fields?.length > 0) {
        const exampleData = {};
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
    <div className={`${styles.container} ${isPanelMinimized ? styles.minimized : ''} ${isPanelFullWidth ? styles.fullWidth : ''}`}>
    <div className={styles.header}>
    <div className={styles.headerLeft}>
    <div className={styles.traffic}>
    <button className={styles.trafficButton} style={{ backgroundColor: '#FF605C' }} onClick={handleClosePanel} title="Minimize panel" aria-label="Minimize panel" />
    <button className={styles.trafficButton} style={{ backgroundColor: '#FFBD44' }} onClick={handleMinimizePanel} title={isPanelMinimized ? 'Restore panel' : 'Minimize panel'} aria-label={isPanelMinimized ? 'Restore panel' : 'Minimize panel'} />
    <button className={styles.trafficButton} style={{ backgroundColor: '#00CA4E' }} onClick={handleMaximizePanel} title={isPanelFullWidth ? 'Restore panel size' : 'Maximize panel'} aria-label={isPanelFullWidth ? 'Restore panel size' : 'Maximize panel'} />
    </div>
    <div className={styles.headerTitle}>
    <h2>{method.name}</h2>
    <span className={styles.serviceName}>{service.service}</span>
    </div>
    </div>
    <div className={styles.headerActions}>
    <button className={styles.modeToggle} onClick={toggleJsonMode} disabled={jsonMode && jsonError !== null || isLoading}>
    {jsonMode ? 'Form Mode' : 'JSON Mode'}
    </button>
    </div>
    </div>

    {isLoading ? (
      <div className="flex flex-col items-center justify-center flex-grow p-8">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-text-secondary">Loading...</p>
      </div>
    ) : (
      <>
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
        {method.fields?.length ? method.fields.map(field => (
          <div key={field.name} className={styles.fieldContainer}>
          <label className={styles.fieldLabel}>
          {field.name}
          <span className={styles.fieldType}>{field.repeated ? `${field.type}[]` : field.type}</span>
          </label>
          {field.options && <div className={styles.fieldDescription}>{field.options}</div>}
          {field.repeated ? (
            <div className={styles.arrayContainer}>
            {(formState[field.name] || []).map((value: any, index: number) => (
              <div key={index} className={styles.arrayItem}>
              <input type="text" value={value} onChange={(e) => handleArrayChange(field.name, index, e.target.value, field)} className={styles.input} placeholder={`Enter ${field.type}...`} />
              <button className={styles.removeButton} onClick={() => removeArrayItem(field.name, index)} type="button">×</button>
              </div>
            ))}
            <button className={styles.addButton} onClick={() => addArrayItem(field.name)} type="button">+ Add Item</button>
            </div>
          ) : (
            <div>
            {field.type === 'bool' ? (
              <select value={formState[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value, field)} className={styles.select}>
              <option value="">Select...</option>
              <option value="true">true</option>
              <option value="false">false</option>
              </select>
            ) : (
              <input type={["int32", "int64", "uint32", "uint64", "float", "double"].includes(field.type) ? 'number' : 'text'} value={formState[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value, field)} className={`${styles.input} ${formErrors[field.name] ? styles.inputError : ''}`} placeholder={`Enter ${field.type}...`} />
            )}
            {formErrors[field.name] && <div className={styles.errorMessage}>{formErrors[field.name]}</div>}
            </div>
          )}
          </div>
        )) : <div className={styles.emptyFields}>No parameters required</div>}
        </div>
      )}
      </div>

      <div className={styles.actionsContainer}>
      <button
      className={styles.executeButton}
      onClick={handleSubmit}
      disabled={(jsonMode && jsonError !== null) || Object.keys(formErrors).length > 0 || isLoading}
      >
      {isLoading ? (
        <span className="flex items-center justify-center">
        <LoadingSpinner size="sm" color="#ffffff" />
        <span className="ml-2">Executing...</span>
        </span>
      ) : (
        'Execute'
      )}
      </button>
      </div>
      </>
    )}
    </div>
  );
};

export default MethodForm;
