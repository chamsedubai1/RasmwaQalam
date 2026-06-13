import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";

// NOTE: `vite` is only needed in development. Importing it at the top of this
// module pulls it into the production bundle, which then fails at runtime
// because vite is a devDependency and isn't present in the runtime image.
// We dynamically import vite + the vite.config inside setupVite() so
// production never loads them.

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamic imports so vite is only loaded when this function is actually
  // called (development only). In production, this code path is never hit.
  //
  // The variable indirection on the import specifiers is intentional: it
  // prevents esbuild from statically analyzing and bundling these modules
  // into dist/index.js. If esbuild bundles vite.config.ts, it hoists its
  // own `import { defineConfig } from "vite"` to the top of the bundle,
  // which then crashes at module load in production (no vite installed).
  const viteModule = "vite";
  const viteConfigModule = "../vite.config";
  const nanoidModule = "nanoid";
  const { createServer: createViteServer, createLogger } = await import(viteModule);
  const { default: viteConfig } = await import(viteConfigModule);
  const { nanoid } = await import(nanoidModule);

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
