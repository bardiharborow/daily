import { spawn } from "node:child_process";

export function copyToClipboard(text: string): Promise<void> {
  if (process.platform !== "darwin") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const child = spawn("pbcopy");
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pbcopy exited with code ${code}`));
      }
    });
    child.stdin.end(text);
  });
}
