'use client';

import React, { useState } from 'react';
import { useTabManager } from '@/lib/contexts/TabManager';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import AddNetworkDialog from './AddNetworkDialog';

export const TabBar: React.FC = () => {
	const { tabs, activeTabId, setActiveTab, removeTab } = useTabManager();
	const [showAddDialog, setShowAddDialog] = useState(false);

	return (
		<div className="glass-subtle border-b border-border">
			<div className="flex items-center h-10 px-2 gap-1">
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
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
				<button
					onClick={() => setShowAddDialog(true)}
					className="btn-ghost p-1.5 rounded-md"
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>
			{showAddDialog && (
				<AddNetworkDialog 
					onAdd={(endpoint, tls) => {
						// TODO: Handle adding network
						setShowAddDialog(false);
					}}
					onClose={() => setShowAddDialog(false)}
				/>
			)}
		</div>
	);
};