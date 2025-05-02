// scripts/init-project.js
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Get proper directory path in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

// Create directories
async function ensureDir(dir) {
    try {
        await fs.promises.mkdir(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    } catch (err) {
        console.error(`❌ Failed to create directory ${dir}:`, err);
    }
}

// Write file
async function writeFile(filePath, content) {
    await ensureDir(path.dirname(filePath));
    await fs.promises.writeFile(filePath, content, 'utf8');
    console.log(`✅ Created file: ${filePath}`);
}

async function main() {
    try {
        // Create API directories if they don't exist
        const API_DIRS = [
            path.join(PROJECT_ROOT, 'app', 'api', 'services'),
            path.join(PROJECT_ROOT, 'app', 'api', 'service'),
            path.join(PROJECT_ROOT, 'app', 'api', 'method'),
            path.join(PROJECT_ROOT, 'app', 'api', 'execute')
        ];

        for (const dir of API_DIRS) {
            if (!fs.existsSync(dir)) {
                await ensureDir(dir);
            }
        }

        // Create .eslintrc.json if it doesn't exist
        const eslintPath = path.join(PROJECT_ROOT, '.eslintrc.json');
        if (!fs.existsSync(eslintPath)) {
            const eslintContent = `{
                "extends": "next/core-web-vitals",
                "rules": {
                    "react/no-unescaped-entities": "off",
                    "react/display-name": "off",
                    "react-hooks/exhaustive-deps": "warn",
                    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
                    "no-console": ["warn", { "allow": ["warn", "error", "info"] }],
                    "@next/next/no-img-element": "off"
                }
            }`;
            await writeFile(eslintPath, eslintContent);
        }

        // Create .gitignore if it doesn't exist
        const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
            const gitignoreContent = `# dependencies
            /node_modules
            /.pnp
            .pnp.js
            .yarn/install-state.gz

            # testing
            /coverage

            # next.js
            /.next/
            /out/

            # production
            /build

            # misc
            .DS_Store
            *.pem

            # debug
            npm-debug.log*
            yarn-debug.log*
            yarn-error.log*

            # local env files
            .env*.local
            .env

            # vercel
            .vercel

            # typescript
            *.tsbuildinfo
            next-env.d.ts

            # IDE specific files
            .idea/
            .vscode/
            *.swp
            *.swo

            # OS specific files
            Thumbs.db
            desktop.ini

            # Project specific
            /public/output/
            `;
            await writeFile(gitignorePath, gitignoreContent);
        }

        console.log('✅ Project initialization complete!');

    } catch (err) {
        console.error('❌ Initialization failed:', err);
    }
}

main();
