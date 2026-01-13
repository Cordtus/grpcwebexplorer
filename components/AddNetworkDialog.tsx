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
import { ChevronRight, ChevronDown, Search, Loader2, History, Database, Globe, Link, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { debug } from '@/lib/utils/debug';
import { listCachedChains, type CachedChainInfo } from '@/lib/utils/client-cache';
import EndpointSelector, { createEndpointConfigs } from './EndpointSelector';
import { EndpointConfig } from '@/lib/types/grpc';

interface AddNetworkDialogProps {
	onAdd: (endpoint: string, tlsEnabled: boolean, roundRobinEnabled: boolean, endpointConfigs?: EndpointConfig[]) => void;
	onClose: () => void;
	defaultRoundRobin?: boolean;
}

interface ChainData {
	chain_name: string;
	chain_id: string;
	pretty_name: string;
	grpc_endpoints: Array<{ address: string; provider?: string }>;
}

const AddNetworkDialog: React.FC<AddNetworkDialogProps> = ({ onAdd, onClose, defaultRoundRobin = false }) => {
	const [endpoint, setEndpoint] = useState('');
	const [tlsEnabled, setTlsEnabled] = useState(true);
	const [roundRobinEnabled, setRoundRobinEnabled] = useState(defaultRoundRobin);
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
	const addNetwork = (finalEndpoint: string, tls: boolean, configs?: EndpointConfig[]) => {
		onAdd(finalEndpoint, tls, roundRobinEnabled, configs);
		setEndpoint('');
		setTlsEnabled(true);
		setRoundRobinEnabled(defaultRoundRobin);
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
		setRoundRobinEnabled(defaultRoundRobin);
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

	// Select chain from dropdown - load endpoint details for selection
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

			// For round-robin mode, create endpoint configs with intelligent TLS detection
			if (roundRobinEnabled) {
				const configs = createEndpointConfigs(chainDetails.grpc_endpoints);
				setEndpointConfigs(configs);
				debug.log(`Round-robin: Loaded ${configs.length} endpoints for ${chainName} with per-endpoint TLS`);

				// Validate endpoints in background and update state
				setLoadingChainData(false);
				const validatedConfigs = await validateEndpoints(configs);
				setEndpointConfigs(validatedConfigs);
			} else {
				debug.log(`Loaded ${grpcEndpoints.length} endpoints for ${chainName}`);
				setLoadingChainData(false);
			}
		} catch (error) {
			console.error('Error fetching chain data:', error);
			setLoadingChainData(false);
		}
	};

	const selectEndpointFromChain = (address: string) => {
		let normalizedAddress = address.trim();
		let hasTls = false;
		let hadHttpsPrefix = false;

		if (normalizedAddress.startsWith('https://')) {
			normalizedAddress = normalizedAddress.replace('https://', '');
			hasTls = true;
			hadHttpsPrefix = true;
		} else if (normalizedAddress.startsWith('http://')) {
			normalizedAddress = normalizedAddress.replace('http://', '');
			hasTls = false;
		} else if (normalizedAddress.startsWith('grpc://')) {
			normalizedAddress = normalizedAddress.replace('grpc://', '');
			hasTls = false;
		} else if (normalizedAddress.startsWith('grpcs://')) {
			normalizedAddress = normalizedAddress.replace('grpcs://', '');
			hasTls = true;
			hadHttpsPrefix = true;
		}

		if (!normalizedAddress.includes(':')) {
			if (hadHttpsPrefix) {
				normalizedAddress = `${normalizedAddress}:443`;
				hasTls = true;
			} else {
				normalizedAddress = `${normalizedAddress}:9090`;
			}
		} else {
			const port = normalizedAddress.split(':')[1];
			if (port === '443' || port === '9091') {
				hasTls = true;
			}
		}

		setEndpoint(normalizedAddress);
		setTlsEnabled(hasTls);
		setSelectedChainDetails(null);
	};

	const useAllEndpoints = (chain: ChainData) => {
		const chainMarker = `chain:${chain.chain_name}`;
		addNetwork(chainMarker, true);
		debug.log(`Using all ${chain.grpc_endpoints.length} endpoints for ${chain.pretty_name}`);
	};

	// Add chain with selected endpoints (round-robin mode)
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

	// Check if current input is a valid chain name
	const isValidChainName = endpoint.trim() && !isEndpointFormat(endpoint) &&
		chains.includes(endpoint.trim().toLowerCase());

	return (
		<Dialog open={true} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-[525px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Add Network</DialogTitle>
						<DialogDescription>
							{roundRobinEnabled
								? "Select a chain to add with automatic endpoint rotation"
								: "Select a chain or enter a specific gRPC endpoint"
							}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
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
														{roundRobinEnabled ? (
															<span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
																click to add
															</span>
														) : (
															<ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
														)}
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
								{roundRobinEnabled ? (
									<>Select a chain from the list to add it instantly with all available endpoints</>
								) : (
									<>Type to search chains, or enter a direct endpoint (e.g., <code className="bg-secondary px-1 rounded">grpc.osmosis.zone:443</code>)</>
								)}
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

						{/* Chain details panel (when round-robin disabled and chain selected) */}
						{selectedChainDetails && !roundRobinEnabled && (
							<div className="border border-border rounded-lg p-3 max-h-[250px] overflow-y-auto">
								<div className="mb-3">
									<button
										type="button"
										onClick={() => {
											setSelectedChainDetails(null);
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
								) : selectedChainDetails.grpc_endpoints.length > 0 ? (
									<>
										<Button
											type="button"
											onClick={() => useAllEndpoints(selectedChainDetails)}
											className="w-full mb-3"
											variant="default"
										>
											Use All {selectedChainDetails.grpc_endpoints.length} Endpoints
										</Button>
										<div className="text-xs text-muted-foreground mb-2 text-center">
											Or select a specific endpoint:
										</div>
										<div className="space-y-1">
											{selectedChainDetails.grpc_endpoints.map((ep, idx) => (
												<button
													key={idx}
													type="button"
													onClick={() => selectEndpointFromChain(ep.address)}
													className={cn(
														"w-full text-left px-3 py-2 rounded hover:bg-secondary/50",
														"transition-colors group"
													)}
												>
													<div className="flex items-center justify-between">
														<div>
															<div className="text-sm font-medium">{ep.address}</div>
															{ep.provider && (
																<div className="text-xs text-muted-foreground">{ep.provider}</div>
															)}
														</div>
														<ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
													</div>
												</button>
											))}
										</div>
									</>
								) : (
									<div className="text-sm text-muted-foreground text-center py-4">
										No gRPC endpoints available
									</div>
								)}
							</div>
						)}

						{/* Round-robin endpoint selector panel */}
						{selectedChainDetails && roundRobinEnabled && (
							<div className="border border-border rounded-lg p-3 max-h-[300px] overflow-y-auto">
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
									<>
										<div className="text-xs text-muted-foreground mb-3">
											Select endpoints to use for round-robin and configure TLS per endpoint:
										</div>
										<EndpointSelector
											endpoints={endpointConfigs}
											onChange={setEndpointConfigs}
											validating={validatingEndpoints}
										/>
										<Button
											type="button"
											onClick={addWithSelectedEndpoints}
											className="w-full mt-4"
											variant="default"
											disabled={selectedEndpointCount === 0 || validatingEndpoints}
										>
											{validatingEndpoints
												? 'Validating endpoints...'
												: `Add with ${selectedEndpointCount} Endpoint${selectedEndpointCount !== 1 ? 's' : ''}`
											}
										</Button>
									</>
								) : (
									<div className="text-sm text-muted-foreground text-center py-4">
										No gRPC endpoints available
									</div>
								)}
							</div>
						)}

						{/* Settings row */}
						<div className="flex items-center gap-6 pt-2 border-t border-border">
							<div className="flex items-center gap-3 flex-1">
								<Switch
									id="roundrobin"
									checked={roundRobinEnabled}
									onCheckedChange={(checked) => {
										setRoundRobinEnabled(checked);
										// Reset state when toggling
										setSelectedChainDetails(null);
										setEndpointConfigs([]);
										setValidatingEndpoints(false);
										if (!isEndpointFormat(endpoint)) {
											setShowDropdown(true);
										}
									}}
								/>
								<div className="flex flex-col">
									<Label htmlFor="roundrobin" className="cursor-pointer text-sm">Round-robin</Label>
									<span className="text-[10px] text-muted-foreground">
										{roundRobinEnabled ? "Using all endpoints" : "Pick specific endpoint"}
									</span>
								</div>
							</div>
							{!roundRobinEnabled && (
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
							)}
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!endpoint.trim() || (roundRobinEnabled && !isValidChainName && !isEndpointFormat(endpoint))}
						>
							{roundRobinEnabled && isValidChainName ? 'Add Chain' : 'Add Network'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default AddNetworkDialog;