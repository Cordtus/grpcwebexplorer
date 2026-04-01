import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Extract message string from an unknown catch value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
