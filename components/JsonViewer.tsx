// JsonViewer.tsx
import React, { useState } from 'react';
import styles from './JsonViewer.module.css';

interface JsonViewerProps {
  data: any;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [filter, setFilter] = useState<string>('');
  const [isPanelMinimized, setIsPanelMinimized] = useState<boolean>(false);
  const [isPanelFullWidth, setIsPanelFullWidth] = useState<boolean>(false);

  const toggleNode = (path: string) => {
    setExpandedNodes((prevNodes) => {
      const newNodes = new Set(prevNodes);
      newNodes.has(path) ? newNodes.delete(path) : newNodes.add(path);
      return newNodes;
    });
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    const findAllPaths = (obj: any, currentPath = 'root') => {
      if (typeof obj !== 'object' || obj === null) return;
      allPaths.add(currentPath);
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            findAllPaths(item, `${currentPath}.${index}`);
          }
        });
      } else {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            findAllPaths(obj[key], `${currentPath}.${key}`);
          }
        });
      }
    };
    findAllPaths(data);
    setExpandedNodes(allPaths);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set(['root']));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const handleMinimizePanel = () => setIsPanelMinimized(!isPanelMinimized);
  const handleMaximizePanel = () => setIsPanelFullWidth(!isPanelFullWidth);
  const handleClosePanel = () => setIsPanelMinimized(true);

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
  };

  const getNodeColor = (value: any): string => {
    if (value === null) return styles.nullValue;
    if (value === undefined) return styles.undefinedValue;
    if (typeof value === 'boolean') return styles.booleanValue;
    if (typeof value === 'number') return styles.numberValue;
    if (typeof value === 'string') return styles.stringValue;
    return '';
  };

  const matchesFilter = (key: string, value: any): boolean => {
    if (!filter) return true;
    const searchTerm = filter.toLowerCase();
    const keyMatches = key.toLowerCase().includes(searchTerm);
    const valueMatches = typeof value === 'string' && value.toLowerCase().includes(searchTerm);
    return keyMatches || valueMatches;
  };

  const renderNode = (key: string, value: any, path: string, isArrayItem = false) => {
    const isExpandable = typeof value === 'object' && value !== null;
    const isExpanded = expandedNodes.has(path);
    const isArray = Array.isArray(value);

    if (!matchesFilter(key, value) && !isExpandable) return null;

    return (
      <div key={path} className={styles.node}>
      <div
      className={`${styles.nodeHeader} ${isArrayItem ? styles.arrayItem : ''}`}
      onClick={() => isExpandable && toggleNode(path)}
      >
      {isExpandable && (
        <span className={styles.expandIcon}>
        {isExpanded ? '▼' : '▶'}
        </span>
      )}
      {key !== '' && (
        <>
        <span className={styles.key}>{isArrayItem ? `[${key}]` : key}</span>
        <span className={styles.colon}>: </span>
        </>
      )}
      {isExpandable ? (
        <span className={styles.preview}>
        {isArray ? `Array(${value.length})` : `Object{${Object.keys(value).length}}`}
        </span>
      ) : (
        <span className={`${styles.value} ${getNodeColor(value)}`}>
        {formatValue(value)}
        </span>
      )}
      </div>
      {isExpandable && isExpanded && (
        <div className={styles.nodeChildren}>
        {isArray
          ? value.map((item: any, index: number) =>
          renderNode(String(index), item, `${path}.${index}`, true)
          )
          : Object.entries(value).map(([childKey, childValue]) =>
          renderNode(childKey, childValue, `${path}.${childKey}`)
          )}
          </div>
      )}
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${isPanelMinimized ? styles.minimized : ''} ${isPanelFullWidth ? styles.fullWidth : ''}`}>
    <div className={styles.header}>
    <div className={styles.headerControls}>
    <div className={styles.traffic}>
    <button
    className={styles.trafficButton}
    style={{ backgroundColor: '#FF605C' }}
    onClick={handleClosePanel}
    title="Minimize panel"
    aria-label="Minimize panel"
    />
    <button
    className={styles.trafficButton}
    style={{ backgroundColor: '#FFBD44' }}
    onClick={handleMinimizePanel}
    title={isPanelMinimized ? 'Restore panel' : 'Minimize panel'}
    aria-label={isPanelMinimized ? 'Restore panel' : 'Minimize panel'}
    />
    <button
    className={styles.trafficButton}
    style={{ backgroundColor: '#00CA4E' }}
    onClick={handleMaximizePanel}
    title={isPanelFullWidth ? 'Restore panel size' : 'Maximize panel'}
    aria-label={isPanelFullWidth ? 'Restore panel size' : 'Maximize panel'}
    />
    </div>
    <div className={styles.headerTitle}>Response</div>
    </div>

    <div className={styles.toolbar}>
    <div className={styles.searchContainer}>
    <input
    type="text"
    value={filter}
    onChange={(e) => setFilter(e.target.value)}
    placeholder="Filter..."
    className={styles.searchInput}
    />
    </div>
    <div className={styles.actionButtons}>
    <button onClick={expandAll} className={styles.button}>Expand All</button>
    <button onClick={collapseAll} className={styles.button}>Collapse All</button>
    <button onClick={copyToClipboard} className={styles.button}>Copy</button>
    </div>
    </div>
    </div>

    <div className={styles.body}>
    {renderNode('', data, 'root')}
    </div>
    </div>
  );
};

export default JsonViewer;
