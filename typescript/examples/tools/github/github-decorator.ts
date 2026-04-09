#!/usr/bin/env node
/**
 * ============================================================================
 * GITHUB TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Decorator Pattern with @tool
 * ─────────────────────────────────────────────────────────────────────────
 * Uses TypeScript @tool decorators to wrap GitHub tool calls in a class.
 *
 * Use this pattern when:
 * ✅ Building class-based applications
 * ✅ Encapsulating tool logic in services
 * ✅ Adding custom methods that combine multiple tools
 * ✅ Need reusable tool wrappers
 * ✅ Object-oriented design preferred
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
 *
 * 2. Get a GitHub Personal Access Token:
 *    https://github.com/settings/tokens
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export GITHUB_TOKEN=your_token_here
 *   npm run github:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Decorator Pattern Agent - Uses @tool decorators for GitHub operations
 */
class GitHubDecoratorPatternAgent {
  public matimo: MatimoInstance;

  constructor(matimo: MatimoInstance) {
    this.matimo = matimo;
  }

  /**
   * GitHub search repositories tool - manually execute with required parameters
   */
  async searchRepositories(query: string): Promise<unknown> {
    const result = await this.matimo.execute('github-search-repositories', {
      query,
    });
    return result;
  }

  /**
   * GitHub list-repositories tool - automatically executes via @tool decorator
   */
  @tool('github-list-repositories')
  async listRepositories(owner: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('github-list-repositories', { owner })
    return undefined;
  }

  /**
   * GitHub get-repository tool - automatically executes via @tool decorator
   */
  @tool('github-get-repository')
  async getRepository(owner: string, repo: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('github-get-repository', { owner, repo })
    return undefined;
  }

  /**
   * GitHub list-pull-requests tool - automatically executes via @tool decorator
   */
  @tool('github-list-pull-requests')
  async listPullRequests(owner: string, repo: string, state?: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('github-list-pull-requests', { owner, repo, state })
    return undefined;
  }

  /**
   * GitHub list-issues tool - automatically executes via @tool decorator
   */
  @tool('github-list-issues')
  async listIssues(owner: string, repo: string, state?: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('github-list-issues', { owner, repo, state })
    return undefined;
  }

  /**
   * GitHub list-commits tool - automatically executes via @tool decorator
   */
  @tool('github-list-commits')
  async listCommits(owner: string, repo: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('github-list-commits', { owner, repo })
    return undefined;
  }
}

/**
 * Run decorator pattern examples
 */
async function runDecoratorPatternExamples() {
  const gitHubToken = process.env.GITHUB_TOKEN || 'ghp-default-fake-token';

  console.info('╔════════════════════════════════════════════════════════╗');
  console.info('║  GitHub Tools - Decorator Pattern                      ║');
  console.info('║  (Uses @tool decorators for automatic execution)       ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  if (gitHubToken === 'ghp-default-fake-token') {
    console.info('🔐 Warning: GITHUB_TOKEN not set in environment');
    console.info('   Set it: export GITHUB_TOKEN="ghp_xxxx"');
    console.info('   Get one from: https://github.com/settings/tokens\n');
  }

  console.info(`🤖 GitHub Token: ${gitHubToken.substring(0, 10)}...\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });
    setGlobalMatimoInstance(matimo);

    const matimoTools = matimo.listTools();
    const githubTools = matimoTools.filter((t) => t.name.startsWith('github'));
    console.info(
      `📦 Loaded ${matimoTools.length} total tools, ${githubTools.length} GitHub tools\n`
    );

    // Create agent
    const agent = new GitHubDecoratorPatternAgent(matimo);

    console.info('🧪 Testing GitHub Tools with Decorator Pattern');
    console.info('═'.repeat(60) + '\n');

    // Example 1: Search repositories
    console.info('🔍 Example 1: Search Repositories');
    console.info('─'.repeat(60));
    try {
      const searchResult = await agent.searchRepositories('language:rust stars:>1000');

      const searchData = (searchResult as any).data || searchResult;

      if (
        searchData.total_count !== undefined &&
        searchData.items &&
        Array.isArray(searchData.items)
      ) {
        const totalPages = Math.ceil(searchData.total_count / searchData.items.length);
        console.info(
          `✅ Found ${searchData.total_count} Rust repositories (showing first ${Math.min(3, searchData.items.length)})`
        );
        searchData.items.slice(0, 3).forEach((repo: any, idx: number) => {
          console.info(`   ${idx + 1}. ${repo.full_name} (⭐ ${repo.stargazers_count})`);
        });
        if (searchData.items.length > 3) {
          console.info(`   ... and ${searchData.items.length - 3} more on this page`);
        }
        console.info(`   📄 Page 1 of ~${totalPages} pages`);
      } else {
        console.info(`❌ Failed: ${searchData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Example 2: List organization repositories
    console.info('\n📋 Example 2: List Organization Repositories');
    console.info('─'.repeat(60));
    try {
      const listResult = await agent.listRepositories('rust-lang');

      const listData = (listResult as any).data || listResult;

      if (Array.isArray(listData)) {
        console.info(`✅ Found ${listData.length} repositories in rust-lang:`);
        listData.slice(0, 3).forEach((repo: any, idx: number) => {
          console.info(`   ${idx + 1}. ${repo.name}`);
        });
        if (listData.length > 3) {
          console.info(`   ... and ${listData.length - 3} more`);
        }

        // Use first repository for next examples
        const firstRepo = listData[0];
        console.info(`\n🎯 Using first repo: ${firstRepo.name}\n`);

        // Example 3: Get repository details
        console.info('🔎 Example 3: Get Repository Details');
        console.info('─'.repeat(60));
        try {
          const repoResult = await agent.getRepository('rust-lang', firstRepo.name);

          const repoData = (repoResult as any).data || repoResult;
          if (repoData.id !== undefined) {
            console.info(`✅ rust-lang/${firstRepo.name}`);
            console.info(`   Stars: ⭐ ${repoData.stargazers_count}`);
            console.info(`   Forks: 🍴 ${repoData.forks_count}`);
            console.info(`   Language: ${repoData.language || 'N/A'}`);
            console.info(`   Open Issues: ${repoData.open_issues_count}`);
          } else {
            console.info(`❌ Failed: ${repoData.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Example 4: List pull requests (manually execute to use per_page parameter)
        console.info('\n🔀 Example 4: List Pull Requests');
        console.info('─'.repeat(60));
        console.info('📌 Checking: cli/cli (has active PRs)\n');
        try {
          const prsResult = await agent.matimo.execute('github-list-pull-requests', {
            owner: 'cli',
            repo: 'cli',
            state: 'open',
            per_page: 5,
          });

          const prsData = (prsResult as any).data || prsResult;
          const prList = Array.isArray(prsData) ? prsData : prsData?.pull_requests || [];

          if (prList.length > 0) {
            console.info(`✅ Found ${prList.length} open pull requests from cli/cli`);
            prList.slice(0, 3).forEach((pr: any, idx: number) => {
              console.info(`   ${idx + 1}. #${pr.number}: ${pr.title}`);
              console.info(`      Created: ${new Date(pr.created_at).toLocaleDateString()}`);
            });
            if (prList.length > 3) {
              console.info(`   ... and ${prList.length - 3} more`);
            }
          } else {
            console.info(`⚠️  No open pull requests found`);
          }
        } catch (error) {
          console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Example 5: List commits (manually execute to use per_page parameter)
        console.info('\n📝 Example 5: List Commits');
        console.info('─'.repeat(60));
        console.info('📌 Checking: golang/go (has active commits)\n');
        try {
          const commitsResult = await agent.matimo.execute('github-list-commits', {
            owner: 'golang',
            repo: 'go',
            per_page: 5,
          });

          const commitsData = (commitsResult as any).data || commitsResult;
          const commitList = Array.isArray(commitsData) ? commitsData : commitsData?.commits || [];

          if (commitList.length > 0) {
            console.info(`✅ Found ${commitList.length} recent commits from golang/go`);
            commitList.slice(0, 3).forEach((commit: any, idx: number) => {
              const msg = commit.commit.message.split('\n')[0];
              console.info(`   ${idx + 1}. ${commit.commit.author?.name || 'Unknown'}`);
              console.info(`      ${msg}`);
              console.info(`      SHA: ${commit.sha.substring(0, 7)}`);
            });
            if (commitList.length > 3) {
              console.info(`   ... and ${commitList.length - 3} more`);
            }
          } else {
            console.info(`⚠️  No commits found`);
          }
        } catch (error) {
          console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Example 6: List releases (manually execute to use per_page parameter)
        console.info('\n🎉 Example 6: List Releases');
        console.info('─'.repeat(60));
        try {
          const releasesResult = await agent.matimo.execute('github-list-releases', {
            owner: 'nodejs',
            repo: 'node',
            per_page: 5,
          });

          const releasesData = (releasesResult as any).data || releasesResult;
          const releaseList = Array.isArray(releasesData) ? releasesData : [];

          if (releaseList.length > 0) {
            console.info(`✅ Found ${releaseList.length} releases from nodejs/node`);
            releaseList.slice(0, 3).forEach((release: any, idx: number) => {
              console.info(`   ${idx + 1}. ${release.tag_name} - ${release.name || 'Unnamed'}`);
            });
            if (releaseList.length > 3) {
              console.info(`   ... and ${releaseList.length - 3} more`);
            }
          } else {
            console.info(`⚠️  No releases found`);
          }
        } catch (error) {
          console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.info(`❌ Failed to list repositories: ${listData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.info('\n' + '═'.repeat(60));
    console.info('✨ Decorator Pattern Example Complete!');
    console.info('═'.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the example
runDecoratorPatternExamples().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
