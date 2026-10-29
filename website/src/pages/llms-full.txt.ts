import { CORE, page, SITE } from '../lib-llms';

export function GET() {
  const parts = CORE.map(page).map((p) => `# ${p.title}\nSource: ${p.url}\n\n${p.body}`);
  const head = `# Matimo: full documentation for LLMs
> Matimo is an MIT-licensed, policy-governed tool-execution SDK for AI agents (TypeScript and Python). This file concatenates the core documentation pages. Summary and guidance for agents: ${SITE}/llms.txt . Every page below also exists as HTML at the Source URL.
> Versions checked 2026-10-29: TypeScript 0.4.0 on npm (matimo, @matimo/core, @matimo/cli); Python matimo was 0.2.0 on PyPI when last checked. Where this text names a version, a newer release may exist; confirm on npm and PyPI.
> Caveats that apply across all pages: the 15 meta-tools are in both SDKs (create, approve, reload and run were verified with pip install matimo 0.2.0 and with the TypeScript SDK); @matimo/composio is TypeScript only. The audit log is tamper evident, not tamper proof.
`;
  return new Response([head, ...parts].join('\n\n---\n\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
