#!/usr/bin/env node

/**
 * System Validation Script for Beauty LMS
 * Validates deployment scripts, monitoring tools, and system configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function section(message) {
    log(`\n🔧 ${message}`, 'cyan');
    log('─'.repeat(50), 'cyan');
}

const rootDir = path.join(__dirname, '..');

//=====================================
// File System Validation
//=====================================

async function validateFileStructure() {
    info('Validating file structure and permissions...');
    let allPassed = true;
    
    const requiredFiles = [
        'backend/package.json',
        'backend/server.js',
        'backend/.env.example',
        'scripts/test_recording_api.js',
        'scripts/setup_recording_paths.sh',
        'backend/deploy.sh',
        'backend/monitor.sh',
        'deploy_hostinger.sh'
    ];
    
    const requiredDirectories = [
        'backend',
        'backend/controllers',
        'backend/routes',
        'backend/config',
        'backend/utils',
        'scripts',
        'recordings'
    ];
    
    // Check required files
    for (const file of requiredFiles) {
        const filePath = path.join(rootDir, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (file.endsWith('.sh') && !(stats.mode & parseInt('111', 8))) {
                warning(`Script ${file} is not executable`);
                allPassed = false;
            } else {
                success(`File exists: ${file}`);
            }
        } else {
            error(`Missing required file: ${file}`);
            allPassed = false;
        }
    }
    
    // Check required directories
    for (const dir of requiredDirectories) {
        const dirPath = path.join(rootDir, dir);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
            success(`Directory exists: ${dir}`);
        } else {
            error(`Missing required directory: ${dir}`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

//=====================================
// Script Validation
//=====================================

async function validateScripts() {
    info('Validating deployment and monitoring scripts...');
    let allPassed = true;
    
    const scripts = [
        {
            name: 'Recording Setup Script',
            path: 'scripts/setup_recording_paths.sh',
            checkSyntax: true
        },
        {
            name: 'Backend Deploy Script',
            path: 'backend/deploy.sh',
            checkSyntax: true
        },
        {
            name: 'Backend Monitor Script',
            path: 'backend/monitor.sh',
            checkSyntax: true
        },
        {
            name: 'Hostinger Deploy Script',
            path: 'deploy_hostinger.sh',
            checkSyntax: true
        }
    ];
    
    for (const script of scripts) {
        const scriptPath = path.join(rootDir, script.path);
        
        if (!fs.existsSync(scriptPath)) {
            error(`Script not found: ${script.name}`);
            allPassed = false;
            continue;
        }
        
        if (script.checkSyntax) {
            try {
                // Check bash syntax
                execSync(`bash -n "${scriptPath}"`, { stdio: 'pipe' });
                success(`${script.name} syntax valid`);
            } catch (syntaxError) {
                error(`${script.name} has syntax errors`);
                allPassed = false;
            }
        }
        
        // Check if script has help/usage information
        const content = fs.readFileSync(scriptPath, 'utf8');
        if (content.includes('Usage:') || content.includes('help') || content.includes('--help')) {
            success(`${script.name} has usage documentation`);
        } else {
            warning(`${script.name} missing usage documentation`);
        }
    }
    
    return allPassed;
}

//=====================================
// Configuration Validation
//=====================================

async function validateConfiguration() {
    info('Validating configuration files...');
    let allPassed = true;
    
    // Check package.json
    try {
        const packagePath = path.join(rootDir, 'backend/package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        const requiredFields = ['name', 'version', 'main', 'scripts', 'dependencies'];
        for (const field of requiredFields) {
            if (packageJson[field]) {
                success(`package.json has ${field}`);
            } else {
                error(`package.json missing ${field}`);
                allPassed = false;
            }
        }
        
        // Check for required dependencies
        const requiredDeps = ['express', 'socket.io', 'mediasoup', 'firebase-admin', 'cors'];
        for (const dep of requiredDeps) {
            if (packageJson.dependencies && packageJson.dependencies[dep]) {
                success(`Dependency available: ${dep}`);
            } else {
                error(`Missing dependency: ${dep}`);
                allPassed = false;
            }
        }
        
    } catch (err) {
        error(`Failed to parse package.json: ${err.message}`);
        allPassed = false;
    }
    
    // Check .env.example
    try {
        const envExamplePath = path.join(rootDir, 'backend/.env.example');
        const envContent = fs.readFileSync(envExamplePath, 'utf8');
        
        const requiredEnvVars = [
            'PORT', 
            'NODE_ENV',
            'FIREBASE_PROJECT_ID',
            'MEDIASOUP_LISTEN_IP',
            'MEDIASOUP_ANNOUNCED_IP',
            'CORS_ORIGINS',
            'JWT_SECRET'
        ];
        
        for (const envVar of requiredEnvVars) {
            if (envContent.includes(envVar)) {
                success(`Environment variable documented: ${envVar}`);
            } else {
                warning(`Environment variable not documented: ${envVar}`);
            }
        }
        
    } catch (err) {
        error(`Failed to read .env.example: ${err.message}`);
        allPassed = false;
    }
    
    return allPassed;
}

//=====================================
// Recording System Validation
//=====================================

async function validateRecordingSystem() {
    info('Validating recording system...');
    let allPassed = true;
    
    // Check recordings directory structure
    const recordingsDir = path.join(rootDir, 'recordings');
    const requiredSubdirs = ['active', 'completed', 'failed', 'temp', 'private'];
    
    if (fs.existsSync(recordingsDir)) {
        success('Recordings directory exists');
        
        for (const subdir of requiredSubdirs) {
            const subdirPath = path.join(recordingsDir, subdir);
            if (fs.existsSync(subdirPath)) {
                success(`Recording subdirectory exists: ${subdir}`);
            } else {
                warning(`Recording subdirectory missing: ${subdir}`);
            }
        }
    } else {
        warning('Recordings directory not found (will be created at runtime)');
    }
    
    // Check if FFmpeg is available
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        success('FFmpeg is available for recording');
    } catch (err) {
        warning('FFmpeg not available - recording may not work properly');
    }
    
    return allPassed;
}

//=====================================
// System Dependencies
//=====================================

async function validateSystemDependencies() {
    info('Validating system dependencies...');
    let allPassed = true;
    
    const requiredCommands = [
        { cmd: 'node --version', name: 'Node.js' },
        { cmd: 'npm --version', name: 'NPM' },
        { cmd: 'curl --version', name: 'curl' },
        { cmd: 'bash --version', name: 'Bash' }
    ];
    
    for (const { cmd, name } of requiredCommands) {
        try {
            const output = execSync(cmd, { stdio: 'pipe' }).toString().trim();
            const version = output.split('\n')[0];
            success(`${name} available: ${version.substring(0, 50)}`);
        } catch (err) {
            error(`${name} not available`);
            allPassed = false;
        }
    }
    
    // Check optional dependencies
    const optionalCommands = [
        { cmd: 'ffmpeg -version', name: 'FFmpeg' },
        { cmd: 'nginx -v', name: 'Nginx' },
        { cmd: 'pm2 --version', name: 'PM2' }
    ];
    
    for (const { cmd, name } of optionalCommands) {
        try {
            execSync(cmd, { stdio: 'pipe' });
            success(`${name} available (optional)`);
        } catch (err) {
            warning(`${name} not available (optional)`);
        }
    }
    
    return allPassed;
}

//=====================================
// Main Validation Runner
//=====================================

async function runSystemValidation() {
    log('🔍 Starting Beauty LMS System Validation', 'magenta');
    log('='.repeat(60), 'magenta');
    
    const validationSuites = [
        { name: 'File Structure', fn: validateFileStructure },
        { name: 'Script Validation', fn: validateScripts },
        { name: 'Configuration', fn: validateConfiguration },
        { name: 'Recording System', fn: validateRecordingSystem },
        { name: 'System Dependencies', fn: validateSystemDependencies }
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    const failedSuites = [];
    
    for (const suite of validationSuites) {
        section(suite.name);
        
        try {
            const result = await suite.fn();
            if (result) {
                totalPassed++;
                success(`${suite.name} validation passed`);
            } else {
                totalFailed++;
                failedSuites.push(suite.name);
                error(`${suite.name} validation failed`);
            }
        } catch (error) {
            totalFailed++;
            failedSuites.push(`${suite.name} (Exception)`);
            error(`${suite.name} validation threw exception: ${error.message}`);
        }
    }
    
    // Final results
    log('\n' + '='.repeat(60), 'magenta');
    log(`🎯 SYSTEM VALIDATION RESULTS`, 'magenta');
    log(`📊 Total Suites: ${totalPassed + totalFailed}`, 'blue');
    log(`✅ Passed: ${totalPassed}`, 'green');
    log(`❌ Failed: ${totalFailed}`, totalFailed === 0 ? 'green' : 'red');
    
    if (failedSuites.length > 0) {
        log('\n❌ Failed Validation Suites:', 'red');
        failedSuites.forEach(suite => log(`   • ${suite}`, 'red'));
    }
    
    if (totalFailed === 0) {
        success('\n🎉 ALL SYSTEM VALIDATIONS PASSED! Beauty LMS is properly configured.');
        process.exit(0);
    } else {
        error(`\n⚠️  ${totalFailed} validation suite(s) failed. Check the output above for details.`);
        process.exit(1);
    }
}

// Run the system validation
runSystemValidation().catch(err => {
    error(`System validation runner failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
});