import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Extract message string from an unknown catch value. */
export function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

/**
 * True when a gRPC error indicates a TLS version/handshake mismatch (the classic
 * signature of connecting to a plaintext port with TLS, or vice-versa). Callers
 * use this to retry the endpoint with TLS toggled off.
 */
export function isTLSError(message: string): boolean {
	return (
		message.includes("wrong version number") ||
		message.includes("SSL routines") ||
		message.includes("EPROTO")
	);
}
