// components/MethodCard.tsx
import React, { useState, useEffect } from 'react';
import { Service, Method } from './GrpcExplorerApp';
import MethodForm from './MethodForm';
import LoadingSpinner from './LoadingSpinner';
import JsonViewer from './JsonViewer';
import { fetchMethodFields, executeGrpcCall, getEndpointDisplay } from '@/utils/grpcHelpers';
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

  // Fetch method fields when component mounts
  useEffect(() => {
    const loadMethodFields = async () => {
      if (!method.fields) {
        try {
          setLoading(true);
          setError(null);
          
          const { error: fieldsError, fields } = await fetchMethodFields(
            service, method, endpoint, useTLS, cacheEnabled
          );
          
          if (fieldsError) {
            setError(fieldsError);
          } else if (fields) {
            setMethodWithFields({
              ...method,
              fields
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

    loadMethodFields();
  }, [method, service, endpoint, useTLS, cacheEnabled]);

  const executeQuery = async (params: Record<string, any>) => {
    try {
      setIsExecuting(true);
      setResponse(null);
      setError(null);
      setShowResponse(true);

      const { error: execError, data } = await executeGrpcCall(
        endpoint, 
        service.service, 
        method.name, 
        params, 
        useTLS, 
        cacheEnabled
      );

      if (execError) {
        setError(execError);
      } else {
        setResponse(data);
      }
    } catch (err) {
      console.error('Failed to execute query:', err);
      setError('Failed to execute query');
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleResponse = () => {
    setShowResponse(!showResponse);
  };

  return (
    <div className={`bg-dark-surface border border-dark-border rounded-md mb-4 overflow-hidden transition-all ${
      isMinimized ? 'h-12' : ''
    } ${isMaximized ? 'flex-grow' : 'flex-none'}`}>
      <div className="flex justify-between items-center px-4 py-2 bg-dark-highlight">
        <div className="flex items-center">
          <div className="flex gap-2 mr-3">
            <button
              className="w-3 h-3 rounded-full bg-error-red hover:bg-opacity-80 transition"
              onClick={onClose}
              title="Close method"
            />
            <button
              className="w-3 h-3 rounded-full bg-warning-yellow hover:bg-opacity-80 transition"
              onClick={onMinimize}
              title={isMinimized ? "Expand method" : "Minimize method"}
            />
            <button
              className="w-3 h-3 rounded-full bg-success-green hover:bg-opacity-80 transition"
              onClick={onMaximize}
              title={isMaximized ? "Restore size" : "Maximize method"}
            />
          </div>
          <div>
            <div className="flex items-center">
              <span className="font-medium text-text-primary">{method.name}</span>
              {response && (
                <button 
                  onClick={toggleResponse}
                  className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-accent text-white"
                >
                  {showResponse ? 'Hide Response' : 'Show Response'}
                </button>
              )}
            </div>
            <div className="flex text-xs text-text-secondary">
              <span className="truncate max-w-[200px]">{service.service}</span>
              <span className="mx-1">•</span>
              <span className="text-blue-accent">{getEndpointDisplay(endpoint)}</span>
              <span className={`ml-1 px-1 rounded ${useTLS ? 'bg-success-green/20 text-success-green' : 'bg-warning-yellow/20 text-warning-yellow'}`}>
                {useTLS ? 'TLS' : 'Plain'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isMinimized && (
        <div className={`transition-all ${showResponse && response ? 'flex flex-col md:flex-row' : ''}`}>
          <div className={`${showResponse && response ? 'w-full md:w-1/2 border-r border-dark-border' : 'w-full'}`}>
            {loading ? (
              <div className="flex flex-col items-center justify-center p-8">
                <LoadingSpinner size="md" />
                <span className="text-text-secondary mt-2">Loading method details...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-error-red text-sm">
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
            <div className={`w-full md:w-1/2 max-h-[500px] overflow-auto`}>
              <JsonViewer data={response} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MethodCard;