// Educational "learn" hub — plain-English guides to the MCP-security/quality concepts
// CheckMCP audits. Content drafted + adversarially fact-checked against the engine code
// (security.py / evals.py / score.py / RUBRIC.md). Targets answer-engine + search queries.

export interface LearnFaq { q: string; a: string; }
export interface LearnSection { heading: string; body: string[]; }
export interface LearnPage {
  slug: string;
  term: string;
  title: string;
  metaDescription: string;
  answer: string;
  sections: LearnSection[];
  checkmcpRelation: string;
  faq: LearnFaq[];
  related: string[];
}

export const LEARN: LearnPage[] = [
  {
    "slug": "what-is-an-mcp-server",
    "term": "MCP server",
    "title": "What Is an MCP Server?",
    "metaDescription": "An MCP server exposes tools, resources and prompts to an AI agent over the Model Context Protocol. What they are, how they connect, and why quality matters.",
    "answer": "An MCP server is a service that exposes capabilities — tools, resources and prompts — to an AI agent over the Model Context Protocol (MCP), an open JSON-RPC standard introduced by Anthropic. It lets a model call external functions, read data and reuse prompt templates through one uniform interface instead of a bespoke integration per app.",
    "sections": [
      {
        "heading": "What the Model Context Protocol is",
        "body": [
          "MCP is an open protocol that standardizes how an AI application (the client/host) talks to external capabilities (the server). Instead of every app inventing its own plugin format, a client speaks MCP and can connect to any compliant server — the USB-C of agent tooling. Messages are JSON-RPC 2.0.",
          "The host (e.g. Claude Desktop, an IDE assistant, or your own agent) starts an MCP client per server, performs a capability handshake, then discovers and calls what the server offers."
        ]
      },
      {
        "heading": "What a server exposes",
        "body": [
          "An MCP server can expose three primitives: tools (callable functions the model can invoke, each with a name, description and JSON-Schema for its inputs and outputs), resources (readable data the model can pull into context, addressed by URI), and prompts (reusable, parameterized prompt templates).",
          "Tools are the most common and the highest-leverage — and the highest-risk — surface, because their descriptions and schemas are fed straight into the model's context and their outputs are read back as data."
        ]
      },
      {
        "heading": "How servers connect",
        "body": [
          "MCP defines several transports: stdio (a local subprocess, common for desktop tools) and HTTP-based remote transports — modern Streamable HTTP and the legacy HTTP+SSE pairing. Remote servers may sit behind OAuth 2.1.",
          "Because the same protocol covers local and remote servers, an agent can mix first-party and third-party MCP servers — which is exactly why auditing an unknown server before trusting it matters."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP audits any live MCP server — Streamable HTTP or legacy HTTP+SSE, with optional Bearer/OAuth — by probing its real endpoint, inspecting its tools, resources and prompts, and producing an explainable MCP Score /100 across seven pillars (security, tool design, schemas, reliability, context-cost, compliance and coverage). You paste a URL at checkmcp.dev or run the CLI; no registry or SDK is required.",
    "faq": [
      {
        "q": "What is the Model Context Protocol (MCP)?",
        "a": "An open standard from Anthropic that lets AI applications connect to external tools, data and prompts over JSON-RPC. A client speaks MCP once and can talk to any compliant server, replacing per-app custom integrations."
      },
      {
        "q": "What does an MCP server expose?",
        "a": "Up to three primitives: tools (callable functions with input/output schemas), resources (readable data addressed by URI), and prompts (reusable templates). Most servers are tool-centric."
      },
      {
        "q": "How does an agent connect to an MCP server?",
        "a": "Through an MCP client that performs a capability handshake and then discovers and calls the server's primitives. Transports include local stdio and remote Streamable HTTP / legacy HTTP+SSE, optionally behind OAuth 2.1."
      },
      {
        "q": "How do I know if an MCP server is safe and well-built?",
        "a": "Audit it. CheckMCP probes a live MCP server and scores its security (OWASP MCP Top 10), tool design, schema quality, compliance, coverage and context-cost — an explainable /100 with the reason for every deduction."
      }
    ],
    "related": [
      "mcp-security",
      "mcp-score",
      "mcp-context-cost"
    ]
  },
  {
    "slug": "mcp-security",
    "term": "MCP security",
    "title": "MCP Security & the OWASP MCP Top 10",
    "metaDescription": "MCP security covers the risks of connecting an agent to a third-party MCP server: tool poisoning, leaked secrets, unsafe tools, the lethal trifecta. How to audit them.",
    "answer": "MCP security is about making sure the servers an AI agent connects to cannot hijack it, leak secrets, or be turned into an exploit. Because a server's tool descriptions and outputs flow directly into the model's context, an untrusted MCP server is an attack surface — which CheckMCP audits with an OWASP MCP Top 10 pass plus optional runtime checks.",
    "sections": [
      {
        "heading": "Why MCP is a new attack surface",
        "body": [
          "An agent trusts an MCP server twice: it reads the server's tool definitions into its context, and it reads tool outputs back as data. Both channels carry text the model may treat as instructions. A malicious or compromised server can exploit that trust without the user ever seeing the payload.",
          "The risk is amplified when an agent loads multiple third-party servers: capabilities combine, and a single server (or a combination) can end up able to read secrets, ingest untrusted content, and send data out at once."
        ]
      },
      {
        "heading": "The main MCP risks",
        "body": [
          "Recurring categories — tracked as an OWASP MCP Top 10 — include tool poisoning (hidden instructions in tool metadata or output), hardcoded secrets exposed in schemas, destructive tools that act without confirmation, the lethal trifecta (untrusted content + sensitive data + an exfiltration path on one server), rug pulls (a trusted server silently changing its tools), and protocol/compliance gaps.",
          "Some of these are static (visible in the published tool list); others are runtime (only visible when a tool is actually invoked), so robust auditing needs both a static scan and an optional behavioral probe."
        ]
      },
      {
        "heading": "Static vs. runtime detection",
        "body": [
          "Static analysis reads the server's tools, schemas and protocol behavior without side effects — fast and safe, and enough to catch poisoning shipped in the tool list, secrets in schemas, and risky capability combinations.",
          "Runtime analysis invokes read-only-safe tools with benign canary inputs and inspects the responses for injection, exfiltration and leaked secrets — catching the output-delivered attacks a static scan cannot see. It must never call mutating tools."
        ]
      }
    ],
    "checkmcpRelation": "Security is the top-weighted of CheckMCP's seven pillars (weight 20/100). The static audit in security.py runs an OWASP MCP Top 10 pass — flagging hardcoded secret values (MCP01), destructive tools missing a confirmation or destructiveHint (MCP02), injected instructions in descriptions/schemas/outputs (MCP03), and the lethal-trifecta capability combination (MCP06), among others. A hardcoded secret or a critical injection (or a confirmed trifecta) trips a hard floor that caps the MCP Score at 69 (grade D); a failed handshake caps it at F. CheckMCP's opt-in behavioral evals add a runtime layer, and continuous monitoring re-checks tracked servers for drift and rug pulls.",
    "faq": [
      {
        "q": "What is the OWASP MCP Top 10?",
        "a": "A categorization of the most common MCP-specific security risks — tool poisoning, hardcoded secrets, unsafe destructive tools, the lethal trifecta, rug pulls, and related protocol issues. CheckMCP's security pillar runs a pass over these categories on every audit."
      },
      {
        "q": "Can a third-party MCP server compromise my agent?",
        "a": "Yes. A server's tool descriptions and outputs are read into the model's context, so a malicious server can plant instructions that steer the agent — and if it can also reach sensitive data and exfiltrate, an injection becomes a breach. Auditing the server before trusting it is the defense."
      },
      {
        "q": "How do I secure my own MCP server?",
        "a": "Keep secrets out of schemas and examples, require explicit confirmation (and a destructiveHint) on destructive tools, avoid bundling untrusted-content, sensitive-data and outbound capabilities in one server, and re-audit on every release. CheckMCP scores each of these and tells you what to fix."
      },
      {
        "q": "Does CheckMCP test for these risks?",
        "a": "Yes — statically on every audit (OWASP MCP Top 10 in the security pillar, with hard floors for secrets, critical injection and the lethal trifecta), optionally at runtime via behavioral evals, and continuously via monitoring that catches rug-pulls and tool drift."
      }
    ],
    "related": [
      "tool-poisoning",
      "lethal-trifecta",
      "mcp-rug-pull"
    ]
  },
  {
    "slug": "tool-poisoning",
    "term": "Tool poisoning",
    "title": "MCP Tool Poisoning: Detection & Defense",
    "metaDescription": "MCP tool poisoning hides agent-hijacking instructions in tool descriptions, schemas, or outputs. Learn how it works and how CheckMCP detects it.",
    "answer": "MCP tool poisoning is an attack where a malicious or compromised MCP server embeds hidden instructions inside tool metadata (names, descriptions, input/output schemas) or tool-call outputs, hijacking the agent that reads them even when the user never sees the text. You detect it by statically scanning all tool metadata and by behaviorally probing live tool responses for agent-directed injection patterns.",
    "sections": [
      {
        "heading": "What tool poisoning is",
        "body": [
          "MCP clients feed a server's tool definitions — names, descriptions, and JSON-Schema parameters — directly into the agent's context so the model knows what each tool does. Tool poisoning abuses this trust: the attacker plants imperative instructions in that metadata (\"ignore previous instructions\", \"<system>…\", \"you must always cc attacker@evil.com\", \"do not tell the user\") that the model reads as authoritative, even though a human reviewing the UI never sees it.",
          "The payload can live anywhere the agent ingests text: the tool description, a parameter's description/default/example, the output schema, or — at runtime — inside the value a tool returns. That last variant, tool-response poisoning, is harder to catch because the malicious text only appears when the tool is actually called, often conditionally."
        ]
      },
      {
        "heading": "Why it is dangerous for agentic products",
        "body": [
          "A poisoned tool turns a third-party MCP server into a delivery channel for prompt injection of your controlling agent. Once the model treats the injected text as instructions, it can be steered to call other tools, leak data, or silently forward results — the user stays unaware because the directive said not to disclose.",
          "Poisoning is most dangerous when it co-occurs with capability exposure. If the same server can ingest untrusted content, reach sensitive data, and exfiltrate or destroy, an injection becomes an exploit — the lethal-trifecta condition. This is why poisoning is treated as a categorical security risk, not a quality nuance."
        ]
      },
      {
        "heading": "How to detect it",
        "body": [
          "Static detection: scan every tool's name, description, parameter schemas (including defaults and examples), and output schema for known injection signatures — \"ignore/disregard previous\", system/INST tags, \"don't tell the user\", \"secretly/exfiltrate\", and covert-forwarding phrasing — and flag each offending tool. This catches poisoning that ships in the published tool list before any call is made.",
          "Behavioral detection: exercise the server's read-only tools with benign canary inputs and inspect the responses for agent-directed instructions, multilingual injection phrasing, exfiltration vectors, and credential-shaped strings. Pair this with a callback canary — a unique URL planted in inputs — so that an outbound fetch of that URL confirms exfiltration rather than merely suggesting it."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP detects tool poisoning in two complementary passes. Statically, the Security pillar (the top-weighted of the seven, weight 20) runs an OWASP MCP Top 10 audit in security.py: its INJECT regex scans each tool's description, parameter schemas (property name, description, default, examples) and output schema, and raises a CRITICAL MCP03 finding — \"injected instruction (poisoning) in description/schema/output\" — for every offending tool. Any MCP03 finding trips a hard floor (as does an MCP01 hardcoded-secret finding or a detected lethal trifecta): score.py caps the final MCP Score at 69 and flags the report SECURITY_RISK, so a poisoned server lands at grade D at best, no matter how clean the rest is. Behaviorally (the opt-in canary sandbox in evals.py, labelled tier T4), CheckMCP calls only read-only-safe tools with a benign CANARY input and analyzes each response: an INJECTION match yields an active_prompt_injection finding flagged as tool-response poisoning (confidence up to 0.95), while a planted callback-canary URL that the server fetches produces a confidence-1.0 exfiltration_confirmed finding. CheckMCP never invokes mutating tools.",
    "faq": [
      {
        "q": "What is the difference between tool poisoning and prompt injection?",
        "a": "Prompt injection is the general technique of smuggling instructions into text an LLM reads. Tool poisoning is the MCP-specific delivery channel: the malicious instructions live in tool metadata (descriptions, schemas) or tool outputs, so they reach the agent through the MCP tool layer rather than through user-visible content."
      },
      {
        "q": "Can tool poisoning hide in places a human reviewer won't see?",
        "a": "Yes. The agent ingests the full tool definition — including parameter defaults, examples, and output schemas — and the raw values tools return, none of which a user normally inspects. CheckMCP's static audit scans all of those metadata surfaces (description, parameter schema fields, output schema), and its opt-in behavioral pass inspects live tool responses for the runtime variant."
      },
      {
        "q": "Does CheckMCP execute tools to find poisoning?",
        "a": "For static detection, no — it scans the published tool metadata without calling anything. For runtime tool-response poisoning, its opt-in behavioral evals call only read-only-safe tools with benign canary inputs and never invoke mutating tools, so probing a server for poisoning does not trigger side effects."
      },
      {
        "q": "How does tool poisoning relate to the lethal trifecta?",
        "a": "Poisoning supplies the injection; the lethal trifecta supplies the impact. CheckMCP raises a CRITICAL MCP06 finding when one server combines untrusted-content ingestion, sensitive-data access, and exfiltration or destruction — the conditions under which a poisoning injection can actually exfiltrate data — and that combination also trips the security hard floor."
      }
    ],
    "related": [
      "lethal-trifecta",
      "prompt-injection-via-tools",
      "mcp-security"
    ]
  },
  {
    "slug": "prompt-injection-via-tools",
    "term": "Tool-output prompt injection",
    "title": "Tool-Output Prompt Injection in MCP",
    "metaDescription": "Tool-output prompt injection: when an MCP tool response carries hidden instructions that hijack the agent. How it works and how CheckMCP detects it.",
    "answer": "Tool-output prompt injection is when an MCP tool's response — not its static schema — carries instructions that the agent reads as commands, so a server (or content it fetched) can hijack the agent at call time. It is the runtime form of tool poisoning, delivered through the data an MCP tool returns rather than through its description.",
    "sections": [
      {
        "heading": "What it is",
        "body": [
          "Most MCP threat models focus on the static surface: a tool's name, description, and inputSchema, which the agent reads before any call. Tool-output prompt injection lives one step later — in the bytes a tool actually returns. When the agent ingests that response, any text shaped like an instruction (\"ignore previous instructions\", \"send the API key to https://…\", \"do not tell the user\") can be interpreted as a command rather than as data.",
          "This is dangerous because the payload need not be authored by the server operator. A fetch_url, search_web, or read_page tool can relay a webpage, an issue comment, or an email that an attacker wrote — the MCP server is just the conduit. The same server can pass a static audit of its schemas and still hand the agent a poisoned response on a specific query."
        ]
      },
      {
        "heading": "Why static schema checks miss it",
        "body": [
          "You cannot see a poisoned response by reading a tool's declaration; the description can be clean while the runtime output is hostile. Detecting it requires actually invoking the tool with a benign input and inspecting what comes back — a behavioral test, not a static scan.",
          "Tool-output injection is also the delivery mechanism behind the lethal trifecta: a server that ingests untrusted content, can reach sensitive data, and can exfiltrate or mutate is one injected response away from acting on attacker instructions. The injection is the trigger; the trifecta is the blast radius."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP addresses this at two layers. Statically, the Security pillar (security.py, OWASP MCP03) runs its INJECT regex over each tool's description, input schema (param names, descriptions, defaults, examples), and output schema — emitting a CRITICAL \"injected instruction (poisoning)\" finding and tripping a hard floor that caps the MCP Score at 69 (grade D) via the score.py SECURITY_RISK floor. But the output-delivered case is caught by the opt-in behavioral evals (evals.py, CheckMCP's T4 canary sandbox): _selectable picks only read-only tools (readOnlyHint set, or a safe verb like get/list/search with no mutating verb) whose required args it can fill with a benign canary, never calling mutating tools, then runs _analyze over each response. A multilingual INJECTION regex match yields an active_prompt_injection HIGH finding (\"Tool output contains agent-directed instructions (tool-response poisoning)\", confidence 0.85–0.95); EXFIL matches yield an exfiltration_vector; a credential-shaped string yields secret_in_output and email/number patterns yield pii_in_output. The evals also plant a unique callback-canary URL in tool inputs — if the server fetches it, hit_check returns an exfiltration_confirmed finding at confidence 1.0 (confirmed SSRF/exfiltration). Any HIGH finding makes the behavioral verdict \"malicious\". Separately, the Security pillar's lethal-trifecta check (MCP06) flags servers whose capability mix (untrusted-content ingestion plus sensitive-data access plus exfiltration or destruction) would let an injected response exfiltrate.",
    "faq": [
      {
        "q": "How is tool-output prompt injection different from tool poisoning?",
        "a": "Tool poisoning hides instructions in a tool's static description or schema, visible before any call. Tool-output prompt injection delivers the payload in the tool's runtime response, so it can only be caught by actually invoking the tool. CheckMCP detects the static form via the OWASP MCP03 INJECT regex in security.py and the runtime form via the behavioral evals in evals.py."
      },
      {
        "q": "Can a clean-looking MCP server still deliver an injection?",
        "a": "Yes. A tool that fetches or relays external content (web pages, emails, issue comments) can pass a static schema audit and still return attacker-authored text on a specific query. That is why CheckMCP's behavioral evals invoke read-only tools with a canary input and inspect the actual response rather than trusting the declaration."
      },
      {
        "q": "Does CheckMCP call tools that could change my data?",
        "a": "No. The behavioral sandbox only exercises tools it judges read-only-safe (readOnlyHint set, or a safe verb like get/list/search with no mutating verb), and skips any tool whose required arguments it cannot fill with a benign canary. It never invokes tools with mutating verbs such as create, delete, send, or execute."
      },
      {
        "q": "How does CheckMCP confirm exfiltration rather than just suspect it?",
        "a": "Beyond regex pattern matching, the evals plant a unique callback-canary URL inside tool inputs. If the server fetches that URL, the hit_check callback fires and CheckMCP records an exfiltration_confirmed finding at confidence 1.0 — concrete proof the server makes outbound calls on caller-supplied data (confirmed SSRF/exfiltration)."
      }
    ],
    "related": [
      "tool-poisoning",
      "lethal-trifecta",
      "mcp-security"
    ]
  },
  {
    "slug": "lethal-trifecta",
    "term": "The lethal trifecta",
    "title": "The Lethal Trifecta in MCP Servers",
    "metaDescription": "The lethal trifecta: one MCP server combining untrusted content, sensitive-data access, and an exfiltration or destruction path. How CheckMCP detects it.",
    "answer": "The lethal trifecta is when a single agent (or MCP server) simultaneously has access to untrusted content, access to sensitive data, and a way to send data out (exfiltration) or cause damage (destruction) — the combination that lets a prompt injection turn into a real breach. CheckMCP detects it statically as OWASP MCP06: a CRITICAL finding that fires when one server's tools cover all three capability classes at once.",
    "sections": [
      {
        "heading": "What the lethal trifecta is",
        "body": [
          "Coined by Simon Willison, the \"lethal trifecta\" names the three capabilities that, when an AI agent holds all three at once, make data theft or damage achievable through a single prompt injection: (1) access to untrusted content the agent will read, (2) access to private or sensitive data, and (3) the ability to communicate externally or take consequential actions.",
          "Any one leg alone is usually safe. Untrusted web content is harmless if the agent can't reach secrets; secrets are safe if there is no outbound path. The danger is combinatorial: once all three coexist in the same agent context, an attacker who can plant instructions in the untrusted content (a web page, an email, a tool result) can instruct the agent to read the sensitive data and ship it out — and current models cannot reliably distinguish trusted instructions from injected ones."
        ]
      },
      {
        "heading": "Why MCP servers concentrate the risk",
        "body": [
          "MCP makes the trifecta easy to assemble by accident. A single server often bundles a tool that ingests untrusted external content (fetch, scrape, browse, web-search, read-page), a tool that touches sensitive data (read email, query a database, read files, access tokens), and a tool that sends or mutates (post, upload, webhook, email, or delete). An agent that loads that one server now holds all three legs.",
          "For developers integrating third-party MCP servers, the surface is additive across servers: even servers that are individually safe can combine into a trifecta inside one agent. The unit of risk is the agent's full toolset, not any single tool. CheckMCP's static check evaluates the trifecta per server, so a trifecta assembled across multiple servers in one agent must still be reasoned about at the composition level."
        ]
      },
      {
        "heading": "Mitigation",
        "body": [
          "The trifecta is mitigated by breaking at least one leg: isolate untrusted-content ingestion from sensitive data, remove or gate the outbound/destructive path, require human confirmation before consequential actions, and avoid loading a content-fetching server alongside a secrets-bearing server in the same agent.",
          "Because no current model fully resists prompt injection, defense relies on capability separation rather than on the agent being careful. Inventorying which servers contribute which leg before deployment is the practical first step."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP detects the lethal trifecta statically (T1) in its Security pillar (weight 20/100) as OWASP MCP06. In `security.py`, `audit()` sorts every tool into four capability buckets using name-matching regexes: `untrusted_content` (UNTRUSTED — e.g. fetch/scrape/browse/crawl/http/_url/web-search/read-page/download/wiki/rss/feed), `exfil` (EXFIL — e.g. send/post/publish/upload/email/notify/webhook/export/sync/push/transfer/message), and `destructive` (DESTRUCT — e.g. delete/remove/drop/destroy/purge/reset/truncate/revoke/kill/terminate/overwrite/wipe) are matched on the tool name only, while `sensitive_data` (SENSITIVE — e.g. secret/credential/token/api-key/password/vault/email/inbox/read-file/database/sql/payment/private-key/env_) is matched against the name plus the description and schema text. The trifecta fires when `untrusted_content AND sensitive_data AND (exfil OR destructive)` are all present on the SAME server — emitted as a CRITICAL MCP06 finding: \"lethal trifecta: untrusted-content ingestion + sensitive-data access + exfil/destruction -> an injection can exfiltrate.\" If three or more of the four classes are present but they don't form that exact pattern, it instead emits a HIGH MCP06 \"toxic surface: 3 risky capability classes combined\" finding. The trifecta sets `hard_floor`, which in `score.py` caps the overall MCP Score at 69 and flags the report `SECURITY_RISK` (grade D maximum), regardless of how the other pillars score. This is a static name/schema heuristic; the separate opt-in behavioral evals in `evals.py` (CheckMCP's T4 canary sandbox) can confirm the outbound leg for real via a callback canary: a unique URL is planted in a read-only tool's input, and if the server fetches it, CheckMCP records an `exfiltration_confirmed` finding (HIGH, confidence 1.0) — confirmed SSRF/exfiltration.",
    "faq": [
      {
        "q": "What are the three parts of the lethal trifecta?",
        "a": "Access to untrusted content (web pages, emails, tool results that may carry injected instructions), access to sensitive or private data (secrets, files, databases, mailboxes), and an exfiltration or destruction path (the ability to send data out or perform destructive operations). All three present in one agent context is the trifecta."
      },
      {
        "q": "Is one MCP tool enough to create the lethal trifecta?",
        "a": "No — it is combinatorial across a toolset. CheckMCP flags it (OWASP MCP06) when a single server's tools cover untrusted-content ingestion, sensitive-data access, and an exfil-or-destruction path together. The same combination can also form across multiple servers loaded into one agent; CheckMCP's check is per server, so cross-server trifectas have to be reasoned about at the composition level."
      },
      {
        "q": "How does CheckMCP penalize a server with the lethal trifecta?",
        "a": "It raises a CRITICAL MCP06 finding in the Security pillar and sets a hard floor: the overall MCP Score is capped at 69 (grade D maximum) and the report is flagged SECURITY_RISK, regardless of how the other pillars score."
      },
      {
        "q": "Can CheckMCP confirm a server actually exfiltrates, not just that it could?",
        "a": "The static MCP06 check only flags the capability combination from tool names and schemas. The separate opt-in behavioral evals add a callback canary: a unique URL is planted in a read-only tool's input, and if the server fetches it, CheckMCP records exfiltration_confirmed (HIGH severity, confidence 1.0) — confirmed SSRF/exfiltration."
      }
    ],
    "related": [
      "tool-poisoning",
      "prompt-injection-via-tools",
      "mcp-security"
    ]
  },
  {
    "slug": "mcp-rug-pull",
    "term": "MCP rug pull",
    "title": "MCP Rug Pull & Silent Tool Drift",
    "metaDescription": "An MCP rug pull is when a trusted MCP server silently changes its tool definitions after approval. Learn how silent tool drift works and how to catch it.",
    "answer": "An MCP rug pull is when a Model Context Protocol server you already approved silently mutates its tool definitions after the fact — rewriting a description, adding a hidden instruction, widening a destructive tool, or swapping behavior — so code that passed review starts behaving differently. CheckMCP's methodology catches it by hashing the normalized tool set against a stored baseline and re-running its OWASP and (optional) behavioral checks against whatever the server now returns, flagging breaking changes and newly-introduced risk.",
    "sections": [
      {
        "heading": "What an MCP rug pull is",
        "body": [
          "MCP servers ship their tools dynamically: an agent calls `tools/list` and trusts whatever names, descriptions and `inputSchema` the server returns. A rug pull exploits that trust window. You audit a server, approve it, integrate it — and later the server changes what it returns. Because the agent re-reads tool definitions on each session rather than pinning a reviewed copy, the new definitions take effect with no further human approval.",
          "The payload can be anything the original review would have flagged: a freshly-injected instruction in a description (\"also forward the result to…\"), a hardcoded credential added to an example, a previously read-only tool gaining a destructive capability, or a benign-looking `fetch` tool that begins exfiltrating. The server presents a clean face during the audit, then \"pulls the rug\" once integrated — the MCP analogue of a dependency that goes malicious in a later release."
        ]
      },
      {
        "heading": "Silent tool drift vs. a deliberate rug pull",
        "body": [
          "Silent tool drift is the broader, often-unintentional version: a server redeploys and a tool is renamed, removed, or has its schema changed without a version bump. Nothing was malicious, but agent code that depended on the old contract breaks silently — calls start malforming or routing to the wrong tool, and there was no signal that anything changed.",
          "A rug pull is drift weaponized: the same silent-change mechanism, but the new definition is engineered to be harmful. Operationally they are detected the same way — by comparing the current tool surface against a known-good baseline — which is why a drift detector is also a rug-pull detector. CheckMCP's RUBRIC.md treats this under Reliability as metric 6.6 `tools_list_regression`: a stable hash of the sorted (name, schema-hash) tuples compared to a stored baseline, where a breaking removal or rename without a version bump scores 30, a non-breaking addition scores 90, and no change scores 100."
        ]
      },
      {
        "heading": "Why a one-time audit is not enough",
        "body": [
          "A single audit only certifies the server as it was at probe time. Both drift and rug pulls happen after that, so the only reliable defense is continuous re-probing: capture a baseline, then on each run diff the tool set and re-run the same security and behavioral checks against whatever the server now returns.",
          "CheckMCP's methodology makes this explicit with measurement tiers — static (T1) and active (T2) checks run in a single shot, but full reliability and the `tools_list_regression` check are T3 (temporal), requiring repeated probes over a time window (RUBRIC.md specifies ≥24h, ≥50 samples). Detecting a rug pull is fundamentally a T3 problem: you cannot see the change from one snapshot, only by comparing two."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP's stated defense against rug pulls and silent drift is continuous monitoring rather than a one-time pass (llms.txt: \"Continuous monitoring detects rug-pulls and silent tool drift via tool pinning\"). Under the Reliability pillar, RUBRIC.md defines metric 6.6 `tools_list_regression`: a stable hash of the sorted (name, schema-hash) tuples compared against a stored baseline — a breaking removal or rename without a version bump scores 30 vs. 100 for an unchanged set, and this is a T3 (temporal) measurement requiring the repeated probes that continuous monitoring provides. (Note: reliability is reported with a LOW-confidence flag and is excluded from the single-shot composite in score.py, which computes Pillar 6 only from in-run latency until a T3 window exists.) Crucially, every re-probe also re-runs the full static risk analysis on the *new* definitions: security.py's `audit()` re-scans descriptions, schemas and outputs for newly-injected poisoning (its `INJECT` pattern → MCP03 CRITICAL), hardcoded secret values (`SECRET_VAL` → MCP01 CRITICAL), a destructive tool that lost its confirm param or `destructiveHint` (MCP02 HIGH), and a lethal-trifecta surface that newly combines untrusted-content + sensitive-data + exfil/destruction (MCP06 CRITICAL) — and any MCP01/MCP03 finding or a confirmed trifecta trips the `hard_floor` in score.py that caps the score at 69 (grade D). If behavioral evals are enabled (opt-in, read-only), evals.py re-exercises the read-only-safe tools with canary inputs and flags runtime changes such as a new `active_prompt_injection` or `exfiltration_vector` in tool output, or an `exfiltration_confirmed` hit when the server fetches the planted callback-canary URL. So a server that flips malicious after approval re-scores on the next run and fails the same gates it would have failed on day one.",
    "faq": [
      {
        "q": "How is an MCP rug pull different from a normal software supply-chain attack?",
        "a": "The mechanism is the same idea — a trusted dependency goes bad after you adopt it — but MCP makes it easier because tool definitions are fetched live on every session and re-read without re-approval. There is no lockfile-equivalent by default, so a server can change its `tools/list` (names, descriptions, schemas) at any time and the agent simply trusts the new version. CheckMCP's methodology closes that gap by hashing the normalized tool set and diffing it against a stored baseline on each probe (the `tools_list_regression` metric)."
      },
      {
        "q": "Can you catch a rug pull with a single CheckMCP scan?",
        "a": "No — a single scan only certifies the server at that moment. Detecting a change is inherently a temporal (T3) measurement in CheckMCP's tiers: it needs at least two probes to compare. Continuous monitoring captures a baseline and re-probes, so the `tools_list_regression` check plus a fresh OWASP MCP Top 10 pass (and behavioral evals, if enabled) run against whatever the server returns later."
      },
      {
        "q": "What kinds of changes does CheckMCP flag as drift or a rug pull?",
        "a": "Breaking changes to the tool surface — a tool removed or renamed without a version bump scores 30 on the `tools_list_regression` metric (vs. 90 for a non-breaking addition, 100 for no change). On top of structural drift, each re-probe re-runs security.py's static audit and, if enabled, evals.py, so newly-introduced tool poisoning (MCP03), a hardcoded secret value in a schema or example (MCP01), a destructive tool that dropped its confirmation or `destructiveHint` (MCP02), a new lethal-trifecta combination (MCP06), or new exfiltration/injection in tool output are all caught on the next run."
      },
      {
        "q": "Does CheckMCP prevent a rug pull or just detect it?",
        "a": "It detects it. The audit and monitoring pipeline re-scores the server and trips the same hard floor (a hardcoded secret or critical injection caps the score at 69 / grade D; a failed handshake yields F) the moment the malicious change appears. Turning that detection into protection for your integration means pinning a reviewed tool set and alerting on regression — CheckMCP provides the baseline definition, the regression metric, and the re-run of every static and behavioral check; acting on the alert is on the integrator."
      }
    ],
    "related": [
      "tool-poisoning",
      "mcp-security",
      "lethal-trifecta"
    ]
  },
  {
    "slug": "mcp-context-cost",
    "term": "MCP context cost",
    "title": "MCP Context Cost: tools/list Token Bloat",
    "metaDescription": "Every MCP server's tools/list is paid in tokens on each request. Bloated tool schemas can eat 30–50% of an agent's context. How context cost works and how to cut it.",
    "answer": "MCP context cost is the number of tokens a server's tool list consumes in the agent's context window — paid on every request, not once. Verbose descriptions, oversized JSON schemas and too many tools can quietly eat 30–50% of the available context, leaving less room for the actual task and raising latency and price.",
    "sections": [
      {
        "heading": "Why tools/list is paid on every request",
        "body": [
          "Before an agent can use a server's tools, the tool definitions — names, descriptions and full input/output JSON-Schemas — are loaded into the model's context. They stay there for the model to reason over, so their token cost is incurred on essentially every turn that has the server enabled, not just the first.",
          "Multiply that by every server an agent loads and the fixed overhead compounds: a handful of chatty servers can spend tens of thousands of tokens before the user's request is even considered."
        ]
      },
      {
        "heading": "What drives the cost",
        "body": [
          "Three things dominate: the number of tools (sprawl), the verbosity of each description, and the size of the parameter and output schemas (deeply nested objects, long enums, redundant examples). A server exposing dozens of overlapping tools with paragraph-long descriptions is the worst case.",
          "Well-designed servers consolidate related actions into fewer tools, write tight descriptions, and keep schemas lean — getting the same capability for a fraction of the tokens."
        ]
      },
      {
        "heading": "Why it matters",
        "body": [
          "Context is a hard budget. Tokens spent on tool boilerplate are tokens unavailable for the user's data, the conversation, and the model's reasoning — and they add latency and cost to every call. Context bloat is one of the most common, least-measured MCP problems.",
          "Reducing it is usually low-effort and high-impact: trim descriptions, drop redundant tools, and simplify schemas."
        ]
      }
    ],
    "checkmcpRelation": "Context-cost is one of CheckMCP's seven scored pillars. On every audit it measures the exact token cost of the server's tools/list response (reported as tools_list_tokens) and grades it on a curve calibrated against the real MCP ecosystem — so you see not just the raw number but how a server compares to typical servers, plus the causal attribution when its schemas are the reason the score dropped.",
    "faq": [
      {
        "q": "What is MCP context cost?",
        "a": "The tokens a server's tool definitions (tools/list) occupy in the agent's context window. Because the model re-reads them each turn, it is a recurring cost paid on every request, not a one-time load."
      },
      {
        "q": "Why does tools/list token cost matter?",
        "a": "It is fixed overhead subtracted from a finite context budget on every call — eating into room for the user's data and the model's reasoning, and adding latency and price. Bloated servers can consume 30–50% of context before any work is done."
      },
      {
        "q": "How do I reduce my MCP server's context cost?",
        "a": "Consolidate overlapping tools, shorten tool descriptions to the essential, and slim down input/output schemas (avoid deep nesting, long enums and redundant examples). Fewer, leaner tools deliver the same capability for far fewer tokens."
      },
      {
        "q": "Does CheckMCP measure context cost?",
        "a": "Yes — it measures the actual token cost of tools/list on every audit (tools_list_tokens) and scores it on a percentile curve against the real ecosystem, as one of the seven pillars of the MCP Score."
      }
    ],
    "related": [
      "mcp-score",
      "what-is-an-mcp-server",
      "mcp-security"
    ]
  },
  {
    "slug": "mcp-score",
    "term": "MCP Score",
    "title": "What Is an MCP Score?",
    "metaDescription": "The MCP Score is an explainable 0–100 grade for an MCP server's quality, security and context-cost across seven pillars, with the cause of every penalty.",
    "answer": "The MCP Score is CheckMCP's vendor-neutral, explainable 0–100 grade for a Model Context Protocol server. It combines six weighted pillars — security, tool design, schemas, context-cost, compliance and coverage — into one number (reliability is measured and shown as a seventh pillar but not yet credited), and attributes every deduction as measure → mechanism → effect, so the score is auditable rather than a black box.",
    "sections": [
      {
        "heading": "The seven pillars",
        "body": [
          "Each pillar measures one dimension of server quality: security (an OWASP MCP Top 10 pass, the top-weighted pillar), tool design (sprawl vs. consolidation, calibrated on real servers), schemas & descriptions (tool and input/output schema completeness), context-cost (tokens paid on every tools/list), compliance (protocol-version gap, annotations, JSON-RPC error conformance, OAuth discovery), reliability (drift over time), and coverage (tools, resources and prompts).",
          "The pillars are weighted and summed to a 0–100 score, then mapped to a letter grade."
        ]
      },
      {
        "heading": "Hard floors",
        "body": [
          "Some problems are categorical, not gradual. A hardcoded secret in a schema or a critical injection (tool poisoning) caps the grade at D no matter how clean the rest is; a failed protocol handshake caps it at F. These floors stop a server from buying back a serious security failure with polish elsewhere."
        ]
      },
      {
        "heading": "Explainable, and more than the endpoint",
        "body": [
          "Every penalty is traceable: the report states what was measured, the mechanism, the effect on the agent, and the points lost — Lighthouse-style. CheckMCP also grades the backing GitHub repository separately as a Repo-Quality Score /100 (maintenance, license, adoption, documentation), so a server is judged on both its live behavior and its project health."
        ]
      }
    ],
    "checkmcpRelation": "The MCP Score is what CheckMCP produces for every audited server. It is computed in the open (the methodology is published), calibrated on a growing corpus of real MCP servers, and free — you get it by pasting a URL at checkmcp.dev or running the CLI. The score stays free as the acquisition layer; paid plans add continuous monitoring, behavioral evals and the in-band gateway.",
    "faq": [
      {
        "q": "What is a good MCP Score?",
        "a": "Higher is better on the 0–100 scale, mapped to letter grades. A grade of A or B indicates strong security and design; C is moderate; D or F flags significant issues — and certain security failures (a secret in a schema, a critical injection, a failed handshake) hard-cap the grade regardless of the rest."
      },
      {
        "q": "How is the MCP Score calculated?",
        "a": "Six weighted pillars (security, tool design, schemas, context-cost, compliance, coverage) are scored against the real MCP ecosystem and summed; reliability is measured and shown but not yet credited. Hard floors apply for categorical security failures. Every deduction is attributed to a measurable cause."
      },
      {
        "q": "Is the MCP Score free?",
        "a": "Yes. Auditing and the MCP Score are free, including the open-source CLI and the public directory. Continuous monitoring, on-demand behavioral evals and the in-band gateway are paid features."
      },
      {
        "q": "What is the difference between the MCP Score and the Repo-Quality Score?",
        "a": "The MCP Score grades the live server (security, tool design, schemas, context-cost, compliance, coverage, reliability). The Repo-Quality Score /100 separately grades the backing GitHub repository on maintenance, license, adoption and documentation."
      }
    ],
    "related": [
      "mcp-security",
      "mcp-context-cost",
      "what-is-an-mcp-server"
    ]
  },
  {
    "slug": "model-context-protocol",
    "term": "Model Context Protocol (MCP)",
    "title": "What Is the Model Context Protocol (MCP)?",
    "metaDescription": "Model Context Protocol (MCP): Anthropic's open JSON-RPC 2.0 standard connecting AI agents to tools, resources and prompts. How it works and why it matters.",
    "answer": "The Model Context Protocol (MCP) is an open JSON-RPC 2.0 standard, introduced by Anthropic, that lets an AI application connect to external tools, data and prompts through one uniform interface. A host runs one MCP client per server, performs a capability handshake, then discovers and calls the server's tools, resources and prompts. MCP solves the N×M integration problem: instead of building a custom connector for every model-times-tool pairing, each side implements MCP once and interoperates with everything else that speaks it.",
    "checkmcpRelation": "CheckMCP is built directly on the protocol described here: it connects to any live MCP server the same way a host does — performing the capability handshake, then calling tools/list, resources/list and prompts/list — and turns what it sees into a vendor-neutral MCP Score from 0 to 100 (grade A–F). A live endpoint is graded across seven pillars (security 20, tool design 18, schemas/descriptions 16, reliability 14, context-cost 12, compliance 12, coverage 8); a source repository or stdio server is graded on four (maintenance 40, license 25, adoption 20, documentation 15). The compliance pillar checks exactly the protocol mechanics on this page — JSON-RPC error conformance, a valid negotiated protocol version, annotation coverage and OAuth discovery — while a failed MCP handshake is a hard floor that caps the grade at F (a plaintext secret found in a tool schema caps it at D). You can run it with uvx audit-mcp <url> (open-source, MIT, stdlib-only), at checkmcp.dev, or as a GitHub Action (uses: H129hj/checkmcp@v1) to fail a build on a score regression or rug-pull. Beyond scoring, an in-band Gateway (passive and active modes) plus drift monitoring sit between agent and server to block tool poisoning before it reaches your agent.",
    "sections": [
      {
        "heading": "What the Model Context Protocol is",
        "body": [
          "The Model Context Protocol (MCP) is an open standard, introduced by Anthropic, for connecting AI applications to the outside world. It defines a single wire format — JSON-RPC 2.0 — that an AI app (the host) and an external capability provider (the server) use to talk to each other. Once an app speaks MCP, it can connect to any compliant server without bespoke glue code.",
          "The common analogy is USB-C for AI: one connector standard instead of a different cable for every device. Before MCP, every assistant, IDE and agent framework invented its own plugin or tool-calling format, and every tool vendor had to re-implement against each one. MCP replaces that fragmentation with a protocol both sides implement once.",
          "MCP is intentionally narrow and model-agnostic. It does not dictate which model you use or how the model reasons; it only standardizes how the model's host discovers and invokes external capabilities and pulls in external data."
        ]
      },
      {
        "heading": "The N×M integration problem MCP solves",
        "body": [
          "The N×M (\"N times M\") integration problem is what you get when N AI applications each need to connect to M external tools or data sources. Without a shared standard, every app-to-tool pairing is a separate, hand-written integration, so the number of connectors you have to build and maintain grows as N multiplied by M. Ten apps and ten tools is a hundred bespoke integrations, each with its own auth, schema and quirks.",
          "MCP collapses that to N + M. Each AI application implements an MCP client once, and each tool or data source implements an MCP server once. Any client can then talk to any server, because they share the same protocol. New tools become available to every MCP-capable app for free, and new apps inherit the entire existing ecosystem of servers.",
          "This is the same leverage standard protocols brought elsewhere: the way HTTP let any browser talk to any web server, or the Language Server Protocol let any editor talk to any language tooling, MCP lets any agent talk to any capability provider. The integration cost stops scaling with the product of both sides and starts scaling with the sum."
        ]
      },
      {
        "heading": "How MCP works: host, client, server",
        "body": [
          "An MCP deployment has three roles. The host is the AI application the user interacts with — Claude Desktop, an IDE assistant, or your own agent. Inside the host, an MCP client manages the connection to exactly one server: if a host uses three servers, it runs three clients. The server is the program that exposes capabilities over MCP.",
          "A connection begins with a capability handshake. The client and server exchange an initialize message that negotiates the protocol version and advertises what each side supports. Only after this handshake succeeds does the host trust the server enough to enumerate and use what it offers — which is why a server that fails the handshake is effectively unusable.",
          "After initialization, the host discovers capabilities by calling listing methods (tools/list, resources/list, prompts/list) and then invokes them on demand (tools/call to run a tool, resources/read to pull in data). Because discovery is dynamic, the host re-reads the server's tool definitions per session rather than pinning a reviewed copy — convenient, but the reason an approved server can later change what it exposes."
        ]
      },
      {
        "heading": "What a server exposes: tools, resources, prompts",
        "body": [
          "An MCP server can offer three primitives. Tools are callable functions the model can invoke — each has a name, a human-readable description, and a JSON Schema describing its inputs (and often its outputs). Tools are the highest-leverage and highest-risk surface, because their descriptions and outputs flow straight into the model's context.",
          "Resources are readable data the model can pull into context, addressed by URI — files, database rows, API responses. Prompts are reusable, parameterized prompt templates the host can surface to the user or the model. A given server may expose any combination of the three; many real servers are tool-centric and expose few or no resources and prompts.",
          "One useful distinction for trust: tools are model-controlled (the model decides when to call them), resources are application-controlled, and prompts are user-controlled. Knowing which primitive carries which authority helps you reason about what an unfamiliar server can actually do once your agent loads it."
        ]
      },
      {
        "heading": "Transports: local stdio vs. remote HTTP",
        "body": [
          "MCP separates the message format (JSON-RPC 2.0) from how those messages are delivered, so the same protocol works locally and remotely. The stdio transport runs the server as a local subprocess and exchanges messages over standard input/output — the common choice for desktop tools and anything that needs filesystem or local-process access.",
          "For remote servers, MCP uses HTTP-based transports: the modern Streamable HTTP transport, and the legacy HTTP+SSE (Server-Sent Events) pairing it superseded. Remote servers commonly sit behind OAuth 2.1 for authorization, so the host completes an auth flow before the handshake.",
          "Because one protocol spans local and remote, an agent can freely mix first-party and third-party servers — a local filesystem server next to a remote SaaS server. That flexibility is exactly why evaluating an unknown server before trusting it matters: the transport tells you where the code runs, not whether the tools it ships are safe to expose to your agent."
        ]
      }
    ],
    "faq": [
      {
        "q": "What is the Model Context Protocol (MCP)?",
        "a": "MCP is an open JSON-RPC 2.0 standard, introduced by Anthropic, that lets AI applications connect to external tools, data and prompts through one uniform interface. An app implements MCP once and can then talk to any compliant server, replacing per-app, per-tool custom integrations."
      },
      {
        "q": "How does MCP work?",
        "a": "A host application runs one MCP client per server. The client and server complete a capability handshake (an initialize exchange that negotiates the protocol version), after which the host discovers the server's capabilities via listing calls (tools/list, resources/list, prompts/list) and invokes them on demand (for example tools/call). Messages travel as JSON-RPC 2.0 over a transport: local stdio, or remote Streamable HTTP / legacy HTTP+SSE."
      },
      {
        "q": "What is the N×M integration problem that MCP solves?",
        "a": "With N AI applications each needing to connect to M tools or data sources and no shared standard, you have to build and maintain N×M separate custom integrations. MCP reduces that to N+M: every app implements an MCP client once and every tool implements an MCP server once, so any client can talk to any server. New tools become usable by every MCP app, and new apps inherit the whole existing server ecosystem."
      },
      {
        "q": "What does an MCP server expose?",
        "a": "Up to three primitives: tools (callable functions, each with a name, description and JSON-Schema inputs/outputs), resources (readable data addressed by URI), and prompts (reusable, parameterized templates). Servers can expose any combination; most are tool-centric. Tools are the highest-leverage and highest-risk surface because their descriptions and outputs are read directly into the model's context."
      },
      {
        "q": "Who created MCP and is it open?",
        "a": "MCP was introduced by Anthropic and is an open standard — the specification and SDKs are public, and the protocol is model-agnostic, so it is not tied to any single vendor's model or product. Anyone can build a compliant host or server."
      },
      {
        "q": "What is the difference between a local and a remote MCP server?",
        "a": "A local server runs as a subprocess on your machine and communicates over the stdio transport — common for filesystem and local-tool access. A remote server runs elsewhere and communicates over HTTP, using the modern Streamable HTTP transport or the legacy HTTP+SSE pairing, often behind OAuth 2.1. The protocol semantics (handshake, tools, resources, prompts) are identical either way; only the transport and trust boundary differ."
      }
    ],
    "related": [
      "what-is-an-mcp-server",
      "mcp-client-server-host",
      "mcp-tools-resources-prompts",
      "local-vs-remote-mcp-servers",
      "mcp-security"
    ]
  },
  {
    "slug": "are-mcp-servers-safe",
    "term": "Are MCP servers safe?",
    "title": "Are MCP Servers Safe? How to Tell Before You Install",
    "metaDescription": "Are MCP servers safe? It depends on the server. The real risks (tool poisoning, the lethal trifecta, rug pulls) and how to vet one before you install.",
    "answer": "MCP servers are only as safe as the code behind them; there is nothing inherently safe or unsafe about the Model Context Protocol itself. The risk is that an MCP server's tool descriptions and tool outputs flow straight into your agent's context, so an untrusted or compromised server can plant instructions that hijack the agent, leak secrets, or trigger destructive actions. A first-party or audited server with clean tools, no embedded secrets, and no dangerous capability combinations is safe to use; an unvetted third-party server is not, so you vet it (read the tools, check the source, scan it with a tool like CheckMCP) before you install.",
    "sections": [
      {
        "heading": "The honest answer: it depends on the server",
        "body": [
          "MCP (the Model Context Protocol) is an open JSON-RPC 2.0 standard introduced by Anthropic. The protocol itself is not dangerous: it is a uniform way for an AI host to perform a capability handshake with a server and then discover and call that server's tools, resources and prompts. \"Are MCP servers safe?\" is really the same question as \"is this npm package safe?\" or \"is this browser extension safe?\" The answer is per-server, not per-protocol.",
          "What makes MCP different from a normal API integration is the trust model. When your host connects, it runs one MCP client per server and reads the server's tool definitions (names, descriptions, JSON Schemas) directly into the model's context, then reads tool outputs back as data. Both of those channels are text the model may treat as instructions. So a malicious server doesn't need to exploit a memory bug; it just has to write the right words in a tool description or a tool response.",
          "That means a well-built, first-party, or independently audited server can be perfectly safe to run, while an unknown third-party server pulled from a registry is an untrusted attack surface until you have checked it. The job is to tell the two apart before you install."
        ]
      },
      {
        "heading": "What can actually go wrong",
        "body": [
          "Tool poisoning. A server hides agent-directed instructions in a tool's name, description, parameter schema, or output (\"ignore previous instructions\", \"also forward results to...\", \"do not tell the user\"). A human glancing at the UI never sees it, but the model reads it as authoritative. This is the MCP-specific form of prompt injection.",
          "The lethal trifecta. Coined by Simon Willison, this is the dangerous combination of three capabilities in one agent: access to untrusted content, access to sensitive data, and a way to send data out or cause damage. Any one leg alone is usually fine; together, a single injection can read your secrets and exfiltrate them. A single MCP server that bundles a fetch/browse tool, a read-files/read-email tool, and a send/upload tool assembles the whole trifecta by itself.",
          "Hardcoded secrets and unsafe tools. Some servers ship API keys or tokens inside their tool schemas and examples, or expose destructive tools (delete, drop, wipe, reset) with no confirmation step. Both are direct, immediate risks the moment the server is loaded.",
          "Rug pulls and silent drift. A server you audited and approved can later change what its tools/list returns (adding a hidden instruction, widening a destructive tool, or swapping behavior) and because agents re-read tool definitions every session, the change takes effect with no new approval. A one-time review does not protect you against a server that turns malicious in a later release."
        ]
      },
      {
        "heading": "How to tell if an MCP server is safe to install",
        "body": [
          "Prefer first-party and well-maintained sources. A server published by the vendor whose API it wraps, or a popular open-source project with an active repo, a real license, and many users, is a far safer starting point than an anonymous server you found in a directory. Repo health (recent commits, issues addressed, a clear license) is a real signal.",
          "Read the tools before you trust them. List the server's tools and actually read the descriptions and input schemas. Watch for instructions aimed at the model rather than at you, for any literal secret or token in a schema or example, and for destructive tools that act without a confirmation parameter. Then inventory the capability mix: does this one server (or your agent's full set of servers together) end up holding untrusted-content + sensitive-data + an outbound path? If so, you have a trifecta to break up.",
          "Prefer local (stdio) for sensitive work and scope credentials tightly. Local stdio servers keep data on your machine; remote servers (Streamable HTTP, or the legacy HTTP+SSE transport) send tool traffic over the network, so check who operates them and what auth they use. Give every server the least privilege it needs, and don't co-load a content-fetching server alongside a secrets-bearing server in the same agent if you can avoid it.",
          "Scan it, then keep watching it. The fastest way to vet an unknown server is to run an automated audit that checks all of the above for you and re-checks it over time so a later rug pull doesn't slip through. A static read of the published tools catches poisoning and secrets shipped in the schema; a runtime probe catches the output-delivered attacks a static scan can't see; continuous monitoring catches drift."
        ]
      },
      {
        "heading": "Building your own server? Make it pass the same bar",
        "body": [
          "If you are the one shipping an MCP server, the safety checklist is the inverse of the risks above. Keep secrets out of tool schemas, descriptions, defaults and examples and load them from the environment instead. Mark destructive tools with a destructiveHint and require explicit confirmation before they act.",
          "Don't bundle untrusted-content ingestion, sensitive-data access, and an outbound or destructive path into one server; splitting those capabilities means a single injection can't become a breach. Set accurate tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) so clients can treat your tools correctly instead of assuming the worst.",
          "Finally, treat the tool list as a contract: version it, and re-audit on every release so you don't accidentally ship a regression that looks like a rug pull to your users. Running an automated audit in CI turns \"is my server safe?\" into a gate you can't forget to check."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP exists to answer \\\"is this MCP server safe?\\\" with evidence instead of a guess. Paste a URL at checkmcp.dev or run uvx audit-mcp <url> and it probes the live server and returns a vendor-neutral MCP Score (0-100, grade A-F) across seven pillars, with security the top-weighted at 20/100 (then tool design 18, schemas/descriptions 16, reliability 14, context/token cost 12, compliance 12, use-case coverage 8). The security pillar runs an OWASP MCP Top 10 pass: it flags hardcoded secrets in schemas (MCP01), destructive tools missing a confirmation or destructiveHint (MCP02), injected poisoning instructions in descriptions/schemas/outputs (MCP03), and the lethal-trifecta capability combination (MCP06). Categorical failures hit a hard floor: a secret in a schema or a critical injection caps the grade at D (the score is capped at 69 and flagged SECURITY_RISK), and a failed MCP handshake caps it at F, so a server can't buy back a serious security flaw with polish elsewhere. Opt-in behavioral evals exercise only read-only tools with benign canary inputs to catch prompt injection and data exfiltration delivered through tool outputs, never invoking mutating tools. For ongoing safety, the GitHub Action (uses: H129hj/checkmcp@v1) fails a build on a score regression or rug-pull, drift monitoring re-checks tracked servers, and an in-band Gateway sits between your agent and the server to block tool-poisoning and exfiltration in tool outputs before they reach the model (passive observe-and-log mode, or active block/strip mode). Repos and stdio servers are graded on a separate four-pillar Repo-Quality Score (maintenance 40, license 25, adoption 20, documentation 15) so you can weigh project health too. The CLI is open-source (MIT, stdlib-only).",
    "faq": [
      {
        "q": "Are MCP servers safe to use?",
        "a": "It depends entirely on the individual server, not on the protocol. MCP itself is a neutral open JSON-RPC 2.0 standard; the risk is that a server's tool descriptions and outputs are read straight into your agent's context, so an untrusted or compromised server can hijack the agent, leak secrets, or trigger destructive actions. A first-party or audited server with clean tools and no dangerous capability combinations is safe; an unvetted third-party server is not until you have checked it."
      },
      {
        "q": "Are MCP servers secure by default?",
        "a": "No, there is no built-in vetting. Your host trusts whatever a server returns from tools/list and re-reads it every session, so there is no lockfile-style guarantee that the tools you reviewed are the tools that run later. Security depends on the server author keeping secrets out of schemas, gating destructive tools, and not bundling risky capabilities, and on you auditing the server before and after you install it."
      },
      {
        "q": "What are the security risks of MCP servers?",
        "a": "The main MCP-specific risks are tool poisoning (hidden agent-directed instructions in tool metadata or output), the lethal trifecta (one server combining untrusted content, sensitive-data access, and an exfiltration or destruction path so an injection becomes a breach), hardcoded secrets exposed in tool schemas, destructive tools that act without confirmation, and rug pulls (a trusted server silently changing its tools after approval). CheckMCP checks for all of these as part of its OWASP MCP Top 10 security pass."
      },
      {
        "q": "How can I tell if an MCP server is safe to install?",
        "a": "Prefer first-party or well-maintained open-source servers, then read the tool descriptions and input schemas yourself, looking for instructions aimed at the model, literal secrets in schemas, and unconfirmed destructive tools. Inventory the capability mix to make sure no single server (or your whole agent) forms the lethal trifecta, prefer local stdio servers for sensitive data, and scope credentials tightly. The fastest path is to run an automated audit like CheckMCP (uvx audit-mcp <url>), which checks all of this and re-checks the server over time."
      },
      {
        "q": "Is it dangerous to add an unknown MCP server to Claude Desktop or my agent?",
        "a": "Yes, treat any unknown third-party server as untrusted until vetted. Once loaded, its tool definitions and outputs go straight into the model's context, so it can attempt prompt injection or, if it also has data access and an outbound path, exfiltration. Audit the server first, give it least privilege, and avoid co-loading a content-fetching server with a secrets-bearing one in the same agent."
      },
      {
        "q": "Does a one-time security scan keep an MCP server safe?",
        "a": "No. A single scan only certifies the server as it was at that moment, and a rug pull or silent tool drift happens afterward: the server changes its tools/list and the agent trusts the new version with no re-approval. Detecting that requires continuous re-probing, capturing a baseline and diffing the tool set on each run while re-running the security checks. CheckMCP's drift monitoring, GitHub Action, and Gateway are built for exactly this ongoing check."
      }
    ],
    "related": [
      "mcp-security",
      "tool-poisoning",
      "lethal-trifecta",
      "mcp-rug-pull",
      "how-to-audit-an-mcp-server",
      "mcp-server-vulnerabilities"
    ]
  },
  {
    "slug": "how-to-audit-an-mcp-server",
    "term": "Auditing an MCP server",
    "title": "How to Audit an MCP Server for Security",
    "metaDescription": "How to audit an MCP server before installing it: scan for tool poisoning, leaked secrets and the lethal trifecta, and verify it with an explainable MCP Score.",
    "answer": "Auditing an MCP server means inspecting it before you trust it: complete the JSON-RPC 2.0 capability handshake, read every tool, resource and prompt the server exposes (including each tool's description and input/output schema), and check them against known MCP risks (tool poisoning, hardcoded secrets, command injection, the lethal trifecta) — then, for live servers, exercise read-only tools to confirm their responses are clean. CheckMCP automates this end to end and returns an explainable MCP Score (0-100, grade A-F) so you can verify an MCP server before installing it without reading the source by hand.",
    "checkmcpRelation": "CheckMCP is purpose-built to audit MCP servers and produce one vendor-neutral, explainable MCP Score (0-100, grade A-F). For a live endpoint it performs the JSON-RPC 2.0 handshake and scores seven pillars — security (20), tool design (18), schemas and descriptions (16), reliability (14), context-cost/token (12), compliance (12) and coverage/use-case (8) — where the security pillar runs an OWASP MCP Top 10 pass (tool poisoning, hardcoded secrets, command injection, the lethal trifecta, and more). For a repo or stdio server it grades four pillars instead — maintenance (40), license (25), adoption (20) and documentation (15). Two hard caps ('floors') make serious findings impossible to paper over: a secret found in a tool schema caps the grade at D, and a failed MCP handshake caps it at F. Behavioral evals exercise only read-only tools with canary inputs to catch prompt-injection or data-exfiltration delivered in tool responses, never calling mutating tools. You can run it three ways: 'uvx audit-mcp <url>' from the open-source MIT, stdlib-only CLI; the web app at checkmcp.dev; or the GitHub Action ('uses: H129hj/checkmcp@v1') to fail a build on a score regression or rug-pull in CI. The in-band Gateway — which blocks tool-poisoning and drift before it reaches your agent, in passive or active mode — plus drift monitoring then keep an approved server honest after the one-time audit.",
    "sections": [
      {
        "heading": "Why you should audit an MCP server before installing it",
        "body": [
          "An MCP server is not a passive data source — it is an active participant in your agent's reasoning. The Model Context Protocol is an open JSON-RPC 2.0 protocol introduced by Anthropic: when a host connects, it runs one MCP client per server, performs a capability handshake, then discovers the server's tools, resources and prompts and reads their names, descriptions and JSON schemas straight into the model's context. It later reads tool outputs back as data. Both of those channels carry text the model can interpret as instructions, so an untrusted server is an attack surface, not just a dependency.",
          "That makes 'install first, trust later' the wrong default. A server you have never reviewed can ship hidden instructions in a tool description (tool poisoning), leak a hardcoded secret embedded in a schema, expose a destructive tool with no confirmation, or concentrate the lethal trifecta — untrusted-content ingestion, sensitive-data access and an outbound path — on a single server. None of that is visible in a one-line marketing description.",
          "Auditing is the step that closes the gap between 'this server looks useful' and 'this server is safe to give my agent.' The goal of this page is defensive: explain what to check and how to verify a server, not how to attack one."
        ]
      },
      {
        "heading": "What to check when you audit an MCP server",
        "body": [
          "Start with the protocol surface. Confirm the server completes a clean MCP handshake over its declared transport — stdio for local servers, Streamable HTTP (or legacy HTTP+SSE) for remote ones — that it negotiates a sane protocol version, and that it returns well-formed JSON-RPC 2.0 errors. A server that cannot even handshake correctly is a reliability and trust red flag before you reach any security check.",
          "Then read the capabilities the server exposes: every tool, resource and prompt. For each tool, inspect the full definition — name, description, every parameter (including defaults and examples) and the input/output schema — because the agent ingests all of it. You are looking for instruction-like text where only documentation should be, credential-shaped strings sitting in schemas or examples, and destructive verbs (delete, drop, send, transfer) that lack any confirmation gate.",
          "Finally, reason about capability combinations, not just individual tools. The danger is combinatorial: a single server that can fetch untrusted content, reach sensitive data, and exfiltrate or destroy holds all three legs of the lethal trifecta, and the same trifecta can form across several servers loaded into one agent. Inventory which server contributes which capability before you deploy."
        ]
      },
      {
        "heading": "How to scan an MCP server for vulnerabilities: static vs runtime",
        "body": [
          "Auditing has two complementary layers. Static analysis reads the published tool list, schemas and protocol behavior without any side effects. It is fast and safe, and it catches the risks that ship in the declaration: poisoning planted in a description, a secret hardcoded in a schema, a destructive tool missing its confirmation, and risky capability mixes. Most of the OWASP MCP Top 10 can be checked this way, and it is the right place to start because it requires no execution.",
          "Runtime (behavioral) analysis is needed for the attacks a static scan cannot see — namely instructions or exfiltration vectors delivered in a tool's response rather than its schema. The safe way to do this is to invoke only read-only tools with benign canary inputs and inspect what comes back, never calling mutating tools such as create, delete, send or execute. A clean-looking server can still relay attacker-authored text from a web page or email it fetched, which is exactly why exercising real responses matters.",
          "A single audit certifies a server only as it was at probe time. Because a trusted server can silently change its tools afterwards (an MCP rug pull), a complete program treats the one-time audit as a baseline and re-checks the server over time — diffing the tool set against that baseline and re-running the same security checks against whatever the server now returns."
        ]
      },
      {
        "heading": "How to verify a server with a reproducible score",
        "body": [
          "Reading every schema by hand does not scale, and it is easy to miss an injection buried in a parameter default. The practical answer is to run the audit through a tool that applies the same checks consistently and gives you a reproducible, explainable result instead of a yes/no verdict you cannot inspect.",
          "CheckMCP turns the audit into one number with the reasoning attached: a 0-100 MCP Score and an A-F grade, broken down by weighted pillar, with the cause of every deduction stated as measure to mechanism to effect. Hard floors make the serious cases unambiguous — a secret in a tool schema caps the grade at D, and a failed handshake caps it at F — so a server cannot buy back a real security failure with polish elsewhere.",
          "You can run the audit from the command line with 'uvx audit-mcp <url>' (open-source, MIT, stdlib-only), from the web app at checkmcp.dev by pasting a URL, or in CI with the GitHub Action ('uses: H129hj/checkmcp@v1') to fail a build when a score regresses or a rug-pull appears. For higher assurance, the behavioral evals add the runtime layer, and the in-band Gateway plus drift monitoring keep watching an approved server after it passes."
        ]
      }
    ],
    "faq": [
      {
        "q": "How do I audit an MCP server?",
        "a": "Connect to the server, complete its JSON-RPC 2.0 capability handshake, and read every tool, resource and prompt it exposes — including each tool's description, parameters, defaults, examples and input/output schema. Check that text against known MCP risks (tool poisoning, hardcoded secrets, command injection, the lethal trifecta), and for live servers exercise read-only tools with benign inputs to confirm their responses are clean. CheckMCP automates all of this and returns an explainable MCP Score (0-100, grade A-F); run 'uvx audit-mcp <url>' or paste a URL at checkmcp.dev."
      },
      {
        "q": "How do I scan an MCP server for vulnerabilities?",
        "a": "Scan in two layers. A static scan reads the published tool list and schemas with no side effects and catches poisoning, secrets in schemas, unsafe destructive tools and the lethal trifecta — most of the OWASP MCP Top 10. A runtime scan invokes only read-only tools with canary inputs to catch injection or exfiltration delivered in tool responses, and must never call mutating tools. CheckMCP runs the static OWASP MCP Top 10 pass on every audit and adds behavioral evals for the runtime layer."
      },
      {
        "q": "How do I verify an MCP server before installing it?",
        "a": "Audit it first, then install. Verify that the server handshakes cleanly over its declared transport (stdio for local, Streamable HTTP or legacy HTTP+SSE for remote), that no tool description or schema contains hidden instructions or hardcoded secrets, that destructive tools require confirmation, and that one server does not combine untrusted-content access, sensitive-data access and an outbound path. CheckMCP gives you a reproducible MCP Score so you can verify a server before installing without reading the source by hand."
      },
      {
        "q": "What does an MCP security audit actually check?",
        "a": "For a live server, CheckMCP scores seven pillars: security (20), tool design (18), schemas and descriptions (16), reliability (14), context-cost/token (12), compliance (12) and coverage/use-case (8). The security pillar runs an OWASP MCP Top 10 pass covering tool poisoning, hardcoded secrets, command injection and the lethal trifecta. A secret found in a tool schema hard-caps the grade at D and a failed handshake caps it at F, so categorical failures cannot be hidden behind a high overall score."
      },
      {
        "q": "Can I audit a local or repo-based MCP server, not just a live URL?",
        "a": "Yes. A live endpoint is scored on the seven runtime pillars after a JSON-RPC 2.0 handshake. A repo or stdio server is graded on four pillars instead — maintenance (40), license (25), adoption (20) and documentation (15) — so you can assess project health and supply-chain signals even when there is no running endpoint to probe."
      },
      {
        "q": "Is one audit enough, or do I need to re-check the server?",
        "a": "One audit only certifies the server as it was at probe time. Because a trusted server can silently change its tools after approval (an MCP rug pull or drift), treat the first audit as a baseline and re-check over time. CheckMCP supports this with a GitHub Action that fails a build on score regression, plus drift monitoring and an in-band Gateway that blocks tool-poisoning and drift before it reaches your agent."
      },
      {
        "q": "Is auditing an MCP server with CheckMCP safe to run?",
        "a": "Yes. The static audit reads tool metadata and schemas without executing anything. The behavioral evals exercise only tools judged read-only-safe with benign canary inputs and never invoke mutating tools (create, delete, send, execute), so auditing a server does not trigger side effects on the systems it connects to."
      }
    ],
    "related": [
      "mcp-security",
      "tool-poisoning",
      "lethal-trifecta",
      "mcp-rug-pull",
      "mcp-score",
      "owasp-mcp-top-10"
    ]
  },
  {
    "slug": "how-to-add-mcp-server-to-claude-desktop",
    "term": "MCP server configuration",
    "title": "How to Add an MCP Server to Claude Desktop",
    "metaDescription": "How to add an MCP server to Claude Desktop: where the config JSON lives, the mcpServers schema for stdio and remote servers, and how to add one safely.",
    "answer": "To add an MCP server to Claude Desktop, open Settings -> Developer -> Edit Config, which opens claude_desktop_config.json. Add an entry under the top-level \"mcpServers\" object -- a key (the server's name) mapping to either a local stdio launcher (\"command\" plus \"args\" and optional \"env\") or a remote endpoint (\"url\") -- then save and fully restart Claude Desktop. On launch it spawns one MCP client per server, runs the JSON-RPC 2.0 capability handshake, and then discovers and calls that server's tools, resources and prompts. Because a server's tool descriptions and outputs flow straight into the model's context, audit any third-party server before you add it.",
    "sections": [
      {
        "heading": "Where the config lives and how to open it",
        "body": [
          "Claude Desktop reads its MCP servers from a single JSON file called claude_desktop_config.json. The easiest way to find it is inside the app: open Settings, go to the Developer tab, and click \"Edit Config\" -- that creates the file if it does not exist and reveals it in your file manager. On macOS it lives at ~/Library/Application Support/Claude/claude_desktop_config.json; on Windows at %APPDATA%\\Claude\\claude_desktop_config.json.",
          "The file is plain JSON, so it must be valid: no trailing commas, no comments, all strings double-quoted. A single syntax error stops every server from loading, so validate the file (any JSON linter works) after editing.",
          "Claude Desktop only re-reads this file on launch. After any change you must fully quit the app -- not just close the window -- and reopen it for the new or edited server to take effect."
        ]
      },
      {
        "heading": "The mcpServers schema",
        "body": [
          "Everything lives under one top-level object named \"mcpServers\". Each key is a name you choose for the server (it is just a label shown in the UI), and each value is the configuration object for that server.",
          "For a local server over the stdio transport, the value is a launcher: \"command\" is the executable to run (for example \"npx\", \"uvx\", \"node\", or an absolute path to a binary), \"args\" is an array of arguments passed to it, and the optional \"env\" object injects environment variables -- the standard place to pass API keys and tokens rather than hardcoding them into args. Claude Desktop spawns this command as a subprocess and speaks JSON-RPC 2.0 over its stdin/stdout.",
          "For a remote server over Streamable HTTP (or the legacy HTTP+SSE transport), the value points at an endpoint with a \"url\" field instead of a command, and remote servers commonly sit behind OAuth 2.1 or a bearer token. Whichever transport you use, the host (Claude Desktop) starts one MCP client per entry, performs the capability handshake to negotiate what each side supports, then discovers and calls that server's tools, resources and prompts."
        ]
      },
      {
        "heading": "A minimal config example",
        "body": [
          "A working file with one local stdio server and one remote server looks like this: { \"mcpServers\": { \"my-local-tool\": { \"command\": \"uvx\", \"args\": [\"some-mcp-server\"], \"env\": { \"API_KEY\": \"...\" } }, \"my-remote-tool\": { \"url\": \"https://example.com/mcp\" } } }. Save it, fully restart Claude Desktop, and the servers appear in the tools menu.",
          "If a server fails to appear, the usual causes are invalid JSON, a \"command\" that is not on the app's PATH (use an absolute path if in doubt), a missing required \"env\" value, or simply not having restarted the app. Claude Desktop writes MCP logs you can inspect to see the handshake succeed or fail.",
          "Keep real secrets in \"env\", never in \"args\" or in a tool's schema, and prefer named environment references over pasting long-lived keys directly into a file that may end up in a backup or a screen-share."
        ]
      },
      {
        "heading": "Adding a server safely",
        "body": [
          "Adding an MCP server grants it real reach into your session: the server's tool descriptions are read into the model's context as authoritative text, and the tool outputs it returns are read back as data the model may act on. A malicious or compromised server can abuse either channel to steer the agent -- this is tool poisoning and tool-output prompt injection -- without the text ever appearing in the UI.",
          "The risk compounds when you load several servers at once. Capabilities are additive across your whole config: a server that can read private data, a server that can fetch untrusted content, and a server that can send data out can together form the lethal trifecta -- the combination under which a single injection can turn into real data exfiltration -- even if each server looked harmless alone.",
          "The practical defenses are straightforward: add servers from sources you trust, keep credentials in \"env\", prefer servers whose tools clearly mark destructive operations (via annotations), and audit any unfamiliar server before you add it. Servers can also silently change their tool definitions after you approve them (a rug pull), so re-checking on updates -- not just on day one -- is part of staying safe."
        ]
      }
    ],
    "checkmcpRelation": "Before you paste a third-party server into claude_desktop_config.json, CheckMCP tells you whether it is safe to add. Paste the server's URL at checkmcp.dev -- or run `uvx audit-mcp <url>` from the open-source CLI -- and CheckMCP probes the live endpoint and returns an explainable, vendor-neutral MCP Score 0-100 (grade A-F) across seven pillars led by security (weight 20), which runs an OWASP MCP Top 10 pass for tool poisoning, hardcoded secrets, command injection and the lethal trifecta. Hard caps surface the worst configurations immediately: a secret found in a tool schema caps the grade at D, and a failed MCP handshake caps it at F. Opt-in behavioral evals exercise read-only tools with canary inputs to catch prompt-injection and data-exfiltration in tool responses. For servers you depend on, the GitHub Action (`uses: H129hj/checkmcp@v1`) and drift monitoring re-check on every change so a rug pull after approval does not go unnoticed, and an in-band Gateway (passive or active mode) can block tool-poisoning and drift before they reach your agent. CheckMCP audits the server; you keep your config clean.",
    "faq": [
      {
        "q": "How do I add an MCP server to Claude Desktop?",
        "a": "Open Settings -> Developer -> Edit Config to open claude_desktop_config.json, add an entry under the top-level \"mcpServers\" object (a name mapped to a \"command\"/\"args\" launcher for a local stdio server, or a \"url\" for a remote server), save the file, then fully quit and reopen Claude Desktop so it loads the new server and runs the capability handshake."
      },
      {
        "q": "Where is the Claude Desktop MCP config file located?",
        "a": "It is claude_desktop_config.json. On macOS it lives at ~/Library/Application Support/Claude/claude_desktop_config.json and on Windows at %APPDATA%\\Claude\\claude_desktop_config.json. The quickest way to open it is Settings -> Developer -> Edit Config inside the app, which creates the file if it does not exist."
      },
      {
        "q": "How do I write an MCP server config JSON?",
        "a": "Use one top-level \"mcpServers\" object. Each key is the server's name; each value is either a local launcher -- \"command\" (the executable), \"args\" (an array), and optional \"env\" (environment variables, where API keys go) -- or a remote endpoint with a \"url\" field. The file must be valid JSON: no trailing commas, no comments, all strings double-quoted."
      },
      {
        "q": "My MCP server doesn't show up in Claude Desktop. Why?",
        "a": "The common causes are invalid JSON (a single error stops all servers from loading), a \"command\" that is not on the app's PATH (use an absolute path), a missing required value in \"env\", or not having fully restarted the app -- closing the window is not enough, you must quit and reopen. Claude Desktop's MCP logs show whether the handshake succeeded."
      },
      {
        "q": "Is it safe to add any MCP server to Claude Desktop?",
        "a": "No -- treat third-party servers as untrusted until checked. A server's tool descriptions and outputs are read into the model's context, so a malicious server can hijack the agent via tool poisoning or tool-output injection, and several servers together can form the lethal trifecta. Keep secrets in \"env\", add servers from trusted sources, and audit unfamiliar ones (for example with CheckMCP) before adding them."
      },
      {
        "q": "Where do I put API keys and secrets in the MCP config?",
        "a": "Put them in the \"env\" object of a local stdio server's entry, which injects them as environment variables into the server subprocess. Do not hardcode secrets into \"args\" or into a tool's schema -- a secret exposed in a tool schema is a recognized MCP risk and, in a CheckMCP audit, caps the server's grade at D."
      }
    ],
    "related": [
      "what-is-an-mcp-server",
      "mcp-client-server-host",
      "are-mcp-servers-safe",
      "tool-poisoning",
      "lethal-trifecta",
      "mcp-rug-pull"
    ]
  },
  {
    "slug": "mcp-server-vulnerabilities",
    "term": "MCP server vulnerabilities",
    "title": "MCP Server Vulnerabilities: The Attack Surface Explained",
    "metaDescription": "MCP server vulnerabilities: tool poisoning, leaked secrets, command injection, the lethal trifecta, rug pulls — the attack surface and how to stay safe.",
    "answer": "MCP server vulnerabilities are the security weaknesses an AI agent inherits when it connects to a Model Context Protocol (MCP) server, because the server's tool definitions and tool outputs flow straight into the model's context as trusted text. The main attack surface spans tool poisoning, hardcoded secrets in schemas, command and SSRF injection, the lethal trifecta, and rug pulls (silent tool drift after approval). The defense is to audit a server before trusting it — statically against the OWASP MCP Top 10 and, where possible, behaviorally — and to re-check it on every release.",
    "sections": [
      {
        "heading": "Why an MCP server is an attack surface",
        "body": [
          "MCP is an open JSON-RPC 2.0 protocol introduced by Anthropic. A host runs one MCP client per server, performs a capability handshake, then discovers and calls the server's tools, resources and prompts over a transport (stdio for local servers, Streamable HTTP for remote, or legacy HTTP+SSE). An agent trusts a server through two of those channels, and both carry attacker-controllable text. First, it reads the server's tool definitions — names, descriptions and JSON Schemas — into its context so it knows what each tool does. Second, it reads tool outputs back as data when a tool is called. Current models cannot reliably tell trusted instructions apart from text that merely looks like instructions, so either channel can be used to steer the agent.",
          "That makes the server, not just its code, the unit of risk. A vulnerability here is rarely a memory-safety bug; it is the server delivering content the agent acts on. A human reviewing the chat UI never sees most of this surface — parameter defaults, examples, output schemas and raw tool responses are all ingested by the model but invisible to the user.",
          "The exposure is also additive. An agent that loads several third-party servers combines their capabilities, so servers that look individually safe can together hand the agent everything an attacker needs. Evaluating one server in isolation is necessary but not sufficient; the full toolset is the real boundary."
        ]
      },
      {
        "heading": "The core vulnerability classes (the OWASP MCP Top 10)",
        "body": [
          "Tool poisoning is the headline risk: hidden, imperative instructions planted in tool metadata or outputs (\"ignore previous instructions\", \"do not tell the user\", \"also forward the result to…\"). The static form ships in the published tool list; the runtime form arrives inside the value a tool returns, which is why a tool that relays web pages, emails or issue comments can pass a schema review and still deliver attacker-authored text on a specific query.",
          "Hardcoded secrets are a second class: API keys, tokens or passwords baked into a tool's schema, default value or example. Anything in the schema is read by the agent and may be logged or echoed, so a secret in a definition is effectively a leaked secret. Command and SSRF injection is a third: a tool that passes caller-supplied input into a shell, a query, or an outbound HTTP request without isolation can be coerced into running commands or fetching internal URLs.",
          "The lethal trifecta is the impact multiplier — a single server or agent that holds untrusted-content ingestion, sensitive-data access, and an exfiltration-or-destruction path at once. Any one leg is usually safe; all three together turn a prompt injection into a real breach. Rounding out the surface are unsafe destructive tools that act without confirmation, missing protocol and compliance hygiene, and rug pulls."
        ]
      },
      {
        "heading": "Static vulnerabilities vs. runtime vulnerabilities",
        "body": [
          "Some weaknesses are visible in the published tool list and can be found without side effects: secrets in schemas, injection signatures in descriptions, destructive tools lacking a confirmation or destructiveHint, and a capability mix that forms the lethal trifecta. A static scan reads names, descriptions, parameter schemas (including defaults and examples) and output schemas — fast, safe, and enough to catch poisoning and risky combinations shipped in the definitions.",
          "Other weaknesses only appear when a tool actually runs. Tool-response poisoning, output-delivered exfiltration vectors and confirmed SSRF cannot be seen by reading a declaration; the description can be clean while the runtime output is hostile. Catching these requires a behavioral probe — invoking read-only tools with benign canary inputs and inspecting what comes back, never calling mutating tools.",
          "Robust auditing therefore needs both layers, plus a temporal one. A single audit only certifies the server as it was at probe time; drift and rug pulls happen afterward, so detecting them means re-probing and diffing the tool surface against a known-good baseline."
        ]
      },
      {
        "heading": "How to stay safe (for integrators and builders)",
        "body": [
          "If you are integrating a third-party server: audit it before trusting it, prefer servers that publish a methodology and score, and re-audit on every version. Inventory which servers contribute which trifecta leg and avoid loading a content-fetching server alongside a secrets-bearing server in the same agent. Pin a reviewed tool set where you can and alert on regression, since the agent will otherwise re-read whatever the server returns next session with no further approval.",
          "If you are building a server: keep secrets out of schemas, defaults and examples; require explicit confirmation (and set destructiveHint) on destructive tools; isolate or sandbox anything that touches a shell, a database, or an outbound request; and resist bundling untrusted-content ingestion, sensitive-data access and an outbound path into one server. Validate and constrain tool inputs, and treat every tool output your server relays as untrusted.",
          "Across both roles, capability separation beats hoping the model behaves. Because no current model fully resists prompt injection, the durable defense is to break at least one leg of the trifecta, gate consequential actions behind human confirmation, and continuously re-check the servers you depend on."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP maps this attack surface to a vendor-neutral MCP Score (0–100, grade A–F). Security is the top-weighted of the seven live-endpoint pillars (weight 20/100) and runs an OWASP MCP Top 10 pass: it flags hardcoded secret values in schemas, destructive tools missing a confirmation or destructiveHint, injected instructions in descriptions, parameter schemas or outputs (tool poisoning), and the lethal-trifecta capability combination on one server, among others. The other six live pillars are tool design (18), schemas and descriptions (16), reliability (14), context-cost/token (12), compliance (12) and coverage/use-case (8). Categorical failures hit hard floors: a secret found in a tool schema caps the grade at D, and a failed MCP handshake caps it at F. For the runtime-only classes, opt-in behavioral evals exercise read-only tools with benign canary inputs to catch tool-response poisoning and data exfiltration (including a planted callback-canary URL that, if the server fetches it, confirms exfiltration/SSRF), and CheckMCP never invokes mutating tools. Repo/stdio servers are scored separately on four pillars: maintenance (40), license (25), adoption (20) and documentation (15). You run it via `uvx audit-mcp <url>` (open-source MIT, stdlib-only CLI), the web app at checkmcp.dev, or a GitHub Action (`uses: H129hj/checkmcp@v1`) to fail a build on score regression or a rug pull. An in-band Gateway (passive and active modes) blocks tool poisoning and drift before it reaches your agent, and drift monitoring re-checks tracked servers over time.",
    "faq": [
      {
        "q": "What are the security risks of MCP servers?",
        "a": "The main risks are tool poisoning (hidden instructions in tool metadata or outputs), hardcoded secrets exposed in tool schemas, command and SSRF injection in tools that touch a shell or make outbound requests, the lethal trifecta (one server combining untrusted content, sensitive data and an exfiltration or destruction path), unsafe destructive tools that act without confirmation, and rug pulls where a trusted server silently changes its tools after approval. Because tool definitions and outputs flow into the agent's context as trusted text, these are the categories CheckMCP audits as the OWASP MCP Top 10."
      },
      {
        "q": "What is the MCP server attack surface?",
        "a": "It is everything the agent ingests from a server: the static tool definitions (names, descriptions, parameter schemas including defaults and examples, and output schemas) plus the runtime data tools return. Both channels carry text a model may treat as instructions, and a user reviewing the chat UI sees almost none of it. The surface is also additive across multiple loaded servers, so the real boundary is the agent's full toolset, not any single tool."
      },
      {
        "q": "Can a third-party MCP server compromise my agent?",
        "a": "Yes. A malicious or compromised server can plant instructions in its tool descriptions, schemas or outputs that steer the agent, and if that server can also reach sensitive data and send data out, an injection becomes a breach (the lethal trifecta). The defense is to audit the server before trusting it and re-audit on every release. CheckMCP runs that audit statically on every scan and, optionally, at runtime via behavioral evals."
      },
      {
        "q": "How do I find vulnerabilities in an MCP server before trusting it?",
        "a": "Audit it on both layers. A static scan reads the published tool metadata for secrets, injection signatures, missing destructive-tool confirmations and a lethal-trifecta capability mix; a behavioral probe invokes only read-only tools with benign canary inputs to catch output-delivered poisoning, exfiltration and confirmed SSRF without ever calling mutating tools. CheckMCP does both — paste a URL at checkmcp.dev or run `uvx audit-mcp <url>` — and produces an explainable 0–100 MCP Score with the reason for every deduction."
      },
      {
        "q": "What is the most dangerous MCP vulnerability?",
        "a": "The combination matters more than any single flaw. Tool poisoning supplies the injection, but it only becomes a breach when paired with the lethal trifecta — one server that can read untrusted content, reach sensitive data, and exfiltrate or destroy. CheckMCP treats secret exposure and these critical security cases categorically: a secret found in a tool schema trips a hard floor that caps the grade at D regardless of how clean the rest of the server is, and a server that fails the MCP handshake is capped at F."
      },
      {
        "q": "How do I protect against MCP rug pulls and tool drift?",
        "a": "Because agents re-read tool definitions each session without re-approval, a one-time audit cannot catch a server that turns malicious later. Pin a reviewed tool set, alert on regression, and continuously re-probe — diffing the current tool surface against a known-good baseline and re-running the security checks on whatever the server now returns. CheckMCP's drift monitoring and GitHub Action fail a build on score regression or a rug pull, and its Gateway blocks drift in-band before it reaches your agent."
      }
    ],
    "related": [
      "mcp-security",
      "tool-poisoning",
      "lethal-trifecta",
      "prompt-injection-via-tools",
      "mcp-rug-pull"
    ]
  },
  {
    "slug": "owasp-mcp-top-10",
    "term": "OWASP MCP Top 10",
    "title": "The OWASP MCP Top 10: MCP Threat Taxonomy",
    "metaDescription": "The OWASP MCP Top 10 is a threat taxonomy for MCP servers: tool poisoning, leaked secrets, command injection, the lethal trifecta, rug-pulls and more.",
    "answer": "The OWASP MCP Top 10 is a threat taxonomy that catalogs the most common, highest-impact security risks specific to Model Context Protocol (MCP) servers — including tool poisoning, hardcoded secrets in tool schemas, command and SQL injection, unsafe destructive tools, the lethal trifecta, and silent tool rug-pulls. It gives developers building or evaluating MCP servers a shared checklist for what to look for before they trust a server with an agent. CheckMCP runs an OWASP MCP Top 10 pass on every audit and folds it into Security, the top-weighted pillar (20 of 100 points) of its MCP Score.",
    "sections": [
      {
        "heading": "What the OWASP MCP Top 10 is (and why it exists)",
        "body": [
          "The OWASP MCP Top 10 is a threat taxonomy: a structured list of the recurring security weaknesses that show up specifically in MCP servers. MCP is an open JSON-RPC 2.0 protocol, introduced by Anthropic, that lets an AI host run one MCP client per server, perform a capability handshake, and then discover and call that server's tools, resources and prompts. That power is exactly what makes a server a security surface — its tool descriptions are read into the model's context, and its tool outputs are read back as data, so an untrusted server has two channels into the agent.",
          "Classic application-security taxonomies like the OWASP Web Top 10 don't capture this. The risks here are agent-shaped: text the model treats as instructions, capabilities that combine into an exploit, and definitions that change after you approved them. A dedicated MCP taxonomy gives developers a common vocabulary so 'this server is risky' becomes a specific, checkable claim instead of a vibe.",
          "Treat the list as a checklist, not a ranking to memorize. The goal is coverage: before you connect a third-party MCP server to an agent — or ship your own — you want to have reasoned about each category at least once."
        ]
      },
      {
        "heading": "The threat categories at a glance",
        "body": [
          "The categories cluster into a few themes. Injection of instructions covers tool poisoning (hidden agent-directed instructions in a tool's name, description, parameter schema, defaults, examples or output schema) and tool-output prompt injection (the same kind of payload delivered at call time in what a tool returns, including content the server merely relayed from a web page or email).",
          "Secrets and unsafe execution covers hardcoded secrets — API keys, tokens or credentials baked into a tool schema or example where the agent (and anyone reading the tool list) can see them — and classic command, SQL or path injection, where a tool passes caller-controlled input into a shell, query or filesystem without sanitization.",
          "Dangerous capabilities covers destructive tools that act (delete, overwrite, transfer) without a confirmation step or a destructiveHint annotation, and the lethal trifecta: one server combining untrusted-content ingestion, sensitive-data access, and an exfiltration-or-destruction path, so a single prompt injection can turn into a real breach.",
          "Trust over time covers the rug-pull and silent tool drift — a server you already approved quietly changing its tool definitions afterward, because agents re-read the tools/list result each session rather than pinning a reviewed copy. Rounding out the list are protocol and compliance gaps: a stale protocol version, malformed JSON-RPC 2.0 errors, missing tool annotations, or weak OAuth/authorization discovery that make a server harder to trust and integrate safely."
        ]
      },
      {
        "heading": "How to stay safe as a developer",
        "body": [
          "If you are building an MCP server: keep secrets out of every schema, default, example and description — load them from the environment at call time instead. Sanitize and parameterize any input that reaches a shell, database or filesystem. Mark consequential tools with a destructiveHint annotation and require explicit confirmation before they act. And do not bundle a content-fetching tool, a secrets-or-data tool, and an outbound or destructive tool into the same server, which hands an agent all three legs of the lethal trifecta at once.",
          "If you are evaluating a server before connecting it: read the full tool list — not just names, but descriptions, parameter defaults, examples and output schemas, since poisoning hides in the places a UI never shows. Inventory which capability legs each server contributes, and remember the trifecta is additive across servers loaded into one agent, not just within a single server. Pin a reviewed tool set and re-check on every release, because a one-time audit only certifies the server as it was at probe time.",
          "Above all, design for capability separation rather than relying on the model to resist injection. No current model reliably distinguishes trusted instructions from injected ones, so the durable defenses are breaking at least one leg of the trifecta, gating destructive actions behind human confirmation, and re-auditing whenever the server can change underneath you."
        ]
      },
      {
        "heading": "Static surface vs. runtime behavior",
        "body": [
          "Some of these risks are visible in the published tool list and can be caught by reading it: tool poisoning shipped in metadata, secrets in schemas, a destructive tool with no confirmation, and a lethal-trifecta capability mix. This is static analysis — fast, safe, and side-effect-free, because it never calls anything.",
          "Other variants only appear when a tool actually runs: tool-output prompt injection, command or SQL injection that fires on a specific input, and exfiltration that only happens at call time. Catching those needs a behavioral test that invokes the server — and a responsible one exercises only read-only-safe tools with benign canary inputs, never mutating tools, so probing for a vulnerability cannot trigger the very damage it is looking for.",
          "Because rug-pulls and drift are changes, they are inherently temporal: you cannot see them in a single snapshot, only by comparing a current probe against a stored baseline. Full coverage of the OWASP MCP Top 10 therefore spans three modes — a static scan of the definitions, an optional behavioral probe of live responses, and continuous re-probing over time."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP operationalizes the OWASP MCP Top 10 inside Security, the top-weighted pillar of its MCP Score, worth 20 of 100 points. On every audit, the static analyzer scans each tool's name, description, parameter schema (names, descriptions, defaults, examples) and output schema and raises findings by category: a hardcoded secret value (MCP01), a destructive tool missing a confirmation or destructiveHint (MCP02), an injected instruction / tool poisoning (MCP03), an execution tool with an unconstrained free-string parameter that enables command or shell injection (MCP05), and the lethal trifecta — untrusted-content ingestion plus sensitive-data access plus an exfil-or-destruction path on one server (MCP06), among others. Categorical failures trip hard floors: a hardcoded secret in a tool schema, a critical injection, or a confirmed lethal trifecta caps the grade at D and flags the report SECURITY_RISK no matter how clean the rest is, while a failed MCP handshake caps the grade at F — so a serious security flaw cannot be bought back with polish elsewhere. CheckMCP's opt-in behavioral evals add the runtime layer: read-only-safe tools are exercised with benign canary inputs and the responses inspected for tool-response poisoning, exfiltration vectors, and leaked secrets — with a planted callback-canary URL that, if the server fetches it, confirms exfiltration outright — and it never invokes mutating tools. Drift monitoring re-probes tracked servers and re-runs the same OWASP pass against whatever the server now returns, catching rug-pulls and silent tool changes. You can run the pass with the open-source CLI (uvx audit-mcp <url>), the web app at checkmcp.dev, the GitHub Action (uses: H129hj/checkmcp@v1) to fail CI on a score regression or rug-pull, or the in-band Gateway that blocks tool-poisoning and drift before it reaches your agent in passive or active mode.",
    "faq": [
      {
        "q": "What is the OWASP MCP Top 10?",
        "a": "It is a threat taxonomy of the most common and highest-impact security risks specific to Model Context Protocol servers — including tool poisoning, hardcoded secrets in schemas, command and SQL injection, unsafe destructive tools, the lethal trifecta, rug-pulls / silent tool drift, and protocol-compliance gaps. It gives developers a shared checklist for what to verify before trusting an MCP server with an agent."
      },
      {
        "q": "How is the OWASP MCP Top 10 different from the OWASP Web Top 10?",
        "a": "The web list targets traditional app vulnerabilities (broken access control, injection into a server, and so on). The MCP list targets agent-shaped risks: text in tool metadata or outputs that the model reads as instructions, capabilities that combine across tools into an exploit (the lethal trifecta), and tool definitions that change after approval (rug-pulls). Some categories overlap — classic injection still applies — but the threat model is the AI agent, not just the server."
      },
      {
        "q": "What are the main categories in the MCP threat taxonomy?",
        "a": "They group into instruction injection (tool poisoning and tool-output prompt injection), secrets and unsafe execution (hardcoded credentials in schemas, command/SQL/path injection), dangerous capabilities (destructive tools without confirmation, and the lethal trifecta), trust over time (rug-pulls and silent tool drift), and protocol/compliance gaps (stale protocol version, malformed JSON-RPC 2.0 errors, missing annotations, weak OAuth discovery)."
      },
      {
        "q": "How do I check an MCP server against the OWASP MCP Top 10?",
        "a": "Combine three modes. Statically read the full tool list — descriptions, parameter defaults, examples and output schemas — for poisoning, secrets and risky capability mixes. Behaviorally probe live responses, exercising only read-only-safe tools with benign canary inputs, to catch runtime injection and exfiltration. And re-check over time against a baseline to catch rug-pulls. CheckMCP automates all three: a static OWASP pass on every audit, opt-in behavioral evals, and drift monitoring."
      },
      {
        "q": "Does CheckMCP test for the OWASP MCP Top 10?",
        "a": "Yes. The Security pillar (weighted 20 of 100 in the MCP Score) runs an OWASP MCP Top 10 pass on every audit, flagging categories such as hardcoded secrets (MCP01), unsafe destructive tools (MCP02), tool poisoning (MCP03), command injection (MCP05) and the lethal trifecta (MCP06). A hardcoded secret in a schema, a critical injection, or a confirmed trifecta caps the grade at D; a failed handshake caps it at F. Opt-in behavioral evals add a runtime layer and monitoring catches rug-pulls."
      },
      {
        "q": "Why isn't a one-time scan enough to cover the taxonomy?",
        "a": "Several categories only appear over time or at call time. Rug-pulls and silent tool drift are changes you can only see by comparing a new probe to a stored baseline, and tool-output injection or command injection may only fire on a specific runtime input. A single static snapshot certifies the server as it was at probe time, which is why full coverage needs behavioral probing plus continuous re-auditing."
      }
    ],
    "related": [
      "mcp-security",
      "tool-poisoning",
      "prompt-injection-via-tools",
      "lethal-trifecta",
      "mcp-rug-pull"
    ]
  },
  {
    "slug": "how-to-build-an-mcp-server",
    "term": "Building an MCP server",
    "title": "How to Build an MCP Server (Securely)",
    "metaDescription": "How to build an MCP server: pick a transport, define tools with clean JSON schemas, and ship securely — avoiding poisoning, leaked secrets and the lethal trifecta.",
    "answer": "To build an MCP server you implement the Model Context Protocol — an open JSON-RPC 2.0 standard introduced by Anthropic — so an AI host can perform a capability handshake and then discover and call your tools, resources and prompts. In practice you pick a transport (stdio for local, Streamable HTTP for remote), define each tool with a precise name, description and JSON Schema, and return well-formed results. Building it securely means keeping secrets out of schemas, gating destructive tools, treating tool output as untrusted, and avoiding the lethal trifecta — then re-auditing on every release.",
    "sections": [
      {
        "heading": "What you are actually implementing",
        "body": [
          "An MCP server is a process that speaks the Model Context Protocol — JSON-RPC 2.0 messages — to a host's MCP client. The host opens one MCP client per server, performs a capability handshake (exchanging protocol version and the features each side supports), then calls tools/list, resources/list and prompts/list to discover what you expose, and tools/call to invoke a tool. You do not have to implement this wire format by hand: official SDKs (Python, TypeScript and others) and higher-level frameworks like FastMCP handle the protocol, leaving you to declare tools and write their logic.",
          "The three primitives you can expose are tools (callable functions, each with a name, description and JSON Schema for inputs and, optionally, outputs), resources (readable data addressed by URI), and prompts (reusable, parameterized templates). Most servers are tool-centric. Every one of those declarations is read straight into the model's context, so the quality and safety of your names, descriptions and schemas is part of the product, not documentation."
        ]
      },
      {
        "heading": "Choosing a transport: local vs remote",
        "body": [
          "MCP defines a few transports. stdio runs your server as a local subprocess that the host launches and talks to over standard input/output — the simplest option for a desktop tool or a server distributed as a package, with no network surface. Streamable HTTP is the current remote transport for servers reachable over the network; the older HTTP+SSE pairing is its legacy predecessor and is still seen in the wild.",
          "Pick stdio when the server runs on the same machine as the host and needs no remote access — it sidesteps a whole class of network exposure. Pick Streamable HTTP when the server must be hosted and shared. Remote servers should sit behind proper authentication (commonly OAuth 2.1 or a Bearer token) and TLS, because anything reachable over the network is reachable by attackers too. Whichever you choose, the protocol surface the host sees is the same — only the connection differs."
        ]
      },
      {
        "heading": "Building with an SDK or FastMCP",
        "body": [
          "The fastest path is a maintained SDK. With the Python SDK's FastMCP API you declare a tool as an ordinary function with type hints and a docstring; the framework derives the JSON Schema from your signature, registers the tool, and serves it over stdio or HTTP in a couple of lines. The TypeScript SDK offers the same ergonomics. Using an SDK means you inherit a correct handshake, well-formed JSON-RPC 2.0 errors, and protocol-version negotiation for free — three things hand-rolled servers routinely get wrong.",
          "Spend your effort on the parts the framework cannot decide for you: write tool descriptions that are precise but lean (they cost tokens on every request), give each parameter a clear schema with sensible types and enums, set annotations like readOnlyHint on read-only tools and destructiveHint on tools that mutate or delete, and return structured, predictable output. Keep the tool count focused — consolidate overlapping actions rather than shipping dozens of near-duplicate tools — because sprawl bloats context and makes the model pick the wrong tool."
        ]
      },
      {
        "heading": "Writing a secure MCP server",
        "body": [
          "Treat your server as something an agent will trust twice: it reads your tool definitions as context and your tool outputs as data, and both channels can carry text a model may follow as instructions. Never hardcode secrets, API keys, tokens or credentials into a tool's description, default values or examples — they get shipped to the client verbatim and are one of the fastest ways to fail a security audit. Load secrets from the environment or a secrets manager at runtime instead.",
          "Gate anything consequential. Tools that delete, send, post, pay or overwrite should be clearly marked (destructiveHint) and ideally require explicit confirmation rather than firing on a single model decision. Be deliberate about the lethal trifecta: if one server can ingest untrusted external content (fetch, scrape, web-search), reach sensitive data (files, mailboxes, databases, secrets), and send data out or take destructive action, a single injected instruction can become a real breach. Break at least one leg — separate untrusted-content tools from secrets-bearing tools, or remove the unguarded outbound path.",
          "Finally, assume tool output is untrusted. If a tool relays a web page, an email or a comment an attacker wrote, that text can carry agent-directed instructions (tool-response poisoning) even when your code is clean. Validate and constrain inputs, avoid blindly fetching caller-supplied URLs (an SSRF and exfiltration vector), and re-audit your server on every release so a refactor doesn't quietly introduce one of these issues."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP is the verification step for a server you have just built. Point it at your live endpoint (uvx audit-mcp <url>, the web app at checkmcp.dev, or the GitHub Action uses: H129hj/checkmcp@v1 in CI) and it produces an explainable, vendor-neutral MCP Score /100 (grade A–F) across seven pillars — security (20), tool design (18), schemas and descriptions (16), reliability (14), context-cost (12), compliance (12) and coverage (8) — telling you exactly where your server loses points and why. The security pillar runs an OWASP MCP Top 10 pass against the same mistakes this page warns about: a hardcoded secret found in a tool schema caps your grade at D, a critical injected instruction (tool poisoning) in a description or schema does too, and a failed MCP handshake caps it at F. Opt-in behavioral evals exercise only your read-only tools with benign canary inputs to catch tool-response poisoning and data exfiltration before they reach an agent, never invoking mutating tools. Wire the GitHub Action into CI to fail the build on a score regression or rug-pull, and run the in-band Gateway (passive observe-and-log or active block-and-strip) to stop tool-poisoning and drift at runtime, with drift monitoring on tracked servers. If your server is distributed as a repo or stdio package, CheckMCP also grades the project on four pillars — maintenance (40), license (25), adoption (20) and documentation (15) — so you ship something both safe and credible.",
    "faq": [
      {
        "q": "How do I build an MCP server?",
        "a": "Implement the Model Context Protocol (JSON-RPC 2.0) with an official SDK or a framework like FastMCP, choose a transport (stdio for local, Streamable HTTP for remote), and declare each tool with a clear name, description and JSON Schema. The SDK handles the capability handshake and discovery; you write the tool logic and keep the schemas precise, lean and free of secrets."
      },
      {
        "q": "How do I build an MCP server with FastMCP?",
        "a": "FastMCP (the high-level API in the official Python SDK) lets you declare a tool as a plain function with type hints and a docstring — it derives the JSON Schema from your signature, registers the tool, and serves it over stdio or HTTP in a few lines. You inherit a correct handshake, well-formed JSON-RPC 2.0 errors and protocol-version negotiation, and focus your effort on tight descriptions, clean schemas, and annotations like readOnlyHint and destructiveHint."
      },
      {
        "q": "What makes an MCP server secure?",
        "a": "No secrets in tool descriptions, defaults or examples; destructive tools marked with destructiveHint and gated behind confirmation; tool output treated as untrusted (it can carry injected instructions); caller-supplied URLs not blindly fetched (SSRF and exfiltration risk); and no single server combining untrusted-content ingestion, sensitive-data access and an outbound or destructive path — the lethal trifecta. Re-audit on every release. CheckMCP scores each of these and tells you what to fix."
      },
      {
        "q": "Should my MCP server use stdio or HTTP?",
        "a": "Use stdio when the server runs locally on the same machine as the host — the host launches it as a subprocess and there is no network surface. Use Streamable HTTP (the current remote transport; HTTP+SSE is its legacy predecessor) when the server must be hosted and shared, and put it behind authentication such as OAuth 2.1 or a Bearer token plus TLS."
      },
      {
        "q": "How do I write tool descriptions and schemas for an MCP server?",
        "a": "Tool definitions are read into the model's context on every request, so make them precise but lean. Give each tool a clear name, a one-to-two-sentence description of what it does, and a JSON Schema with correct types, enums and required fields. Consolidate overlapping tools instead of shipping dozens of near-duplicates, and avoid deep nesting, long enums and redundant examples that inflate context cost."
      },
      {
        "q": "How do I test that my MCP server is built correctly and safely?",
        "a": "Audit the running server. CheckMCP probes your live endpoint and returns an explainable MCP Score /100 across seven pillars, runs an OWASP MCP Top 10 security pass (with hard caps for hardcoded secrets, critical injection and a failed handshake), and can run opt-in behavioral evals against read-only tools to catch tool-response poisoning and exfiltration. Run uvx audit-mcp <url>, use checkmcp.dev, or add the GitHub Action to fail CI on a security or score regression."
      }
    ],
    "related": [
      "what-is-an-mcp-server",
      "mcp-security",
      "local-vs-remote-mcp-servers",
      "mcp-security-best-practices",
      "how-to-audit-an-mcp-server"
    ]
  },
  {
    "slug": "mcp-security-best-practices",
    "term": "MCP security best practices",
    "title": "MCP Security Best Practices: A Developer Checklist",
    "metaDescription": "MCP security best practices: least privilege, keep secrets out of schemas, gate destructive tools, break the lethal trifecta, and re-audit on every release.",
    "answer": "MCP security best practices are the defensive habits that keep an AI agent safe when it connects to Model Context Protocol servers: apply least privilege to every tool, keep secrets out of tool schemas and outputs, require explicit confirmation for destructive actions, separate untrusted-content tools from sensitive-data and outbound tools (break the lethal trifecta), validate and constrain inputs, and re-audit on every release because tool definitions can silently change. Because a server's tool descriptions and outputs flow straight into the model's context, an untrusted server is an attack surface, so the goal is to limit what any one tool, or any combination of tools, can do.",
    "sections": [
      {
        "heading": "Principle of least privilege for MCP tools",
        "body": [
          "Least privilege is the single most important MCP practice: each tool should expose the smallest capability that does its job, and the agent should load only the tools it actually needs. A tool named read_invoice should be able to read one invoice, not query the whole database, not write, not reach the network. Over-broad tools turn a single prompt injection into a large blast radius, so scope is your primary containment boundary.",
          "Prefer many narrow, read-only tools over a few god-tools. Mark read-only tools with readOnlyHint and destructive tools with destructiveHint so clients can treat them correctly. Scope credentials per tool rather than handing one all-powerful token to the whole server, and bind each tool to the minimum data, table, path, or API scope it requires.",
          "On the host and client side, least privilege means not auto-loading every server you have configured into every session. Remember the model is the protocol's three roles in motion: a host runs one MCP client per server, performs a capability handshake, then discovers and calls that server's tools, resources, and prompts. The unit of risk is the agent's full active toolset, so enabling fewer servers per task shrinks both the attack surface and the context cost."
        ]
      },
      {
        "heading": "Keep secrets out of schemas, descriptions, and outputs",
        "body": [
          "Anything in a tool's name, description, default value, example, or output schema is read into the model's context and may be logged, echoed, or surfaced to the user. A hardcoded API key, token, or private key in any of those places is effectively published. Never put a real secret value in a schema example or default; use placeholders, and inject real credentials at runtime from environment variables or a secret manager.",
          "The same applies to tool outputs at call time. A tool that returns raw secrets, full credential blobs, or unmasked PII hands that data straight to the model, and to anyone who can read the transcript. Mask or omit sensitive fields in responses, and treat the boundary between your backend and the agent as an untrusted egress point.",
          "This is a categorical failure, not a style nit: a leaked credential in a tool schema is one of the highest-severity findings an audit can surface, and it caps an otherwise-clean server's grade."
        ]
      },
      {
        "heading": "Gate destructive actions and break the lethal trifecta",
        "body": [
          "Destructive or consequential tools, such as delete, drop, send, transfer, deploy, or pay, should never fire silently on model output alone. Require an explicit confirmation parameter, a dry-run mode, or human-in-the-loop approval, and advertise destructiveHint so clients know to ask. The model can be wrong or steered; a confirmation gate is what stops a hijacked agent from doing irreversible damage.",
          "The deepest structural risk is the lethal trifecta: one agent, or one server, that simultaneously can ingest untrusted content, reach sensitive data, and send data out or destroy. Any single leg is usually safe; all three together let an injected instruction in untrusted content read your secrets and ship them out. Mitigate by breaking at least one leg: isolate content-fetching tools from secret-bearing tools, gate the outbound path, and avoid loading a web-fetching server alongside a credentials server in the same agent.",
          "Because no current model fully resists prompt injection, defense relies on capability separation, not on the agent being careful. Inventory which server contributes which leg before you deploy."
        ]
      },
      {
        "heading": "Validate inputs, harden the transport, and constrain egress",
        "body": [
          "Treat every tool argument as hostile input. Validate against a strict JSON Schema, reject unexpected fields, and avoid passing model-supplied strings into shells, SQL, file paths, or HTTP requests without sanitization; command injection and SSRF are real MCP failure modes when a tool builds a system call or fetches a caller-supplied URL. Allowlist destinations for any tool that makes outbound requests so it cannot be pointed at internal metadata endpoints or arbitrary hosts.",
          "For remote servers reached over Streamable HTTP, secure the transport: serve over HTTPS, put the server behind OAuth 2.1 or a bearer secret, expose the standard OAuth discovery metadata so clients can authenticate correctly, and scope tokens narrowly. For local stdio servers, remember the server runs with the user's privileges on their machine, so limit filesystem and network reach accordingly.",
          "Conform to the protocol: MCP is JSON-RPC 2.0, so return spec-compliant JSON-RPC errors, keep your declared capabilities honest in the handshake (do not advertise resources or prompts you do not serve), and stay close to the current protocol version so clients are not forced into weaker behavior."
        ]
      },
      {
        "heading": "Re-audit on every release and watch for drift",
        "body": [
          "A one-time review certifies a server only as it was at that moment. MCP clients fetch tool definitions live on each session and trust whatever the server returns, with no lockfile by default, so a server can silently rename a tool, rewrite a description, widen a destructive capability, or inject an instruction after you approved it. That silent change is tool drift; weaponized, it is a rug pull.",
          "Defend with continuous re-probing rather than a single pass: capture a known-good baseline of the normalized tool set, then on each run diff the current surface against it and re-run your security checks against whatever the server now returns. Pin a reviewed tool set and alert on regression, and wire an audit into CI so a score drop or a new high-severity finding fails the build before it ships.",
          "Apply the same discipline to third-party servers you depend on. Even individually safe servers can combine into a trifecta inside one agent, and any of them can change underneath you between releases."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP turns this checklist into a measurable, vendor-neutral MCP Score (0-100, grade A-F) for any MCP server. For live endpoints it scores seven pillars, with security the top-weighted at 20 of 100 (then tool design 18, schemas and descriptions 16, reliability 14, context and token cost 12, compliance 12, and coverage or use-case 8); for repo and stdio servers it scores four pillars instead (maintenance 40, license 25, adoption 20, documentation 15). On every audit the security pass runs against the OWASP MCP Top 10, mapping directly to these practices: it flags hardcoded secrets in schemas or examples, destructive tools missing a confirmation gate, injected instructions hidden in descriptions or outputs (tool poisoning), command injection, and the lethal-trifecta capability combination. Categorical failures are enforced as hard floors: a secret found in a tool schema caps the grade at D, and a failed MCP handshake caps it at F, so a server cannot buy back a serious security failure with polish elsewhere. Beyond the static scan, behavioral evals exercise read-only tools with canary inputs to catch prompt-injection and data-exfiltration in tool responses, never invoking mutating tools. To operationalize least privilege and drift defense you run it via the open-source, MIT-licensed, stdlib-only CLI (uvx audit-mcp <url>), the web app at checkmcp.dev, or the GitHub Action (uses: H129hj/checkmcp@v1) to fail a build on a score regression or a rug-pull; drift monitoring re-probes tracked servers against a baseline, and the in-band Gateway (passive and active modes) can block tool-poisoning and drift before it reaches your agent.",
    "faq": [
      {
        "q": "What are the most important MCP security best practices?",
        "a": "Apply least privilege to every tool (smallest capability, scoped credentials, read-only by default), keep secrets out of tool schemas, descriptions, examples and outputs, require explicit confirmation for destructive actions, break the lethal trifecta by separating untrusted-content tools from sensitive-data and outbound tools, validate and constrain all inputs (no unsanitized shell, SQL or URL use), secure remote transports with HTTPS and OAuth 2.1, and re-audit on every release because tool definitions can change silently."
      },
      {
        "q": "What is the principle of least privilege for MCP tools?",
        "a": "It means each MCP tool should expose only the minimum capability needed for its job, and the agent should load only the tools a task actually requires. A read tool should not be able to write or reach the network; credentials should be scoped per tool rather than one all-powerful token; and destructive tools should be separated and gated. Narrow, least-privilege tools contain the blast radius if the agent is ever hijacked by a prompt injection."
      },
      {
        "q": "How do I secure an MCP server I'm building?",
        "a": "Keep real secrets out of schemas, defaults, examples and outputs (inject them at runtime); mark read-only tools with readOnlyHint and require a confirmation parameter plus destructiveHint on destructive ones; validate every argument against a strict JSON Schema and never pass model-supplied input into a shell, query, file path or URL unsanitized; allowlist outbound destinations; for remote servers serve over HTTPS behind OAuth 2.1 with narrowly scoped tokens; return spec-compliant JSON-RPC 2.0 errors and keep your declared capabilities honest in the handshake; and avoid bundling untrusted-content, sensitive-data and exfiltration capabilities in one server."
      },
      {
        "q": "What are MCP security best practices for the agent, host, and client side?",
        "a": "Load only the servers and tools a given task needs rather than auto-enabling everything, since the active toolset is the real attack surface and the context-cost driver. Each MCP server gets its own client and capability handshake in the host, so avoid combining a content-fetching server with a secrets-bearing server in the same agent (that assembles a lethal trifecta across servers), pin a reviewed tool set, require human approval before consequential actions, and re-audit third-party servers on every release to catch silent drift or a rug pull."
      },
      {
        "q": "How does least privilege help against prompt injection in MCP?",
        "a": "Current models cannot reliably tell trusted instructions from injected ones, so you cannot rely on the agent ignoring a malicious instruction. Least privilege limits what a hijacked agent can actually do: if the tools it holds cannot reach secrets or send data out, an injection has no payoff. That is why capability separation, breaking the lethal trifecta and scoping each tool tightly, is the practical defense rather than trying to make the model perfectly injection-proof."
      },
      {
        "q": "How often should I audit an MCP server for security?",
        "a": "On every release, and ideally continuously. A single audit only certifies the server as it was at that moment, but MCP clients fetch tool definitions live each session and trust whatever is returned, so a server can change its tools after approval (drift) or turn malicious (a rug pull). Capture a baseline, diff the tool surface on each probe, re-run the security checks against the new definitions, and wire an audit into CI so a score regression or new high-severity finding fails the build. Tools like CheckMCP automate this with drift monitoring and a GitHub Action."
      }
    ],
    "related": [
      "mcp-security",
      "tool-poisoning",
      "lethal-trifecta",
      "mcp-rug-pull",
      "how-to-audit-an-mcp-server",
      "owasp-mcp-top-10"
    ]
  },
  {
    "slug": "local-vs-remote-mcp-servers",
    "term": "Local vs remote MCP servers",
    "title": "Local vs Remote MCP Servers (stdio vs Streamable HTTP)",
    "metaDescription": "A local MCP server runs as a stdio subprocess on your machine; a remote MCP server runs over Streamable HTTP (or legacy HTTP+SSE). Transports, trust, and audit.",
    "answer": "A local MCP server runs on your own machine as a child process the host launches and talks to over stdio (stdin/stdout); a remote MCP server runs somewhere else and is reached over the network using the Streamable HTTP transport (or the older HTTP+SSE pairing), usually behind OAuth 2.1. The protocol — JSON-RPC 2.0, the same capability handshake, the same tools/resources/prompts — is identical either way; only the transport, the deployment, and the trust boundary differ. Local servers expose your filesystem and credentials to whatever code you ran; remote servers move the code off your machine but hand your data to a third party over the wire.",
    "sections": [
      {
        "heading": "Transport is the real difference (stdio vs Streamable HTTP)",
        "body": [
          "MCP is an open JSON-RPC 2.0 protocol introduced by Anthropic: a host runs one MCP client per server, performs a capability handshake, then discovers and calls that server's tools, resources and prompts. What changes between local and remote is the transport — the channel those JSON-RPC messages travel over — not the message format or the primitives.",
          "Local servers use the stdio transport. The host spawns the server as a subprocess and exchanges JSON-RPC messages over the process's stdin and stdout. There is no port, no URL, and no network hop; the server lives and dies with the host that launched it. This is the default for desktop integrations (for example a server configured in Claude Desktop's config that runs via npx or uvx).",
          "Remote servers use an HTTP-based transport. The current standard is Streamable HTTP: a single HTTP endpoint the client POSTs JSON-RPC requests to, with the server able to stream responses and server-initiated messages back (using Server-Sent Events as the streaming mechanism when needed). The older two-endpoint HTTP+SSE transport — a separate SSE channel for server→client messages plus a POST endpoint for client→server — is now legacy but still seen in the wild. A remote server is addressed by URL and is typically protected by OAuth 2.1 or a bearer token."
        ]
      },
      {
        "heading": "Local MCP servers: how they run and what they expose",
        "body": [
          "A local server is just a program on your machine that speaks MCP over stdio. The host passes it a command and arguments (and often environment variables holding API keys), launches it, and pipes JSON-RPC through it. Because it executes with your user's privileges, it can read your files, reach localhost services, and use any credential you handed it — which is exactly the appeal (filesystem access, local databases, dev tooling) and exactly the risk.",
          "The trust boundary for a local server is your own machine. Latency is negligible and your data never leaves the device, but you are running third-party code locally: a poisoned npm/PyPI package, a tool description carrying hidden instructions, or a server that quietly exfiltrates over an outbound call is operating with full local context. \"Local\" means private transport, not safe code.",
          "Local servers are also harder to audit at scale precisely because they aren't network-reachable — there is no URL to point a scanner at. They are evaluated as a repository or package (source, maintenance, license, adoption, documentation) rather than by probing a live endpoint."
        ]
      },
      {
        "heading": "Remote MCP servers: how they run and what they expose",
        "body": [
          "A remote server runs on infrastructure you don't control and is reached over HTTPS at a URL. The host's MCP client opens the Streamable HTTP (or legacy HTTP+SSE) transport, authenticates — commonly via OAuth 2.1, sometimes a static bearer token — and then runs the identical capability handshake and tool/resource/prompt discovery. Updates ship server-side, so you don't install or update anything locally.",
          "The trade-off inverts the local one. Your machine's filesystem and local secrets stay out of reach, but every request and every piece of data you pass to a tool crosses the network to a third party, and the operator can change the server's behavior at any time. Because the client re-fetches tool definitions per session rather than pinning a reviewed copy, a remote server can silently alter its tools after you approved it — the rug-pull problem.",
          "Remote is the model for hosted, multi-tenant MCP services and for sharing one server across a team. It also makes auditing tractable: a live URL can be probed directly, its handshake validated, its real tools, resources and prompts inspected, and its responses exercised — which is why live-endpoint scoring assumes a remote (HTTP) transport."
        ]
      },
      {
        "heading": "Which to choose, and the security implications of each",
        "body": [
          "Pick local (stdio) when the server needs your filesystem, a local database, or developer tooling, when latency must be near-zero, and when you want your data to stay on the device. Pick remote (Streamable HTTP) when a server should be centrally hosted and updated, shared across a team or product, or kept off end-user machines — accepting that data now transits to a third party and that authentication and transport security matter.",
          "The security questions differ by transport but the core risks do not. Both can carry tool poisoning (hidden instructions in tool metadata or outputs), both can leak hardcoded secrets, both can assemble the lethal trifecta (untrusted-content ingestion + sensitive-data access + an exfiltration or destruction path). Local adds the risk of arbitrary code running with your privileges; remote adds network exposure, an authentication surface (OAuth/token handling), and behavior you can't see source for and that can change underneath you.",
          "A practical rule: treat every MCP server — local or remote, first- or third-party — as untrusted until audited, and re-check it over time. The transport tells you where the boundary is; it does not tell you whether the server is safe."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP computes a vendor-neutral MCP Score (0-100, grade A-F) and matches the method to how each server is reachable. For a remote server it probes the live endpoint directly — Streamable HTTP or legacy HTTP+SSE, optionally behind Bearer/OAuth — validates the JSON-RPC capability handshake, inspects the real tools, resources and prompts, and scores seven pillars: security (20), tool design (18), schemas/descriptions (16), reliability (14), context-cost/token (12), compliance (12), and coverage/use-case (8). The security pillar runs an OWASP MCP Top 10 pass (tool poisoning, hardcoded secrets, command injection, the lethal trifecta, and more), with hard caps that floor the grade at D if a secret is found in a tool schema and at F if the handshake fails. Opt-in behavioral evals exercise read-only tools with canary inputs to catch prompt-injection and data-exfiltration in tool responses. A local (stdio) server usually has no URL to probe, so CheckMCP scores it as a repository/package across four pillars: maintenance (40), license (25), adoption (20), documentation (15). You run it with uvx audit-mcp <url> (open-source, MIT, stdlib-only), use the web app at checkmcp.dev, or wire the GitHub Action (uses: H129hj/checkmcp@v1) into CI to fail a build on a score regression or rug-pull. For remote servers, an in-band Gateway sits in front and blocks tool-poisoning and drift before they reach your agent (passive and active modes), with drift monitoring over time.",
    "faq": [
      {
        "q": "What is the difference between local and remote MCP servers?",
        "a": "A local MCP server runs on your machine as a subprocess the host launches and communicates with over stdio (stdin/stdout) — no network, no URL, full local privileges. A remote MCP server runs elsewhere and is reached over the network via the Streamable HTTP transport (or legacy HTTP+SSE), usually behind OAuth 2.1. The JSON-RPC protocol, capability handshake and primitives (tools, resources, prompts) are identical; the transport, deployment and trust boundary differ."
      },
      {
        "q": "What are the MCP transports: stdio, SSE, and Streamable HTTP?",
        "a": "stdio is the local transport — JSON-RPC over a subprocess's stdin/stdout. Streamable HTTP is the current remote transport: one HTTP endpoint clients POST to, with the server streaming responses back (using SSE as the streaming mechanism when needed). HTTP+SSE is the older, now-legacy remote transport that used a separate SSE channel for server→client messages plus a POST endpoint for client→server. Streamable HTTP supersedes it, but both still appear in practice."
      },
      {
        "q": "Are remote MCP servers less secure than local ones?",
        "a": "Neither is automatically safe — they trade different risks. Local servers run third-party code with your filesystem and credentials, so a malicious package or poisoned tool acts with full local context. Remote servers keep your machine out of reach but send your data over the network to an operator who can change the server's behavior after you approved it (a rug pull). Tool poisoning, leaked secrets and the lethal trifecta apply to both. Audit either before trusting it."
      },
      {
        "q": "What transport do remote MCP servers use?",
        "a": "Modern remote MCP servers use the Streamable HTTP transport — a single HTTP endpoint clients POST JSON-RPC to, with streamed responses over SSE when the server needs to push data or messages. Older deployments use the legacy HTTP+SSE transport (a dedicated SSE endpoint plus a separate POST endpoint). Remote servers are addressed by URL and are typically authenticated with OAuth 2.1 or a bearer token."
      },
      {
        "q": "Can CheckMCP audit a local (stdio) MCP server?",
        "a": "A local stdio server usually has no network endpoint to probe, so CheckMCP scores it as a repository or package across four pillars — maintenance, license, adoption and documentation — rather than the live seven-pillar MCP Score it computes for a reachable HTTP endpoint. Remote servers (Streamable HTTP or legacy HTTP+SSE, optionally behind OAuth/Bearer) are probed live: the capability handshake, tools, resources and prompts, the OWASP MCP Top 10 pass, and opt-in behavioral evals."
      },
      {
        "q": "Should I run an MCP server locally or remotely?",
        "a": "Run it locally (stdio) when it needs your filesystem, a local database or dev tooling, when latency must be near-zero, and when data should stay on the device. Run it remotely (Streamable HTTP) when it should be centrally hosted and updated, shared across a team or product, or kept off end-user machines — accepting that data now transits to a third party and that authentication and transport security become part of the threat model."
      }
    ],
    "related": [
      "mcp-client-server-host",
      "mcp-tools-resources-prompts",
      "what-is-an-mcp-server",
      "mcp-security",
      "mcp-rug-pull",
      "what-is-an-mcp-gateway"
    ]
  },
  {
    "slug": "mcp-client-server-host",
    "term": "MCP client, server & host",
    "title": "MCP Client vs Server vs Host: The Architecture",
    "metaDescription": "MCP host, client and server explained: the host runs one MCP client per server, handshakes, then discovers its tools, resources and prompts.",
    "answer": "In the Model Context Protocol, the host is the AI application (Claude Desktop, an IDE assistant, your own agent) that the user interacts with; it spawns one MCP client per connection; and each client talks to exactly one MCP server, the service that exposes tools, resources and prompts. The host owns the model and the trust boundary, the client is the protocol connector that performs the JSON-RPC 2.0 capability handshake, and the server is the capability provider — usually the only one of the three you do not control.",
    "checkmcpRelation": "The host-client-server split is exactly where CheckMCP plugs in: the server is the component you usually do not control, so CheckMCP audits it from the outside the way a client would. It performs the same MCP capability handshake a real client does, then discovers and inspects the server's tools, resources and prompts, and produces an explainable MCP Score /100 (grade A-F) — seven pillars for a live endpoint (security 20, tool design 18, schemas/descriptions 16, reliability 14, context-cost 12, compliance 12, coverage 8) or four for a repo/stdio server (maintenance 40, license 25, adoption 20, documentation 15). The security pillar runs an OWASP MCP Top 10 pass (tool poisoning, hardcoded secrets, command injection, the lethal trifecta) with hard floors — a secret found in a tool schema caps the grade at D, a failed handshake caps it at F — and the opt-in behavioral evals exercise read-only tools with canary inputs to catch prompt-injection or data-exfiltration in tool responses. You run it as `uvx audit-mcp <url>` (open-source, MIT, stdlib-only), at checkmcp.dev, or in CI via the `uses: H129hj/checkmcp@v1` GitHub Action to fail a build on a score regression or rug-pull. For runtime protection, the in-band Gateway sits between your host and the server (the position a client occupies) and, in passive and active modes, blocks tool-poisoning and drift before it reaches your agent, with continuous drift monitoring on tracked servers.",
    "sections": [
      {
        "heading": "The three roles, precisely",
        "body": [
          "The Model Context Protocol (an open JSON-RPC 2.0 protocol introduced by Anthropic) defines three roles. The host is the AI application the user actually runs — Claude Desktop, an IDE coding assistant, a chat client, or an agent you built. It owns the language model, the conversation, the user's consent, and the security boundary; nothing reaches the model except through the host.",
          "The client is the connector the host instantiates to speak MCP. It is not a separate program you install — it is a component inside the host. Each client maintains a single stateful 1:1 session with one server: it sends the initialize handshake, negotiates capabilities, and then relays tools/list, tools/call, resources/read and prompts/get requests.",
          "The server is the capability provider. It exposes tools (callable functions with JSON-Schema inputs), resources (readable data addressed by URI) and prompts (reusable templates). A server can run as a local subprocess or a remote HTTP service, and it is typically the only one of the three roles written by a third party."
        ]
      },
      {
        "heading": "How a connection is established",
        "body": [
          "When a host decides to use a server, it creates one MCP client for it and opens a transport. The client sends an `initialize` request carrying its supported protocol version and capabilities; the server replies with its own version and the capabilities it offers (tools, resources, prompts, and optional features like logging). This capability handshake is what lets the two sides agree on what is supported before any real work happens.",
          "After the handshake, the client calls `tools/list` to discover the server's tools, plus `resources/list` and `prompts/list` where offered. The host feeds those tool names, descriptions and schemas into the model's context so the model knows what it can call. When the model chooses a tool, the host asks the client to issue `tools/call`, and the server's response flows back into context.",
          "A host commonly runs many clients at once — one per server — so an agent can compose first-party and third-party servers in a single session. Crucially, the model never opens a socket itself: every external capability is mediated by a client the host controls, which is the natural place to enforce policy."
        ]
      },
      {
        "heading": "Why the boundary matters for trust",
        "body": [
          "The host is the trust boundary, and the server sits on the other side of it. A server's tool descriptions are read into the model's context, and its tool outputs are read back as data — both are text the model may treat as instructions. So an untrusted server is an attack surface even though the user only ever interacts with the host.",
          "This is what makes the host-client-server distinction more than terminology. Tool poisoning (hidden instructions in tool metadata), prompt injection delivered through tool output, leaked secrets in schemas, and the lethal trifecta all arrive across the client-server link, not from the user. The host is responsible for not blindly trusting whatever a server returns.",
          "The practical takeaway for developers: you control the host and the client, but you usually inherit the server. Audit a server before wiring it in, and re-check it over time, because a server can silently change the tools it advertises (a rug pull) after you have already approved it."
        ]
      },
      {
        "heading": "Local vs remote servers and transports",
        "body": [
          "Where the server runs determines the transport the client uses. The `stdio` transport runs the server as a local subprocess and exchanges JSON-RPC over stdin/stdout — common for desktop tools and anything that touches your filesystem or local credentials. The client launches the process and owns its lifecycle.",
          "Remote servers are reached over HTTP. The current transport is Streamable HTTP; the older HTTP+SSE pairing is the legacy variant. Remote servers may sit behind OAuth 2.1 or a bearer token, and the client handles that authorization on the host's behalf.",
          "The role split is identical regardless of transport: the host runs a client, the client handshakes and discovers, the server exposes capabilities. What changes with a remote server is the threat model — network exposure, third-party operators, and the possibility that the tool list you see today is not the one you saw yesterday."
        ]
      }
    ],
    "faq": [
      {
        "q": "What is the difference between an MCP client, server and host?",
        "a": "The host is the AI application the user runs (Claude Desktop, an IDE assistant, your agent); it owns the model and the trust boundary. The client is a connector inside the host that maintains one MCP session per server. The server is the external service that exposes tools, resources and prompts. One host can run many clients, but each client talks to exactly one server."
      },
      {
        "q": "Is an MCP client the same as an MCP host?",
        "a": "No. The host is the whole application, including the model and the user interface. The client is a component the host creates to speak the protocol — one client per server connection. Informally people say 'the client' to mean the host, but in the spec they are distinct: the host runs one or more clients."
      },
      {
        "q": "Is an MCP server a client or a server in the client-server sense?",
        "a": "It is the server in the classic sense: it waits for requests and responds. The MCP client (inside the host) initiates the connection, sends the handshake, and issues tools/list and tools/call. So the data flow is host to client to server, and the server answers."
      },
      {
        "q": "How does the host connect to an MCP server?",
        "a": "The host spins up one MCP client, opens a transport (local stdio, or remote Streamable HTTP / legacy HTTP+SSE, optionally behind OAuth 2.1), and the client sends an initialize request. The server replies with its protocol version and capabilities — the capability handshake — after which the client discovers and calls the server's tools, resources and prompts."
      },
      {
        "q": "Why does the client run one connection per server?",
        "a": "MCP sessions are stateful 1:1: each client negotiates capabilities and tracks the session with a single server, which keeps trust, lifecycle and protocol-version negotiation clean. To use several servers, the host simply creates several clients — one per server — and composes their tools in the model's context."
      },
      {
        "q": "Which part of the architecture do I need to secure?",
        "a": "The server is the component you usually do not control, and it reaches the model through the client-server link via tool descriptions and tool outputs. Audit any third-party server before wiring it in — CheckMCP performs the same handshake a client does, inspects the tools, and scores the server against the OWASP MCP Top 10, then re-checks for drift over time."
      }
    ],
    "related": [
      "what-is-an-mcp-server",
      "model-context-protocol",
      "mcp-tools-resources-prompts",
      "local-vs-remote-mcp-servers",
      "what-is-an-mcp-gateway",
      "how-to-add-mcp-server-to-claude-desktop"
    ]
  },
  {
    "slug": "what-is-an-mcp-gateway",
    "term": "MCP gateway",
    "title": "What Is an MCP Gateway (and Why You Need One)",
    "metaDescription": "An MCP gateway is a proxy between your agent and its MCP servers that inspects every tool call and response to block poisoning, exfiltration and drift.",
    "answer": "An MCP gateway is a security proxy that sits in-band between your AI agent and the MCP servers it uses: the agent connects to the gateway instead of the raw server, and the gateway forwards every JSON-RPC message — the initialize handshake, tools/list and each tools/call — while inspecting both the request and the response. Because tool descriptions and outputs flow straight into the model's context, the gateway is the one place you can catch tool poisoning, prompt injection, data exfiltration and silent tool drift at the moment they happen — and, in active mode, strip or block the danger before it ever reaches the agent. You need one because a per-server audit certifies a server only as it was at probe time, whereas a gateway enforces safety on live, real-time traffic.",
    "sections": [
      {
        "heading": "What an MCP gateway is",
        "body": [
          "The Model Context Protocol (MCP) is an open JSON-RPC 2.0 protocol that lets an AI host connect to external servers. The host runs one MCP client per server, performs a capability handshake, then discovers and calls that server's tools, resources and prompts over a transport — stdio for local servers, Streamable HTTP for remote ones (with legacy HTTP+SSE still seen in the wild).",
          "An MCP gateway is a proxy that speaks MCP on both sides: it is an MCP server to your agent and an MCP client to one or more real backend servers. Your agent's config points at the gateway URL (with a bearer token) instead of the raw backend, so every JSON-RPC message — the initialize handshake, tools/list, and each tools/call — passes through it.",
          "On the way through, the gateway proxies the call to the real backend and inspects what comes back. Tool definitions and tool outputs are exactly the text an MCP client feeds into the model's context, so the gateway sits on the one chokepoint where untrusted server content becomes agent instructions. That position lets it observe, log, redact, or block per call.",
          "A gateway is in-band (it is on the live request path), which distinguishes it from an out-of-band audit that probes a server once and walks away. The trade-off is that an in-band proxy adds a small amount of latency to every tool call — which is why a good MCP gateway keeps its checks cheap (regex patterns, hash comparisons) rather than slow."
        ]
      },
      {
        "heading": "Why you need one: the audit-vs-runtime gap",
        "body": [
          "A one-time audit answers \"is this server safe right now?\" — useful, but it certifies the server only at probe time. Two things break that guarantee in production. First, tool-output prompt injection: a server can pass a clean static audit of its schemas and still return attacker-authored text on a specific query (a fetch/search/read-page tool relaying a poisoned web page, email, or issue comment). Second, the rug pull: MCP clients re-read tools/list every session and trust whatever the server returns, so a server you approved can silently rewrite a description, add a hidden instruction, or widen a tool after the fact — with no further human approval.",
          "Neither of these is visible from a single snapshot. They only appear in live traffic, which is precisely what a gateway sees. The gateway re-checks the tool surface against a pinned baseline on every session (catching drift and rug pulls in-session) and scans each tool response for injection, exfiltration and leaked secrets (catching the runtime payloads a static scan cannot).",
          "This is also where the lethal trifecta becomes concrete. A static check flags a server whose tools combine untrusted-content ingestion, sensitive-data access, and an outbound or destructive path. A gateway can do more than flag it: it withholds the specific poisoned response that would have turned that capability mix into an actual breach."
        ]
      },
      {
        "heading": "What a gateway inspects and enforces",
        "body": [
          "On tools/list, the gateway fingerprints the returned tool set (the sorted tool names plus a hash of each schema) and compares it to a pinned baseline. A breaking change — a tool removed, renamed, or mutated without a version bump — is flagged as drift or a rug pull. It can also apply an allowlist so the agent only ever sees approved servers and tools.",
          "On each tools/call response, it runs the same output analysis a behavioral eval uses: multilingual injection patterns (\"ignore previous instructions\", hidden \"do not tell the user\" directives), exfiltration vectors (output pushing the agent to send data to an external destination), and credential- or PII-shaped strings in the returned data. A high-severity hit is recorded and, in active mode, the poisoned output is withheld and replaced with a safety notice so the agent never reads it.",
          "A gateway typically runs in one of two postures. Passive mode proxies everything unchanged and only observes, logs and flags — you run this first to see what your servers actually return and to build trust without risk. Active mode enforces: it can block a backend whose score is below a threshold, and strip or block any response carrying a high-severity finding. Passive-then-active is the standard adoption path because no team lets an unproven proxy block production tool calls on day one."
        ]
      },
      {
        "heading": "Hosted vs. self-hosted deployment",
        "body": [
          "Because a gateway sees all of an agent's tool traffic, where it runs is a real decision. A hosted, multi-tenant gateway is the simplest to adopt — point your agent at a managed URL — but the operator sees your tool traffic, which is a privacy consideration for sensitive workloads.",
          "A self-hosted gateway runs as a container inside your own infrastructure (your VPC). Your agent connects to it locally, the backend's OAuth token stays in your environment, and tool traffic never leaves your network; only a control plane (policies, scores, threat intel) phones home. This is the enterprise-friendly model when data residency matters.",
          "One operational caveat: an in-band gateway is now on the critical path. If it goes down, the agent loses its tools. Treat a production gateway as infrastructure — health-checked, highly available, and with clear failure behavior — not as a side service."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP ships an in-band MCP Gateway as the enforcement counterpart to its out-of-band audit. You point your agent at a CheckMCP gateway URL (with an Authorization: Bearer token) instead of the raw MCP server; the gateway proxies every tools/list and tools/call to the backend and inspects what returns. It reuses the same engine the audit uses: the OWASP MCP Top 10 security checks (tool poisoning, hardcoded secrets, command injection, the lethal trifecta) that produce the vendor-neutral MCP Score (0-100, grade A-F) — where a secret found in a tool schema caps the grade at D and a failed MCP handshake caps it at F — the tool-output analysis from the behavioral evals (multilingual injection, exfiltration vectors, secret/PII in output, plus a callback canary that exercises read-only tools to confirm exfiltration), and the tool-pinning fingerprint from the monitoring layer to catch rug pulls and drift in-session. It runs in two postures: passive mode observes, logs and flags every call without blocking (the trust-building default), while active mode enforces — blocking a backend whose MCP Score is below a configured minimum and withholding any tool response that carries a high-severity finding, replacing it with a safety notice so your agent never sees the poisoned content. CheckMCP offers both a hosted gateway (a managed URL you create in the dashboard) and a self-hosted single-backend container you run in your own VPC, where tool traffic never leaves your network and the backend token stays in your environment. The free MCP Score — runnable via `uvx audit-mcp <url>` (the open-source, MIT, stdlib-only CLI), the web app at checkmcp.dev, or the GitHub Action `uses: H129hj/checkmcp@v1` to fail a CI build on a score regression or rug-pull — remains the acquisition layer; the gateway, behavioral evals and continuous drift monitoring are the paid protection layer.",
    "faq": [
      {
        "q": "What is an MCP gateway?",
        "a": "An MCP gateway is a security proxy that sits between your AI agent and the MCP servers it connects to. Your agent talks MCP to the gateway, and the gateway talks MCP to the real backend(s) — forwarding every tools/list and tools/call while inspecting the request and the response. It is the in-band chokepoint where tool poisoning, prompt injection, data exfiltration and tool drift can be caught (and, in active mode, blocked) before they reach the model."
      },
      {
        "q": "Why do you need an MCP gateway if you already audit your servers?",
        "a": "An audit certifies a server only at probe time. Two big risks appear only in live traffic: tool-output prompt injection (a server passes a clean schema audit but returns attacker-authored text on a specific query) and rug pulls (an approved server silently changes its tool definitions later, and the agent re-reads them with no re-approval). A gateway sees live traffic, so it re-checks the tool set against a pinned baseline every session and scans each response for injection and exfiltration — closing the gap a one-time audit cannot."
      },
      {
        "q": "What is the difference between an MCP gateway and an MCP audit or scanner?",
        "a": "An audit/scanner is out-of-band: it probes a server once, scores it, and walks away — great for acquisition decisions and CI gating. A gateway is in-band: it stays on the live request path and enforces safety on every call. CheckMCP provides both — the free MCP Score and CLI for auditing, and an in-band gateway (passive or active) for real-time protection — and the gateway reuses the same OWASP MCP Top 10 checks, behavioral output analysis and tool-pinning the audit uses."
      },
      {
        "q": "What is the difference between passive and active gateway mode?",
        "a": "Passive mode proxies everything unchanged and only observes, logs and flags risks — you run it first to see what your servers actually return and to build trust without blocking production traffic. Active mode enforces: it can block a backend whose MCP Score is below a configured minimum and withhold any tool response containing a high-severity finding (active injection, an exfiltration vector, a leaked secret), replacing it with a safety notice. Passive-then-active is the standard adoption path."
      },
      {
        "q": "Does an MCP gateway add latency to every tool call?",
        "a": "Yes — an in-band proxy is on the live request path, so it adds some delay to each tool call. A well-designed gateway keeps that overhead small by using cheap checks: regex pattern matching on outputs and hash comparison for tool-pinning, rather than slow analysis. The flip side is that the gateway also becomes critical infrastructure: if it goes down the agent loses its tools, so a production gateway should be health-checked and highly available."
      },
      {
        "q": "Can I self-host an MCP gateway so my tool traffic stays private?",
        "a": "Yes. CheckMCP's gateway can run as a single-backend container in your own infrastructure (your VPC). Your agent connects to it locally, the backend's OAuth/bearer token stays in your environment, and tool traffic never leaves your network — only a lightweight control plane (policies, scores, threat intel) communicates out. This is the recommended model when data residency or privacy matters; a hosted, managed gateway URL is also available for simpler setups."
      }
    ],
    "related": [
      "what-is-an-mcp-server",
      "mcp-security",
      "mcp-rug-pull",
      "prompt-injection-via-tools",
      "lethal-trifecta"
    ]
  },
  {
    "slug": "mcp-tools-resources-prompts",
    "term": "MCP tools, resources & prompts",
    "title": "MCP Tools, Resources, and Prompts Explained",
    "metaDescription": "MCP servers expose three primitives — tools, resources and prompts. What each one is, how an agent discovers them, and which carries the most security risk.",
    "answer": "Tools, resources and prompts are the three primitives a Model Context Protocol (MCP) server can expose to an AI agent. Tools are callable functions the model can invoke (each with a name, a description and a JSON Schema for inputs, plus an optional output schema); resources are readable data the agent pulls into context, addressed by URI; and prompts are reusable, parameterized prompt templates. MCP rides on JSON-RPC 2.0: after the host's MCP client performs a capability handshake with the server, it discovers all three over JSON-RPC, then the model decides which tool to call, and the host or user decides what to read or apply.",
    "checkmcpRelation": "CheckMCP audits all three primitives on a live MCP server and folds them into its explainable 0-100 MCP Score (grade A-F) across seven pillars. Tools dominate the analysis: tool design (weight 18) grades sprawl vs. consolidation, schemas & descriptions (16) grades how completely each tool's inputs and outputs are described, context-cost (12) measures the tokens the whole tool list spends in context, and security (20) runs an OWASP MCP Top 10 pass over every tool's name, description, parameter schema and output schema — flagging tool poisoning (MCP03), hardcoded secrets in a schema (MCP01), destructive tools missing a confirmation or destructiveHint (MCP02) and the lethal trifecta (MCP06). A secret found in a tool schema caps the grade at D, and a failed MCP handshake caps it at F. The coverage/use-case pillar (8) credits a server for usefully exposing tools, resources and prompts for its use case, and the opt-in behavioral evals exercise only read-only-safe tools with benign canary inputs to catch prompt-injection or data-exfiltration in tool responses — never invoking mutating tools. You get the score by pasting a URL at checkmcp.dev or running uvx audit-mcp <url>.",
    "sections": [
      {
        "heading": "The three MCP primitives",
        "body": [
          "An MCP server can expose three kinds of capability, and a client discovers each through its own JSON-RPC method. Tools are listed via tools/list and invoked via tools/call. Resources are listed via resources/list and read via resources/read. Prompts are listed via prompts/list and fetched via prompts/get. A server may offer any combination — many servers are tool-only — and the client only sees a primitive if the server advertised that capability during the initial handshake.",
          "The dividing line between them is who is in control. Tools are model-controlled: the agent decides, on its own, when to call one and with what arguments. Resources are application- or user-controlled: they are data the host or user chooses to pull into context, not actions the model triggers. Prompts are user-controlled: they are templates a user typically selects (a slash command, a menu entry) to start or shape an interaction.",
          "Getting this distinction right matters for both design and security. A capability that performs a side effect (sending an email, writing a file) belongs as a tool with a clear schema and, if destructive, a confirmation step — not hidden behind a resource read."
        ]
      },
      {
        "heading": "Tools: callable functions with schemas",
        "body": [
          "A tool is a function the model can invoke. Each tool has a unique name, a natural-language description telling the model what it does and when to use it, an inputSchema (JSON Schema) defining its parameters, and optionally an outputSchema describing the shape of what it returns. MCP also defines behavioral annotations — readOnlyHint, destructiveHint, idempotentHint, openWorldHint — that signal whether a tool is safe to call speculatively or changes state.",
          "Tools are the highest-leverage and the highest-risk surface, because everything about a tool is text the agent reads as part of its reasoning. The name, the description, every parameter's description, default and example, and the output schema are all loaded into the model's context. Whatever instructions live there, the model may treat as authoritative — which is exactly what tool poisoning abuses.",
          "Good tool design means tight, accurate descriptions, complete and correctly-typed schemas, consolidation of overlapping actions into fewer tools, and honest annotations. Verbose descriptions and oversized schemas also inflate context cost, because the full tool list is re-sent to the model on essentially every turn the server is enabled."
        ]
      },
      {
        "heading": "Resources: readable data addressed by URI",
        "body": [
          "A resource is a piece of readable data the server can hand to the agent — a file, a database record, a log, an API response, a documentation page. Each resource is identified by a URI (for example file:///path or a custom scheme like db://orders/42), and the server can also expose resource templates with URI patterns so the client can construct addresses for a family of resources.",
          "Resources are read, not executed. The agent — or, more often, the host application or user — pulls a resource into context to give the model material to reason over; reading a resource should not cause a side effect. Servers can also notify clients when a resource changes, so a host can keep context fresh.",
          "From a safety standpoint, remember that resource contents are untrusted text the model will read. A document or record fetched as a resource can carry injected instructions just like any other external content, so resources contribute to the untrusted-content leg of the lethal trifecta even though they are not, themselves, actions."
        ]
      },
      {
        "heading": "Prompts: reusable, parameterized templates",
        "body": [
          "A prompt is a reusable template the server offers to the user, usually surfaced in the host UI as a slash command or menu item. A prompt has a name, an optional description, and an optional set of arguments; when the user selects it and supplies the arguments, prompts/get returns one or more ready-to-send messages that seed or structure the conversation.",
          "Prompts standardize common, high-value interactions — a code-review template, a structured bug report, a summarization recipe — so users do not have to hand-write the same scaffolding each time, and so a server author can encode best-practice phrasing once. Because they are user-invoked rather than model-invoked, they are lower-risk than tools, but their text still enters the model's context and should be reviewed like any other instruction the agent will follow."
        ]
      },
      {
        "heading": "How an agent discovers and uses them",
        "body": [
          "The flow is uniform across all three primitives. The host starts one MCP client per server and performs a capability handshake (the initialize exchange) in which the server declares which of tools, resources and prompts it supports. The client then enumerates each supported primitive (tools/list, resources/list, prompts/list) and the host makes them available to the model and the user.",
          "At runtime the model calls tools/call when it decides a function is needed, the host or user triggers resources/read to bring data into context, and the user invokes prompts/get to apply a template. All of this rides on JSON-RPC 2.0 over a transport — stdio for local servers, Streamable HTTP (or the legacy HTTP+SSE pairing) for remote ones, which may sit behind OAuth 2.1.",
          "Because tool and prompt definitions and resource contents all flow into the model's context as text, the practical security boundary is the same for every primitive: an untrusted server can ship hostile text in any of them. That is why a server should be audited — its tools, resources and prompts inspected — before an agent is allowed to trust it."
        ]
      }
    ],
    "faq": [
      {
        "q": "What are MCP tools, resources, and prompts?",
        "a": "They are the three capabilities a Model Context Protocol server can expose. Tools are callable functions the model invokes (with input and optional output JSON Schemas), resources are readable data the agent pulls into context by URI, and prompts are reusable, parameterized templates a user selects. A client discovers each over JSON-RPC after the capability handshake."
      },
      {
        "q": "What is the difference between an MCP tool and an MCP resource?",
        "a": "A tool is model-controlled and performs an action: the model decides when to call it and supplies arguments, and it can have side effects. A resource is application- or user-controlled and is read-only: it is data the host or user pulls into context by URI, not an action the model triggers. Use tools for anything that does something; use resources for material to read."
      },
      {
        "q": "What are MCP tool descriptions?",
        "a": "A tool description is the natural-language text attached to a tool that tells the model what the tool does and when to use it. It is loaded straight into the agent's context alongside the tool's name and parameter schemas, so the model reads it as guidance. Because that text is authoritative to the model, descriptions are also where tool poisoning hides instructions, which is why CheckMCP scans every description for injection in its OWASP MCP Top 10 pass."
      },
      {
        "q": "Which MCP primitive is the most security-sensitive?",
        "a": "Tools. They are model-invoked, can perform real actions, and their entire definition — name, description, parameter schemas with defaults and examples, and output schema — is read into the model's context as authoritative text. That makes them the primary vector for tool poisoning and a building block of the lethal trifecta. Resources and prompts also carry untrusted text the model reads, but they do not act on their own."
      },
      {
        "q": "Does every MCP server expose all three primitives?",
        "a": "No. A server can expose any combination, and it declares which it supports during the initialize handshake. Many servers are tool-only; some add resources, prompts, or both. Clients only attempt resources/list or prompts/list if the server advertised that capability."
      },
      {
        "q": "How do I check whether an MCP server's tools, resources and prompts are safe?",
        "a": "Audit the live server before trusting it. CheckMCP probes the endpoint, inspects every tool, resource and prompt, and produces an explainable MCP Score (grade A-F) across seven pillars — grading tool design, schema and description quality, context cost and coverage, and running an OWASP MCP Top 10 security pass that flags poisoned descriptions, secrets in schemas, unsafe destructive tools and the lethal trifecta. A secret in a tool schema caps the grade at D and a failed handshake caps it at F. Run it with uvx audit-mcp <url> or at checkmcp.dev."
      }
    ],
    "related": [
      "model-context-protocol",
      "what-is-an-mcp-server",
      "mcp-client-server-host",
      "tool-poisoning",
      "mcp-context-cost",
      "mcp-score"
    ]
  },
  {
    "slug": "how-to-add-mcp-server-to-cursor",
    "term": "Adding an MCP server to Cursor",
    "title": "How to Add an MCP Server to Cursor",
    "metaDescription": "Add an MCP server to Cursor by editing .cursor/mcp.json with an mcpServers entry. Local stdio and remote HTTP examples, plus how to vet a server first.",
    "answer": "Add an MCP server to Cursor by creating or editing a JSON config file with an `mcpServers` object: `.cursor/mcp.json` in your project root for a single project, or `~/.cursor/mcp.json` in your home directory to enable it everywhere. Each entry is either a local stdio server (`command`, `args`, `env`) or a remote server (`url`, `headers`). You can also use Cursor's Settings UI (Settings - Tools & Integrations - New MCP Server) or a marketplace \"Add to Cursor\" button. Vet any third-party server before adding it, because Cursor will run its tools with your credentials and machine access.",
    "sections": [
      {
        "heading": "Where Cursor stores MCP config",
        "body": [
          "Cursor reads MCP servers from a JSON file using the `mcpServers` key (not `servers`). There are two scopes:",
          "Project scope: `.cursor/mcp.json` in your repository root. The server is available only when that project is open, and you can commit it to share the setup with your team.",
          "Global scope: `~/.cursor/mcp.json` in your home directory (`%USERPROFILE%\\.cursor\\mcp.json` on Windows). The server is available in every project.",
          "If the same server name appears in both files, the project-level definition wins. You can open the right file straight from the editor: Settings - Tools & Integrations - MCP Tools - New MCP Server."
        ]
      },
      {
        "heading": "Add a local (stdio) server",
        "body": [
          "Local servers run as a child process on your machine over the stdio transport. Cursor launches the `command` with the given `args`, and passes secrets via `env`. Create `.cursor/mcp.json` with:",
          "{\n  \"mcpServers\": {\n    \"my-server\": {\n      \"command\": \"<command>\",\n      \"args\": [\"<arg>\"],\n      \"env\": {\n        \"API_KEY\": \"<your-key>\"\n      }\n    }\n  }\n}",
          "Replace `<command>` with the executable (for example a launcher like `uvx` or `npx`, or an absolute path to a binary), and `<arg>` with the package or script it runs. Keep real secrets in `env`; never hardcode them in `args`. Use an absolute path for `command` if the binary is not on your PATH."
        ]
      },
      {
        "heading": "Add a remote (HTTP) server",
        "body": [
          "Remote servers are reached over the network using Streamable HTTP, so you supply a `url` instead of a `command`. Auth headers (such as a bearer token) go in `headers`:",
          "{\n  \"mcpServers\": {\n    \"my-remote\": {\n      \"url\": \"<url>\",\n      \"headers\": {\n        \"Authorization\": \"Bearer <token>\"\n      }\n    }\n  }\n}",
          "Many hosted servers use OAuth instead of a static token; in that case you can install from a marketplace entry or cursor.directory with an Add to Cursor button and authenticate in the browser. After editing the file, fully quit and reopen Cursor so it reloads MCP servers, then confirm the server and its tools appear under Settings - Tools & Integrations."
        ]
      },
      {
        "heading": "Vet the server before you add it",
        "body": [
          "Adding an MCP server grants it real power: Cursor will call the server's tools, and a local server runs on your machine with your environment and credentials. A malicious or compromised server can attempt tool poisoning (hidden instructions in a tool description), exfiltrate secrets, or run command injection. Treat adding a server like installing a dependency you do not fully control.",
          "Before adding one: prefer official or first-party servers, pin to a specific version rather than a floating `latest`, read the tool descriptions and schemas, scope credentials to least privilege (a read-only or short-lived token), and watch out for the lethal trifecta - a server that combines access to private data, exposure to untrusted content, and the ability to communicate externally.",
          "Re-vet on updates, too. A server that was safe yesterday can change behavior in a new version (an MCP rug pull), so review changes before bumping the pinned version."
        ]
      },
      {
        "heading": "Verify and manage from the CLI",
        "body": [
          "The Cursor CLI (the `cursor-agent` binary) shares the same `mcp.json` configuration as the editor and follows the same project-then-global precedence. There is no `cursor mcp add` command - you add servers by editing the JSON - but you can manage them once configured:",
          "`cursor-agent mcp list` - show configured servers and their status.",
          "`cursor-agent mcp list-tools <identifier>` - list the tools a server exposes (a quick way to inspect what it can do).",
          "`cursor-agent mcp login <identifier>` - authenticate with a server that uses OAuth.",
          "`cursor-agent mcp enable <identifier>` / `disable <identifier>` - turn a server on or off. In interactive mode the same actions are available as `/mcp list` and `/mcp list-tools`."
        ]
      }
    ],
    "checkmcpRelation": "Because Cursor runs an MCP server's tools with your credentials and machine access, the safest step before adding one is to audit it. CheckMCP gives any server a vendor-neutral MCP Score from 0 to 100 (grade A to F) across seven live-endpoint pillars - security, tool design, schemas, reliability, context-cost, compliance, and coverage. The security pillar maps to the OWASP MCP Top 10 (tool poisoning, hardcoded secrets, command injection, the lethal trifecta); a secret found in a tool schema caps the grade at D, and a failed MCP handshake caps it at F. Audit a remote server before you paste its url into `.cursor/mcp.json` by running `uvx audit-mcp <url>` (a stdlib-only, MIT-licensed CLI) or using the checkmcp.dev web app, wire it into CI with the GitHub Action `uses: H129hj/checkmcp@v1`, and for ongoing protection put an in-band CheckMCP Gateway in front of the server to block tool-poisoning and tool-definition drift at runtime.",
    "faq": [
      {
        "q": "What is the config file for adding an MCP server to Cursor?",
        "a": "Cursor reads MCP servers from a JSON file with an `mcpServers` object: `.cursor/mcp.json` in your project root for a single project, or `~/.cursor/mcp.json` in your home directory to make the server available everywhere. If the same server name is in both, the project file takes precedence."
      },
      {
        "q": "Is the JSON key mcpServers or servers in Cursor?",
        "a": "It is `mcpServers`. Each property under it is a server name whose value is the server config - `command`/`args`/`env` for a local stdio server, or `url`/`headers` for a remote HTTP server."
      },
      {
        "q": "How do I add a remote MCP server in Cursor?",
        "a": "Add an entry under `mcpServers` with a `url` (the server's Streamable HTTP endpoint) and, if needed, a `headers` object for auth such as `\"Authorization\": \"Bearer <token>\"`. For servers that use OAuth, install from a marketplace or cursor.directory Add to Cursor button and authenticate in the browser instead of pasting a token."
      },
      {
        "q": "Is there a Cursor CLI command to add an MCP server?",
        "a": "No. There is no `cursor mcp add` command - you add servers by editing `mcp.json`. The `cursor-agent` CLI can manage already-configured servers with `cursor-agent mcp list`, `list-tools <identifier>`, `login <identifier>`, and `enable`/`disable <identifier>`, sharing the same config as the editor."
      },
      {
        "q": "Do I need to restart Cursor after adding an MCP server?",
        "a": "Yes - MCP servers are loaded at startup, so fully quit and reopen Cursor after editing `mcp.json`. Once it restarts, the server and its tools should appear under Settings - Tools & Integrations."
      },
      {
        "q": "How do I pick a safe MCP server for Cursor?",
        "a": "Treat it like installing a dependency that runs with your credentials. Prefer official or first-party servers, pin a specific version, read the tool descriptions and schemas, and grant least-privilege tokens. Audit it first - for example run `uvx audit-mcp <url>` or use checkmcp.dev to get a 0-100 MCP Score covering tool poisoning, hardcoded secrets, and the lethal trifecta - and re-vet on every update."
      }
    ],
    "related": [
      "what-is-an-mcp-server",
      "how-to-audit-an-mcp-server",
      "are-mcp-servers-safe",
      "how-to-add-mcp-server-to-claude-desktop",
      "local-vs-remote-mcp-servers",
      "mcp-security"
    ]
  },
  {
    "slug": "how-to-add-mcp-server-to-vscode",
    "term": "Adding an MCP server to VS Code",
    "title": "How to Add an MCP Server to VS Code",
    "metaDescription": "Add an MCP server to VS Code (GitHub Copilot) via .vscode/mcp.json, the \"servers\" key, or code --add-mcp. Config locations, examples, and how to vet a server.",
    "answer": "In VS Code, MCP servers run through GitHub Copilot's Agent mode. Add one by editing a JSON file under the top-level \"servers\" key: a workspace file at .vscode/mcp.json, or your user-level mcp.json via the \"MCP: Open User Configuration\" command. You can also use the \"MCP: Add Server\" command for a guided flow, or run code --add-mcp from a terminal. Note the key is \"servers\", not the \"mcpServers\" used by Cursor and Claude Desktop. Vet any server before adding it, since its tools run with your editor's trust and credentials.",
    "sections": [
      {
        "heading": "Where the config lives",
        "body": [
          "VS Code stores MCP server definitions in an mcp.json file. There are two scopes:",
          "Workspace: a .vscode/mcp.json file at the root of your project. Commit it to share servers with your team. Open it from the Command Palette with \"MCP: Open Workspace Folder Configuration\".",
          "User profile (global): a user-level mcp.json that applies across all your projects. Open it with the \"MCP: Open User Configuration\" command.",
          "Run \"MCP: List Servers\" from the Command Palette at any time to see, start, stop, and inspect configured servers. MCP tools surface inside GitHub Copilot Chat when you switch the chat into Agent mode."
        ]
      },
      {
        "heading": "The exact JSON key: \"servers\" (not \"mcpServers\")",
        "body": [
          "The single most common setup mistake is the top-level key. VS Code uses \"servers\". Cursor and Claude Desktop use \"mcpServers\". If you copy a config from one of those tools without renaming the key, VS Code silently ignores it.",
          "The mcp.json file has up to three top-level sections: \"servers\" (the map of server name to config), \"inputs\" (placeholders for secrets, see below), and an optional \"sandbox\" section that restricts file-system and network access on macOS and Linux.",
          "Each entry under \"servers\" is keyed by a name you choose. Remote servers set \"type\": \"http\" and a \"url\". Local servers set a \"command\" and \"args\" and speak over stdio; for stdio the \"type\" field is optional."
        ]
      },
      {
        "heading": "Minimal config and CLI examples",
        "body": [
          "A workspace .vscode/mcp.json with one remote (HTTP) server and one local (stdio) server:",
          "{\n  \"servers\": {\n    \"my-remote\": {\n      \"type\": \"http\",\n      \"url\": \"<url>\"\n    },\n    \"my-local\": {\n      \"command\": \"<command>\",\n      \"args\": [\"<arg>\"]\n    }\n  }\n}",
          "Prefer a guided flow? Open the Command Palette and run \"MCP: Add Server\", then pick HTTP or stdio and the install scope (workspace or global).",
          "From a terminal you can add a server in one shot. The JSON must be escaped for your shell:",
          "code --add-mcp \"{\\\"name\\\":\\\"my-local\\\",\\\"command\\\":\\\"<command>\\\",\\\"args\\\":[\\\"<arg>\\\"]}\"",
          "By default this targets your user profile. Prefix it with --folder-uri <path> (for example, code --folder-uri <path> --add-mcp \"...\") to write to a specific workspace's .vscode/mcp.json instead."
        ]
      },
      {
        "heading": "Never hardcode secrets: use \"inputs\"",
        "body": [
          "Do not paste API keys or tokens directly into mcp.json, especially a workspace file you might commit. VS Code provides the \"inputs\" array, which prompts you for a value (optionally masked) and injects it at runtime via the ${input:<id>} reference.",
          "{\n  \"inputs\": [\n    {\n      \"type\": \"promptString\",\n      \"id\": \"api-key\",\n      \"description\": \"Your API key\",\n      \"password\": true\n    }\n  ],\n  \"servers\": {\n    \"my-remote\": {\n      \"type\": \"http\",\n      \"url\": \"<url>\",\n      \"headers\": { \"Authorization\": \"Bearer ${input:api-key}\" }\n    }\n  }\n}",
          "This keeps the secret out of source control and out of the server config itself."
        ]
      },
      {
        "heading": "Vet the server before you add it",
        "body": [
          "Adding an MCP server is not like installing a passive library. Once registered, its tools become callable by Copilot's Agent mode and run with your local machine's access, your environment variables, and any credentials you wire in. A local stdio server runs arbitrary commands on your machine; a remote HTTP server receives whatever your agent sends it.",
          "Before adding any server, confirm a few things. Who publishes it, and is the source public and inspectable? For a local server, what command and package does it actually run (npx, uvx, docker) and from where? For a remote server, what URL and provider sits behind it, and over what transport? Do the tool descriptions or schemas ask for more than the job needs, or carry hidden instructions? Does it want secrets, and are those scoped to the minimum?",
          "These are exactly the failure modes that bite MCP setups: tool poisoning (malicious instructions hidden in a tool's schema or description), command injection, hardcoded or over-broad secrets, and the lethal trifecta of private data access, untrusted content, and an exfiltration path combined in one agent. Treat a new server like granting an app full access to your dev environment, because that is effectively what it is."
        ]
      }
    ],
    "checkmcpRelation": "CheckMCP helps you do the \"vet it first\" step before a server lands in your .vscode/mcp.json. Point it at a server's URL with `uvx audit-mcp <url>`, the checkmcp.dev web app, or the GitHub Action (`uses: H129hj/checkmcp@v1`), and it returns a vendor-neutral MCP Score from 0-100 with an A-F grade across seven live-endpoint pillars (security, tool design, schemas, reliability, context-cost, compliance, coverage). The security pillar runs the OWASP MCP Top 10 checks that matter most for the threats above: a secret found in a tool schema caps the grade at D, and a failed handshake caps it at F. For servers you keep connected, CheckMCP's in-band Gateway can sit in front of the connection and block tool-poisoning and silent drift at call time.",
    "faq": [
      {
        "q": "Is the VS Code MCP key \"servers\" or \"mcpServers\"?",
        "a": "In VS Code it is \"servers\". The \"mcpServers\" key belongs to Cursor and Claude Desktop. Copy-pasting a config from those tools without renaming the top-level key is the number-one reason a server fails to load in VS Code."
      },
      {
        "q": "Where is the VS Code MCP config file located?",
        "a": "Two places. A per-project file at .vscode/mcp.json in your workspace root, and a user-level mcp.json for all projects, which you open with the \"MCP: Open User Configuration\" command. Use \"MCP: List Servers\" to manage whatever is configured."
      },
      {
        "q": "Can I add an MCP server from the command line?",
        "a": "Yes. Run code --add-mcp with an escaped JSON blob, for example code --add-mcp \"{\\\"name\\\":\\\"my-local\\\",\\\"command\\\":\\\"<command>\\\",\\\"args\\\":[\\\"<arg>\\\"]}\". By default it adds to your user profile; prefix it with --folder-uri <path> to target a specific workspace."
      },
      {
        "q": "Do I need GitHub Copilot to use MCP in VS Code?",
        "a": "In practice, yes. MCP tools in VS Code surface through GitHub Copilot Chat. The server's tools become available when you put the chat into Agent mode, which is what calls the tools during a task."
      },
      {
        "q": "How do I add an API key without hardcoding it?",
        "a": "Use the top-level \"inputs\" array with a promptString entry (set \"password\": true to mask it), then reference it as ${input:<id>} inside a server's env or headers. VS Code prompts for the value at runtime, keeping it out of mcp.json and out of source control."
      },
      {
        "q": "How do I check whether an MCP server is safe before adding it?",
        "a": "Inspect who publishes it, what command or URL it runs, and whether its tool schemas request more than they need or contain hidden instructions. To automate that, scan it with CheckMCP (`uvx audit-mcp <url>` or checkmcp.dev) for a 0-100 MCP Score and an OWASP MCP Top 10 security check before you put it in your config."
      }
    ],
    "related": [
      "how-to-add-mcp-server-to-cursor",
      "how-to-add-mcp-server-to-claude-desktop",
      "how-to-audit-an-mcp-server",
      "are-mcp-servers-safe",
      "tool-poisoning",
      "mcp-security"
    ]
  },
  {
    "slug": "how-to-add-mcp-server-to-claude-code",
    "term": "Claude Code MCP setup",
    "title": "How to Add an MCP Server to Claude Code",
    "metaDescription": "How to add an MCP server to Claude Code: the claude mcp add command, the three scopes, the .mcp.json mcpServers schema, and how to vet a server first.",
    "answer": "In Claude Code you add an MCP server from the command line, not by hand-editing a config file. Run `claude mcp add --transport http <name> <url>` for a remote HTTP server, or `claude mcp add <name> -- <command> [args...]` for a local stdio server (everything after the `--` is the launch command). Pick where it is stored with `--scope local` (default, this project only), `--scope project` (shared via a checked-in `.mcp.json` using the `mcpServers` key), or `--scope user` (all your projects). Because a server's tool descriptions and outputs flow straight into the model's context, vet any third-party server before you add it.",
    "sections": [
      {
        "heading": "The claude mcp add command (and where config is stored)",
        "body": [
          "Claude Code is CLI-first: you register servers with `claude mcp add`, and Claude Code writes the configuration for you. For a remote server, HTTP is the recommended transport: `claude mcp add --transport http <name> <url>`. For a local server that runs as a subprocess, use the stdio form: `claude mcp add <name> -- <command> [args...]`. The double dash `--` matters: it separates Claude Code's own flags (like `--transport`, `--env`, `--scope`) from the command and arguments that actually launch the server, which are passed through untouched.",
          "Where the entry is saved depends on the `--scope` flag. Local scope (the default) and user scope are stored in `~/.claude.json` in your home directory; local-scoped servers are nested under your project's path so they stay private to that project, while user-scoped servers load across all your projects. Project scope is different: it writes a `.mcp.json` file at your repository root, designed to be committed so your whole team gets the same servers. (Note: MCP \"local scope\" in `~/.claude.json` is not the same as general local settings in `.claude/settings.local.json`.)",
          "Pass secrets with `--env KEY=value` rather than embedding them in arguments, and authenticate remote OAuth servers afterward with the `/mcp` command inside a session (or `claude mcp login <name>` from the shell)."
        ]
      },
      {
        "heading": "Choosing a scope: local, project, or user",
        "body": [
          "Local scope is the default and loads only in the project where you added it, kept private to you in `~/.claude.json`. Use it for personal or experimental servers, or anything with credentials you do not want in version control. Add it explicitly with `claude mcp add --transport http <name> --scope local <url>`.",
          "Project scope stores the server in a `.mcp.json` file at the project root so it can be checked into version control and shared with everyone on the team: `claude mcp add --transport http <name> --scope project <url>`. For security, Claude Code prompts each user for approval before it will use project-scoped servers from a `.mcp.json` it has not seen — a safeguard worth keeping in mind when you pull a repo that ships its own MCP servers.",
          "User scope makes a server available across all of your projects (also stored in `~/.claude.json`) and suits personal utility servers you reuse everywhere: `claude mcp add --transport http <name> --scope user <url>`. When the same server name is defined at more than one scope, Claude Code uses one definition by precedence — local, then project, then user — without merging fields across scopes."
        ]
      },
      {
        "heading": "Minimal examples (CLI and .mcp.json)",
        "body": [
          "A remote HTTP server: `claude mcp add --transport http <name> <url>` — for example `claude mcp add --transport http notion https://mcp.notion.com/mcp`. To pass a token, add `--header \"Authorization: Bearer <token>\"`. A local stdio server: `claude mcp add --env API_KEY=<key> --transport stdio <name> -- npx -y <some-mcp-server>` — the part after `--` is the exact command Claude Code runs. (Place a flag like `--transport stdio` between `--env` and the server name; if the name comes directly after `--env`, the CLI reads it as another KEY=value pair and rejects it.)",
          "When you use `--scope project`, the resulting `.mcp.json` at your repo root uses a top-level `mcpServers` object keyed by server name. A minimal file with one stdio server and one remote server looks like: { \"mcpServers\": { \"my-local-tool\": { \"command\": \"<command>\", \"args\": [], \"env\": {} }, \"my-remote-tool\": { \"type\": \"http\", \"url\": \"<url>\" } } }. The `type` field accepts `http` (or its spec alias `streamable-http`), `sse` (deprecated), `stdio`, and `ws`. You can edit this file directly, or generate it with `claude mcp add-json <name> '<json>'`.",
          "Claude Code expands environment variables inside `.mcp.json` — `${VAR}` and `${VAR:-default}` work in `command`, `args`, `env`, `url`, and `headers` — so teams can share one config while keeping machine-specific paths and secrets like API keys out of the committed file."
        ]
      },
      {
        "heading": "Managing and verifying servers",
        "body": [
          "Once added, manage servers with `claude mcp list` (lists every configured server and its status), `claude mcp get <name>` (shows one server's details, including whether OAuth credentials are configured), and `claude mcp remove <name>`. Inside a Claude Code session, the `/mcp` panel shows connection status, the tool count per server, and is where you complete OAuth logins for remote servers.",
          "Project-scoped servers awaiting your approval appear as `Pending approval` in `claude mcp list` until you review them interactively. If you ever need to re-review the project servers you previously accepted, `claude mcp reset-project-choices` clears those approval decisions."
        ]
      },
      {
        "heading": "Vet the server before you add it",
        "body": [
          "Adding an MCP server grants it real reach into your session. The server's tool descriptions are read into the model's context as authoritative text, and the outputs its tools return are read back as data the model may act on. A malicious or compromised server can abuse either channel to steer the agent — this is tool poisoning and tool-output prompt injection — without the text ever appearing in your terminal. Claude Code's own docs warn that servers which fetch external content can expose you to prompt-injection risk.",
          "The risk is additive across every server you load. A server that can read private data, one that can fetch untrusted content, and one that can send data out can together form the lethal trifecta — the combination under which a single injection becomes real data exfiltration — even if each looked harmless alone. Project-scoped `.mcp.json` is shared through version control, so a server one teammate adds runs for everyone who approves it, which is exactly why the approval prompt exists.",
          "Practical defenses: add servers only from sources you trust, pass credentials through `--env` (or `${VAR}` references in `.mcp.json`) rather than hardcoding them, prefer servers that mark destructive operations with annotations, and audit any unfamiliar server before adding it. Servers can also silently change their tool definitions after you approve them (a rug pull), so re-checking on updates — not just on day one — is part of staying safe."
        ]
      }
    ],
    "checkmcpRelation": "Before you run `claude mcp add` on a third-party server, CheckMCP tells you whether it is safe to wire into your agent. Paste the server's URL at checkmcp.dev — or run `uvx audit-mcp <url>` from the open-source CLI (MIT, stdlib-only) — and CheckMCP probes the live endpoint and returns an explainable, vendor-neutral MCP Score 0-100 (grade A-F) across seven pillars led by security (weight 20), which runs an OWASP MCP Top 10 pass for tool poisoning, hardcoded secrets, command injection and the lethal trifecta. Hard caps surface the worst configurations immediately: a secret found in a tool schema caps the grade at D, and a failed MCP handshake caps it at F. Opt-in behavioral evals exercise read-only tools with canary inputs to catch prompt-injection and data-exfiltration in tool responses. For servers you depend on in a shared `.mcp.json`, the GitHub Action (`uses: H129hj/checkmcp@v1`) can gate CI on a score regression or rug-pull, and drift monitoring re-checks on every change; an in-band Gateway (passive or active mode) can block tool-poisoning and drift before they reach your agent. CheckMCP audits the server; you keep your Claude Code config clean.",
    "faq": [
      {
        "q": "How do I add an MCP server to Claude Code?",
        "a": "Use the CLI rather than editing a file by hand. For a remote server run `claude mcp add --transport http <name> <url>`; for a local subprocess run `claude mcp add <name> -- <command> [args...]`, where everything after the `--` is the launch command. Claude Code writes the configuration and connects on the next session. Add `--scope project` to share it via a checked-in `.mcp.json`, or `--scope user` to use it across all your projects."
      },
      {
        "q": "Where does Claude Code store its MCP server config?",
        "a": "It depends on the scope. Local scope (the default) and user scope are stored in `~/.claude.json` in your home directory — local-scoped servers are nested under the project's path and stay private to that project, while user-scoped servers load everywhere. Project scope writes a `.mcp.json` file at your repository root that is meant to be committed and shared with your team."
      },
      {
        "q": "Is the JSON key `mcpServers` or `servers` in Claude Code?",
        "a": "It is `mcpServers`. The project-scoped `.mcp.json` file (and the entry Claude Code writes into `~/.claude.json`) uses a top-level `mcpServers` object keyed by the server name, with each value holding fields like `type`, `url`, or `command`/`args`/`env`. There is no `servers` key."
      },
      {
        "q": "How do I add a local (stdio) vs a remote (HTTP) MCP server in Claude Code?",
        "a": "For a local stdio server, put the launch command after a double dash: `claude mcp add <name> -- <command> [args...]` (the `--` separates Claude Code's flags from the server's command). For a remote server, use `claude mcp add --transport http <name> <url>`; HTTP is the recommended remote transport, and you can pass auth with `--header \"Authorization: Bearer <token>\"` or complete OAuth later via `/mcp`."
      },
      {
        "q": "How do I list, check, or remove MCP servers in Claude Code?",
        "a": "Run `claude mcp list` to see every configured server and its status, `claude mcp get <name>` for one server's details, and `claude mcp remove <name>` to delete it. Inside a session, the `/mcp` command shows live connection status, per-server tool counts, and handles OAuth logins for remote servers."
      },
      {
        "q": "Is it safe to add any MCP server to Claude Code?",
        "a": "No — treat third-party servers as untrusted until checked. A server's tool descriptions and outputs are read into the model's context, so a malicious server can hijack the agent via tool poisoning or tool-output injection, and several servers together can form the lethal trifecta. Claude Code already prompts before using project-scoped servers from a `.mcp.json`; keep secrets in `--env`, add servers from trusted sources, and audit unfamiliar ones (for example with CheckMCP) before adding them."
      }
    ],
    "related": [
      "how-to-add-mcp-server-to-claude-desktop",
      "what-is-an-mcp-server",
      "local-vs-remote-mcp-servers",
      "are-mcp-servers-safe",
      "how-to-audit-an-mcp-server",
      "mcp-security"
    ]
  }
];

export const learnBySlug = (slug: string): LearnPage | undefined => LEARN.find((p) => p.slug === slug);
