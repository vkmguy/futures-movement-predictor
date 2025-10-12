import { getUncachableGitHubClient } from '../server/github-client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface RepoConfig {
  owner: string;
  repoName: string;
  description?: string;
  private?: boolean;
}

async function createGitHubRepository(config: RepoConfig) {
  const octokit = await getUncachableGitHubClient();
  
  try {
    // Check if repository already exists
    try {
      const { data: existingRepo } = await octokit.repos.get({
        owner: config.owner,
        repo: config.repoName,
      });
      
      console.log(`✅ Repository already exists: ${existingRepo.html_url}`);
      return existingRepo;
    } catch (error: any) {
      if (error.status !== 404) throw error;
    }

    // Create new repository
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: config.repoName,
      description: config.description || 'Futures Movement Predictor - Professional web-based futures price prediction application',
      private: config.private || false,
      auto_init: false,
    });

    console.log(`✅ Created new repository: ${repo.html_url}`);
    return repo;
  } catch (error: any) {
    console.error('❌ Error creating repository:', error.message);
    throw error;
  }
}

async function pushToGitHub(config: RepoConfig) {
  const octokit = await getUncachableGitHubClient();
  
  // Get authenticated user
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`📝 Authenticated as: ${user.login}`);
  
  // Use provided owner or authenticated user
  const owner = config.owner || user.login;
  const repoConfig = { ...config, owner };
  
  // Create or get repository
  const repo = await createGitHubRepository(repoConfig);
  
  // Initialize git if not already initialized
  if (!fs.existsSync('.git')) {
    console.log('🔧 Initializing git repository...');
    execSync('git init', { stdio: 'inherit' });
  }
  
  // Create .gitignore if it doesn't exist
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    const gitignoreContent = `node_modules/
.env
.env.local
dist/
build/
.replit
.upm/
*.log
.DS_Store
tmp/
.cache/
`;
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log('📄 Created .gitignore file');
  }
  
  // Configure git
  try {
    execSync('git config user.name', { stdio: 'pipe' });
  } catch {
    execSync(`git config user.name "${user.name || user.login}"`, { stdio: 'inherit' });
  }
  
  try {
    execSync('git config user.email', { stdio: 'pipe' });
  } catch {
    execSync(`git config user.email "${user.email || `${user.login}@users.noreply.github.com`}"`, { stdio: 'inherit' });
  }
  
  // Add remote if it doesn't exist
  try {
    execSync('git remote get-url origin', { stdio: 'pipe' });
    console.log('📡 Remote origin already exists');
  } catch {
    execSync(`git remote add origin ${repo.clone_url}`, { stdio: 'inherit' });
    console.log('📡 Added remote origin');
  }
  
  // Stage all files
  console.log('📦 Staging files...');
  execSync('git add .', { stdio: 'inherit' });
  
  // Commit
  console.log('💾 Creating commit...');
  try {
    execSync('git commit -m "Initial commit: Futures Movement Predictor MVP"', { stdio: 'inherit' });
  } catch (error) {
    console.log('ℹ️  No changes to commit or commit already exists');
  }
  
  // Get current branch
  let currentBranch = 'main';
  try {
    currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    if (!currentBranch) {
      currentBranch = 'main';
      execSync('git branch -M main', { stdio: 'inherit' });
    }
  } catch {
    currentBranch = 'main';
  }
  
  // Push to GitHub
  console.log(`🚀 Pushing to GitHub (${currentBranch} branch)...`);
  try {
    execSync(`git push -u origin ${currentBranch}`, { stdio: 'inherit' });
    console.log(`✅ Successfully pushed to ${repo.html_url}`);
  } catch (error) {
    console.log('ℹ️  Attempting force push...');
    execSync(`git push -u origin ${currentBranch} --force`, { stdio: 'inherit' });
    console.log(`✅ Successfully pushed to ${repo.html_url}`);
  }
  
  return repo;
}

// Main execution
const config: RepoConfig = {
  owner: process.argv[2] || '', // GitHub username from command line
  repoName: process.argv[3] || 'futures-movement-predictor',
  description: 'Futures Movement Predictor - Professional web-based application for predicting daily price movements of /NQ, /ES, /YM, /RTY, /GC, and /CL contracts',
  private: process.argv[4] === 'true',
};

pushToGitHub(config)
  .then((repo) => {
    console.log('\n✨ Success! Your project is now on GitHub:');
    console.log(`   ${repo.html_url}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Visit your repository on GitHub');
    console.log('   2. Add a README.md with project documentation');
    console.log('   3. Configure any GitHub Actions or settings');
  })
  .catch((error) => {
    console.error('\n❌ Failed to push to GitHub:', error.message);
    process.exit(1);
  });
