'use client';

import React, { useState, useEffect } from 'react';
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
import { ChevronRight, Globe, Server, TestTube, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXAMPLE_ENDPOINTS, getEndpointsByCategory } from '@/lib/constants/exampleEndpoints';

interface AddNetworkDialogProps {
	onAdd: (endpoint: string, tlsEnabled: boolean) => void;
	onClose: () => void;
}

interface ChainData {
	chain_name: string;
	chain_id: string;
	pretty_name: string;
	grpc_endpoints: Array<{ address: string; provider?: string }>;
}

const AddNetworkDialog: React.FC<AddNetworkDialogProps> = ({ onAdd, onClose }) => {
	const [endpoint, setEndpoint] = useState('');
	const [tlsEnabled, setTlsEnabled] = useState(true);
	const [showExamples, setShowExamples] = useState(false);
	const [showChainRegistry, setShowChainRegistry] = useState(false);
	const [chains, setChains] = useState<string[]>([]);
	const [filteredChains, setFilteredChains] = useState<string[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [loadingChains, setLoadingChains] = useState(false);
	const [loadingChainData, setLoadingChainData] = useState(false);
	const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
	const [showChainSuggestions, setShowChainSuggestions] = useState(false);

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

	// Helper to detect if input looks like a URL/endpoint
	const isEndpointFormat = (input: string): boolean => {
		// Check if it contains common endpoint patterns
		return (
			input.includes(':') || // Has port
			input.includes('.') || // Has domain separator
			input.startsWith('http://') ||
			input.startsWith('https://') ||
			input.startsWith('chain:') // Chain marker
		);
	};

	// Handle endpoint/chain name input changes
	const handleEndpointChange = (value: string) => {
		setEndpoint(value);

		// If it looks like an endpoint, don't show suggestions
		if (isEndpointFormat(value)) {
			setShowChainSuggestions(false);
			return;
		}

		// Otherwise, treat as chain search and show suggestions
		if (value.trim().length > 0) {
			const query = value.toLowerCase();
			const matches = chains.filter(chain =>
				chain.toLowerCase().includes(query)
			);
			setFilteredChains(matches);
			setShowChainSuggestions(matches.length > 0);
		} else {
			setFilteredChains(chains);
			setShowChainSuggestions(false);
		}
	};

	// Filter chains based on search (for registry browser)
	useEffect(() => {
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			setFilteredChains(chains.filter(chain =>
				chain.toLowerCase().includes(query)
			));
		} else {
			setFilteredChains(chains);
		}
	}, [searchQuery, chains]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (endpoint.trim()) {
			onAdd(endpoint.trim(), tlsEnabled);
			// Reset form
			setEndpoint('');
			setTlsEnabled(true);
			onClose(); // Close dialog after adding
		}
	};

	const handleCancel = () => {
		// Reset form
		setEndpoint('');
		setTlsEnabled(true);
		setShowExamples(false);
		setShowChainRegistry(false);
		setSelectedChain(null);
		setSearchQuery('');
		onClose();
	};

	const selectExample = (example: typeof EXAMPLE_ENDPOINTS[0]) => {
		setEndpoint(example.endpoint);
		setTlsEnabled(example.tls);
		setShowExamples(false);
	};

	const selectChain = async (chainName: string) => {
		setLoadingChainData(true);
		try {
			const response = await fetch(`/api/chains?name=${chainName}`);
			const data = await response.json();

			if (data.error) {
				console.error('Error fetching chain data:', data.error);
				return;
			}

			const grpcEndpoints = data.apis?.grpc || [];

			console.log(`Loaded ${grpcEndpoints.length} gRPC endpoints for ${chainName}:`, grpcEndpoints);

			setSelectedChain({
				chain_name: data.info.chain_name,
				chain_id: data.info.chain_id,
				pretty_name: data.info.pretty_name,
				grpc_endpoints: grpcEndpoints.map((ep: any) => ({
					address: ep.address,
					provider: ep.provider
				}))
			});

			console.log('Selected chain state:', {
				chain_name: data.info.chain_name,
				chain_id: data.info.chain_id,
				pretty_name: data.info.pretty_name,
				endpoint_count: grpcEndpoints.length
			});
		} catch (error) {
			console.error('Error fetching chain data:', error);
		} finally {
			setLoadingChainData(false);
		}
	};

	// Select chain from inline suggestions
	const selectChainFromSuggestion = async (chainName: string) => {
		await selectChain(chainName);
		setShowChainSuggestions(false);
		setShowChainRegistry(true); // Show the chain details view
	};

	const selectEndpointFromChain = (address: string) => {
		// Normalize endpoint (remove https:// if present)
		let normalizedAddress = address.replace(/^https?:\/\//, '');

		// Add default port if missing
		if (!normalizedAddress.includes(':')) {
			normalizedAddress = `${normalizedAddress}:9090`;
		}

		// Determine TLS: port 443 = TLS, everything else = no TLS
		const port = normalizedAddress.split(':')[1];
		const hasTls = port === '443';

		setEndpoint(normalizedAddress);
		setTlsEnabled(hasTls);
		setShowChainRegistry(false);
		setSelectedChain(null);
	};

	const useAllEndpoints = (chain: ChainData) => {
		// Use a special marker format that the backend will recognize
		// Format: chain:<chain_name>
		const chainMarker = `chain:${chain.chain_name}`;

		setEndpoint(chainMarker);
		setTlsEnabled(true); // Default to TLS, backend will handle per-endpoint
		setShowChainRegistry(false);
		setSelectedChain(null);

		console.log(`Using all ${chain.grpc_endpoints.length} endpoints for ${chain.pretty_name} in round-robin mode`);
	};

	const categoryIcons = {
		cosmos: Globe,
		ethereum: Server,
		test: TestTube,
		other: Server
	};

	return (
		<Dialog open={true} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-[525px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Add Network</DialogTitle>
						<DialogDescription>
							Add a new gRPC network endpoint to explore
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="endpoint">Endpoint URL</Label>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => {
											setShowChainRegistry(!showChainRegistry);
											setShowExamples(false);
										}}
										className="text-xs text-primary hover:underline"
									>
										{showChainRegistry ? 'Hide' : 'Browse'} Chain Registry
									</button>
									<button
										type="button"
										onClick={() => {
											setShowExamples(!showExamples);
											setShowChainRegistry(false);
										}}
										className="text-xs text-primary hover:underline"
									>
										{showExamples ? 'Hide' : 'Show'} Examples
									</button>
								</div>
							</div>
							<div className="relative">
								<Input
									id="endpoint"
									placeholder="grpc.example.com:443 or chain name (e.g., dydx)"
									value={endpoint}
									onChange={(e) => handleEndpointChange(e.target.value)}
									onFocus={() => {
										// Show suggestions if there's non-endpoint text
										if (endpoint.trim() && !isEndpointFormat(endpoint)) {
											setShowChainSuggestions(filteredChains.length > 0);
										}
									}}
									onBlur={() => {
										// Delay hiding to allow clicking suggestions
										setTimeout(() => setShowChainSuggestions(false), 200);
									}}
									required
									autoFocus
								/>

								{/* Inline chain suggestions */}
								{showChainSuggestions && filteredChains.length > 0 && (
									<div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
										<div className="p-1">
											{filteredChains.slice(0, 10).map((chain) => (
												<button
													key={chain}
													type="button"
													onClick={() => selectChainFromSuggestion(chain)}
													className={cn(
														"w-full text-left px-3 py-2 rounded hover:bg-secondary/50",
														"transition-colors group"
													)}
												>
													<div className="flex items-center justify-between">
														<div className="text-sm font-medium capitalize">
															{chain.replace(/-/g, ' ')}
														</div>
														<ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
													</div>
												</button>
											))}
											{filteredChains.length > 10 && (
												<div className="text-xs text-muted-foreground text-center py-2">
													+{filteredChains.length - 10} more chains
												</div>
											)}
										</div>
									</div>
								)}
							</div>
							<p className="text-xs text-muted-foreground">
								Enter a gRPC endpoint (e.g., server.com:443) or chain name (e.g., dydx)
							</p>
						</div>
						
						{showExamples && (
							<div className="border border-border rounded-lg p-2 max-h-[200px] overflow-y-auto">
								<div className="space-y-2">
									{['cosmos', 'test'].map((category) => {
										const examples = getEndpointsByCategory(category as any);
										if (examples.length === 0) return null;
										const Icon = categoryIcons[category as keyof typeof categoryIcons];
										
										return (
											<div key={category}>
												<div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground">
													<Icon className="h-3 w-3" />
													{category.charAt(0).toUpperCase() + category.slice(1)}
												</div>
												{examples.map((example) => (
													<button
														key={example.endpoint}
														type="button"
														onClick={() => selectExample(example)}
														className={cn(
															"w-full text-left px-2 py-1.5 rounded hover:bg-secondary/50",
															"transition-colors group"
														)}
													>
														<div className="flex items-center justify-between">
															<div>
																<div className="text-sm font-medium">{example.name}</div>
																<div className="text-xs text-muted-foreground">
																	{example.endpoint}
																</div>
															</div>
															<ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
														</div>
													</button>
												))}
											</div>
										);
									})}
								</div>
							</div>
						)}

						{showChainRegistry && (
							<div className="border border-border rounded-lg p-3 max-h-[300px] overflow-y-auto">
								{!selectedChain ? (
									<>
										<div className="mb-2 relative">
											<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
											<Input
												placeholder="Search chains..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="pl-8"
											/>
										</div>
										{loadingChains ? (
											<div className="flex items-center justify-center py-8">
												<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
											</div>
										) : (
											<div className="space-y-1">
												{filteredChains.slice(0, 50).map((chain) => (
													<button
														key={chain}
														type="button"
														onClick={() => selectChain(chain)}
														className={cn(
															"w-full text-left px-3 py-2 rounded hover:bg-secondary/50",
															"transition-colors group"
														)}
													>
														<div className="flex items-center justify-between">
															<div className="text-sm font-medium capitalize">
																{chain.replace(/-/g, ' ')}
															</div>
															<ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
														</div>
													</button>
												))}
												{filteredChains.length === 0 && (
													<div className="text-sm text-muted-foreground text-center py-4">
														No chains found
													</div>
												)}
											</div>
										)}
									</>
								) : (
									<>
										<div className="mb-3">
											<button
												type="button"
												onClick={() => setSelectedChain(null)}
												className="text-xs text-primary hover:underline mb-2"
											>
												← Back to chains
											</button>
											<div className="font-semibold">{selectedChain.pretty_name}</div>
											<div className="text-xs text-muted-foreground">{selectedChain.chain_id}</div>
										</div>
										{loadingChainData ? (
											<div className="flex items-center justify-center py-8">
												<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
											</div>
										) : selectedChain.grpc_endpoints.length > 0 ? (
											<>
												<Button
													type="button"
													onClick={() => useAllEndpoints(selectedChain)}
													className="w-full mb-3"
													variant="default"
												>
													Use All {selectedChain.grpc_endpoints.length} Endpoints (Round-Robin)
												</Button>
												<div className="text-xs text-muted-foreground mb-2 text-center">
													Or select a specific endpoint:
												</div>
												<div className="space-y-1">
													{selectedChain.grpc_endpoints.map((ep, idx) => (
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
																		<div className="text-xs text-muted-foreground">
																			{ep.provider}
																		</div>
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
												No gRPC endpoints available for this chain
											</div>
										)}
									</>
								)}
							</div>
						)}

						<div className="flex items-center justify-between">
							<Label htmlFor="tls">Use TLS/SSL</Label>
							<Switch
								id="tls"
								checked={tlsEnabled}
								onCheckedChange={setTlsEnabled}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button type="submit">Add Network</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default AddNetworkDialog;