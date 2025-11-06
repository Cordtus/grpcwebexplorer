/**
 * Debug Utility
 *
 * Provides conditional logging that only outputs in development mode.
 * Use this instead of console.log for client-side debugging to keep
 * production builds clean.
 *
 * @example
 * ```typescript
 * import { debug } from '@/lib/utils/debug';
 *
 * // Logs only in development
 * debug.log('Service loaded:', serviceData);
 * debug.warn('Cache miss for:', endpoint);
 * debug.error('Failed to fetch:', error);
 * ```
 */

/** Check if we're in development mode */
const isDev = process.env.NODE_ENV === 'development';

/**
 * Debug logger that respects environment
 * All methods are no-ops in production
 */
export const debug = {
	/**
	 * Log informational messages
	 * Only outputs in development mode
	 */
	log: (...args: any[]) => {
		if (isDev) console.log(...args);
	},

	/**
	 * Log warning messages
	 * Only outputs in development mode
	 */
	warn: (...args: any[]) => {
		if (isDev) console.warn(...args);
	},

	/**
	 * Log error messages
	 * Only outputs in development mode
	 */
	error: (...args: any[]) => {
		if (isDev) console.error(...args);
	},

	/**
	 * Log informational messages with a group
	 * Only outputs in development mode
	 */
	group: (label: string, ...args: any[]) => {
		if (isDev) {
			console.group(label);
			console.log(...args);
			console.groupEnd();
		}
	},

	/**
	 * Log table data
	 * Only outputs in development mode
	 */
	table: (data: any) => {
		if (isDev) console.table(data);
	},

	/**
	 * Start a timer
	 * Only outputs in development mode
	 */
	time: (label: string) => {
		if (isDev) console.time(label);
	},

	/**
	 * End a timer
	 * Only outputs in development mode
	 */
	timeEnd: (label: string) => {
		if (isDev) console.timeEnd(label);
	},
};

/**
 * Check if debug mode is enabled
 */
export const isDebugMode = () => isDev;
