#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 Agentic Chat Setup');
console.log('===================\n');

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setup() {
  try {
    console.log('Let\'s configure your AI-powered chat application!\n');
    
    const apiKey = await askQuestion('Enter your OpenAI API key: ');
    
    if (!apiKey || apiKey.trim() === '') {
      console.log('❌ OpenAI API key is required. Please run setup again.');
      process.exit(1);
    }

    const port = await askQuestion('Server port (default: 3000): ') || '3000';
    const personalBotModel = await askQuestion('Personal Bot model (default: gpt-4): ') || 'gpt-4';
    const tataAigModel = await askQuestion('TATA AIG Bot model (default: gpt-4): ') || 'gpt-4';

    const envContent = `# OpenAI API Configuration
OPENAI_API_KEY=${apiKey.trim()}

# Server Configuration
PORT=${port}

# Bot Configuration
PERSONAL_BOT_MODEL=${personalBotModel}
TATA_AIG_BOT_MODEL=${tataAigModel}

# Optional: Custom API Base URL (for Azure OpenAI or other providers)
# OPENAI_BASE_URL=https://your-custom-endpoint.com/v1
`;

    fs.writeFileSync('.env', envContent);
    
    console.log('\n✅ Configuration saved to .env file!');
    console.log('\n🚀 You can now start the application with:');
    console.log('   npm start');
    console.log('\n💡 The AI-powered A2A negotiation is ready!');
    console.log('   Your Personal Bot will use real AI to negotiate with TATA AIG Bot');
    console.log('\n🌐 Open http://localhost:' + port + ' in your browser');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setup();
