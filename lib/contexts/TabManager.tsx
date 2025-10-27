'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface NetworkTab {
	id: string;
	name: string;
	endpoint: string;
	isActive: boolean;
	tlsEnabled: boolean;
	services: any[]; // Will store the services tree for this tab
	selectedMethod: {
		service: string;
		method: string;
		module?: string;
	} | undefined;
	status?: {
		total: number;
		successful: number;
		failed: number;
		withMethods: number;
		withoutMethods: number;
		completionRate: number;
		endpoint: string | null;
	};
	warnings?: string[];
}

interface TabManagerContextType {
	tabs: NetworkTab[];
	activeTabId: string | null;
	addTab: (endpoint: string, name?: string, tlsEnabled?: boolean) => string;
	removeTab: (tabId: string) => void;
	setActiveTab: (tabId: string) => void;
	updateTab: (tabId: string, updates: Partial<NetworkTab>) => void;
	getActiveTab: () => NetworkTab | null;
}

const TabManagerContext = createContext<TabManagerContextType | undefined>(undefined);

export const useTabManager = () => {
	const context = useContext(TabManagerContext);
	if (!context) {
		throw new Error('useTabManager must be used within a TabManagerProvider');
	}
	return context;
};

interface TabManagerProviderProps {
	children: ReactNode;
}

export const TabManagerProvider: React.FC<TabManagerProviderProps> = ({ children }) => {
	const [tabs, setTabs] = useState<NetworkTab[]>([]);
	const [activeTabId, setActiveTabId] = useState<string | null>(null);

	const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	const addTab = useCallback((endpoint: string, name?: string, tlsEnabled: boolean = true): string => {
		const tabId = generateTabId();
		let tabName = name;
		
		try {
			if (!tabName) {
				const url = new URL(endpoint);
				tabName = url.hostname || 'New Tab';
			}
		} catch {
			tabName = name || 'New Tab';
		}
		
		const newTab: NetworkTab = {
			id: tabId,
			name: tabName,
			endpoint,
			isActive: true,
			tlsEnabled,
			services: [],
			selectedMethod: undefined
		};

		setTabs(prevTabs => {
			// Deactivate all existing tabs
			const updatedTabs = prevTabs.map(tab => ({ ...tab, isActive: false }));
			return [...updatedTabs, newTab];
		});
		setActiveTabId(tabId);
		return tabId;
	}, []);

	const removeTab = useCallback((tabId: string) => {
		setTabs(prevTabs => {
			const filteredTabs = prevTabs.filter(tab => tab.id !== tabId);
			
			// If we're removing the active tab, activate the last remaining tab
			if (activeTabId === tabId && filteredTabs.length > 0) {
				const newActiveTab = filteredTabs[filteredTabs.length - 1];
				newActiveTab.isActive = true;
				setActiveTabId(newActiveTab.id);
			} else if (filteredTabs.length === 0) {
				setActiveTabId(null);
			}
			
			return filteredTabs;
		});
	}, [activeTabId]);

	const setActiveTab = useCallback((tabId: string) => {
		setTabs(prevTabs => 
			prevTabs.map(tab => ({
				...tab,
				isActive: tab.id === tabId
			}))
		);
		setActiveTabId(tabId);
	}, []);

	const updateTab = useCallback((tabId: string, updates: Partial<NetworkTab>) => {
		setTabs(prevTabs =>
			prevTabs.map(tab =>
				tab.id === tabId ? { ...tab, ...updates } : tab
			)
		);
	}, []);

	const getActiveTab = useCallback((): NetworkTab | null => {
		return tabs.find(tab => tab.id === activeTabId) || null;
	}, [tabs, activeTabId]);

	const value: TabManagerContextType = {
		tabs,
		activeTabId,
		addTab,
		removeTab,
		setActiveTab,
		updateTab,
		getActiveTab
	};

	return (
		<TabManagerContext.Provider value={value}>
			{children}
		</TabManagerContext.Provider>
	);
};