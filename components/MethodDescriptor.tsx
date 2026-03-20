'use client';

import React, { useState, useMemo } from 'react';
import { Copy, Check, FileCode, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GrpcMethod, GrpcService, ExplorerMode } from '@/lib/types/grpc';
import { generateRestUrl } from '@/lib/utils/rest-path-mapper';
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

type CodeTab = 'curl' | 'grpcurl' | 'typescript' | 'go' | 'python';
type ScaffoldMode = 'simple' | 'full';

interface MethodDescriptorProps {
	method: GrpcMethod;
	service: GrpcService;
	color: string;
	endpoint?: string;
	tlsEnabled?: boolean;
	params?: Record<string, any>;
	restEndpoint?: string;
	mode?: ExplorerMode | undefined;
}

export default function MethodDescriptor({
	method,
	service,
	color,
	endpoint,
	tlsEnabled,
	params = {},
	restEndpoint,
	mode,
}: MethodDescriptorProps) {
	const [copied, setCopied] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<CodeTab>(
		mode === 'generic' ? 'grpcurl' : 'curl'
	);
	const [scaffoldMode, setScaffoldMode] = useState<ScaffoldMode>('simple');

	const handleCopy = (text: string, key: string) => {
		navigator.clipboard.writeText(text);
		setCopied(key);
		setTimeout(() => setCopied(null), 2000);
	};

	// Generate proto definition
	const protoDefinition = `rpc ${method.name}(${method.requestStreaming ? 'stream ' : ''}${method.requestType}) returns (${method.responseStreaming ? 'stream ' : ''}${method.responseType});`;

	// Derive REST endpoint from gRPC endpoint (port 9090 -> 1317)
	const restBaseUrl = useMemo(() => {
		if (restEndpoint) return restEndpoint;
		if (!endpoint) return 'https://api.example.com';
		const url = endpoint.replace(/:9090$/, ':1317').replace(/:443$/, '');
		if (!url.startsWith('http')) {
			return tlsEnabled !== false ? `https://${url}` : `http://${url}`;
		}
		return url;
	}, [endpoint, tlsEnabled, restEndpoint]);

	// Generate REST curl example using method descriptor and HTTP annotation
	const restResult = useMemo(() => {
		return generateRestUrl(
			service.fullName,
			method.name,
			params,
			restBaseUrl,
			method.requestTypeDefinition,
			method.httpRule
		);
	}, [service.fullName, method.name, params, restBaseUrl, method.requestTypeDefinition, method.httpRule]);

	// Build code generation context from props
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
		metadata: {},
	}), [
		service.fullName,
		method.name,
		method.requestType,
		method.responseType,
		method.requestTypeDefinition,
		method.requestStreaming,
		method.responseStreaming,
		endpoint,
		tlsEnabled,
		params,
	]);

	// Generate code for the active tab
	const activeCode = useMemo(() => {
		switch (activeTab) {
			case 'grpcurl':
				return generateGrpcurl(codeGenCtx);
			case 'curl':
				return generateCurl(codeGenCtx, restBaseUrl, method.httpRule);
			case 'typescript':
				return scaffoldMode === 'full'
					? generateTypescriptFull(codeGenCtx)
					: generateTypescriptSnippet(codeGenCtx);
			case 'go':
				return scaffoldMode === 'full'
					? generateGoFull(codeGenCtx)
					: generateGoSnippet(codeGenCtx);
			case 'python':
				return scaffoldMode === 'full'
					? generatePythonFull(codeGenCtx)
					: generatePythonSnippet(codeGenCtx);
		}
	}, [activeTab, codeGenCtx, restBaseUrl, method.httpRule, scaffoldMode]);

	// Whether the curl (REST) tab has no valid mapping
	const curlUnsupported = activeTab === 'curl' && !restResult.supported;

	// Tabs that support scaffold mode toggling
	const hasScaffoldToggle = activeTab === 'typescript' || activeTab === 'go' || activeTab === 'python';

	// All available tabs (curl hidden in generic mode)
	const tabs: { key: CodeTab; label: string }[] = useMemo(() => {
		const allTabs: { key: CodeTab; label: string }[] = [
			{ key: 'curl', label: 'curl (REST)' },
			{ key: 'grpcurl', label: 'grpcurl' },
			{ key: 'typescript', label: 'TypeScript' },
			{ key: 'go', label: 'Go' },
			{ key: 'python', label: 'Python' },
		];
		if (mode === 'generic') {
			return allTabs.filter(t => t.key !== 'curl');
		}
		return allTabs;
	}, [mode]);

	return (
		<div className="h-full flex flex-col p-4 bg-background">
			{/* Header with Full Path */}
			<div className="mb-4 space-y-3">
				{/* Full Path - Copyable */}
				<div className="flex items-center gap-3">
					<div
						className="h-2 w-2 rounded-full shrink-0"
						style={{ backgroundColor: color }}
					/>
					<button
						onClick={() => handleCopy(`${service.fullName}.${method.name}`, 'fullpath')}
						className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded transition-colors group flex-1 min-w-0"
						title="Click to copy full path"
					>
						<code className="font-mono truncate">{service.fullName}.{method.name}</code>
						{copied === 'fullpath' ? (
							<Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
						) : (
							<Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
						)}
					</button>

					{/* Streaming badges */}
					<div className="flex items-center gap-2 shrink-0">
						{method.requestStreaming && (
							<span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
								Client Stream
							</span>
						)}
						{method.responseStreaming && (
							<span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
								Server Stream
							</span>
						)}
						{!method.requestStreaming && !method.responseStreaming && (
							<span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
								Unary
							</span>
						)}
					</div>
				</div>

				{/* Request/Response Types */}
				<div className="flex items-center gap-4 text-xs pl-5">
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Request:</span>
						<code className="font-mono font-medium text-blue-400 break-all">
							{method.requestType}
						</code>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Response:</span>
						<code className="font-mono font-medium text-green-400 break-all">
							{method.responseType}
						</code>
					</div>
				</div>
			</div>

			{/* Content Grid - 2 columns */}
			<div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
				{/* Proto Definition */}
				<div className="flex flex-col min-h-0">
					<div className="shrink-0 flex items-center justify-between mb-2">
						<h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
							<FileCode className="h-3.5 w-3.5 text-primary" />
							Proto Definition
						</h3>
						<button
							onClick={() => handleCopy(protoDefinition, 'proto')}
							className="p-1 hover:bg-muted rounded transition-colors"
						>
							{copied === 'proto' ? (
								<Check className="h-3.5 w-3.5 text-green-500" />
							) : (
								<Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
							)}
						</button>
					</div>
					<div className="flex-1 overflow-auto min-h-0">
						<div className="p-4 bg-muted/50 rounded-lg border border-primary/20 shadow-lg">
							<pre className="text-sm text-blue-100 dark:text-blue-50 font-mono whitespace-pre-wrap leading-relaxed">
								{protoDefinition}
							</pre>
						</div>
					</div>
				</div>

				{/* Examples */}
				<div className="flex flex-col min-h-0">
					<div className="shrink-0 flex items-center justify-between mb-2">
						<div className="flex gap-1">
							{tabs.map(tab => (
								<button
									key={tab.key}
									onClick={() => setActiveTab(tab.key)}
									className={cn(
										"px-2.5 py-1 text-xs font-semibold rounded transition-colors",
										activeTab === tab.key
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
											scaffoldMode === 'simple'
												? "bg-primary text-primary-foreground"
												: "text-foreground hover:bg-muted"
										)}
									>
										Simple
									</button>
									<button
										onClick={() => setScaffoldMode('full')}
										className={cn(
											"px-2 py-1 text-[11px] font-semibold rounded transition-colors",
											scaffoldMode === 'full'
												? "bg-primary text-primary-foreground"
												: "text-foreground hover:bg-muted"
										)}
									>
										Full
									</button>
								</div>
							)}
							<button
								onClick={() => handleCopy(activeCode, activeTab)}
								className="p-1 hover:bg-muted rounded transition-colors"
								disabled={curlUnsupported}
							>
								{copied === activeTab ? (
									<Check className="h-3.5 w-3.5 text-green-500" />
								) : (
									<Copy className={cn(
										"h-3.5 w-3.5 transition-colors",
										curlUnsupported
											? "text-muted-foreground/50"
											: "text-muted-foreground hover:text-foreground"
									)} />
								)}
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-auto min-h-0 code-snippet-scroll">
						<div className="p-4 bg-muted/50 rounded-lg border border-primary/20 shadow-lg">
							<pre className={cn(
								"text-xs font-mono whitespace-pre leading-relaxed",
								curlUnsupported
									? "text-muted-foreground"
									: "text-blue-100 dark:text-blue-50"
							)}>
								{activeCode}
							</pre>
						</div>
					</div>
					{activeTab === 'curl' && (restResult.warning || !restResult.supported) && (
						<div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-500">
							<AlertTriangle className="h-3 w-3" />
							<span>{restResult.warning || 'No REST endpoint for this method'}</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
