'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, ChevronDown, Search, Loader2, History, Database, Globe, Link, AlertTriangle, Lock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { debug } from '@/lib/utils/debug';
import { listCachedChains, type CachedChainInfo } from '@/lib/utils/client-cache';
import EndpointSelector, { createEndpointConfigs } from './EndpointSelector';
import { EndpointConfig, ExplorerMode, GrpcAuthConfig, BufBsrSource } from '@/lib/types/grpc';

interface AddNetworkDialogProps {
	onAdd: (
		endpoint: string,
		tlsEnabled: boolean,
		endpointConfigs?: EndpointConfig[],
		mode?: ExplorerMode,
		bsrSource?: BufBsrSource,
		authConfig?: GrpcAuthConfig
	) => void;
	onClose: () => void;
	defaultMode?: ExplorerMode | undefined;
}

interface BsrModule {
	name: string;
	owner: string;
	description: string;
	visibility: string;
}

interface ChainData {
	chain_name: string;
	chain_id: string;
	pretty_name: string;
	grpc_endpoints: Array<{ address: string; provider?: string }>;
}

const AddNetworkDialog: React.FC<AddNetworkDialogProps> = ({ onAdd, onClose, defaultMode }) => {
	const [mode, setMode] = useState<ExplorerMode>(defaultMode || 'generic');
	const [endpoint, setEndpoint] = useState('');
	const [tlsEnabled, setTlsEnabled] = useState(true);
	const [showDropdown, setShowDropdown] = useState(false);
	const [showCachedChains, setShowCachedChains] = useState(false);
	const [cachedChains, setCachedChains] = useState<CachedChainInfo[]>([]);
	const [chains, setChains] = useState<string[]>([]);
	const [filteredChains, setFilteredChains] = useState<string[]>([]);
	const [loadingChains, setLoadingChains] = useState(false);
	const [loadingChainData, setLoadingChainData] = useState(false);
	const [selectedChainDetails, setSelectedChainDetails] = useState<ChainData | null>(null);
	const [endpointConfigs, setEndpointConfigs] = useState<EndpointConfig[]>([]);
	const [validatingEndpoints, setValidatingEndpoints] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Generic mode: BSR state
	const [genericSourceTab, setGenericSourceTab] = useState<'endpoint' | 'bsr'>('endpoint');
	const [bsrModule, setBsrModule] = useState('');
	const [bsrVersion, setBsrVersion] = useState('main');
	const [bsrAuthToken, setBsrAuthToken] = useState('');
	const [bsrEndpoint, setBsrEndpoint] = useState('');
	const [bsrTlsEnabled, setBsrTlsEnabled] = useState(true);
	const [bsrOrgInput, setBsrOrgInput] = useState('');
	const [bsrModules, setBsrModules] = useState<BsrModule[]>([]);
	const [bsrPopularModules, setBsrPopularModules] = useState<BsrModule[]>([]);
	const [loadingBsrModules, setLoadingBsrModules] = useState(false);

	// Generic mode: auth state
	const [authType, setAuthType] = useState<'none' | 'bearer' | 'api-key' | 'mtls'>('none');
	const [bearerToken, setBearerToken] = useState('');
	const [apiKeyHeader, setApiKeyHeader] = useState('');
	const [apiKeyValue, setApiKeyValue] = useState('');
	const [clientCert, setClientCert] = useState('');
	const [clientKey, setClientKey] = useState('');

	// Detect potential TLS configuration mismatch
	const tlsWarning = useMemo(() => {
		// Skip check for chain: markers (backend handles TLS)
		if (endpoint.startsWith('chain:')) return null;
		if (!endpoint.trim()) return null;

		// Extract port from endpoint
		const portMatch = endpoint.match(/:(\d+)$/);
		if (!portMatch) return null;

		const port = portMatch[1];

		// Port 443 but TLS OFF - likely misconfigured
		if (port === '443' && !tlsEnabled) {
			return 'Port 443 typically requires TLS enabled';
		}

		// Non-443 port but TLS ON - may be misconfigured
		if (port !== '443' && tlsEnabled) {
			return 'Non-443 ports typically use plaintext (TLS off)';
		}

		return null;
	}, [endpoint, tlsEnabled]);

	// Load cached chains on mount
	useEffect(() => {
		const cached = listCachedChains();
		setCachedChains(cached);
	}, []);

	// Load popular BSR modules on mount
	useEffect(() => {
		fetch('/api/bsr/modules?popular=true')
			.then(res => res.json())
			.then(data => setBsrPopularModules(data.modules || []))
			.catch(() => {});
	}, []);

	// Search BSR org modules
	const searchBsrOrg = async (org: string) => {
		if (!org.trim()) { setBsrModules([]); return; }
		setLoadingBsrModules(true);
		try {
			const res = await fetch(`/api/bsr/modules?owner=${encodeURIComponent(org.trim())}`);
			const data = await res.json();
			setBsrModules(data.modules || []);
		} catch {
			setBsrModules([]);
		} finally {
			setLoadingBsrModules(false);
		}
	};

	/** Build auth config from current state */
	const buildAuthConfig = (): GrpcAuthConfig | undefined => {
		if (authType === 'none') return undefined;
		const config: GrpcAuthConfig = { type: authType };
		if (authType === 'bearer') config.bearerToken = bearerToken;
		if (authType === 'api-key') { config.apiKeyHeader = apiKeyHeader; config.apiKeyValue = apiKeyValue; }
		if (authType === 'mtls') { config.clientCert = clientCert; config.clientKey = clientKey; }
		return config;
	};

	// Fetch chains from registry on mount
	useEffect(() => {
		if (chains.length === 0) {
			setLoadingChains(true);
			fetch('/api/chains')
				.then(res => res.json())
				.then(data => {
					setChains(data.chains || []);
					setFilteredChains(data.chains || []);
				})
				.catch(err => console.error('Failed to fetch chains:', err))
				.finally(() => setLoadingChains(false));
		}
	}, [chains.length]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
				inputRef.current && !inputRef.current.contains(e.target as Node)) {
				setShowDropdown(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Helper to detect if input looks like a URL/endpoint
	const isEndpointFormat = (input: string): boolean => {
		return (
			input.includes(':') || // Has port
			input.includes('.') || // Has domain separator
			input.startsWith('http://') ||
			input.startsWith('https://') ||
			input.startsWith('chain:') // Chain marker
		);
	};

	// Filter chains based on input
	const handleInputChange = (value: string) => {
		setEndpoint(value);
		setSelectedChainDetails(null);

		if (isEndpointFormat(value)) {
			// Direct endpoint mode - hide dropdown
			setShowDropdown(false);
			setFilteredChains(chains);
		} else if (value.trim()) {
			// Chain search mode - filter and show dropdown
			const query = value.toLowerCase();
			const matches = chains.filter(chain =>
				chain.toLowerCase().includes(query)
			);
			setFilteredChains(matches);
			setShowDropdown(true);
		} else {
			// Empty - show all chains
			setFilteredChains(chains);
			setShowDropdown(true);
		}
	};

	// Add network with the current settings
	const addNetwork = (finalEndpoint: string, tls: boolean, configs?: EndpointConfig[], bsrSource?: BufBsrSource) => {
		onAdd(finalEndpoint, tls, configs, mode, bsrSource, buildAuthConfig());
		setEndpoint('');
		setTlsEnabled(true);
		setShowDropdown(false);
		setShowCachedChains(false);
		setSelectedChainDetails(null);
		setEndpointConfigs([]);
		setValidatingEndpoints(false);
		onClose();
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (endpoint.trim()) {
			let finalEndpoint = endpoint.trim();

			// Auto-detect chain names: if it's not in endpoint format and matches a chain, prefix with "chain:"
			if (!isEndpointFormat(finalEndpoint) && chains.includes(finalEndpoint.toLowerCase())) {
				finalEndpoint = `chain:${finalEndpoint.toLowerCase()}`;
				debug.log(`Auto-detected chain name, using: ${finalEndpoint}`);
			}

			addNetwork(finalEndpoint, tlsEnabled);
		}
	};

	const handleCancel = () => {
		setEndpoint('');
		setTlsEnabled(true);
		setShowDropdown(false);
		setShowCachedChains(false);
		setSelectedChainDetails(null);
		setEndpointConfigs([]);
		setValidatingEndpoints(false);
		onClose();
	};

	// Select a cached chain directly
	const selectCachedChain = (cached: CachedChainInfo) => {
		setEndpoint(cached.endpoint);
		setTlsEnabled(cached.tlsEnabled);
		setShowCachedChains(false);
		setShowDropdown(false);
		debug.log(`Selected cached chain: ${cached.chainId || cached.endpoint}`);
	};

	// Validate endpoints by checking DNS resolution
	const validateEndpoints = async (configs: EndpointConfig[]): Promise<EndpointConfig[]> => {
		if (configs.length === 0) return configs;

		setValidatingEndpoints(true);
		try {
			const addresses = configs.map(c => c.address);
			const response = await fetch('/api/grpc/validate-endpoints', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoints: addresses })
			});

			if (!response.ok) {
				console.error('Endpoint validation failed');
				return configs;
			}

			const { results } = await response.json();

			// Update configs with validation results and auto-deselect unreachable
			const updatedConfigs = configs.map((config, index) => {
				const validation = results[index];
				return {
					...config,
					reachable: validation?.reachable ?? undefined,
					validationError: validation?.error,
					// Auto-deselect unreachable endpoints
					selected: validation?.reachable !== false ? config.selected : false
				};
			});

			const reachableCount = updatedConfigs.filter(c => c.reachable === true).length;
			const unreachableCount = updatedConfigs.filter(c => c.reachable === false).length;
			debug.log(`Validation complete: ${reachableCount} reachable, ${unreachableCount} unreachable`);

			return updatedConfigs;
		} catch (error) {
			console.error('Error validating endpoints:', error);
			return configs;
		} finally {
			setValidatingEndpoints(false);
		}
	};

	// Select chain from dropdown - always load endpoint details with validation
	const selectChainFromDropdown = async (chainName: string) => {
		setShowDropdown(false);
		const chainMarker = `chain:${chainName}`;
		setEndpoint(chainMarker);
		setTlsEnabled(true);
		setLoadingChainData(true);

		try {
			const response = await fetch(`/api/chains?name=${chainName}`);
			const data = await response.json();

			if (data.error) {
				console.error('Error fetching chain data:', data.error);
				return;
			}

			const grpcEndpoints = data.apis?.grpc || [];
			const chainDetails: ChainData = {
				chain_name: data.info.chain_name,
				chain_id: data.info.chain_id,
				pretty_name: data.info.pretty_name,
				grpc_endpoints: grpcEndpoints.map((ep: any) => ({
					address: ep.address,
					provider: ep.provider
				}))
			};

			setSelectedChainDetails(chainDetails);

			// Always create endpoint configs with intelligent TLS detection
			const configs = createEndpointConfigs(chainDetails.grpc_endpoints);
			setEndpointConfigs(configs);
			debug.log(`Loaded ${configs.length} endpoints for ${chainName} with per-endpoint TLS`);

			// Validate endpoints in background and update state
			setLoadingChainData(false);
			const validatedConfigs = await validateEndpoints(configs);
			setEndpointConfigs(validatedConfigs);
		} catch (error) {
			console.error('Error fetching chain data:', error);
			setLoadingChainData(false);
		}
	};

	// Add chain with selected endpoints
	const addWithSelectedEndpoints = () => {
		if (!selectedChainDetails || endpointConfigs.length === 0) return;

		const selectedEndpoints = endpointConfigs.filter(ep => ep.selected);
		if (selectedEndpoints.length === 0) {
			debug.warn('No endpoints selected for round-robin');
			return;
		}

		const chainMarker = `chain:${selectedChainDetails.chain_name}`;
		const primaryTls = selectedEndpoints[0].tlsEnabled;
		addNetwork(chainMarker, primaryTls, selectedEndpoints);
		debug.log(`Adding ${selectedChainDetails.pretty_name} with ${selectedEndpoints.length} selected endpoints`);
	};

	// Count of selected endpoints for round-robin
	const selectedEndpointCount = useMemo(
		() => endpointConfigs.filter(ep => ep.selected).length,
		[endpointConfigs]
	);

	/** Handle BSR module add */
	const handleBsrAdd = () => {
		if (!bsrModule.trim()) return;
		const bsrSource: BufBsrSource = {
			module: bsrModule.trim(),
			...(bsrVersion && bsrVersion !== 'main' ? { version: bsrVersion } : {}),
			...(bsrAuthToken ? { authToken: bsrAuthToken } : {}),
		};
		addNetwork(bsrEndpoint.trim() || '', bsrTlsEnabled, undefined, bsrSource);
	};

	return (
		<Dialog open={true} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-[525px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Add Network</DialogTitle>
						<DialogDescription>
							{mode === 'cosmos'
								? 'Select a chain or enter a gRPC endpoint directly'
								: 'Connect to any gRPC server or browse buf.build schemas'
							}
						</DialogDescription>
					</DialogHeader>

					{/* Mode toggle */}
					<div className="flex gap-1 mt-2 mb-3 p-1 bg-muted rounded-lg">
						<button
							type="button"
							onClick={() => setMode('generic')}
							className={cn(
								"flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
								mode === 'generic'
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							Generic gRPC
						</button>
						<button
							type="button"
							onClick={() => setMode('cosmos')}
							className={cn(
								"flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
								mode === 'cosmos'
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							Cosmos SDK
						</button>
					</div>

					<div className="grid gap-4 py-2">

					{/* === GENERIC MODE === */}
					{mode === 'generic' && (
						<>
							{/* Source tabs */}
							<div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
								<button
									type="button"
									onClick={() => setGenericSourceTab('endpoint')}
									className={cn(
										"flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
										genericSourceTab === 'endpoint'
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									)}
								>
									Endpoint (Reflection)
								</button>
								<button
									type="button"
									onClick={() => setGenericSourceTab('bsr')}
									className={cn(
										"flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
										genericSourceTab === 'bsr'
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									)}
								>
									buf.build (BSR)
								</button>
							</div>

							{genericSourceTab === 'endpoint' ? (
								/* Generic endpoint tab */
								<div className="grid gap-2">
									<Label htmlFor="endpoint">
										<span className="flex items-center gap-1.5">
											<Link className="h-3.5 w-3.5" />
											gRPC Endpoint
										</span>
									</Label>
									<Input
										ref={inputRef}
										id="endpoint"
										placeholder="host:port (e.g., grpc.example.com:443)"
										value={endpoint}
										onChange={(e) => setEndpoint(e.target.value)}
										autoFocus
										autoComplete="off"
									/>
									<div className="flex items-center gap-6 pt-1">
										<div className="flex flex-col gap-1">
											<div className="flex items-center gap-3">
												<Switch id="tls-generic" checked={tlsEnabled} onCheckedChange={setTlsEnabled} />
												<Label htmlFor="tls-generic" className="cursor-pointer text-sm">TLS</Label>
											</div>
											{tlsWarning && (
												<div className="flex items-center gap-1.5 text-xs text-amber-500">
													<AlertTriangle className="h-3 w-3 shrink-0" />
													<span>{tlsWarning}</span>
												</div>
											)}
										</div>
									</div>
								</div>
							) : (
								/* BSR tab */
								<div className="grid gap-3">
									<div className="grid gap-2">
										<Label>Module</Label>
										<Input
											placeholder="owner/repository (e.g., connectrpc/eliza)"
											value={bsrModule}
											onChange={(e) => setBsrModule(e.target.value)}
											autoFocus
										/>
										<p className="text-xs text-muted-foreground">
											Full module path on buf.build
										</p>
									</div>

									<div className="grid grid-cols-2 gap-2">
										<div>
											<Label className="text-xs">Version</Label>
											<Input
												placeholder="main"
												value={bsrVersion}
												onChange={(e) => setBsrVersion(e.target.value)}
												className="mt-1"
											/>
										</div>
										<div>
											<Label className="text-xs">Auth Token (optional)</Label>
											<Input
												type="password"
												placeholder="For private modules"
												value={bsrAuthToken}
												onChange={(e) => setBsrAuthToken(e.target.value)}
												className="mt-1"
											/>
										</div>
									</div>

									{/* Optional target endpoint for execution */}
									<div className="grid gap-2 pt-2 border-t border-border">
										<Label className="text-xs text-muted-foreground">Target Endpoint (optional, for execution)</Label>
										<div className="flex gap-2 items-center">
											<Input
												placeholder="host:port"
												value={bsrEndpoint}
												onChange={(e) => setBsrEndpoint(e.target.value)}
												className="flex-1"
											/>
											<div className="flex items-center gap-2 shrink-0">
												<Switch id="bsr-tls" checked={bsrTlsEnabled} onCheckedChange={setBsrTlsEnabled} />
												<Label htmlFor="bsr-tls" className="text-xs cursor-pointer">TLS</Label>
											</div>
										</div>
									</div>

									{/* Org browser */}
									<div className="grid gap-2 pt-2 border-t border-border">
										<Label className="text-xs text-muted-foreground">Browse Organization</Label>
										<div className="flex gap-2">
											<Input
												placeholder="Organization name"
												value={bsrOrgInput}
												onChange={(e) => setBsrOrgInput(e.target.value)}
												className="flex-1"
											/>
											<Button type="button" variant="outline" size="sm" onClick={() => searchBsrOrg(bsrOrgInput)} disabled={loadingBsrModules}>
												{loadingBsrModules ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
											</Button>
										</div>
										{bsrModules.length > 0 && (
											<div className="max-h-[120px] overflow-y-auto border border-border rounded-lg p-1 space-y-0.5">
												{bsrModules.map(m => (
													<button
														key={`${m.owner}/${m.name}`}
														type="button"
														onClick={() => setBsrModule(`${m.owner}/${m.name}`)}
														className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
													>
														<span className="font-medium">{m.owner}/{m.name}</span>
														{m.description && <span className="text-muted-foreground ml-2">{m.description}</span>}
													</button>
												))}
											</div>
										)}
									</div>

									{/* Popular modules */}
									{bsrPopularModules.length > 0 && !bsrModules.length && (
										<div className="grid gap-1">
											<Label className="text-xs text-muted-foreground flex items-center gap-1">
												<Package className="h-3 w-3" /> Popular Modules
											</Label>
											<div className="flex flex-wrap gap-1">
												{bsrPopularModules.map(m => (
													<button
														key={`${m.owner}/${m.name}`}
														type="button"
														onClick={() => setBsrModule(`${m.owner}/${m.name}`)}
														className="px-2 py-1 text-xs rounded-full border border-border hover:bg-muted transition-colors"
													>
														{m.owner}/{m.name}
													</button>
												))}
											</div>
										</div>
									)}
								</div>
							)}

							{/* Auth section (generic mode only) */}
							<div className="grid gap-2 pt-2 border-t border-border">
								<button
									type="button"
									onClick={() => setAuthType(authType === 'none' ? 'bearer' : 'none')}
									className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
								>
									<Lock className="h-3 w-3" />
									Authentication
									{authType !== 'none' && (
										<span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
											{authType}
										</span>
									)}
								</button>

								{authType !== 'none' && (
									<div className="space-y-2">
										<select
											value={authType}
											onChange={e => setAuthType(e.target.value as typeof authType)}
											className="w-full px-2 py-1.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
										>
											<option value="none">None</option>
											<option value="bearer">Bearer Token</option>
											<option value="api-key">API Key</option>
											<option value="mtls">mTLS</option>
										</select>

										{authType === 'bearer' && (
											<Input
												type="password"
												placeholder="Bearer token"
												value={bearerToken}
												onChange={e => setBearerToken(e.target.value)}
											/>
										)}

										{authType === 'api-key' && (
											<div className="flex gap-2">
												<Input placeholder="Header (e.g., x-api-key)" value={apiKeyHeader} onChange={e => setApiKeyHeader(e.target.value)} className="flex-1" />
												<Input type="password" placeholder="Value" value={apiKeyValue} onChange={e => setApiKeyValue(e.target.value)} className="flex-1" />
											</div>
										)}

										{authType === 'mtls' && (
											<div className="space-y-2">
												<textarea
													placeholder="PEM client certificate"
													value={clientCert}
													onChange={e => setClientCert(e.target.value)}
													rows={3}
													className="w-full px-2 py-1.5 text-xs rounded border border-input bg-background font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
												/>
												<textarea
													placeholder="PEM private key"
													value={clientKey}
													onChange={e => setClientKey(e.target.value)}
													rows={3}
													className="w-full px-2 py-1.5 text-xs rounded border border-input bg-background font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
												/>
											</div>
										)}
									</div>
								)}
							</div>
						</>
					)}

					{/* === COSMOS MODE === */}
					{mode === 'cosmos' && (
						<>
						{/* Main input with dropdown */}
						<div className="grid gap-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="endpoint">
									{isEndpointFormat(endpoint) ? (
										<span className="flex items-center gap-1.5">
											<Link className="h-3.5 w-3.5" />
											Direct Endpoint
										</span>
									) : (
										<span className="flex items-center gap-1.5">
											<Globe className="h-3.5 w-3.5" />
											Chain Name
										</span>
									)}
								</Label>
								{cachedChains.length > 0 && (
									<button
										type="button"
										onClick={() => {
											setShowCachedChains(!showCachedChains);
											setShowDropdown(false);
										}}
										className={cn(
											"text-xs hover:underline flex items-center gap-1",
											showCachedChains ? "text-primary" : "text-muted-foreground hover:text-primary"
										)}
									>
										<History className="h-3 w-3" />
										Recent ({cachedChains.length})
									</button>
								)}
							</div>

							<div className="relative">
								<div className="relative">
									<Input
										ref={inputRef}
										id="endpoint"
										placeholder="Type chain name or paste endpoint..."
										value={endpoint}
										onChange={(e) => handleInputChange(e.target.value)}
										onFocus={() => {
											if (!isEndpointFormat(endpoint)) {
												setShowDropdown(true);
											}
										}}
										className="pr-8"
										autoFocus
										autoComplete="off"
									/>
									<button
										type="button"
										onClick={() => setShowDropdown(!showDropdown)}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										<ChevronDown className={cn("h-4 w-4 transition-transform", showDropdown && "rotate-180")} />
									</button>
								</div>

								{/* Chain dropdown */}
								{showDropdown && (
									<div
										ref={dropdownRef}
										className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[250px] overflow-y-auto"
									>
										{loadingChains ? (
											<div className="flex items-center justify-center py-6">
												<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
											</div>
										) : filteredChains.length > 0 ? (
											<div className="p-1">
												{filteredChains.map((chain) => (
													<button
														key={chain}
														type="button"
														onClick={() => selectChainFromDropdown(chain)}
														className={cn(
															"w-full text-left px-3 py-2 rounded hover:bg-secondary/50",
															"transition-colors group flex items-center justify-between"
														)}
													>
														<span className="text-sm font-medium capitalize">
															{chain.replace(/-/g, ' ')}
														</span>
														<ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
													</button>
												))}
											</div>
										) : (
											<div className="text-sm text-muted-foreground text-center py-4">
												{endpoint.trim() ? 'No matching chains' : 'Loading chains...'}
											</div>
										)}
									</div>
								)}
							</div>

							<p className="text-xs text-muted-foreground">
								Type to search chains, or enter a direct endpoint (e.g., <code className="bg-secondary px-1 rounded">grpc.osmosis.zone:443</code>)
							</p>
						</div>

						{/* Recently used chains panel */}
						{showCachedChains && cachedChains.length > 0 && (
							<div className="border border-border rounded-lg p-3 max-h-[200px] overflow-y-auto">
								<div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
									<Database className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm font-medium">Previously Used</span>
								</div>
								<div className="space-y-1">
									{cachedChains.map((cached, idx) => (
										<button
											key={`${cached.endpoint}-${idx}`}
											type="button"
											onClick={() => selectCachedChain(cached)}
											className={cn(
												"w-full text-left px-3 py-2 rounded hover:bg-secondary/50",
												"transition-colors group"
											)}
										>
											<div className="flex items-center justify-between">
												<div className="flex-1 min-w-0">
													<div className="text-sm font-medium truncate">
														{cached.chainId || cached.endpoint}
													</div>
													<div className="flex items-center gap-2 text-xs text-muted-foreground">
														<span className="shrink-0">{cached.serviceCount} services</span>
														<span>-</span>
														<span className="shrink-0">{cached.age}</span>
													</div>
												</div>
												<ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
											</div>
										</button>
									))}
								</div>
							</div>
						)}

						{/* Endpoint selector panel (shown when chain selected) */}
						{selectedChainDetails && (
							<div className="border border-border rounded-lg p-3 max-h-[350px] overflow-y-auto">
								<div className="mb-3">
									<button
										type="button"
										onClick={() => {
											setSelectedChainDetails(null);
											setEndpointConfigs([]);
											setEndpoint('');
											setShowDropdown(true);
										}}
										className="text-xs text-primary hover:underline mb-2"
									>
										← Back to chains
									</button>
									<div className="font-semibold">{selectedChainDetails.pretty_name}</div>
									<div className="text-xs text-muted-foreground">{selectedChainDetails.chain_id}</div>
								</div>
								{loadingChainData ? (
									<div className="flex items-center justify-center py-6">
										<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
									</div>
								) : endpointConfigs.length > 0 ? (
									<EndpointSelector
										endpoints={endpointConfigs}
										onChange={setEndpointConfigs}
										validating={validatingEndpoints}
									/>
								) : (
									<div className="text-sm text-muted-foreground text-center py-4">
										No gRPC endpoints available
									</div>
								)}
							</div>
						)}

						{/* TLS toggle only shown for direct endpoint entry */}
						{!selectedChainDetails && isEndpointFormat(endpoint) && (
							<div className="flex items-center gap-6 pt-2 border-t border-border">
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-3">
										<Switch
											id="tls"
											checked={tlsEnabled}
											onCheckedChange={setTlsEnabled}
										/>
										<Label htmlFor="tls" className="cursor-pointer text-sm">TLS</Label>
									</div>
									{tlsWarning && (
										<div className="flex items-center gap-1.5 text-xs text-amber-500">
											<AlertTriangle className="h-3 w-3 shrink-0" />
											<span>{tlsWarning}</span>
										</div>
									)}
								</div>
							</div>
						)}
						</>
					)}

					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						{mode === 'generic' && genericSourceTab === 'bsr' ? (
							<Button
								type="button"
								onClick={handleBsrAdd}
								disabled={!bsrModule.trim()}
							>
								{bsrEndpoint.trim() ? 'Add with Schema' : 'Browse Schema'}
							</Button>
						) : mode === 'cosmos' && selectedChainDetails && endpointConfigs.length > 0 ? (
							<Button
								type="button"
								onClick={addWithSelectedEndpoints}
								disabled={selectedEndpointCount === 0 || validatingEndpoints}
							>
								{validatingEndpoints ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin mr-2" />
										Validating...
									</>
								) : (
									`Add with ${selectedEndpointCount} Endpoint${selectedEndpointCount !== 1 ? 's' : ''}`
								)}
							</Button>
						) : (
							<Button
								type="submit"
								disabled={!endpoint.trim()}
							>
								Add Network
							</Button>
						)}
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default AddNetworkDialog;