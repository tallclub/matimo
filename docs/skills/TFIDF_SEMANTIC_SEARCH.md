# TF-IDF Semantic Search in Matimo Skills

## Overview

Matimo uses **TF-IDF (Term Frequency–Inverse Document Frequency)** as the default semantic search engine for discovering and ranking skills. This document explains the algorithm, its implementation, practical usage, and when to consider alternatives.

**Key takeaway:** TF-IDF provides lightweight, zero-dependency semantic search suitable for 10–200 skills. For larger deployments or specialized ranking, you can plug in OpenAI, Cohere, or custom embedding providers.

---

## TF-IDF Algorithm Explained

### What is TF-IDF?

TF-IDF is a statistical measure that evaluates how important a word is to a document in a collection of documents. It consists of two parts:

**1. Term Frequency (TF)** — How often a term appears in a document
```
TF(term, doc) = (1 + log(count of term in doc)) if count > 0 else 0
```
- Sublinear scaling prevents high-frequency words from dominating
- Logarithm dampens the effect of repeated terms

**2. Inverse Document Frequency (IDF)** — How rare the term is across all documents
```
IDF(term) = log((total documents + 1) / (documents containing term + 1)) + 1
```
- Rare terms get higher weights (more discriminative)
- Smoothing constants prevent division by zero
- Common words (like "the", "and") get low IDF scores

**3. TF-IDF Score** — Product of TF and IDF
```
TF-IDF(term, doc) = TF(term, doc) × IDF(term)
```

### Why TF-IDF for Skills?

✅ **Pros:**
- **Zero dependencies** — Pure JavaScript, works out of the box
- **Fast** — O(n) on document size, O(m) on query size (m = vocabulary size)
- **Deterministic** — Same ranking every time (no API calls)
- **Transparent** — Easy to debug; you can see term weights
- **Good enough** — Accurately ranks 10–200 documents

❌ **Cons:**
- **Bag-of-words** — Ignores word order and semantics ("dog bites man" vs "man bites dog" score identically)
- **No synonyms** — "tool creation" and "build tool" considered different terms
- **Limited context** — Can't understand if similar words have different meanings
- **Doesn't scale** — For 1000+ skills or multi-language, use neural embeddings

---

## Implementation in Matimo

### Core Components

#### 1. TfIdfEmbeddingProvider Class

Located in `packages/core/src/core/tfidf-embedding.ts`:

```typescript
export class TfIdfEmbeddingProvider implements EmbeddingProvider {
  private vocabulary: Map<string, number> = new Map();
  private idf: Float64Array = new Float64Array(0);
  private corpusSize = 0;
  private _dimensions = 0;

  fit(documents: string[]): void { ... }
  async embed(text: string): Promise<number[]> { ... }
  async embedBatch(texts: string[]): Promise<number[][]> { ... }
  embedSync(text: string): number[] { ... }
}
```

**Methods:**

- **`fit(documents: string[])`** — Build vocabulary and IDF weights from all skill files
  - Tokenizes each document (lowercase, splits on non-alphanumeric)
  - Counts document frequency for each term
  - Pre-computes IDF weights for fast lookup
  - Must be called once before embedding

- **`embed(text: string): Promise<number[]>`** — Convert text to TF-IDF vector
  - Tokenizes query
  - Computes TF weights
  - Multiplies by pre-computed IDF
  - Returns **L2-normalized vector** — each element divided by vector magnitude, so final length = 1 (preserves direction, removes length bias)

- **`embedBatch(texts: []): Promise<number[][]>`** — VectorBatch embedding
  - Maps `embed()` over array of texts
  - Useful for embedding all skills at startup

- **`embedSync(text: string): number[]`** — Synchronous version (internal use)
  - No async overhead in hot path

#### 2. Cosine Similarity

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  // Dot product / (norm_a × norm_b)
  // Returns [-1, 1]: 1 = identical, 0 = orthogonal, -1 = opposite
  // Vectors pre-normalized, so result is in [0, 1] for positive weights
}
```

**Why cosine similarity?**
- Works in high-dimensional space (vocabulary size = dimension count)
- Metric-agnostic to vector magnitude (unit vectors)
- Mathematically stable and fast

**Note on L2-Normalization:** All vectors are L2-normalized before similarity computation, meaning each vector is divided by its Euclidean magnitude (√(sum of squares)) to produce unit vectors. This makes vectors comparable regardless of length:
```
L2-normalized = vector / √(x₁² + x₂² + ... + xₙ²)
Result: final length = 1, direction preserved
```
With L2-normalized vectors, cosine similarity simplifies to just the dot product, making computation faster.

#### 3. Stopwords Filter

```typescript
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', ...
]);
```

**Purpose:** Remove common English words that add noise without meaning
- 50+ stopwords built-in
- Reduces vocabulary size by ~40–60%
- Improves ranking by removing irrelevant matches

---

## Integration with Matimo Skills System

### Flow: From YAML to Search Results

```
1. MatimoInstance.init(skillsPath)
   ↓
2. SkillLoader loads all SKILL.md files from disk
   ↓
3. SkillContentParser extracts sections (name, version, description, content)
   ↓
4. SkillRegistry stores SKILL.md metadata + full text
   ↓
5. TfIdfEmbeddingProvider.fit([all skill texts])
   ↓ (Vocabulary + IDF pre-computed once)
   ↓
6. matimo.semanticSearchSkills(query) called by agent
   ↓
7. Query → TF-IDF vector → Cosine similarity vs all skills
   ↓
8. Ranked results returned to agent
```

### SDK APIs

#### `semanticSearchSkills(query: string, topK?: number): Promise<SkillSearchResult[]>`

```typescript
const results = await matimo.semanticSearchSkills(
  'how to create a tool',
  5 // top 5 results
);

// Returns:
[
  {
    skillName: 'tool-creation',
    score: 0.87,        // cosine similarity [0, 1]
    description: 'Create new tools...',
    sections: ['Tool Definition Structure', 'Execution Flow', ...]
  },
  {
    skillName: 'meta-tools-lifecycle',
    score: 0.72,
    description: 'Full lifecycle management...',
    sections: [...]
  },
  ...
]
```

**Scoring:** Ranked by descending similarity; threshold ~0.5 (results below 0.5 are typically noise)

#### `getSkillSections(skillName: string): { sections: string[], totalTokens: number }`

```typescript
const sections = matimo.getSkillSections('tool-creation');
// Returns:
{
  sections: ['Tool Definition Structure', 'Execution Flow', 'Authentication', ...],
  totalTokens: 2847  // Estimated full SKILL.md
}
```

#### `getSkillContent(skillName: string, options?: { sections?: string[] }): Promise<string>`

```typescript
// Load full skill
const full = await matimo.getSkillContent('tool-creation');

// Load selective sections (token-efficient)
const partial = await matimo.getSkillContent('tool-creation', {
  sections: ['Tool Definition Structure', 'Execution Flow']
});
```

---

## Practical Examples

### Example 1: Agent Discovering Skills by Natural Language

**Agent Query:** "I need to understand how to approve tools in the system"

```typescript
const matimo = await MatimoInstance.init('./skills');

const results = await matimo.semanticSearchSkills('approve tools policy', 3);

console.log(results);
// Output:
// [
//   {
//     skillName: 'policy-validation',
//     score: 0.89,
//     description: 'Risk classification, approval tiers, policy configuration',
//     sections: ['Approval Workflow', 'Policy Tiers', ...]
//   },
//   {
//     skillName: 'meta-tools-lifecycle',
//     score: 0.76,
//     description: 'Full lifecycle management (create, validate, approve, ...)',
//     sections: ['Tool Approval', 'Approval Chain', ...]
//   },
//   {
//     skillName: 'tool-creation',
//     score: 0.68,
//     description: 'Create new tools...',
//     sections: ['Validation', 'Error Handling', ...]
//   }
// ]

// Agent loads top result, extracts specific section
const approvalContent = await matimo.getSkillContent('policy-validation', {
  sections: ['Approval Workflow']
});

console.log(approvalContent);
// → Just the approval section, minimal tokens
```

### Example 2: LangChain Agent Using `matimo_search_skills` Meta-Tool

```typescript
import { MatimoInstance } from '@matimo/core';
import { initializeAgentExecutorWithTools } from 'langchain/agents';
import { ChatOpenAI } from 'langchain/chat_models/openai';

const matimo = await MatimoInstance.init('./skills');
const tools = matimo.listTools(); // All tools + meta-tools

const llm = new ChatOpenAI({ modelName: 'gpt-4' });
const executor = await initializeAgentExecutorWithTools({
  tools,
  llm,
  agentType: 'openai-functions',
  verbose: true
});

// Agent autonomously calls matimo_search_skills when needed
const result = await executor.run('I want to learn about tool creation');

// Agent automatically:
// 1. Calls matimo_search_skills('tool creation')
// 2. Gets ranked results
// 3. Calls matimo_get_skill_content() on best match
// 4. Parses sections and responds
```

### Example 3: Multi-Tenant Skill Search (Different Queries)

```typescript
const queries = [
  'how do I validate a YAML tool?',
  'what is OAuth2 authentication?',
  'how to write a skill.md file?',
  'CLI commands for tool management',
  'how to test my tools?'
];

const allResults = await Promise.all(
  queries.map(q => matimo.semanticSearchSkills(q, 1))
);

// Each query gets independently ranked against all skills
// Results show which skill best answers each question
allResults.forEach((results, idx) => {
  console.log(`Query: ${queries[idx]}`);
  console.log(`→ Best match: ${results[0].skillName} (${results[0].score})`);
});
```

### Example 4: Programming: Direct TF-IDF Vectors

For advanced use cases, manipulate embeddings directly:

```typescript
import { TfIdfEmbeddingProvider, cosineSimilarity } from '@matimo/core';

const provider = new TfIdfEmbeddingProvider();

// Fit on corpus
const skillContent = ['Tool creation workflow...', 'Policy tiers...', '...'];
provider.fit(skillContent);

// Embed query
const queryVector = provider.embedSync('how to approve a tool');

// Embed all skills (can be cached)
const skillVectors = skillContent.map(s => provider.embedSync(s));

// Manual ranking
const scores = skillVectors.map(v => cosineSimilarity(queryVector, v));
const ranked = scores
  .map((score, idx) => ({ skillName: skillContent[idx], score }))
  .sort((a, b) => b.score - a.score);

console.log(ranked.slice(0, 3));
```

---

## Performance Characteristics

### Startup Cost

```
Skill Count | Fit Time  | Memory     | Query Time
10          | 5ms       | 50KB       | 0.5ms
50          | 25ms      | 200KB      | 1.5ms
100         | 45ms      | 400KB      | 2.5ms
200         | 90ms      | 800KB      | 4.5ms
500         | 220ms     | 2MB        | 8ms
1000+       | 450ms+    | 4MB+       | 15ms+ ⚠️
```

**Notes:**
- Fit is one-time at `MatimoInstance.init()`
- Query time linear in vocabulary size, not skill count
- Query time is synchronous (no I/O or external API)
- Memory grows with vocabulary (not #skills directly)

### Scalability Limits

- **Ideal range:** 10–200 skills
- **Acceptable:** 200–500 skills (queries ~5ms, still fast)
- **Degraded:** 500+ skills (queries ~8–15ms, consider caching or alternative)
- **Not suitable:** 1000+ skills (queries >15ms, use neural embeddings instead)

---

## Extensibility: Plugging in Other Embedding Providers

### The `EmbeddingProvider` Interface

```typescript
export interface EmbeddingProvider {
  dimensions: number;
  fit(documents: string[]): void | Promise<void>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

### Example: Using OpenAI Embeddings

```typescript
import { EmbeddingProvider } from '@matimo/core';
import { OpenAIApi } from 'openai';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAIApi;
  readonly dimensions = 1536; // text-embedding-3-small

  constructor(apiKey: string) {
    this.client = new OpenAIApi({ apiKey });
  }

  async fit(documents: string[]): Promise<void> {
    // Pre-warm cache or validate corpus
    // Optional: you could cache embeddings to file
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.createEmbedding({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.createEmbedding({
      model: 'text-embedding-3-small',
      input: texts
    });
    return response.data.map(d => d.embedding);
  }
}

// Set custom provider on MatimoInstance
const matimo = await MatimoInstance.init('./skills');
matimo.setSkillEmbeddingProvider(new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY));

// Now all searches use OpenAI embeddings
const results = await matimo.semanticSearchSkills('policy approval');
```

**Advantages of swapping providers:**
- ✅ Better semantic understanding (synonyms, paraphrasing)
- ✅ Multi-language support
- ✅ Scales to 1000+ skills
- ❌ API cost per query (~$0.00001–0.0001 per embedding)
- ❌ Network latency (~100ms round-trip)
- ❌ Requires API keys

---

## Common Pitfalls & Troubleshooting

### Issue: Low Scores (0.3–0.5 range)

**Cause:** Query and skill content have few shared terms (stop words filtered out)

**Solution:**
```typescript
// Before:
const results = await matimo.semanticSearchSkills('make');
// → Low scores, "make" is 4 letters, might match, but noisy

// After:
const results = await matimo.semanticSearchSkills('create a new tool');
// → Higher scores, more specific terms: "create", "tool"
```

### Issue: Unexpected Ranking

**Cause:** Term frequency dominance (e.g., if "HTTP" appears 20x in one skill, it ranks high on "HTTP" queries even if not the best match overall)

**Debugging:**
```typescript
// Use TfIdfEmbeddingProvider directly to inspect vectors
const provider = new TfIdfEmbeddingProvider();
provider.fit(skillContent);

const query = 'HTTP request';
const vec = provider.embedSync(query);

// High values at specific indices = strong signal for those terms
console.log('Query vector (non-zero indices):', vec
  .map((val, idx) => ({ idx, val }))
  .filter(x => x.val > 0.1)
  .sort((a, b) => b.val - a.val)
  .slice(0, 5)
);
```

### Issue: Stopwords Filtering Too Aggressive

**Symptom:** Can't find skills when querying with common terms ("How to...")

**Current stopwords:** ~50 English words (see `STOPWORDS` in `tfidf-embedding.ts`)

**Solution:** For very specialized queries, disable stopword filtering:
```typescript
// Modify tokenization in custom provider:
private tokenize(text: string): string[] {
  // Don't filter stopwords for domain-specific terms
  return text.toLowerCase().split(/[^a-z0-9]+/);
}
```

---

## Best Practices

### 1. Query Writing

✅ **Good queries:**
- "how to create a tool" (specific, multiple terms)
- "OAuth2 authentication flow" (domain terms)
- "approve and reload" (action + context)

❌ **Poor queries:**
- "tool" (too generic, matches everything)
- "a" (single stopword, filtered out)
- "123" (numbers ignored, no semantic value)

### 2. Skill Content Quality

✅ **Well-structured SKILL.md:**
```markdown
# skill-name

> Brief one-line summary describing what agents learn

## Overview
2–3 sentences on the purpose and scope.

## Section 1: Key Concept
Detailed explanation, examples, code blocks.

## Section 2: Workflow
Step-by-step procedures.

## Best Practices
Do's and don'ts specific to this skill.
```

❌ **Poor SKILL.md:**
- Single paragraph (no section headers to search on)
- Repeated terms ("tool tool tool") → high TF but noisy
- Minimal documentation → low IDF discrimination

### 3. Caching Embeddings

For production systems with frequently re-indexed skills:

```typescript
// Cache embeddings to file after fit()
const provider = new TfIdfEmbeddingProvider();
provider.fit(skillContent);

// Later: load from cache (avoid re-fit)
const cached = loadEmbeddingsFromCache();
if (cached) {
  setGlobalSkillEmbeddings(cached); // pseudo-code
}
```

---

## References

- **TF-IDF Fundamentals:** https://en.wikipedia.org/wiki/Tf%E2%80%93idf
- **Cosine Similarity:** https://en.wikipedia.org/wiki/Cosine_similarity
- **Matimo Skills System:** [Skills System Docs](./SKILLS_SYSTEM.md)
- **Embeddings for Production:** OpenAI (text-embedding-3), Cohere, Hugging Face
- **Stopwords Lists:** NLTK, SpaCy (extensible in Matimo)

---

## Conclusion

TF-IDF in Matimo enables lightweight, deterministic semantic search perfect for discovering skills. For 10–200 skills, it's production-ready. For larger deployments or specialized use cases (synonyms, multilingual, semantic nuance), plug in a neural embedding provider and enjoy the same API surface.
