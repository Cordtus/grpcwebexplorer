'use client';

import React, { useMemo, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Check, Minus, Lock, Unlock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EndpointConfig } from '@/lib/types/grpc';

interface EndpointSelectorProps {
	endpoints: EndpointConfig[];
	onChange: (endpoints: EndpointConfig[]) => void;
	disabled?: boolean;
	validating?: boolean; // Show loading state while validating
}

/**
 * Detects whether an endpoint likely needs TLS based on port and protocol hints
 */
function detectTlsFromAddress(address: string): boolean {
	const normalized = address.toLowerCase().trim();

	// Protocol prefixes
	if (normalized.startsWith('https://') || normalized.startsWith('grpcs://')) {
		return true;
	}
	if (normalized.startsWith('http://') || normalized.startsWith('grpc://')) {
		return false;
	}

	// Extract port
	const portMatch = normalized.match(/:(\d+)$/);
	if (portMatch) {
		const port = portMatch[1];
		// Standard TLS ports
		if (port === '443' || port === '9091') {
			return true;
		}
		// Non-TLS ports
		if (port === '80' || port === '9090') {
			return false;
		}
	}

	// Default to TLS for unknown
	return true;
}

/**
 * Normalizes an endpoint address by removing protocol prefixes and adding default port
 */
function normalizeAddress(address: string): string {
	let normalized = address.trim();

	// Remove protocol prefixes
	if (normalized.startsWith('https://')) {
		normalized = normalized.replace('https://', '');
	} else if (normalized.startsWith('http://')) {
		normalized = normalized.replace('http://', '');
	} else if (normalized.startsWith('grpcs://')) {
		normalized = normalized.replace('grpcs://', '');
	} else if (normalized.startsWith('grpc://')) {
		normalized = normalized.replace('grpc://', '');
	}

	// Add default port if missing
	if (!normalized.includes(':')) {
		normalized = `${normalized}:443`;
	}

	return normalized;
}

/**
 * Endpoint selector component for round-robin mode
 * Allows users to select which endpoints to use and configure TLS per endpoint
 */
const EndpointSelector: React.FC<EndpointSelectorProps> = ({
	endpoints,
	onChange,
	disabled = false,
	validating = false
}) => {
	const selectedCount = useMemo(
		() => endpoints.filter(ep => ep.selected).length,
		[endpoints]
	);

	const reachableCount = useMemo(
		() => endpoints.filter(ep => ep.reachable === true).length,
		[endpoints]
	);

	const unreachableCount = useMemo(
		() => endpoints.filter(ep => ep.reachable === false).length,
		[endpoints]
	);

	const allSelected = selectedCount === endpoints.length && endpoints.length > 0;
	const someSelected = selectedCount > 0 && selectedCount < endpoints.length;

	// Select all reachable endpoints (or all if none validated yet)
	const handleSelectAll = useCallback(() => {
		const newSelected = !allSelected;
		onChange(endpoints.map(ep => ({
			...ep,
			// When selecting all, only select reachable endpoints (or all if not validated)
			selected: newSelected ? (ep.reachable !== false) : false
		})));
	}, [endpoints, allSelected, onChange]);

	// Select only reachable endpoints
	const handleSelectReachable = useCallback(() => {
		onChange(endpoints.map(ep => ({
			...ep,
			selected: ep.reachable === true
		})));
	}, [endpoints, onChange]);

	const handleToggleEndpoint = useCallback((index: number) => {
		const updated = [...endpoints];
		updated[index] = { ...updated[index], selected: !updated[index].selected };
		onChange(updated);
	}, [endpoints, onChange]);

	const handleToggleTls = useCallback((index: number) => {
		const updated = [...endpoints];
		updated[index] = { ...updated[index], tlsEnabled: !updated[index].tlsEnabled };
		onChange(updated);
	}, [endpoints, onChange]);

	if (endpoints.length === 0) {
		return (
			<div className="text-sm text-muted-foreground text-center py-4">
				No endpoints available
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{/* Select All Header */}
			<div className="flex items-center gap-3 pb-2 border-b border-border">
				<button
					type="button"
					onClick={handleSelectAll}
					disabled={disabled || validating}
					className={cn(
						"w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
						allSelected
							? "bg-primary border-primary text-primary-foreground"
							: someSelected
								? "bg-primary/50 border-primary text-primary-foreground"
								: "border-muted-foreground/50 hover:border-primary"
					)}
				>
					{allSelected && <Check className="h-3 w-3" />}
					{someSelected && !allSelected && <Minus className="h-3 w-3" />}
				</button>
				<div className="flex-1">
					<span className="text-sm font-medium">
						Select All ({selectedCount}/{endpoints.length})
					</span>
					{validating && (
						<span className="text-xs text-muted-foreground ml-2">
							<Loader2 className="h-3 w-3 inline animate-spin mr-1" />
							Checking...
						</span>
					)}
					{!validating && unreachableCount > 0 && (
						<button
							type="button"
							onClick={handleSelectReachable}
							className="text-xs text-primary hover:underline ml-2"
						>
							Select reachable only ({reachableCount})
						</button>
					)}
				</div>
				<span className="text-xs text-muted-foreground">TLS</span>
			</div>

			{/* Endpoint List */}
			<div className="space-y-1 max-h-[200px] overflow-y-auto">
				{endpoints.map((ep, index) => (
					<div
						key={`${ep.address}-${index}`}
						className={cn(
							"flex items-center gap-2 p-2 rounded hover:bg-secondary/50 transition-colors",
							!ep.selected && "opacity-60",
							ep.reachable === false && "bg-red-500/5"
						)}
					>
						{/* Reachability Status */}
						<div
							className="shrink-0 w-4 flex items-center justify-center"
							title={ep.reachable === false ? (ep.validationError || 'Unreachable') : undefined}
						>
							{validating && ep.reachable === undefined ? (
								<Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
							) : ep.reachable === true ? (
								<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
							) : ep.reachable === false ? (
								<AlertCircle className="h-3.5 w-3.5 text-red-500" />
							) : null}
						</div>

						{/* Checkbox */}
						<button
							type="button"
							onClick={() => handleToggleEndpoint(index)}
							disabled={disabled || validating}
							className={cn(
								"w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
								ep.selected
									? "bg-primary border-primary text-primary-foreground"
									: "border-muted-foreground/50 hover:border-primary"
							)}
						>
							{ep.selected && <Check className="h-3 w-3" />}
						</button>

						{/* Endpoint Info */}
						<div className="flex-1 min-w-0">
							<div
								className={cn(
									"text-sm font-mono truncate",
									ep.reachable === false && "text-red-500"
								)}
								title={ep.validationError ? `${ep.address} - ${ep.validationError}` : ep.address}
							>
								{normalizeAddress(ep.address)}
							</div>
							{ep.provider && (
								<div className="text-xs text-muted-foreground truncate">
									{ep.provider}
								</div>
							)}
							{ep.reachable === false && ep.validationError && (
								<div className="text-xs text-red-500 truncate">
									{ep.validationError}
								</div>
							)}
						</div>

						{/* TLS Toggle */}
						<div className="flex items-center gap-2 shrink-0">
							{ep.tlsEnabled ? (
								<Lock className="h-3.5 w-3.5 text-green-500" />
							) : (
								<Unlock className="h-3.5 w-3.5 text-muted-foreground" />
							)}
							<Switch
								checked={ep.tlsEnabled}
								onCheckedChange={() => handleToggleTls(index)}
								disabled={disabled || validating}
								className="scale-75"
							/>
						</div>
					</div>
				))}
			</div>

			{/* Summary */}
			{!validating && unreachableCount > 0 && (
				<div className="text-xs text-amber-500 text-center pt-2">
					{unreachableCount} endpoint{unreachableCount !== 1 ? 's' : ''} unreachable (DNS resolution failed)
				</div>
			)}
			{selectedCount === 0 && !validating && (
				<div className="text-xs text-amber-500 text-center pt-2">
					Select at least one endpoint for round-robin
				</div>
			)}
		</div>
	);
};

export default EndpointSelector;

// Helper to create EndpointConfig array from chain registry data
export function createEndpointConfigs(
	grpcEndpoints: Array<{ address: string; provider?: string }>
): EndpointConfig[] {
	return grpcEndpoints.map(ep => {
		const config: EndpointConfig = {
			address: normalizeAddress(ep.address),
			tlsEnabled: detectTlsFromAddress(ep.address),
			selected: true
		};
		if (ep.provider) {
			config.provider = ep.provider;
		}
		return config;
	});
}

// Helper to normalize legacy endpoint format to EndpointConfig
export function normalizeEndpointsToConfigs(
	primaryEndpoint: string,
	fallbackEndpoints: string[] = [],
	primaryTls: boolean = true
): EndpointConfig[] {
	const configs: EndpointConfig[] = [
		{
			address: primaryEndpoint,
			tlsEnabled: primaryTls,
			selected: true
		}
	];

	for (const ep of fallbackEndpoints) {
		configs.push({
			address: ep,
			tlsEnabled: detectTlsFromAddress(ep),
			selected: true
		});
	}

	return configs;
}
