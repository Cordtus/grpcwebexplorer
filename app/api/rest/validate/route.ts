import { NextResponse } from "next/server";
import { fetchChainApis } from "@/lib/services/chainRegistry";
import { errorMessage } from "@/lib/utils";
import { isLavenderFiveEndpoint } from "@/lib/utils/endpoint-priority";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_CANDIDATES = 8;
const PROBE_TIMEOUT_MS = 4000;
const NODE_INFO_PATH = "/cosmos/base/tendermint/v1beta1/node_info";

function normalizeBaseUrl(address: string): string {
	const trimmed = address.trim().replace(/\/+$/, "");
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function isWorkingRestEndpoint(baseUrl: string): Promise<boolean> {
	try {
		const response = await fetch(`${baseUrl}${NODE_INFO_PATH}`, {
			method: "GET",
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		return response.ok;
	} catch {
		return false;
	}
}

/** POST /api/rest/validate — verify chain-registry REST endpoints for a chain. */
export async function POST(request: Request) {
	try {
		const { chainName } = (await request.json()) as { chainName?: string };
		if (!chainName || !/^[a-z0-9-]+$/i.test(chainName)) {
			return NextResponse.json(
				{ error: "Invalid or missing chainName" },
				{ status: 400 },
			);
		}

		const apis = await fetchChainApis(chainName);
		const candidates = Array.from(
			new Set(
				(apis?.rest || [])
					.map((endpoint) => normalizeBaseUrl(endpoint.address))
					.filter((address): address is string => Boolean(address)),
			),
		)
			.sort(() => Math.random() - 0.5)
			.slice(0, MAX_CANDIDATES);

		const checks = await Promise.all(
			candidates.map(async (endpoint) => ({
				endpoint,
				working: await isWorkingRestEndpoint(endpoint),
			})),
		);

		const working = checks
			.filter((check) => check.working)
			.map((check) => check.endpoint);
		const nonLavender = working.filter(
			(endpoint) => !isLavenderFiveEndpoint(endpoint),
		);

		// Lavender Five is the last choice for REST too, but remains usable if
		// it is the only verified provider.
		return NextResponse.json({
			endpoints: nonLavender.length > 0 ? nonLavender : working,
		});
	} catch (error: unknown) {
		console.error("[RestValidate] Error:", error);
		return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
	}
}
