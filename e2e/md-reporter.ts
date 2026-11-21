/**
 * Reporter de Playwright que genera `docs/qa/TEST_RESULTS_AUTO.md`.
 *
 * - Cruza los resultados con los casos de `docs/qa/TEST_CASES.md` por su ID (TC-001, TC-002…).
 * - ACUMULA resultados entre ejecuciones (así puedes lanzar los tests por archivos y el informe
 *   va completándose). Para empezar de cero:  QA_RESET=1 pnpm test:e2e
 * - Los casos sin test automático aparecen como «Manual»: esos se anotan a mano en TEST_RESULTS.md.
 */
import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

type Status = "passed" | "failed" | "pending";

type Entry = {
  ids: string[];
  title: string;
  file: string;
  project: string;
  status: Status;
  flaky: boolean;
  durationMs: number;
  error: string;
  date: string;
};

type State = { entries: Record<string, Entry> };

type Options = {
  outputFile?: string;
  casesFile?: string;
  stateFile?: string;
};

type CaseInfo = { id: string; title: string; story: string };

const ID_RE = /TC-\d{3}/g;

function cell(text: string): string {
  return text
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "?";
  }
}

function firstLines(message: string, max = 2): string {
  const lines = stripVTControlCharacters(message)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(0, max).join(" · ").slice(0, 300);
}

/** Lee los casos de TEST_CASES.md: filas `| TC-001 | título | …` y la historia de su sección. */
function parseCases(md: string): CaseInfo[] {
  const cases: CaseInfo[] = [];
  let story = "—";
  for (const line of md.split("\n")) {
    const header = /^##\s+(.+)$/.exec(line);
    if (header) {
      const us = /^(US-\d+)/.exec(header[1] ?? "");
      story = us?.[1] ?? (header[1] ?? "—").trim();
      continue;
    }
    const row = /^\|\s*(TC-\d{3})\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (row) cases.push({ id: row[1]!, title: row[2] ?? "", story });
  }
  return cases;
}

/** IDs TC-xxx que aparecen al inicio de una cadena en los .spec.ts (= casos automatizados). */
function automatedIds(rootDir: string): Set<string> {
  const ids = new Set<string>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(rootDir).filter((f) => f.endsWith(".spec.ts"));
  } catch {
    return ids;
  }
  for (const f of files) {
    const src = fs.readFileSync(path.join(rootDir, f), "utf8");
    for (const m of src.matchAll(/["'`](TC-\d{3}(?:[^"'`\n]*))["'`]/g)) {
      for (const id of m[1]?.match(ID_RE) ?? []) ids.add(id);
    }
  }
  return ids;
}

export default class MarkdownReporter implements Reporter {
  private readonly options: Required<Options>;
  private rootDir = "";
  private readonly last = new Map<
    string,
    { test: TestCase; result: TestResult }
  >();

  constructor(options: Options = {}) {
    this.options = {
      outputFile: options.outputFile ?? "docs/qa/TEST_RESULTS_AUTO.md",
      casesFile: options.casesFile ?? "docs/qa/TEST_CASES.md",
      stateFile: options.stateFile ?? "docs/qa/.results-state.json",
    };
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig): void {
    this.rootDir = config.rootDir;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.last.set(test.id, { test, result });
  }

  onEnd(): void {
    const cwd = process.cwd();
    const statePath = path.resolve(cwd, this.options.stateFile);
    const state = this.loadState(statePath);
    const now = new Date().toISOString().slice(0, 16).replace("T", " ");

    for (const { test, result } of this.last.values()) {
      const outcome = test.outcome();
      const status: Status =
        outcome === "skipped"
          ? "pending"
          : outcome === "unexpected"
            ? "failed"
            : "passed";
      const titlePath = test.titlePath().filter(Boolean);
      const project = test.parent.project()?.name ?? "";
      const file = path.relative(cwd, test.location.file);
      const error =
        status === "failed"
          ? firstLines(result.errors[0]?.message ?? result.error?.message ?? "")
          : "";
      state.entries[`${project}|${file}|${titlePath.join(" › ")}`] = {
        ids: test.title.match(ID_RE) ?? [],
        title: test.title,
        file,
        project,
        status,
        flaky: outcome === "flaky",
        durationMs: result.duration,
        error,
        date: now,
      };
    }

    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const outPath = path.resolve(cwd, this.options.outputFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, this.render(state, now, cwd));
  }

  private loadState(statePath: string): State {
    if (process.env.QA_RESET || !fs.existsSync(statePath)) {
      return { entries: {} };
    }
    try {
      return JSON.parse(fs.readFileSync(statePath, "utf8")) as State;
    } catch {
      return { entries: {} };
    }
  }

  private render(state: State, now: string, cwd: string): string {
    const casesPath = path.resolve(cwd, this.options.casesFile);
    const cases = fs.existsSync(casesPath)
      ? parseCases(fs.readFileSync(casesPath, "utf8"))
      : [];
    const automated = automatedIds(this.rootDir);
    const entries = Object.values(state.entries);

    const byId = new Map<string, Entry[]>();
    for (const e of entries) {
      for (const id of e.ids) byId.set(id, [...(byId.get(id) ?? []), e]);
    }

    type Row = {
      c: CaseInfo;
      label: string;
      kind: "passed" | "failed" | "pending" | "notrun" | "manual";
      runs: string;
      date: string;
      note: string;
    };

    const rows: Row[] = cases.map((c) => {
      const es = byId.get(c.id) ?? [];
      if (es.length === 0) {
        return automated.has(c.id)
          ? {
              c,
              label: "⏳ Sin ejecutar",
              kind: "notrun",
              runs: "",
              date: "",
              note: "",
            }
          : {
              c,
              label: "🖐️ Manual",
              kind: "manual",
              runs: "",
              date: "",
              note: "Sin test automático",
            };
      }
      const failed = es.filter((e) => e.status === "failed");
      const passed = es.filter((e) => e.status === "passed");
      const date =
        es
          .map((e) => e.date)
          .sort()
          .at(-1) ?? "";
      const runs = `${passed.length}/${es.length}`;
      if (failed.length > 0) {
        return {
          c,
          label: "❌ Failed",
          kind: "failed",
          runs,
          date,
          note: failed[0]?.error ?? "",
        };
      }
      if (passed.length > 0) {
        const flaky = passed.some((e) => e.flaky) ? "Inestable (flaky)" : "";
        return {
          c,
          label: "✅ Passed",
          kind: "passed",
          runs,
          date,
          note: flaky,
        };
      }
      return {
        c,
        label: "⏭️ Pendiente (fixme/skip)",
        kind: "pending",
        runs,
        date,
        note: "Test marcado como pendiente en el código",
      };
    });

    const n = (k: Row["kind"]) => rows.filter((r) => r.kind === k).length;
    const executed = n("passed") + n("failed");
    const pct = executed
      ? `${((n("passed") / executed) * 100).toFixed(1)} %`
      : "—";

    const unknownTests = entries.filter(
      (e) =>
        e.ids.length === 0 ||
        e.ids.every((id) => !cases.some((c) => c.id === id)),
    );

    const out: string[] = [
      "# Resultados automáticos de las pruebas — Dovivo",
      "",
      "> **Archivo generado por `e2e/md-reporter.ts`. No editar a mano: se sobrescribe en cada ejecución de Playwright.**",
      "> Acumula los resultados de ejecuciones anteriores (`QA_RESET=1 pnpm test:e2e` para empezar de cero).",
      "> Los casos «Manual» se anotan a mano en [TEST_RESULTS.md](TEST_RESULTS.md).",
      "",
      "## Última ejecución",
      "",
      "| Campo | Valor |",
      "|---|---|",
      `| Fecha | ${now} |`,
      `| Rama | ${git("rev-parse --abbrev-ref HEAD")} |`,
      `| Commit | ${git("rev-parse --short HEAD")} |`,
      `| Entorno | ${process.env.E2E_BASE_URL ?? "local (http://localhost:3000)"} |`,
      `| Sistema | ${process.platform} · Node ${process.version} |`,
      "",
      "## Resumen",
      "",
      "| Métrica | Valor |",
      "|---|---|",
      `| Casos diseñados (TEST_CASES.md) | ${cases.length} |`,
      `| Con test automático | ${cases.length - n("manual")} |`,
      `| Ejecutados con resultado (Passed + Failed) | ${executed} |`,
      `| ✅ Passed | ${n("passed")} |`,
      `| ❌ Failed | ${n("failed")} |`,
      `| ⏭️ Pendiente (fixme/skip) | ${n("pending")} |`,
      `| ⏳ Automáticos sin ejecutar | ${n("notrun")} |`,
      `| 🖐️ Manuales (a rellenar a mano) | ${n("manual")} |`,
      `| % de superación (Passed ÷ ejecutados) | ${pct} |`,
      "",
      "## Resultados por caso",
      "",
      "| ID | Historia | Prueba | Estado | Tests OK | Última ejecución | Notas |",
      "|---|---|---|---|---|---|---|",
      ...rows.map(
        (r) =>
          `| ${r.c.id} | ${cell(r.c.story)} | ${cell(r.c.title)} | ${r.label} | ${r.runs} | ${r.date} | ${cell(r.note)} |`,
      ),
      "",
    ];

    const fails = rows.filter((r) => r.kind === "failed");
    out.push("## Fallos", "");
    if (fails.length === 0) {
      out.push("Ningún test falla en las ejecuciones registradas.", "");
    } else {
      out.push(
        "Antes de abrir una Issue, comprueba si el fallo es del test (selector o texto incorrecto) o un defecto real de la aplicación.",
        "",
      );
      for (const r of fails) {
        out.push(`### ${r.c.id} · ${cell(r.c.title)}`, "");
        for (const e of (byId.get(r.c.id) ?? []).filter(
          (x) => x.status === "failed",
        )) {
          out.push(
            `- **${cell(e.title)}** (\`${e.file}\`): ${cell(e.error) || "sin mensaje"}`,
          );
        }
        out.push("");
      }
    }

    if (unknownTests.length > 0) {
      out.push(
        "## Tests sin caso en TEST_CASES.md",
        "",
        "| Test | Archivo | Estado | Última ejecución |",
        "|---|---|---|---|",
        ...unknownTests.map(
          (e) => `| ${cell(e.title)} | ${e.file} | ${e.status} | ${e.date} |`,
        ),
        "",
      );
    }

    return out.join("\n") + "\n";
  }
}
