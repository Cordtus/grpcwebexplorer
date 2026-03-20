import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		include: ['**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: [
				'lib/grpc/descriptor-parser.ts',
				'lib/utils/code-generators.ts',
				'lib/utils/client-cache.ts',
				'lib/types/grpc.ts',
				'app/api/bsr/descriptor/route.ts',
				'app/api/bsr/modules/route.ts',
			],
			reporter: ['text', 'text-summary'],
		},
	},
});
