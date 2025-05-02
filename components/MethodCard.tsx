// components/MethodCard.tsx
import React, { useState, useEffect } from 'react';
import { Service, Method, Field } from './GrpcExplorerApp';
import MethodForm from './MethodForm';
import LoadingSpinner from './LoadingSpinner';
import JsonViewer from './JsonViewer';
import styles from './MethodCard.module.css';

interface MethodCardProps {
  service: Service;
  method: Method;
  endpoint: string;
  useTLS: boolean;
  cacheEnabled: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  isMinimized: boolean;
  isMaximized: boolean;
}

const MethodCard: React.FC<MethodCardProps> = ({
  service,
  method,
  endpoint,
  useTLS,
  cacheEnabled,
  onClose,
  onMinimize,
  onMaximize,
  isMinimized,
  isMaximized
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [methodWithFields, setMethodWithFields] = useState<Method>(method);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [showResponse, setShowResponse] = useState<boolean>(true);

  useEffect(() => {
    fetchMethodFields();
  }, []);

  const fetchMethodFields = async () => {
    if (!method.fields) {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/method?service=${encodeURIComponent(service.service)}&method=${encodeURIComponent(method.name)}&endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
        );

        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else {
          setMethodWithFields({
            ...method,
            fields: data.fields
          });
        }
      } catch (err) {
        console.error('Failed to fetch method fields:', err);
        setError('Failed to load method details');
      } finally {
        setLoading(false);
      }
    } else {
      setMethodWithFields(method);
      setLoading(false);
    }
  };

  const executeQuery = async (params: Record<string, any>) => {
    try {
      setIsExecuting(true);
      setResponse(null);
      setError(null);
      setShowResponse(true);

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          service: service.service,
          method: method.name,
          params,
          useTLS,
          useCache: cacheEnabled
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResponse(data.response);
      }
    } catch (err) {
      console.error('Failed to execute query:', err);
      setError('Failed to execute query');
    } finally {
      setIsExecuting(false);
    }
  };

  const getEndpointDisplay = () => {
    try {
      const parts = endpoint.split(':');
      if (parts.length > 1) {
        return parts[0];
      }
      return endpoint;
    } catch {
      return endpoint;
    }
  };

  const toggleResponse = () => {
    setShowResponse(!showResponse);
  };

  return (
    <div className={`${styles.container} ${isMinimized ? styles.minimized : ''} ${isMaximized ? styles.maximized : ''}`}>
    <div className={styles.header}>
    <div className={styles.headerLeft}>
    <div className={styles.traffic}>
    <button
    className={styles.trafficButton}
    style={{ backgroundColor: '#FF605C' }}
    onClick={onClose}
    title="Close method"
    />
    <button
    className={styles.trafficButton}
    style={{ backgroundColor: '#FFBD44' }}
    onClick={onMinimize}
    title={isMinimized ? "Expand method" : "Minimize method"}
    />
    <button
    className={styles.trafficButton}
    style={{ backgroundColor: '#00CA4E' }}
    onClick={onMaximize}
    title={isMaximized ? "Restore size" : "Maximize method"}
    />
    </div>
    <div className={styles.methodInfo}>
    <div className={styles.methodName}>
    {method.name}
    {response && (
      <button
      onClick={toggleResponse}
      className={styles.responseToggle}
      >
      {showResponse ? 'Hide Response' : 'Show Response'}
      </button>
    )}
    </div>
    <div className={styles.methodDetails}>
    <span className={styles.serviceName}>{service.service}</span>
    <span className={styles.separator}>•</span>
    <span className={styles.endpointName}>{getEndpointDisplay()}</span>
    <span className={`${styles.tag} ${useTLS ? styles.tagTls : styles.tagPlain}`}>
    {useTLS ? 'TLS' : 'Plain'}
    </span>
    </div>
    </div>
    </div>
    </div>

    {!isMinimized && (
      <div className={styles.content}>
      <div className={`${showResponse && response ? styles.splitView : ''}`}>
      <div className={showResponse && response ? styles.formSection : ''}>
      {loading ? (
        <div className={styles.loading}>
        <LoadingSpinner size="md" />
        <span className="mt-2">Loading method details...</span>
        </div>
      ) : error ? (
        <div className={styles.error}>
        {error}
        </div>
      ) : (
        <MethodForm
        service={service}
        method={methodWithFields}
        onExecute={executeQuery}
        isLoading={isExecuting}
        hideButtons={false}
        />
      )}
      </div>

      {showResponse && response && (
        <div className={styles.responseSection}>
        <JsonViewer data={response} />
        </div>
      )}
      </div>
      </div>
    )}
    </div>
  );
};

export default MethodCard;
