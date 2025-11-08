const path = require('path');

/**
 * Configure environment variables for the build based on the provided mode.
 * Defaults mimic the previous npm script configuration while remaining
 * cross-platform (no shell-specific env assignments).
 */
const configureEnv = (mode) => {
  const baseEnv = {
    CI: 'false',
    GENERATE_SOURCEMAP: 'false',
    INLINE_RUNTIME_CHUNK: 'false',
  };

  const modeEnv = {
    analyze: {
      GENERATE_SOURCEMAP: 'true',
    },
    fast: {
      SKIP_PREFLIGHT_CHECK: 'true',
    },
    'ultra-fast': {
      SKIP_PREFLIGHT_CHECK: 'true',
      FAST_REFRESH: 'false',
      TSC_COMPILE_ON_ERROR: 'false',
      ESLINT_NO_DEV_ERRORS: 'true',
      DISABLE_ESLINT_PLUGIN: 'true',
    },
  };

  const selected = modeEnv[mode] || {};
  return { ...baseEnv, ...selected };
};

const modeArg = process.argv[2] || '';
const mode = modeArg.startsWith('--') ? modeArg.slice(2) : '';
const envConfig = configureEnv(mode);

Object.entries(envConfig).forEach(([key, value]) => {
  process.env[key] = value;
});

// Ensure NODE_ENV defaults to production for build commands.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Delegate to the standard react-scripts build script.
require(path.resolve(__dirname, '../node_modules/react-scripts/scripts/build'));

