import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const configPath = join(cwd, "src", "domain", "balance.config.json");
const originalText = await readFile(configPath, "utf8");
const alternative = JSON.parse(originalText);
alternative.world.condensesPerDay = 6;
alternative.world.ballInitialV = 80;
alternative.world.soilCapacityV = 72;
alternative.orders.firstWindowDays = 12;
alternative.orders.renewalWindowDays = 10;
alternative.orders.quantity = 2;
alternative.economy.orderDelivery = 21;
const command = (argv, env) => {
  const result = spawnSync("pnpm", argv, { cwd, env, stdio: "inherit", timeout: 240000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Alternate config command failed: " + argv.join(" "));
};
try {
  await writeFile(configPath, JSON.stringify(alternative, null, 2) + "\n");
  command(["run", "build"], process.env);
  command(["exec", "playwright", "test", "tests/balance-variant.spec.ts", "--workers=1", "--reporter=line"], {
    ...process.env, CI: "1", LIYUE_BALANCE_VARIANT: "1",
  });
} finally {
  await writeFile(configPath, originalText);
}
