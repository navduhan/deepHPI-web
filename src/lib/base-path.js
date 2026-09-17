const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

export function withBasePath(path) {
  if (!path.startsWith("/")) return path;
  return `${basePath}${path}`;
}
