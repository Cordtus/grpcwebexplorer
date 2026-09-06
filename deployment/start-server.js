#!/usr/bin/env node

import { createServer } from "node:http";
import net from "node:net";
import { parse } from "node:url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

async function findAvailablePort(startPort = 3000) {
	return new Promise((resolve) => {
		const server = net.createServer();

		server.listen(startPort, (err) => {
			if (err) {
				server.close();
				resolve(findAvailablePort(startPort + 1));
			} else {
				const port = server.address().port;
				server.close();
				resolve(port);
			}
		});

		server.on("error", () => {
			server.close();
			resolve(findAvailablePort(startPort + 1));
		});
	});
}

app.prepare().then(async () => {
	const port = await findAvailablePort(parseInt(process.env.PORT, 10) || 3000);

	createServer(async (req, res) => {
		try {
			const parsedUrl = parse(req.url, true);
			await handle(req, res, parsedUrl);
		} catch (err) {
			console.error("Error occurred handling", req.url, err);
			res.statusCode = 500;
			res.end("internal server error");
		}
	}).listen(port, (err) => {
		if (err) throw err;
		console.log(`> Ready on http://localhost:${port}`);
	});
});
