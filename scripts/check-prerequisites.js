#!/usr/bin/env node

/**
 * Prerequisites checker for Solid Octo Invention
 * Checks if all required tools and services are available
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Checking prerequisites for Solid Octo Invention...\n');

let hasErrors = false;

/**
 * Check if a command exists
 */
function checkCommand(command, name, installUrl) {
  try {
    execSync(`${command} --version`, { stdio: 'pipe' });
    console.log(`✅ ${name} is installed`);
    return true;
  } catch (error) {
    console.log(`❌ ${name} is not installed or not in PATH`);
    if (installUrl) {
      console.log(`   Install from: ${installUrl}`);
    }
    hasErrors = true;
    return false;
  }
}

/**
 * Check if a file exists
 */
function checkFile(filePath, name, instructions) {
  const fullPath = join(rootDir, filePath);
  if (existsSync(fullPath)) {
    console.log(`✅ ${name} exists`);
    return true;
  } else {
    console.log(`❌ ${name} is missing`);
    if (instructions) {
      console.log(`   ${instructions}`);
    }
    hasErrors = true;
    return false;
  }
}

/**
 * Check if Docker services are running
 */
function checkDockerServices() {
  try {
    const output = execSync('docker ps --format "table {{.Names}}"', { 
      stdio: 'pipe', 
      encoding: 'utf8' 
    });
    
    const runningContainers = output.split('\n').slice(1).filter(line => line.trim());
    const hasPostgres = runningContainers.some(name => name.includes('postgres'));
    const hasRedis = runningContainers.some(name => name.includes('redis'));
    
    if (hasPostgres && hasRedis) {
      console.log('✅ Database services are running');
      return true;
    } else {
      console.log('❌ Database services are not running');
      console.log('   Run: pnpm db:up');
      hasErrors = true;
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot check Docker services (Docker may not be running)');
    console.log('   Make sure Docker Desktop is running');
    hasErrors = true;
    return false;
  }
}

// Check Node.js version
console.log('📦 Checking runtime requirements...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 18) {
  console.log(`✅ Node.js ${nodeVersion} (>= 18.0.0)`);
} else {
  console.log(`❌ Node.js ${nodeVersion} (requires >= 18.0.0)`);
  console.log('   Install from: https://nodejs.org');
  hasErrors = true;
}

// Check package manager
checkCommand('pnpm', 'pnpm', 'https://pnpm.io/installation');

// Check Docker
console.log('\n🐳 Checking Docker...');
const dockerInstalled = checkCommand('docker', 'Docker', 'https://docker.com');
if (dockerInstalled) {
  checkCommand('docker compose', 'Docker Compose', null);
  checkDockerServices();
}

// Check project files
console.log('\n📁 Checking project files...');
checkFile('.env', '.env file', 'Run: cp .env.example .env');
checkFile('pnpm-lock.yaml', 'pnpm-lock.yaml', 'Run: pnpm install');

// Check if dependencies are installed
console.log('\n📦 Checking dependencies...');
if (existsSync(join(rootDir, 'node_modules'))) {
  console.log('✅ Dependencies are installed');
} else {
  console.log('❌ Dependencies are not installed');
  console.log('   Run: pnpm install');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Some prerequisites are missing or not configured properly.');
  console.log('\n📋 Quick fix commands:');
  console.log('1. cp .env.example .env');
  console.log('2. pnpm install');
  console.log('3. pnpm db:up');
  console.log('4. pnpm migrate:up');
  console.log('5. pnpm dev');
  process.exit(1);
} else {
  console.log('✅ All prerequisites are met! You can run: pnpm dev');
  process.exit(0);
}

