'use client';

import React, { useState } from 'react';
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
import { ChevronRight, Globe, Server, TestTube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXAMPLE_ENDPOINTS, getEndpointsByCategory } from '@/lib/constants/exampleEndpoints';

interface AddNetworkDialogProps {
	onAdd: (endpoint: string, tlsEnabled: boolean) => void;
	onClose: () => void;
}

const AddNetworkDialog: React.FC<AddNetworkDialogProps> = ({ onAdd, onClose }) => {
	const [endpoint, setEndpoint] = useState('');
	const [tlsEnabled, setTlsEnabled] = useState(true);
	const [showExamples, setShowExamples] = useState(false);

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
		onClose();
	};
	
	const selectExample = (example: typeof EXAMPLE_ENDPOINTS[0]) => {
		setEndpoint(example.endpoint);
		setTlsEnabled(example.tls);
		setShowExamples(false);
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
								<button
									type="button"
									onClick={() => setShowExamples(!showExamples)}
									className="text-xs text-primary hover:underline"
								>
									{showExamples ? 'Hide' : 'Show'} Examples
								</button>
							</div>
							<Input
								id="endpoint"
								placeholder="grpc.example.com:443"
								value={endpoint}
								onChange={(e) => setEndpoint(e.target.value)}
								required
								autoFocus
							/>
							<p className="text-xs text-muted-foreground">
								Enter the gRPC endpoint without protocol (e.g., server.com:443)
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