"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

export type Theme = "light" | "dark" | "retro" | "system";

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	resolvedTheme: "light" | "dark" | "retro";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>("system");
	const [resolvedTheme, setResolvedTheme] = useState<
		"light" | "dark" | "retro"
	>("dark");
	const [mounted, setMounted] = useState(false);

	const applyTheme = useCallback((nextTheme: Theme) => {
		const root = document.documentElement;

		// Remove all theme classes
		root.classList.remove("light", "dark", "retro");

		let effectiveTheme: "light" | "dark" | "retro" = "dark";

		if (nextTheme === "system") {
			// Detect system preference
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			effectiveTheme = prefersDark ? "dark" : "light";
		} else {
			effectiveTheme = nextTheme;
		}

		// Add the effective theme class
		root.classList.add(effectiveTheme);
		setResolvedTheme(effectiveTheme);
	}, []);

	useEffect(() => {
		setMounted(true);
		// Load theme from localStorage on mount
		const savedTheme = localStorage.getItem("grpc-explorer-theme") as Theme;
		if (
			savedTheme &&
			["light", "dark", "retro", "system"].includes(savedTheme)
		) {
			setThemeState(savedTheme);
			applyTheme(savedTheme);
		} else {
			// Default to system
			setThemeState("system");
			applyTheme("system");
		}
	}, [applyTheme]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		localStorage.setItem("grpc-explorer-theme", newTheme);
		applyTheme(newTheme);
	};

	// Listen for system theme changes
	useEffect(() => {
		if (theme !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			applyTheme("system");
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme, applyTheme]);

	// Prevent flash of unstyled content
	if (!mounted) {
		return <div style={{ visibility: "hidden" }}>{children}</div>;
	}

	return (
		<ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
