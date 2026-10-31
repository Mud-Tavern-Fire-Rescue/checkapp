// Runs after `next build` (npm "postbuild"). Removes unused Prisma files from
// every server function's file list (.nft.json) so Vercel doesn't store them
// with each deployment; they count against the Function Storage limit.
//
// next.config.ts `outputFileTracingExcludes` handles pages and routes, but
// Turbopack writes the proxy's list (middleware.js.nft.json) separately and
// ignores it, leaving ~60 MB of unused Prisma engines in the proxy function.
//
// The app uses Prisma's Node library engine (runtime/library.js plus the
// libquery_engine binary). Everything removed here is for other databases,
// edge/WASM runtimes, the binary engine, or source maps.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UNUSED = [
  /node_modules\/@prisma\/client\/runtime\/.*\.wasm-base64\./,
  /node_modules\/@prisma\/client\/runtime\/.*\.map$/,
  /node_modules\/@prisma\/client\/runtime\/edge/,
  /node_modules\/@prisma\/client\/runtime\/wasm-/,
  /node_modules\/@prisma\/client\/runtime\/react-native/,
  /node_modules\/@prisma\/client\/runtime\/binary\./,
  /node_modules\/\.prisma\/client\/query_engine_bg\./,
  /node_modules\/\.prisma\/client\/.*\.d\.ts$/,
];

async function* traceFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* traceFiles(full);
    else if (entry.name.endsWith(".nft.json")) yield full;
  }
}

let removed = 0;
for await (const file of traceFiles(".next")) {
  const trace = JSON.parse(await readFile(file, "utf8"));
  const kept = trace.files.filter((f) => !UNUSED.some((re) => re.test(f)));
  if (kept.length !== trace.files.length) {
    removed += trace.files.length - kept.length;
    trace.files = kept;
    await writeFile(file, JSON.stringify(trace));
  }
}
console.log(`trim-traces: removed ${removed} unused Prisma file entries`);
