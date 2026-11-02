const LAVENDER_FIVE_RE = /lavender[\s._-]*five|lavender5/i;

/** Lavender Five endpoints are always tried after every other provider. */
export function isLavenderFiveEndpoint(
	address: string,
	provider?: string,
): boolean {
	return (
		LAVENDER_FIVE_RE.test(address) || LAVENDER_FIVE_RE.test(provider ?? "")
	);
}
