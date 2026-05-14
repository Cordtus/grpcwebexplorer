'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
	Copy, Check, FileCode, AlertTriangle, Code2, Terminal,
	CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Save, Network, Binary
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GrpcMethod, GrpcService, GrpcAuthConfig, ExplorerMode } from '@/lib/types/grpc';
import { generateRestUrl } from '@/lib/utils/rest-path-mapper';
import { decodeBinaryValuesForDisplay, isDecodedBinaryValue, type DecodedBinaryValue } from '@/lib/utils/response-decoder';
import {
	generateGrpcurl,
	generateCurl,
	generateTypescriptSnippet,
	generateTypescriptFull,
	generateGoSnippet,
	generateGoFull,
	generatePythonSnippet,
	generatePythonFull,
	CodeGenContext,
} from '@/lib/utils/code-generators';

type MainTab = 'proto' | 'code' | 'results';
type CodeTab = 'curl' | 'grpcurl' | 'typescript' | 'go' | 'python';
type ScaffoldMode = 'simple' | 'full';

interface ExecutionResult {
	methodId: string;
	success: boolean;
	data?: any;
	error?: string;
	timestamp: number;
	duration?: number;
	endpoint?: string;
}

interface MethodDetailPanelProps {
	method: GrpcMethod;
	service: GrpcService;
	color: string;
	endpoint?: string;
	tlsEnabled?: boolean;
	params?: Record<string, any>;
	metadata?: Record<string, string>;
	authConfig?: GrpcAuthConfig | undefined;
	restEndpoint?: string;
	mode?: ExplorerMode | undefined;
	result: ExecutionResult | null;
	isExecuting: boolean;
}

/** Check whether params contain any user-entered values */
function hasNonEmptyParams(params: Record<string, any>): boolean {
	for (const v of Object.values(params)) {
		if (v === undefined || v === null || v === '') continue;
		if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
		if (Array.isArray(v) && v.length === 0) continue;
		return true;
	}
	return false;
}

// ── JsonViewer (inlined from ResultsPanel) ──────────────────────────────

function DecodedBinaryViewer({ value }: { value: DecodedBinaryValue }) {
	return (
		<span className="inline-flex max-w-full flex-col gap-1 rounded border border-primary/20 bg-primary/5 px-2 py-1 align-top">
			<span className="flex flex-wrap items-center gap-2">
				<span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-primary">
					<Binary className="h-3 w-3" />
					base64
				</span>
				<span className="text-muted-foreground">{value.byteLength} bytes</span>
			</span>
			<span className="break-all text-green-600 dark:text-green-400">&quot;{value.original}&quot;</span>
			{value.text ? (
				<span className="break-all text-foreground">
					<span className="text-muted-foreground">decoded text: </span>
					&quot;{value.text}&quot;
				</span>
			) : (
				<span className="break-all text-muted-foreground">
					hex: {value.hexPreview}{value.byteLength > 32 ? ' ...' : ''}
				</span>
			)}
		</span>
	);
}

function JsonViewer({ data, level = 0, path = '' }: { data: any; level?: number; path?: string }) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());

	const toggleExpand = (key: string) => {
		const next = new Set(expanded);
		if (next.has(key)) next.delete(key); else next.add(key);
		setExpanded(next);
	};

	const handleCopyValue = (value: any, key: string) => {
		const text = isDecodedBinaryValue(value)
			? value.text || value.original
			: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
		navigator.clipboard.writeText(text);
		const next = new Set(copiedKeys);
		next.add(key);
		setCopiedKeys(next);
		setTimeout(() => setCopiedKeys(prev => { const s = new Set(prev); s.delete(key); return s; }), 2000);
	};

	if (data === null) return <span className="text-muted-foreground">null</span>;
	if (data === undefined) return <span className="text-muted-foreground">undefined</span>;
	if (isDecodedBinaryValue(data)) return <DecodedBinaryViewer value={data} />;
	if (typeof data === 'string') return <span className="text-green-600 dark:text-green-400 break-all">&quot;{data}&quot;</span>;
	if (typeof data === 'number') return <span className="text-blue-600 dark:text-blue-400">{data}</span>;
	if (typeof data === 'boolean') return <span className="text-purple-600 dark:text-purple-400">{data.toString()}</span>;

	if (Array.isArray(data)) {
		if (data.length === 0) return <span>[]</span>;
		const key = `${path}-array-${level}`;
		const isOpen = level === 0 || expanded.has(key);
		const LIMIT = 100;
		const hasMore = data.length > LIMIT;
		const visible = hasMore ? data.slice(0, LIMIT) : data;

		return (
			<div className="w-full min-w-0 overflow-hidden">
				<div className="flex-center-1 group">
					<button onClick={() => toggleExpand(key)} className="inline-flex items-center hover:bg-muted rounded px-1">
						{isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
						<span className="text-muted-foreground ml-1">[{data.length}]</span>
					</button>
					<button onClick={() => handleCopyValue(data, key)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity" title="Copy array">
						{copiedKeys.has(key) ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
					</button>
				</div>
				{isOpen && (
					<div className="ml-4 mt-1 min-w-0 overflow-hidden">
						{visible.map((item, i) => (
							<div key={i} className="flex items-start min-w-0 overflow-hidden">
								<span className="text-muted-sm mr-2 shrink-0">{i}:</span>
								<div className="flex-1-truncate break-all"><JsonViewer data={item} level={level + 1} path={`${path}[${i}]`} /></div>
							</div>
						))}
						{hasMore && (
							<div className="text-muted-sm italic mt-2 p-2 bg-muted rounded">
								... and {data.length - LIMIT} more items (showing first {LIMIT} of {data.length})
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	if (typeof data === 'object') {
		const entries = Object.entries(data);
		if (entries.length === 0) return <span>{'{}'}</span>;

		return (
			<div className="min-w-0 overflow-hidden">
				{entries.map(([key, value]) => {
					const itemKey = `${path}.${key}`;
					const isOpen = level === 0 || expanded.has(itemKey);
					const isObj = typeof value === 'object' && value !== null && !isDecodedBinaryValue(value);

					return (
						<div key={key} className="mb-1 group min-w-0 overflow-hidden">
							<div className="flex items-start min-w-0">
								{isObj ? (
									<button onClick={() => toggleExpand(itemKey)} className="mr-1 hover:bg-muted rounded p-0.5 shrink-0">
										{isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
									</button>
								) : <span className="w-5 shrink-0" />}
								<span className="text-foreground font-medium shrink-0">{key}:</span>
								<div className="ml-2 flex-1 flex items-start gap-1 min-w-0 overflow-hidden">
									{isObj ? (
										<>
											{isOpen ? (
												<div className="ml-4 flex-1-truncate"><JsonViewer data={value} level={level + 1} path={itemKey} /></div>
											) : (
												<span className="text-muted-foreground">{Array.isArray(value) ? `[${value.length}]` : '{...}'}</span>
											)}
											<button onClick={() => handleCopyValue(value, itemKey)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity shrink-0" title={`Copy ${Array.isArray(value) ? 'array' : 'object'}`}>
												{copiedKeys.has(itemKey) ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
											</button>
										</>
									) : (
										<>
											<div className="flex-1-truncate break-all"><JsonViewer data={value} level={level + 1} path={itemKey} /></div>
											<button onClick={() => handleCopyValue(value, itemKey)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity shrink-0" title="Copy value">
												{copiedKeys.has(itemKey) ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
											</button>
										</>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	return <span>{JSON.stringify(data)}</span>;
}

// ── Main Component ──────────────────────────────────────────────────────

export default function MethodDetailPanel({
	method,
	service,
	color,
	endpoint,
	tlsEnabled,
	params = {},
	metadata = {},
	authConfig,
	restEndpoint,
	mode,
	result,
	isExecuting,
}: MethodDetailPanelProps) {
	const [activeTab, setActiveTab] = useState<MainTab>('proto');
	const [codeTab, setCodeTab] = useState<CodeTab>(mode === 'generic' ? 'grpcurl' : 'curl');
	const [scaffoldMode, setScaffoldMode] = useState<ScaffoldMode>('simple');
	const [copied, setCopied] = useState<string | null>(null);
	const [resultViewMode, setResultViewMode] = useState<'formatted' | 'raw'>('formatted');
	const [resultCopied, setResultCopied] = useState(false);
	const [decodeBinaryValues, setDecodeBinaryValues] = useState(false);

	// Track identity so we can reset tab on method change
	const methodKey = `${service.fullName}.${method.name}`;
	const prevMethodKeyRef = useRef(methodKey);

	// Track previous param state and result to detect transitions
	const prevHadParamsRef = useRef(false);
	const prevResultRef = useRef<ExecutionResult | null>(null);
	const prevExecutingRef = useRef(false);

	// Reset to proto tab when method changes
	useEffect(() => {
		if (prevMethodKeyRef.current !== methodKey) {
			setActiveTab('proto');
			prevMethodKeyRef.current = methodKey;
			prevHadParamsRef.current = false;
			prevResultRef.current = null;
			prevExecutingRef.current = false;
		}
	}, [methodKey]);

	// Auto-switch to code tab when params first become non-empty
	useEffect(() => {
		const hasParams = hasNonEmptyParams(params);
		if (hasParams && !prevHadParamsRef.current && activeTab === 'proto') {
			setActiveTab('code');
		}
		prevHadParamsRef.current = hasParams;
	}, [params, activeTab]);

	// Auto-switch to results tab when execution starts or result arrives
	useEffect(() => {
		if (isExecuting && !prevExecutingRef.current) {
			setActiveTab('results');
		}
		prevExecutingRef.current = isExecuting;
	}, [isExecuting]);

	useEffect(() => {
		if (result && result !== prevResultRef.current) {
			setActiveTab('results');
		}
		prevResultRef.current = result;
	}, [result]);

	// ── Copy helper ─────────────────────────────────────────────────────

	const handleCopy = (text: string, key: string) => {
		navigator.clipboard.writeText(text);
		setCopied(key);
		setTimeout(() => setCopied(null), 2000);
	};

	// ── Proto definition ────────────────────────────────────────────────

	const protoDefinition = `rpc ${method.name}(${method.requestStreaming ? 'stream ' : ''}${method.requestType}) returns (${method.responseStreaming ? 'stream ' : ''}${method.responseType});`;

	// ── Code generation context ─────────────────────────────────────────

	const restBaseUrl = useMemo(() => {
		if (restEndpoint) return restEndpoint;
		if (!endpoint) return 'https://api.example.com';
		const url = endpoint.replace(/:9090$/, ':1317').replace(/:443$/, '');
		if (!url.startsWith('http')) {
			return tlsEnabled !== false ? `https://${url}` : `http://${url}`;
		}
		return url;
	}, [endpoint, tlsEnabled, restEndpoint]);

	const restResult = useMemo(() => {
		return generateRestUrl(service.fullName, method.name, params, restBaseUrl, method.requestTypeDefinition, method.httpRule);
	}, [service.fullName, method.name, params, restBaseUrl, method.requestTypeDefinition, method.httpRule]);

	const codeGenCtx: CodeGenContext = useMemo(() => ({
		serviceName: service.fullName,
		methodName: method.name,
		requestType: method.requestType,
		responseType: method.responseType,
		requestTypeDefinition: method.requestTypeDefinition,
		requestStreaming: method.requestStreaming,
		responseStreaming: method.responseStreaming,
		endpoint: endpoint || 'localhost:9090',
		tlsEnabled: tlsEnabled !== false,
		params,
		metadata,
		...(authConfig ? { authConfig } : {}),
	}), [
		service.fullName, method.name, method.requestType, method.responseType,
		method.requestTypeDefinition, method.requestStreaming, method.responseStreaming,
		endpoint, tlsEnabled, params, metadata, authConfig,
	]);

	const activeCode = useMemo(() => {
		switch (codeTab) {
			case 'grpcurl': return generateGrpcurl(codeGenCtx);
			case 'curl': return generateCurl(codeGenCtx, restBaseUrl, method.httpRule);
			case 'typescript': return scaffoldMode === 'full' ? generateTypescriptFull(codeGenCtx) : generateTypescriptSnippet(codeGenCtx);
			case 'go': return scaffoldMode === 'full' ? generateGoFull(codeGenCtx) : generateGoSnippet(codeGenCtx);
			case 'python': return scaffoldMode === 'full' ? generatePythonFull(codeGenCtx) : generatePythonSnippet(codeGenCtx);
		}
	}, [codeTab, codeGenCtx, restBaseUrl, method.httpRule, scaffoldMode]);

	const curlUnsupported = codeTab === 'curl' && !restResult.supported;
	const hasScaffoldToggle = codeTab === 'typescript' || codeTab === 'go' || codeTab === 'python';
	const displayResultData = useMemo(() => {
		if (!decodeBinaryValues || !result?.data) return result?.data;
		return decodeBinaryValuesForDisplay(result.data);
	}, [decodeBinaryValues, result?.data]);

	const codeTabs: { key: CodeTab; label: string }[] = useMemo(() => {
		const all: { key: CodeTab; label: string }[] = [
			{ key: 'curl', label: 'curl (REST)' },
			{ key: 'grpcurl', label: 'grpcurl' },
			{ key: 'typescript', label: 'TypeScript' },
			{ key: 'go', label: 'Go' },
			{ key: 'python', label: 'Python' },
		];
		if (mode === 'generic') return all.filter(t => t.key !== 'curl');
		return all;
	}, [mode]);

	// ── Results helpers ─────────────────────────────────────────────────

	const handleCopyResult = () => {
		if (result?.data) {
			navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
			setResultCopied(true);
			setTimeout(() => setResultCopied(false), 2000);
		}
	};

	const handleSaveAsJSON = () => {
		if (!result?.data) return;
		const jsonString = JSON.stringify(result.data, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		link.download = `${method.name}_${timestamp}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const formatDuration = (ms?: number) => {
		if (!ms) return 'N/A';
		return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
	};

	const formatTimestamp = (ts: number) => new Date(ts).toLocaleTimeString();

	// ── Main tab definitions ────────────────────────────────────────────

	const mainTabs: { key: MainTab; label: string; icon: React.ReactNode }[] = [
		{ key: 'proto', label: 'Proto', icon: <FileCode className="h-3.5 w-3.5" /> },
		{ key: 'code', label: 'Code', icon: <Code2 className="h-3.5 w-3.5" /> },
		{ key: 'results', label: 'Results', icon: <Terminal className="h-3.5 w-3.5" /> },
	];

	// ── Render ──────────────────────────────────────────────────────────

	return (
		<div className="h-full flex flex-col min-h-0 overflow-hidden bg-card">
			{/* Header: full path + streaming badges */}
			<div className="shrink-0 px-4 pt-3 pb-2 border-b border-border space-y-2">
				<div className="flex items-center gap-3">
					<div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
					<button
						onClick={() => handleCopy(`${service.fullName}.${method.name}`, 'fullpath')}
						className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-foreground hover:bg-muted rounded transition-colors group flex-1 min-w-0"
						title="Click to copy full path"
					>
						<code className="font-mono truncate">{service.fullName}.{method.name}</code>
						{copied === 'fullpath' ? (
							<Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
						) : (
							<Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
						)}
					</button>
					<div className="flex items-center gap-2 shrink-0">
						{method.requestStreaming && (
							<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Client Stream</span>
						)}
						{method.responseStreaming && (
							<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Server Stream</span>
						)}
						{!method.requestStreaming && !method.responseStreaming && (
							<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">Unary</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-4 text-xs pl-5">
					<div className="flex items-center gap-1.5">
						<span className="text-muted-foreground">Request:</span>
						<code className="font-mono font-medium text-blue-400">{method.requestType}</code>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="text-muted-foreground">Response:</span>
						<code className="font-mono font-medium text-green-400">{method.responseType}</code>
					</div>
				</div>
			</div>

			{/* Tab bar */}
			<div className="shrink-0 flex items-center gap-1 px-4 py-1.5 border-b border-border bg-muted/30">
				{mainTabs.map(tab => (
					<button
						key={tab.key}
						onClick={() => setActiveTab(tab.key)}
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors",
							activeTab === tab.key
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground hover:bg-muted"
						)}
					>
						{tab.icon}
						{tab.label}
						{tab.key === 'results' && result && (
							<span className={cn(
								"ml-1 h-1.5 w-1.5 rounded-full",
								result.success ? "bg-green-400" : "bg-red-400"
							)} />
						)}
					</button>
				))}
			</div>

			{/* Tab content */}
			<div className="flex-1 overflow-auto min-h-0 min-w-0">
				{/* ── Proto tab ── */}
				{activeTab === 'proto' && (
					<div className="p-4 space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
								<FileCode className="h-3.5 w-3.5 text-primary" />
								Proto Definition
							</h3>
							<button onClick={() => handleCopy(protoDefinition, 'proto')} className="p-1 hover:bg-muted rounded transition-colors">
								{copied === 'proto' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />}
							</button>
						</div>
						<div className="p-4 bg-muted/50 rounded-lg border border-primary/20 shadow-lg">
							<pre className="text-sm text-blue-100 dark:text-blue-50 font-mono whitespace-pre-wrap leading-relaxed">
								{protoDefinition}
							</pre>
						</div>

						{/* Show response type definition if available */}
						{method.responseTypeDefinition?.fields && method.responseTypeDefinition.fields.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response Fields</h4>
								<div className="p-3 bg-muted/30 rounded-lg border border-border text-xs font-mono space-y-1">
									{method.responseTypeDefinition.fields.map(f => (
										<div key={f.name} className="flex items-center gap-2">
											<span className="text-green-400">{f.type}</span>
											<span className="text-foreground">{f.name}</span>
											{f.rule === 'repeated' && <span className="text-amber-400 text-[10px]">repeated</span>}
												{f.comment && <span className="text-muted-foreground ml-2">{'// '}{f.comment}</span>}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{/* ── Code tab ── */}
				{activeTab === 'code' && (
					<div className="h-full flex flex-col min-h-0">
						{/* Language sub-tabs + scaffold toggle */}
						<div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/50">
							<div className="flex gap-1">
								{codeTabs.map(tab => (
									<button
										key={tab.key}
										onClick={() => setCodeTab(tab.key)}
										className={cn(
											"px-2.5 py-1 text-xs font-semibold rounded transition-colors",
											codeTab === tab.key
												? "bg-primary text-primary-foreground"
												: "text-foreground hover:bg-muted"
										)}
									>
										{tab.label}
									</button>
								))}
							</div>
							<div className="flex items-center gap-1">
								{hasScaffoldToggle && (
									<div className="flex gap-0.5 mr-1">
										<button
											onClick={() => setScaffoldMode('simple')}
											className={cn(
												"px-2 py-1 text-[11px] font-semibold rounded transition-colors",
												scaffoldMode === 'simple' ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
											)}
										>
											Simple
										</button>
										<button
											onClick={() => setScaffoldMode('full')}
											className={cn(
												"px-2 py-1 text-[11px] font-semibold rounded transition-colors",
												scaffoldMode === 'full' ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
											)}
										>
											Full
										</button>
									</div>
								)}
								<button
									onClick={() => handleCopy(activeCode, 'code')}
									className="p-1 hover:bg-muted rounded transition-colors"
									disabled={curlUnsupported}
								>
									{copied === 'code' ? (
										<Check className="h-3.5 w-3.5 text-green-500" />
									) : (
										<Copy className={cn(
											"h-3.5 w-3.5 transition-colors",
											curlUnsupported ? "text-muted-foreground/50" : "text-muted-foreground hover:text-foreground"
										)} />
									)}
								</button>
							</div>
						</div>

						{/* Code display */}
						<div className="flex-1 overflow-auto min-h-0 p-4 code-snippet-scroll">
							<div className="p-4 bg-muted/50 rounded-lg border border-primary/20 shadow-lg">
								<pre className={cn(
									"text-xs font-mono whitespace-pre leading-relaxed",
									curlUnsupported ? "text-muted-foreground" : "text-blue-100 dark:text-blue-50"
								)}>
									{activeCode}
								</pre>
							</div>
							{codeTab === 'curl' && (restResult.warning || !restResult.supported) && (
								<div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-500">
									<AlertTriangle className="h-3 w-3" />
									<span>{restResult.warning || 'No REST endpoint for this method'}</span>
								</div>
							)}
						</div>
					</div>
				)}

				{/* ── Results tab ── */}
				{activeTab === 'results' && (
					<div className="h-full flex flex-col min-h-0">
						{/* Results toolbar */}
						{result && (
							<div className="shrink-0 flex flex-col gap-2 px-4 py-2 border-b border-border/50 sm:flex-row sm:items-center sm:justify-between">
								<div className={cn(result.success ? "status-success" : "status-error", "min-w-0 flex-wrap px-2 py-1.5")}>
									{result.success ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
									<span className="text-xs font-medium">{result.success ? 'Success' : 'Failed'}</span>
									<span className="text-muted-foreground text-[11px] ml-2">{formatDuration(result.duration)}</span>
									{result.endpoint && (
										<span className="min-w-0 max-w-full truncate text-muted-foreground text-[11px] ml-2 font-mono sm:max-w-[12rem]">{result.endpoint}</span>
									)}
								</div>
								<div className="flex flex-wrap items-center justify-end gap-1">
									<div className="flex gap-1 mr-1">
										<button
											onClick={() => setResultViewMode('formatted')}
											className={cn(
												"px-2 py-1 text-xs rounded transition-colors",
												resultViewMode === 'formatted' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
											)}
										>
											Formatted
										</button>
										<button
											onClick={() => setResultViewMode('raw')}
											className={cn(
												"px-2 py-1 text-xs rounded transition-colors",
												resultViewMode === 'raw' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
											)}
										>
											Raw
										</button>
									</div>
									<button
										onClick={() => setDecodeBinaryValues((enabled) => !enabled)}
										aria-label="Decode base64 and binary values"
										aria-pressed={decodeBinaryValues}
										className={cn(
											"inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
											decodeBinaryValues
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground hover:bg-muted/70"
										)}
										title="Decode base64 and binary-looking values in the formatted response view"
									>
										<Binary className="h-3.5 w-3.5" />
										<span className="hidden sm:inline">Decode</span>
									</button>
									<button onClick={handleSaveAsJSON} className="icon-btn" title="Save as JSON file">
										<Save className="h-4 w-4 text-muted-foreground" />
									</button>
									<button onClick={handleCopyResult} className="icon-btn" title="Copy entire response">
										{resultCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
									</button>
								</div>
							</div>
						)}

						{/* Results content */}
						<div className="flex-1 overflow-auto min-h-0 min-w-0 w-full">
							<div className="p-4 w-full max-w-full overflow-hidden">
								{isExecuting ? (
									<div className="h-full flex items-center justify-center py-12">
										<div className="text-center">
											<Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
											<p className="text-sm text-muted-foreground">Executing {method.name}...</p>
										</div>
									</div>
								) : result ? (
									<div className="space-y-4">
										{/* Metadata */}
										<div className="grid grid-cols-2 gap-2 text-muted-sm">
											<div className="flex-center-1">
												<Clock className="h-3 w-3" />
												<span>{formatTimestamp(result.timestamp)}</span>
											</div>
											<div className="text-right">Duration: {formatDuration(result.duration)}</div>
										</div>

										{/* Error or Data */}
										{result.error ? (
											<div className="status-error">
												<h3 className="section-header mb-2">Error</h3>
												<pre className="text-xs whitespace-pre-wrap font-mono">{result.error}</pre>
											</div>
										) : result.data ? (
											<div className="panel-section overflow-hidden">
												<h3 className="section-header mb-2">Response Data</h3>
												{resultViewMode === 'formatted' ? (
													<div className="text-xs font-mono overflow-x-auto min-w-0 w-full">
														<JsonViewer data={displayResultData} />
													</div>
												) : (
													<pre className="text-xs text-foreground whitespace-pre font-mono bg-muted/50 p-3 rounded overflow-x-auto min-w-0">
														{JSON.stringify(result.data, null, 2)}
													</pre>
												)}
											</div>
										) : (
											<div className="text-center text-muted-foreground py-4">
												<p className="text-sm">No response data</p>
											</div>
										)}
									</div>
								) : (
									<div className="flex items-center justify-center py-12 text-muted-foreground">
										<div className="text-center">
											<div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
												<Terminal className="h-6 w-6 opacity-50" />
											</div>
											<p className="text-sm">No execution results yet</p>
											<p className="text-muted-sm mt-1">Execute the method to see results here</p>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// ── Empty state placeholder (no method selected) ───────────────────────

export function MethodDetailPanelEmpty() {
	return (
		<div className="h-full flex items-center justify-center bg-card text-muted-foreground">
			<div className="text-center">
				<Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
				<p className="text-sm">Select a method to view details</p>
				<p className="text-muted-sm mt-1">Proto definition, code snippets, and execution results</p>
			</div>
		</div>
	);
}
