#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_LIVE_DIR = "/opt/storefront";
export const DEFAULT_PM2_APP = "maky-storefront";

export function canonicalDirectory(directory) {
	try {
		return realpathSync(directory);
	} catch {
		return resolve(directory);
	}
}

export function evaluateBuildSafety({ currentDirectory, liveDirectory, appName, processes }) {
	if (currentDirectory !== liveDirectory) {
		return {
			allowed: true,
			reason: "build is not running in the canonical live checkout",
		};
	}

	const matchingProcesses = processes.filter((processDescription) => processDescription?.name === appName);

	if (matchingProcesses.length === 0) {
		return {
			allowed: false,
			reason: `PM2 has no registered app named "${appName}"; its state cannot be proven safe`,
		};
	}

	const unsafeStatuses = matchingProcesses
		.map((processDescription) => processDescription?.pm2_env?.status ?? "unknown")
		.filter((status) => status !== "stopped");

	if (unsafeStatuses.length > 0) {
		return {
			allowed: false,
			reason: `PM2 app "${appName}" is not stopped (status: ${unsafeStatuses.join(", ")})`,
		};
	}

	return {
		allowed: true,
		reason: `PM2 app "${appName}" is stopped`,
	};
}

export function parsePm2Processes(result) {
	if (result.error) {
		return {
			ok: false,
			reason: `could not run "pm2 jlist": ${result.error.message}`,
		};
	}

	if (result.status !== 0) {
		const detail = String(result.stderr ?? "").trim();
		return {
			ok: false,
			reason: `"pm2 jlist" exited with status ${String(result.status)}${detail ? `: ${detail}` : ""}`,
		};
	}

	try {
		const processes = JSON.parse(String(result.stdout ?? ""));
		if (!Array.isArray(processes)) {
			return { ok: false, reason: '"pm2 jlist" did not return a JSON array' };
		}
		return { ok: true, processes };
	} catch (error) {
		return {
			ok: false,
			reason: `could not parse "pm2 jlist" output: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * @param {{
 *   cwd?: string;
 *   liveDir?: string;
 *   appName?: string;
 *   runPm2?: () => {
 *     error?: Error;
 *     status: number | null;
 *     stdout?: string;
 *     stderr?: string;
 *   };
 *   log?: (message: string) => void;
 *   canonicalize?: (directory: string) => string;
 * }} [options]
 * @returns {0 | 1}
 */
export function main({
	cwd = process.cwd(),
	liveDir = DEFAULT_LIVE_DIR,
	appName = DEFAULT_PM2_APP,
	runPm2 = () =>
		spawnSync("pm2", ["jlist"], {
			encoding: "utf8",
			timeout: 10_000,
		}),
	log = (message) => console.error(message),
	canonicalize = canonicalDirectory,
} = {}) {
	const currentDirectory = canonicalize(cwd);
	const liveDirectory = canonicalize(liveDir);

	if (currentDirectory !== liveDirectory) {
		return 0;
	}

	const parsed = parsePm2Processes(runPm2());
	if (!parsed.ok) {
		log(`[build-guard] Refusing to build in ${liveDirectory}: ${parsed.reason}.`);
		log(
			"[build-guard] Use ./scripts/ops/deploy-production.sh so the live process is stopped and the previous build is snapshotted.",
		);
		return 1;
	}

	const decision = evaluateBuildSafety({
		currentDirectory,
		liveDirectory,
		appName,
		processes: parsed.processes,
	});

	if (!decision.allowed) {
		log(`[build-guard] Refusing to build in ${liveDirectory}: ${decision.reason}.`);
		log(
			"[build-guard] A direct build can replace .next underneath the running server. Use ./scripts/ops/deploy-production.sh.",
		);
		return 1;
	}

	return 0;
}

const isDirectInvocation = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectInvocation) {
	process.exitCode = main();
}
