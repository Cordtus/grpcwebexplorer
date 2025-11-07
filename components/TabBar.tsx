'use client';

import React, { useState } from 'react';
import { useTabManager } from '@/lib/contexts/TabManager';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import AddNetworkDialog from './AddNetworkDialog';

/**
 * TabBar Component
 *
 * Displays network tabs with add/remove functionality.
 * Integrates with TabManager context for centralized tab state management.
 *
 * Features:
 * - Interactive tab switching
 * - Tab close buttons with hover visibility
 * - Network addition via AddNetworkDialog
 * - Horizontal scroll for overflow tabs
 */
export const TabBar: React.FC = () => {
	const { tabs, activeTabId, setActiveTab, removeTab, addTab } = useTabManager();
	const [showAddDialog, setShowAddDialog] = useState(false);

	/**
	 * Handles adding a new network tab
	 * Creates a tab with the specified endpoint and TLS configuration
	 *
	 * @param endpoint - gRPC endpoint URL
	 * @param tls - Whether TLS is enabled for this endpoint
	 */
	const handleAddNetwork = (endpoint: string, tls: boolean) => {
		addTab(endpoint, undefined, tls);
		setShowAddDialog(false);
	};

	return (
		<div className="glass-subtle border-b border-border">
			<div className="flex items-center h-10 px-2 gap-1">
				{/* Scrollable tab container */}
				<div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin">
					{tabs.map((tab) => (
						<div
							key={tab.id}
							className={cn(
								"tab group",
								tab.id === activeTabId && "active"
							)}
							onClick={() => setActiveTab(tab.id)}
						>
							<span className="text-sm truncate max-w-[150px]" title={tab.endpoint}>
								{tab.name}
							</span>
							<button
								onClick={(e) => {
									e.stopPropagation();
									removeTab(tab.id);
								}}
								className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 rounded hover:bg-destructive/20 transition-all"
								aria-label={`Close ${tab.name} tab`}
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>

				{/* Add network button */}
				<button
					onClick={() => setShowAddDialog(true)}
					className="btn-ghost p-1.5 rounded-md"
					aria-label="Add network"
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>

			{/* Network addition dialog */}
			{showAddDialog && (
				<AddNetworkDialog
					onAdd={handleAddNetwork}
					onClose={() => setShowAddDialog(false)}
				/>
			)}
		</div>
	);
};