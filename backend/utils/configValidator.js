require('dotenv').config();

const requiredEnvVars = [
  'MNEMONIC',
  'INFURA_API_KEY',
  'MONGODB_URI',
  'RPC_URL'
];

const validateConfig = () => {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ [Config Error] Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }

  // Warning for placeholder values
  const placeholders = requiredEnvVars.filter(envVar => process.env[envVar] === '0x...' || process.env[envVar].includes('YOUR_'));
  if (placeholders.length > 0) {
    console.warn('⚠️ [Config Warning] Some environment variables contain placeholder values:');
    placeholders.forEach(v => console.warn(`   - ${v}`));
  }

  console.log('✅ [Config] Environment variables validated.');
};

module.exports = { validateConfig };
