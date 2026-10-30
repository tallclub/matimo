// Renders the docs diagrams as light and dark SVGs into src/assets/diagrams/.
// Run with `pnpm diagrams`. Edit the specs at the bottom, then re-run and commit the output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'diagrams');
const M = 20; // canvas margin
const CH = { t: 7.0, m: 7.7, h: 8.4 }; // rough glyph widths, used only to warn about overflow

// ---- spec helpers ---------------------------------------------------------------------
// Text lines are strings (sans) or { m: '...' } (mono). Tone: undefined | 'accent' | 'ok' | 'bad'.
const N = (title, lines = [], tone, sub) => ({ k: 'n', title, lines, tone, sub });
const A = (label) => ({ k: 'a', label });
const R = (nodes, arrows = true) => ({ k: 'r', nodes, arrows });
const F = (cols) => ({ k: 'f', cols });
const G = (title, chips, tone) => ({ k: 'g', title, chips, tone });
const GAP = (h = 12) => ({ k: 'gap', h });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nb = (s) => s.replace(/^ +/, (m) => ' '.repeat(m.length));
const lineText = (l) => (typeof l === 'string' ? l : l.m);
let warnName = '';
const warn = (text, width, avail) => {
  if (width > avail) console.warn(`  [${warnName}] may overflow (${Math.round(width)} > ${Math.round(avail)}): ${text}`);
};

const nodeH = (n) => {
  let h = 14;
  if (n.title) h += 22 + (n.lines.length ? 2 : 0);
  h += n.lines.length * 21;
  return h + (n.lines.length ? 8 : 12);
};

function drawNode(n, x, y, w, h) {
  const tone = n.tone ? ` ${n.tone}` : '';
  let s = `<rect class="box${tone}" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`;
  let ty = y + 14;
  if (n.title) {
    warn(n.title, n.title.length * CH.h + (n.sub ? n.sub.length * CH.t + 8 : 0), w - 36);
    s += `<text class="h${tone}" x="${x + 18}" y="${y + 29}">${esc(n.title)}${n.sub ? `<tspan class="t sub" dx="8">${esc(n.sub)}</tspan>` : ''}</text>`;
    ty += 24;
  }
  n.lines.forEach((l, i) => {
    const mono = typeof l !== 'string';
    const txt = lineText(l);
    warn(txt, txt.length * (mono ? CH.m : CH.t), w - 36);
    s += `<text class="${mono ? 'm' : 't'}" x="${x + 18}" y="${ty + 14 + i * 21}">${esc(nb(txt))}</text>`;
  });
  return s;
}

const arrow = (x, y1, y2, label, cls = 'ln', marker = 'ar') => {
  let s = `<path class="${cls}" d="M${x} ${y1} V${y2}" marker-end="url(#${marker})"/>`;
  if (label) s += `<text class="t sub" x="${x + 10}" y="${(y1 + y2) / 2 + 4}" style="font-size:12px">${esc(label)}</text>`;
  return s;
};

// Renders items top to bottom inside [x, x+w] starting at y. Returns { svg, bottom }.
function render(items, x, y, w) {
  let svg = '';
  let prevBlock = false;
  for (const it of items) {
    if (it.k === 'a') {
      svg += arrow(x + w / 2, y, y + 28, it.label);
      y += 28;
      prevBlock = false;
      continue;
    }
    if (it.k === 'gap') { y += it.h; prevBlock = false; continue; }
    if (prevBlock) { svg += arrow(x + w / 2, y, y + 26); y += 26; }
    if (it.k === 'n') {
      const h = nodeH(it);
      svg += drawNode(it, x, y, w, h);
      y += h;
    } else if (it.k === 'r') {
      const n = it.nodes.length, gap = it.arrows ? 44 : 16;
      const nw = (w - gap * (n - 1)) / n;
      const h = Math.max(...it.nodes.map(nodeH));
      it.nodes.forEach((nd, i) => {
        const nx = x + i * (nw + gap);
        svg += drawNode(nd, nx, y, nw, h);
        if (it.arrows && i < n - 1) svg += `<path class="ln" d="M${nx + nw + 6} ${y + h / 2} H${nx + nw + gap - 6}" marker-end="url(#ar)"/>`;
      });
      y += h;
    } else if (it.k === 'g') {
      const cw = (w - 36 - 24) / 3, ch = 54, rows = Math.ceil(it.chips.length / 3);
      const h = 52 + rows * ch + (rows - 1) * 10 + 18;
      const tone = it.tone ? ` ${it.tone}` : '';
      svg += `<rect class="box${tone}" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`;
      svg += `<text class="h${tone}" x="${x + 18}" y="${y + 29}">${esc(it.title)}</text>`;
      it.chips.forEach(([t, d], i) => {
        const cx = x + 18 + (i % 3) * (cw + 12), cy = y + 46 + Math.floor(i / 3) * (ch + 10);
        warn(t, t.length * 7.7, cw - 24);
        svg += `<rect class="chip" x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="9"/>`;
        svg += `<text class="hs" x="${cx + 14}" y="${cy + (d ? 22 : 32)}">${esc(t)}</text>`;
        if (d) svg += `<text class="t" x="${cx + 14}" y="${cy + 41}" style="font-size:12.5px">${esc(d)}</text>`;
      });
      y += h;
    } else if (it.k === 'f') {
      const n = it.cols.length, gap = 16;
      const total = it.cols.reduce((a, c) => a + (c.w ?? 1), 0);
      const avail = w - gap * (n - 1);
      let cx0 = x;
      const geo = it.cols.map((c) => { const cw = (avail * (c.w ?? 1)) / total; const g = { x: cx0, w: cw, cx: cx0 + cw / 2 }; cx0 += cw + gap; return g; });
      const y1 = y + 14, labelTop = y + 36;
      svg += `<path class="ln" d="M${x + w / 2} ${y} V${y1}"/>`;
      if (n > 1) svg += `<path class="ln" d="M${geo[0].cx} ${y1} H${geo[n - 1].cx}"/>`;
      let bottom = y;
      it.cols.forEach((c, i) => {
        const g = geo[i];
        let iy;
        if (c.label) {
          const pw = Math.max(54, c.label.length * 6.6 + 26);
          warn(c.label, pw, g.w + 12);
          svg += arrow(g.cx, y1, labelTop);
          svg += `<rect class="pill${c.tone ? ' ' + c.tone : ''}" x="${g.cx - pw / 2}" y="${labelTop}" width="${pw}" height="24" rx="12"/>`;
          svg += `<text class="pt${c.tone ? ' ' + c.tone : ''}" x="${g.cx}" y="${labelTop + 16}" text-anchor="middle">${esc(c.label)}</text>`;
          svg += arrow(g.cx, labelTop + 24, labelTop + 46);
          iy = labelTop + 46;
        } else {
          svg += arrow(g.cx, y1, labelTop + 12);
          iy = labelTop + 12;
        }
        const sub = render(c.items, g.x, iy, g.w);
        svg += sub.svg;
        bottom = Math.max(bottom, sub.bottom);
      });
      y = bottom;
    }
    prevBlock = it.k !== 'f';
  }
  return { svg, bottom: y };
}

const STYLE = `
      .bg { fill: #0b0b10; }
      .box { fill: #14141b; stroke: #2a2a35; stroke-width: 1.2; }
      .box.accent { fill: #1a0f15; stroke: #ff3d7f; stroke-width: 1.4; }
      .box.ok { fill: #0f1a15; stroke: #3ddc97; stroke-width: 1.3; }
      .box.bad { fill: #1a1010; stroke: #ff5c5c; stroke-width: 1.3; }
      .chip { fill: #1b1b24; stroke: #2a2a35; stroke-width: 1; }
      .pill { fill: #1b1b24; stroke: #2a2a35; stroke-width: 1; }
      .pill.ok { stroke: #3ddc97; } .pill.bad { stroke: #ff5c5c; }
      .h { font: 650 15.5px 'Inter Variable', Inter, system-ui, 'Segoe UI', sans-serif; fill: #ececf1; }
      .h.accent { fill: #ff7aa8; } .h.ok { fill: #7ae7b9; } .h.bad { fill: #ff8a8a; }
      .hs { font: 650 14px 'Inter Variable', Inter, system-ui, 'Segoe UI', sans-serif; fill: #ececf1; }
      .t { font: 400 13.5px 'Inter Variable', Inter, system-ui, 'Segoe UI', sans-serif; fill: #c4c4d0; }
      .sub { fill: #9a9aa8; }
      .m { font: 400 12.5px 'JetBrains Mono Variable', ui-monospace, Menlo, Consolas, monospace; fill: #c4c4d0; }
      .pt { font: 600 12px 'Inter Variable', Inter, system-ui, 'Segoe UI', sans-serif; fill: #c4c4d0; }
      .pt.ok { fill: #7ae7b9; } .pt.bad { fill: #ff8a8a; }
      .ln { stroke: #9a9aa8; stroke-width: 1.5; fill: none; }`;

const LIGHT = { '#0b0b10': '#f4f4f8', '#14141b': '#ffffff', '#1a0f15': '#fff1f6', '#0f1a15': '#effaf5', '#1a1010': '#fff1f1', '#2a2a35': '#d4d4de', '#1b1b24': '#ececf2', '#9a9aa8': '#5c5c6a', '#ececf1': '#14141a', '#c4c4d0': '#2c2c38', '#ff7aa8': '#b3124f', '#ff3d7f': '#d6205f', '#3ddc97': '#168a60', '#7ae7b9': '#0f6b4a', '#ff5c5c': '#d93a3a', '#ff8a8a': '#a32424' };

function build(spec) {
  warnName = spec.name;
  const cw = spec.w ?? 860;
  const r = render(spec.items, M, M, cw);
  const W = cw + 2 * M, H = r.bottom + M;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.alt)}">
  <title>${esc(spec.alt)}</title>
  <defs>
    <marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9 z" fill="#9a9aa8"/></marker>
    <style>${STYLE}
    </style>
  </defs>
  <rect class="bg" width="${W}" height="${H}" rx="18"/>
  ${r.svg}
</svg>
`;
  const light = svg.replace(/#[0-9a-f]{6}/gi, (c) => LIGHT[c.toLowerCase()] ?? c);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${spec.name}-dark.svg`), svg);
  fs.writeFileSync(path.join(OUT, `${spec.name}-light.svg`), light);
  return { name: spec.name, W, H: Math.round(H), alt: spec.alt };
}

// ---- specs ----------------------------------------------------------------------------
const matimoSdk = N('Matimo SDK', [{ m: 'm.execute(toolName, params)' }]);
const executors = N('Tool executors', ['HTTP, function or command']);

export const specs = [
  {
    name: 'policy-gate', w: 700, alt: 'The agent calls matimo.execute, the policy gate checks it with canExecute, the approval handler, the content validator, the risk classifier, the integrity tracker and the HMAC approval manifest, and an allowed call reaches the tool executor.',
    items: [
      N('Agent or framework', ['LangChain, MCP, or direct SDK calls']),
      A('matimo.execute(toolName, params)'),
      G('Policy gate', [['canExecute()', 'RBAC and status'], ['Approval handler'], ['Content validator', '9 security rules'], ['Risk classifier'], ['Integrity tracker'], ['HMAC approval manifest']], 'accent'),
      A('allowed'),
      N('Tool execution', ['HTTP, command or function executor']),
    ],
  },
  {
    name: 'policy-validation', w: 700, alt: 'policy.yaml becomes a PolicyConfig. When an agent proposes a tool, the ContentValidator uses that config to check the 9 rules plus the policy settings, and the tool either passes or is blocked.',
    items: [
      R([N('policy.yaml'), N('PolicyConfig', ['settings the validator uses'])]),
      A('configures'),
      R([N('Agent proposes tool'), N('ContentValidator', ['uses PolicyConfig']), N('Check 9 rules', ['plus policy settings'])]),
      F([{ items: [N('Pass', [], 'ok')] }, { items: [N('Blocked', [], 'bad')] }]),
    ],
  },
  {
    name: 'tool-lifecycle', alt: 'Tool lifecycle in four steps: create a YAML draft, approve it with an HMAC signature, reload the registry, then use the tool.',
    items: [R([
      N('Create', ['YAML draft', 'validates content', 'forces draft']),
      N('Approve', ['status: approved', 're-validates', 'signs the HMAC']),
      N('Reload', ['registry loaded', 'policy check on', 'untrusted tools']),
      N('Use', ['execute, result', 'approval if required']),
    ])],
  },
  {
    name: 'approval-decision', alt: 'Decision flow for a tool call: if the call needs approval it checks for a pre-approved pattern, otherwise asks the onApproval handler per call, per instance or process-wide, and either executes or throws a MatimoError.',
    items: [
      N("matimo.execute('tool_name', params)"),
      A(),
      N('Needs approval?', ['requires_approval: true in the YAML', 'HTTP DELETE or command tool without requires_approval (secure mode)', 'destructive keyword in the sql or command argument']),
      F([
        { w: 1, label: 'no', tone: 'ok', items: [N('Execute', [], 'ok')] },
        {
          w: 3, label: 'yes', items: [
            N('Pre-approved?', ['MATIMO_APPROVED_PATTERNS or MATIMO_AUTO_APPROVE', 'never for matimo_approve_tool']),
            F([
              { w: 1, label: 'yes', tone: 'ok', items: [N('Execute', [], 'ok')] },
              {
                w: 2, label: 'no', items: [
                  N('Ask, first handler that is set', ['1. execute(..., { onApproval }), per call', '2. init({ onApproval }), per instance', '3. getGlobalApprovalHandler(), process-wide', '4. none, so the call is rejected']),
                  F([
                    { label: 'approved', tone: 'ok', items: [N('Execute', [], 'ok')] },
                    { label: 'rejected', tone: 'bad', items: [N('Throw MatimoError', [], 'bad')] },
                  ]),
                ],
              },
            ]),
          ],
        },
      ]),
    ],
  },
  {
    name: 'mcp-elicitation', alt: 'An MCP tools/call runs matimo.execute with an onApproval handler. If the call needs approval and the client supports elicitation, the user is asked; accepting runs the tool, anything else rejects it. Clients without elicitation get an error.',
    items: [
      N('MCP client', [{ m: "tools/call { name: 'tool_name', arguments: { ... } }" }]),
      A(),
      N('matimo.execute(..., { onApproval })', ["onApproval asks this session's user"]),
      A(),
      N('Call needs approval?', ['requires_approval, DELETE or command tool, destructive keyword']),
      F([
        { w: 1, label: 'no', tone: 'ok', items: [N('Runs', [], 'ok')] },
        {
          w: 3, label: 'yes', items: [
            N('Client supports elicitation?'),
            F([
              {
                label: 'yes', items: [
                  N('elicitation/create', ["Allow the agent to run 'tool_name'?"]),
                  F([
                    { label: 'accept and approve', tone: 'ok', items: [N('Run', [], 'ok')] },
                    { label: 'anything else', tone: 'bad', items: [N('Rejected', [], 'bad')] },
                  ]),
                ],
              },
              { label: 'no', tone: 'bad', items: [N('Error', ['needs human approval, but this', 'MCP client does not support', 'elicitation'], 'bad')] },
            ]),
          ],
        },
      ]),
    ],
  },
  {
    name: 'can-execute-flow', alt: 'policy.canExecute returns allowed, pending approval or false. Allowed executes, false throws POLICY_DENIED, and pending approval goes to the approval manifest or onHITL callback, which either executes or throws POLICY_DENIED.',
    items: [
      N("matimo.execute('tool_name', params)"),
      A(),
      N('policy.canExecute(context, tool)'),
      F([
        { w: 1, label: 'allowed', tone: 'ok', items: [N('Execute', [], 'ok')] },
        {
          w: 2, label: 'pending_approval', items: [
            N('Quarantined', ['approval manifest or onHITL callback']),
            F([
              { label: 'approved', tone: 'ok', items: [N('Execute', [], 'ok')] },
              { label: 'rejected or no callback', tone: 'bad', items: [N('Throw POLICY_DENIED', ['tool:quarantine_rejected'], 'bad')] },
            ]),
          ],
        },
        { w: 1, label: 'false', tone: 'bad', items: [N('Throw POLICY_DENIED', [], 'bad')] },
      ]),
    ],
  },
  {
    name: 'mcp-http-flow', alt: 'An MCP client POSTs tools/call to the MCPServer handler, which calls matimo.execute with an onApproval elicitation handler. Execute runs the policy check, approval, credential injection and executor routing, and the result returns as an MCP response.',
    items: [
      N('MCP client', [{ m: 'POST /mcp (tools/call)' }]),
      A(),
      N('MCPServer handler'),
      A(),
      N('matimo.execute(toolName, params, { onApproval })', ['onApproval is the elicitation prompt for this session', 'Policy check (canExecute): gates and HITL quarantine', "Approval, if the call needs it: elicitation prompt to the client's user", '(_matimo_approved counts only with trustClientApproval)', 'Credential injection', 'Executor routing'], 'accent'),
      A(),
      N('Result', ['returned as the MCP response']),
    ],
  },
  {
    name: 'meta-reload', w: 700, alt: 'matimo_reload_tools passes the policy and approval checks, is intercepted before executor routing, calls reloadTools directly on the instance, and returns a ReloadResult as the tool response.',
    items: [
      N("matimo.execute('matimo_reload_tools', {})"),
      A(),
      N('Checks', ['Policy check (canExecute)', 'Approval check (requires_approval: true)'], 'accent'),
      A('intercepted before executor routing'),
      N('this.reloadTools()', ['called directly on the instance']),
      A(),
      N('Result', ['ReloadResult formatted as a tool response']),
    ],
  },
  {
    name: 'pattern-langchain', w: 520, alt: 'A LangChain agent calls the LangChain official tool API, which calls matimo.execute, which runs the tool executors.',
    items: [
      N('LangChain agent', ['with OpenAI GPT-4']),
      N('LangChain official API', [{ m: 'tool(async fn, schema)' }, '• automatic schema generation', '• type validation via Zod', '• best IDE support']),
      matimoSdk, executors,
    ],
  },
  {
    name: 'pattern-decorator', w: 520, alt: 'A class-based agent uses the @tool decorator, which intercepts method calls and calls matimo.execute, which runs the tool executors.',
    items: [
      N('Class-based agent', [{ m: "@tool('calculator')" }, { m: 'async calculate(...) { }' }, { m: "@tool('gmail-send-email')" }, { m: 'async sendEmail(...) { }' }]),
      N('@tool decorator', ['• intercepts method calls', '• maps args to parameters', '• calls matimo.execute()']),
      matimoSdk, executors,
    ],
  },
  {
    name: 'pattern-factory', w: 520, alt: 'An agent with custom logic routes to tools itself and calls matimo.execute directly, which runs the tool executors.',
    items: [
      N('Agent with custom logic', [{ m: "if (prompt.includes('calc'))" }, { m: "  m.execute('calculator', ...)" }, { m: "if (prompt.includes('email'))" }, { m: "  m.execute('gmail-send-email')" }]),
      matimoSdk, executors,
    ],
  },
  {
    name: 'agent-tool-lifecycle', w: 760, alt: 'Agent tool lifecycle: validate, create a draft that asks a human, reload, approve with a human, then reload and use, where each call still asks a human.',
    items: [
      N('1. Validate', [{ m: 'matimo_validate_tool(yaml_content)' }, 'Schema check plus the 9 content rules (default policy)', 'valid: true exactly when matimo_create_tool would accept it']),
      N('2. Create', [{ m: 'matimo_create_tool(name, yaml_content, target_dir)' }, 'Forces status: draft and requires_approval: true', 'Refuses matimo_* names and runs the content rules again', 'Writes <target_dir>/<name>/definition.yaml (default ./matimo-tools)', 'Reports approvalState: pending'], 'accent', 'asks a human: requires_approval'),
      N('3. Reload', [{ m: 'matimo_reload_tools()' }, "Re-reads every tool path; untrusted tools face the developer's policy", 'Returns { loaded, removed, revalidated, rejected }', 'The draft is now registered but cannot run: drafts need the admin role']),
      N('4. Approve', [{ m: 'matimo_approve_tool(name, tool_dir)' }, 'Refuses a tool the calling agent created; needs admin when a context is set', 'Re-validates, sets status: approved, signs the hash (HMAC)', "Records it in the instance's .matimo-approvals.json"], 'accent', 'always asks a human'),
      N('5. Reload, then use', [{ m: 'matimo_reload_tools()  then  matimo.execute(new_tool_name, params)' }, 'Each call still asks a human, because the tool keeps requires_approval: true'], 'ok'),
    ],
  },
  {
    name: 'execution-flow', alt: 'Every tool call follows eight steps: application call, registry lookup, policy check, per-call approval, credential injection, executor, response size guardrail, and an outcome event.',
    items: [
      N('1. Application', [{ m: "matimo.execute('calculator', { operation: 'add', a: 5, b: 3 }, options?)" }]),
      N('2. ToolRegistry lookup', ['Unknown name: TOOL_NOT_FOUND']),
      N('3. Policy: canExecute(context, tool)', ['Risk: low (GET), medium (POST, PUT, PATCH), high (DELETE, command, requires_approval)', 'Function tools use their declared risk', 'Denied (deprecated, draft without admin, production role check): tool:execution_denied, POLICY_DENIED', 'Quarantined (enableHITL and risk at or above hitlMinRiskLevel): approval manifest, else onHITL callback', 'Events: tool:quarantine_approved, tool:quarantine_rejected'], 'accent'),
      N('4. Per-call approval', ['Needed when: requires_approval: true; HTTP DELETE or command tool without requires_approval', '(secure mode); destructive keyword in params.sql (or params.command for command tools)', 'Skipped when: the name matches MATIMO_APPROVED_PATTERNS, or options.approved is true', 'Asks: options.onApproval, then instance onApproval, then global callback, else reject', 'Events: tool:approval_granted, tool:approval_denied'], 'accent'),
      N('5. Credentials', ['Fill auth placeholders from options.credentials, else environment variables', 'An unfilled placeholder fails with a clear error']),
      N('6. Executor, by execution.type', ["function: import the tool's module and call it with { credentials, policyContext }", 'http: build the request, re-check the final URL for SSRF, send', 'command: spawn the process with templated args']),
      N('7. Response size guardrail', ['Caps the result to output_schema.max_response_size, else the instance default, else 256 KB', 'Arrays are sliced with a "...truncated, N of M items shown" sentinel', 'Long strings get an inline marker; large objects are truncated per field and marked _truncated: true']),
      N('8. Outcome event, then return', ['tool:executed { durationMs, success, riskLevel, traceId }', 'or tool:execution_failed { errorCode, error }', 'Both go to onEvent and the auditSink'], 'ok'),
    ],
  },
  {
    name: 'oauth-flow', w: 700, alt: 'OAuth2 token flow: an access token in the environment is read by the HTTP tool, injected as a Bearer header, and sent to the external service, which returns a result or 401.',
    items: [
      N('1. Environment', [{ m: 'process.env.GMAIL_ACCESS_TOKEN = "ya29.abc..."' }]),
      N('2. HTTP tool execution', ['The tool requires an OAuth2 token', 'Check the authentication config and find the provider: google']),
      N('3. Token injection', ['Read from the environment variable', { m: 'GMAIL_ACCESS_TOKEN -> "ya29.abc..."' }]),
      N('4. HTTP request', ['Add it to the headers', { m: 'Authorization: "Bearer ya29.abc..."' }]),
      N('5. External service (Gmail API)', ['Token valid: execute the request', 'Token invalid: 401 Unauthorized']),
      N('6. Response', ['Return the result or the error'], 'ok'),
    ],
  },
  {
    name: 'validation-pipeline', w: 700, alt: 'Validation pipeline: parse the YAML, validate against the Zod schema, validate authentication, execution and parameters, and produce a validated ToolDefinition.',
    items: [
      N('YAML file'),
      N('Parse YAML'),
      N('Validate against the Zod schema', ['Required fields, types, enums']),
      N('Validate authentication (if OAuth2)', ['Provider exists', 'Endpoints are URLs']),
      N('Validate execution', ["Type is 'http', 'function' or 'command'", 'Required fields for the type']),
      N('Validate parameters', ['Types match', 'Required fields present']),
      N('ToolDefinition', ['validated'], 'ok'),
    ],
  },
  {
    name: 'error-handling', w: 700, alt: 'Error handling: an error is caught, wrapped in a MatimoError with a code, message and details, handled by the application, and recovered from.',
    items: [
      N('Error occurs'),
      N('Catch with try/catch'),
      N('Wrap in MatimoError', ['code: ErrorCode', 'message: string', 'details?: object (includes retryable for HTTP-sourced errors)']),
      N('Application error handling', ['Log the error (never log secrets)', 'Return a structured error', 'Notify the user or system']),
      N('Application recovery', [], 'ok'),
    ],
  },
  {
    name: 'composio-flow', w: 760, alt: 'An agent calls matimo.execute on a Composio tool. MatimoInstance runs the policy check, the optional onHITL callback and the HTTP executor against the Composio REST API, which forwards to your connected services such as Jira, Google Drive and Teams.',
    items: [
      N('Your agent', [{ m: "matimo.execute('composio_jira_create_issue', { ... })" }]),
      N('MatimoInstance.execute()', ['1. PolicyEngine.canExecute(): the risk gate (custom or default)', '2. onHITL callback: human approval, once you configure it', '3. HttpExecutor: POST /v3/tools/execute/JIRA_CREATE_ISSUE'], 'accent'),
      N('Composio REST API'),
      A('forwards to your connected Jira, Drive, Teams, etc.'),
      N('Jira Cloud, Google, Microsoft, ...', [], 'ok'),
    ],
  },
  {
    name: 'mcp-server-startup', alt: 'MCP server startup: a client connects over stdio or HTTP, then the server resolves secrets, runs MatimoInstance.init with auto-discovery, filters tools, registers each tool on McpServer, and connects the transport.',
    items: [
      N('Client', ['Claude Desktop, Cursor, Windsurf, or an HTTP client']),
      A('MCP protocol: JSON-RPC over stdio or HTTP+SSE'),
      N('1. SecretResolverChain', ['Resolves secrets from env, dotenv, vault or aws', 'Seeds process.env with the resolved secrets']),
      N('2. MatimoInstance.init(autoDiscover: true)', ['Entry points: scans @matimo/* (TS) or matimo-* (PY) packages via package.json or pkg_resources', 'Filesystem: recursively scans the toolPaths directories for YAML and JavaScript or Python tool definitions', 'Registry: registers every discovered tool']),
      N('3. Filter tools', ['Allow and deny lists']),
      N('4. Register each tool on McpServer (MCP SDK)', ['Converts YAML params to Zod schemas (TS) or Pydantic models (PY), then to MCP input schemas']),
      N('5. Connect the transport', ['stdio: StdioServerTransport (local clients)', 'http or https: StreamableHTTPServerTransport with Bearer auth'], 'ok'),
    ],
  },
  {
    name: 'mcp-tool-call', w: 620, alt: 'MCP tool call flow: the client sends tools/call, the MCPServer handler calls matimo.execute, which injects auth, runs the executor, validates the response, applies the size guardrail and returns MCP content.',
    items: [
      N('Client', [{ m: 'tools/call' }]),
      N('MCPServer handler'),
      N('matimo.execute(toolName, args)'),
      N('Auth injection', ['from process.env']),
      N('Executor', ['HTTP, command or function']),
      N('Validate the response', ['against output_schema']),
      N('Response-size guardrail', ['truncates oversized results', 'see Tool Execution Flow in the architecture overview']),
      N('Return as MCP content', ['errors return isError: true with structuredContent'], 'ok'),
    ],
  },
  {
    name: 'provider-agent-flow', alt: 'In VS Code Copilot Chat the Matimo Tool Creator agent reads the provider-creation skill, writes the TypeScript and Python provider packages, and calls MCP tools on the Python example server to validate, search, read and run checks.',
    items: [
      N('VS Code Copilot Chat'),
      N('Agent: Matimo Tool Creator', [{ m: '.github/agents/matimo-tool-creator-refactored.agent.md' }]),
      GAP(2),
      N('Reads', [{ m: '.github/skills/matimo-provider-creation/SKILL.md' }, 'Layout, YAML, auth, tests']),
      GAP(),
      N('Writes', [{ m: 'typescript/packages/<provider>/...' }, { m: 'python/packages/<provider>/...' }]),
      GAP(),
      N('Calls MCP tools on the Python example server', [{ m: 'matimo_validate_tool(yaml_content)' }, 'Checks each definition', { m: 'matimo_validate_skill(name)' }, 'Checks the package SKILL.md', 'search, read: find patterns to copy (you approve each)', 'execute: pnpm validate-tools, lint, tests (you approve each)']),
    ],
  },
  {
    name: 'skills-flow', alt: 'An SDK developer writes SKILL.md files under packages/core/skills, and the agent loads, creates and validates skills at runtime with the matimo skill meta-tools.',
    items: [R([
      N('SDK developer writes SKILL.md', [{ m: 'packages/core/skills/' }, { m: '  tool-creation/SKILL.md' }, { m: '  policy-validation/SKILL.md' }, { m: '  meta-tools-lifecycle/SKILL.md' }, { m: '  tool-discovery/SKILL.md' }]),
      N('Agent at runtime', [{ m: 'matimo_list_skills()' }, { m: 'matimo_get_skill("tool-creation")' }, { m: 'matimo_create_skill(name, content)' }, { m: 'matimo_validate_skill(name)' }]),
    ])],
  },
  {
    name: 'tool-or-skill', alt: 'Decision tree: if it needs to run something, use a tool defined in definition.yaml; if it needs to teach the agent something, use a skill in SKILL.md; otherwise put it in the system prompt.',
    items: [
      N('Does it need to RUN something?', ['An API call, a DB query, a command']),
      F([
        { label: 'yes', tone: 'ok', items: [N('Use a Tool', [{ m: 'definition.yaml' }], 'ok')] },
        {
          label: 'no', items: [
            N('Does it need to TEACH the agent something?'),
            F([
              { label: 'yes', tone: 'ok', items: [N('Use a Skill', [{ m: 'SKILL.md' }], 'ok')] },
              { label: 'no', items: [N('System prompt', ['put it there'])] },
            ]),
          ],
        },
      ]),
    ],
  },
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = specs.map(build);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(meta, null, 2));
  for (const m of meta) console.log(`${m.name}  ${m.W}x${m.H}`);
}
