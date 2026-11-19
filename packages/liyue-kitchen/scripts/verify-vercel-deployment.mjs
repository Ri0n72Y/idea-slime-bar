/** Server-side CI guard. Uses authenticated Vercel API, never the PR input URL.
 * Fails closed on missing token, missing deployment, wrong team/project/ref/SHA or not READY.
 * Token is only passed to this step; no secret or response headers are logged.
 */
import { writeFileSync, appendFileSync } from "node:fs";

const projectId = "prj_VzGBScFrTWp4UZA8IKqzX8Yjot8L";
const teamId = "team_gXKEqiKlbcQGlHioZNZJVKdR";
const origin = "https://api.vercel.com";
const token = process.env.VERCEL_TOKEN;
const sha = process.env.EXPECTED_SHA;
const branch = process.env.EXPECTED_BRANCH;
if (!token) throw Error("VERCEL_TOKEN Actions secret is required for authenticated Preview SHA verification");
if (!/^[a-f0-9]{40}$/.test(sha ?? "") || !branch) throw Error("Missing expected SHA or branch");

async function vercel(path) {
  const res = await fetch(origin + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw Error(`Vercel lookup failed, HTTP ${res.status}`);
  return res.json();
}

export function assertCorrectDeployment(item, expectedSha, expectedBranch) {
  if ((item.projectId ?? item.project?.id) !== projectId) throw Error("Wrong Vercel project");
  if (item.meta?.githubCommitSha !== expectedSha) throw Error("Deployed SHA mismatch");
  if (item.meta?.githubCommitRef !== expectedBranch) throw Error("Deployed branch mismatch");
  if (item.readyState !== "READY" && item.state !== "READY") throw Error("Deployment not READY");
  if (item.target === "production") throw Error("PR must use Preview, not Production");
  const url = new URL(`https://${item.url}`);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".vercel.app") ||
      url.pathname !== "/" || url.username || url.password) throw Error("Invalid Vercel URL");
  return url.origin + "/";
}

// Listing is constrained to the configured project and exact SHA; a second
// authenticated read checks the selected deployment ID and actual metadata.
let deployed;
for (let attempt = 0; attempt < 36; attempt++) {
  const qs = new URLSearchParams({ projectId, teamId, sha, limit: "20" });
  const list = await vercel("/v6/deployments?" + qs);
  const candidates = (list.deployments ?? []).filter(d =>
    d.meta?.githubCommitSha === sha && d.meta?.githubCommitRef === branch &&
    d.target !== "production");
  if (candidates.length) {
    const selected = candidates.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];
    const id = selected.uid ?? selected.id;
    deployed = await vercel(`/v13/deployments/${encodeURIComponent(id)}?teamId=${teamId}`);
    if (deployed.readyState === "ERROR" || deployed.state === "ERROR") throw Error("Vercel Preview build failed");
    if (deployed.readyState === "READY" || deployed.state === "READY") break;
  }
  await new Promise(resolve => setTimeout(resolve, 10000));
}
const deployedUrl = assertCorrectDeployment(deployed ?? {}, sha, branch);
const audit = { deploymentId: deployed.uid ?? deployed.id, projectId, branch, sha,
  readyState: deployed.readyState ?? deployed.state, url: deployedUrl };
console.log("VERCEL_PREVIEW_VERIFIED " + JSON.stringify(audit));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${deployedUrl}\n`);
else writeFileSync("verified-vercel-deployment.json", JSON.stringify(audit, null, 2));
