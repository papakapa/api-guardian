import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function getGitRoot(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error(
      `Not a git repository (or git failed). cwd=${cwd}. Use diff --mode snapshot with explicit --base and --head JSON files, or run from a git repo.`,
    );
  }
}

function refExists(repoRoot: string, ref: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], {
      cwd: repoRoot,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a ref for worktree checkout. If `origin/main` is missing, try `main`.
 */
export function resolveGitRef(repoRoot: string, ref: string): string {
  const candidates = ref === "origin/main" ? ["origin/main", "main"] : [ref];
  for (const c of candidates) {
    if (refExists(repoRoot, c)) {
      return c;
    }
  }
  throw new Error(
    `Git ref could not be resolved: ${ref} (tried: ${candidates.join(", ")})`,
  );
}

export function withGitWorktree<T>(
  repoRoot: string,
  ref: string,
  fn: (dir: string) => T,
): T {
  const resolved = resolveGitRef(repoRoot, ref);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "api-guardian-wt-"));
  try {
    execFileSync("git", ["worktree", "add", "--detach", tmp, resolved], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    return fn(tmp);
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", tmp], {
        cwd: repoRoot,
        stdio: "pipe",
      });
    } catch {
      // best-effort cleanup
    }
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
