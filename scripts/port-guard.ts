import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

function occupied(port: number, pids: string[]): Error {
  const owners = pids.length > 0 ? ` by pid ${pids.join(", ")}` : "";
  return new Error(
    `port ${port} is already in use${owners}; stop that process instead of letting the test runner kill it`,
  );
}

export async function assertPortFree(port: number): Promise<void> {
  const lsof = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  });

  if (!lsof.error) {
    const pids = (lsof.stdout ?? "").trim().split("\n").filter(Boolean);
    if (pids.length > 0) throw occupied(port, pids);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "EADDRINUSE"
          ? occupied(port, [])
          : new Error(`cannot check port ${port}: ${error.message}`),
      );
    });
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      server.close(() => resolve());
    });
  });
}
