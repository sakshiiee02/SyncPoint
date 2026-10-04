const fs = require('fs');
const path = require('path');

// Populate process.env from .env file during Metro / Babel build
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  // Ignore
}

function inlineEnvPlugin({ types: t }) {
  return {
    name: 'inline-env-vars',
    visitor: {
      MemberExpression(nodePath) {
        if (nodePath.get('object').matchesPattern('process.env')) {
          const key = nodePath.toComputedKey();
          if (t.isStringLiteral(key)) {
            const varName = key.value;
            if (process.env[varName] !== undefined) {
              nodePath.replaceWith(t.valueToNode(process.env[varName]));
            }
          }
        }
      },
    },
  };
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    inlineEnvPlugin,
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
        },
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
      },
    ],
  ],
};
