#!/usr/bin/env node

import 'dotenv/config';
import { MatimoInstance } from '@matimo/core';

/**
 * GitHub Factory Pattern Example
 * ================================
 *
 * Demonstrates the simplest way to use Matimo tools: direct execution via matimo.execute().
 * This pattern is best for:
 *   - Simple scripts and CLIs
 *   - Direct tool invocation
 *   - Learning Matimo basics
 *
 * Setup:
 * ------
 * 1. Get a GitHub Personal Access Token (PAT):
 *    Visit: https://github.com/settings/tokens
 *    Create token with: repo, read:org scopes (for public repo access)
 *
 * 2. Set environment variable:
 *    export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
 *
 * 3. Run this example:
 *    pnpm github:factory
 *
 * Available GitHub Tools:
 * -----------------------
 * SEARCH:
 *   - github-search-repositories: Find repositories by query (language, stars, etc.)
 *   - github-search-code: Search code across repositories
 *   - github-search-issues: Find issues and pull requests
 *   - github-search-users: Find GitHub users
 *
 * REPOSITORIES:
 *   - github-list-repositories: List repos in an org/user
 *   - github-get-repository: Get detailed repo info
 *   - github-create-repository: Create new repo (write access required)
 *   - github-delete-repository: Delete a repo (write access required)
 *
 * ISSUES:
 *   - github-list-issues: List issues in a repo
 *   - github-create-issue: Create issue (write access required)
 *   - github-get-issue: Get issue details
 *   - github-update-issue: Update issue (write access required)
 *
 * PULL REQUESTS:
 *   - github-list-pull-requests: List PRs in a repo
 *   - github-create-pull-request: Create PR (write access required)
 *   - github-merge-pull-request: Merge PR (write access required)
 *
 * COMMITS:
 *   - github-list-commits: List commits in repo
 *
 * COLLABORATORS:
 *   - github-list-collaborators: List repo collaborators
 *   - github-add-collaborator: Add collaborator (admin access required)
 *
 * RELEASES:
 *   - github-list-releases: List releases
 *   - github-create-release: Create release (write access required)
 *
 * CODE SCANNING:
 *   - github-list-code-alerts: List security alerts (Advanced Security)
 *   - github-update-code-alert: Update alert status (Advanced Security)
 */

// Type definitions for API responses
interface SearchRepositoryResult {
  total_count: number;
  items: Array<{
    id: number;
    name: string;
    full_name: string;
    description: string;
    url: string;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    updated_at: string;
  }>;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  open_issues_count: number;
  topics: string[];
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  created_at: string;
  updated_at: string;
}

interface Commit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
}

interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
}

async function main() {
  console.info('\n╔════════════════════════════════════════════════════════════╗');
  console.info('║  🐙 GitHub Factory Pattern Example                      ║');
  console.info('║  Direct tool execution using matimo.execute()           ║');
  console.info('╚════════════════════════════════════════════════════════════╝\n');

  // Check for GitHub token
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('\n❌ Error: GITHUB_TOKEN environment variable not set');
    console.info('\n📖 Setup Instructions:');
    console.info('   1. Create a GitHub Personal Access Token:');
    console.info('      https://github.com/settings/tokens');
    console.info('   2. Set the environment variable:');
    console.info('      export GITHUB_TOKEN="ghp_xxxx..."');
    console.info('   3. Run this example again:');
    console.info('      pnpm github:factory\n');
    process.exit(1);
  }

  try {
    // Initialize Matimo with auto-discovery
    const matimo = await MatimoInstance.init({
      autoDiscover: true,
    });

    // Get all GitHub tools (filter by prefix)
    const allTools = matimo.listTools();
    const githubTools = allTools.filter((t) => t.name.startsWith('github-'));
    console.info(`📚 Loaded ${githubTools.length} GitHub tools from Matimo\n`);

    // Example 1: Search repositories
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('Example 1: Search TypeScript Repositories');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('📦 Searching: language:typescript fork:false stars:>100\n');
    try {
      const searchResults = await matimo.execute('github-search-repositories', {
        query: 'language:typescript fork:false stars:>100',
      });
      const searchData = (searchResults as any).data || searchResults;
      console.info(`✅ Found ${searchData?.total_count} TypeScript repositories\n`);
      if (searchData?.items && searchData.items.length > 0) {
        console.info('Top 3 Results:');
        searchData.items.slice(0, 3).forEach((repo: any, idx: number) => {
          console.info(`  ${idx + 1}. ${repo.full_name} ⭐ ${repo.stargazers_count}`);
          console.info(`     ${repo.description || 'No description'}\n`);
        });
      }
    } catch (error: any) {
      console.error(`❌ Search failed: ${error.message}`);
    }

    // Example 2: Get repository details
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('Example 2: Get Repository Details');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('🔎 Getting details for: kubernetes/kubernetes\n');
    try {
      const repo = await matimo.execute('github-get-repository', {
        owner: 'kubernetes',
        repo: 'kubernetes',
      });
      const repoData = (repo as any).data || repo;
      if (repoData && repoData.full_name) {
        console.info(`✅ Repository: ${repoData.full_name}`);
        console.info(`   Description: ${repoData.description}`);
        console.info(`   Stars: ⭐ ${repoData.stargazers_count?.toLocaleString()}`);
        console.info(`   Language: ${repoData.language || 'Mixed'}`);
        console.info(`   Open Issues: ${repoData.open_issues_count}`);
        if (repoData.topics?.length > 0) {
          console.info(`   Topics: ${repoData.topics.join(', ')}`);
        }
        console.info();
      } else {
        console.error(
          `❌ Get repository returned unexpected format: ${JSON.stringify(repoData).slice(0, 100)}`
        );
      }
    } catch (error: any) {
      console.error(`❌ Get repository failed: ${error.message}`);
    }

    // Example 3: List repositories
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('Example 3: List Organization Repositories');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('📋 Listing top 5 Node.js repositories\n');
    try {
      const repos = await matimo.execute('github-list-repositories', {
        owner: 'nodejs',
        type: 'public',
        per_page: 5,
      });
      const reposData = (repos as any).data || repos;
      const repoList = Array.isArray(reposData) ? reposData : reposData?.repositories || [];
      if (repoList.length > 0) {
        console.info(`✅ Found ${repoList.length} repositories from nodejs org:\n`);
        repoList.forEach((repo: any, idx: number) => {
          console.info(`  ${idx + 1}. ${repo.name} ⭐ ${repo.stargazers_count}`);
          console.info(`     Full Name: ${repo.full_name}`);
          console.info(`     Language: ${repo.language || 'Mixed'}`);
          console.info();
        });
      } else {
        console.info(`⚠️  No repositories found or unexpected response format`);
      }
    } catch (error: any) {
      console.error(`❌ List repositories failed: ${error.message}`);
    }

    // Example 4: List pull requests
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('Example 4: List Open Pull Requests');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('🔀 Listing PRs from: cli/cli\n');
    try {
      const prs = await matimo.execute('github-list-pull-requests', {
        owner: 'cli',
        repo: 'cli',
        state: 'open',
        per_page: 5,
      });
      const prsData = (prs as any).data || prs;
      const prList = Array.isArray(prsData) ? prsData : prsData?.pull_requests || [];
      if (prList.length > 0) {
        console.info(`✅ Found ${prList.length} open pull requests:\n`);
        prList.forEach((pr: any, idx: number) => {
          console.info(`  ${idx + 1}. #${pr.number}: ${pr.title}`);
          console.info(
            `     Status: ${pr.state} | Created: ${new Date(pr.created_at).toLocaleDateString()}`
          );
          console.info();
        });
      } else {
        console.info(`⚠️  No open pull requests found or unexpected response format`);
      }
    } catch (error: any) {
      console.error(`❌ List pull requests failed: ${error.message}`);
    }

    // Example 5: List commits
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('Example 5: List Recent Commits');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('📝 Listing commits from: golang/go\n');
    try {
      const commits = await matimo.execute('github-list-commits', {
        owner: 'golang',
        repo: 'go',
        per_page: 5,
      });
      const commitsData = (commits as any).data || commits;
      const commitList = Array.isArray(commitsData) ? commitsData : commitsData?.commits || [];
      if (commitList.length > 0) {
        console.info(`✅ Found ${commitList.length} recent commits:\n`);
        commitList.slice(0, 3).forEach((commit: any, idx: number) => {
          const msg = commit.commit.message.split('\n')[0];
          console.info(`  ${idx + 1}. ${commit.commit.author.name}`);
          console.info(`     ${msg}`);
          console.info(`     SHA: ${commit.sha.substring(0, 7)}`);
          console.info();
        });
      } else {
        console.info(`⚠️  No commits found or unexpected response format`);
      }
    } catch (error: any) {
      console.error(`❌ List commits failed: ${error.message}`);
    }

    // Example 6: List releases
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('Example 6: List Releases');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('🎉 Listing releases from: nodejs/node\n');
    try {
      const releases = await matimo.execute('github-list-releases', {
        owner: 'nodejs',
        repo: 'node',
        per_page: 5,
      });
      const releasesData = (releases as any).data || releases;
      const releaseList = Array.isArray(releasesData) ? releasesData : releasesData?.releases || [];
      if (releaseList.length > 0) {
        console.info(`✅ Found ${releaseList.length} releases:\n`);
        releaseList.slice(0, 3).forEach((release: any, idx: number) => {
          console.info(`  ${idx + 1}. ${release.tag_name} "${release.name}"`);
          console.info(`     Published: ${new Date(release.published_at!).toLocaleDateString()}`);
          console.info();
        });
      } else {
        console.info(`⚠️  No releases found or unexpected response format`);
      }
    } catch (error: any) {
      console.error(`❌ List releases failed: ${error.message}`);
    }

    // Example 7: Search code
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('Example 7: Search Code');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('🔍 Searching for: "async function" in React\n');
    try {
      const codeResults = await matimo.execute('github-search-code', {
        query: 'language:typescript "async function" repo:facebook/react',
      });
      const codeData = (codeResults as any).data || codeResults;
      console.info(`✅ Found ${codeData?.total_count} code matches in React\n`);
    } catch (error: any) {
      console.error(`❌ Search code failed: ${error.message}`);
    }

    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('✅ All factory pattern examples completed!');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error: any) {
    console.error('\n❌ Fatal Error:', error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

main();
