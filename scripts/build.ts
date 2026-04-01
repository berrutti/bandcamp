import { readFileSync, writeFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as Record<string, unknown>;
manifest.version = version;
writeFileSync("extension/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
