const isDev = process.env.NODE_ENV === "development";

/** Client-side debug logger; no-ops in production. */
export const debug = {
	log: (...args: any[]) => {
		if (isDev) console.log(...args);
	},
	warn: (...args: any[]) => {
		if (isDev) console.warn(...args);
	},
	error: (...args: any[]) => {
		if (isDev) console.error(...args);
	},
};
