const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'src', 'assets');
const publicDir = path.join(__dirname, 'public');

const filesToCopy = [
    { src: 'fundo.png', dest: 'login-background.png' },
    { src: 'watink-sf.png', dest: 'logo.png' },
    { src: 'favicon.png', dest: 'favicon.png' },
    { src: 'favicon.png', dest: 'favicon.ico' },
    { src: 'logo-completa.png', dest: 'logo-full.png' },
    { src: 'watink-logo-letras.png', dest: 'logo-text.png' }
];

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

filesToCopy.forEach(file => {
    const srcPath = path.join(assetsDir, file.src);
    const destPath = path.join(publicDir, file.dest);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file.src} to ${file.dest}`);
    } else {
        console.warn(`Source file not found: ${srcPath}`);
    }
});

// Update version.json
const packageJsonPath = path.join(__dirname, 'package.json');
const versionJsonPath = path.join(publicDir, 'version.json');

try {
    const packageJson = require(packageJsonPath);
    const versionData = {
        service: "frontend",
        version: packageJson.version,
        lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));
    console.log(`Updated version.json to ${packageJson.version}`);
} catch (error) {
    console.error('Error updating version.json:', error);
}
