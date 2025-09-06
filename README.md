# 🤖 Agentic Chat Application

A sophisticated chat application featuring **real AI-powered Agent-to-Agent (A2A) communication** between a Personal Bot and TATA AIG Bot for intelligent insurance negotiations.

## ✨ Features

- **🧠 Real AI A2A Communication**: Powered by OpenAI GPT-4 for genuine negotiations
- **🤝 Smart Negotiations**: Personal Bot intelligently advocates for users
- **💬 Natural Conversations**: Both bots understand context and nuance
- **🔄 Dynamic Renegotiation**: AI-powered offer improvements based on feedback
- **📱 Telegram-like UI**: Modern, responsive chat interface
- **⚡ Real-time Chat**: WebSocket-powered instant messaging
- **🏢 Professional Insurance Logic**: Realistic policy offers and terms

## 🚀 Quick Start

### 1. Setup (First Time Only)
```bash
npm run setup
```
This will prompt you for your OpenAI API key and configure the application.

### 2. Start the Application
```bash
npm start
```

### 3. Open in Browser
```
http://localhost:3000
```

## 🔑 OpenAI API Key Setup

You'll need an OpenAI API key to enable real A2A communication:

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Run `npm run setup` and enter your key
3. The bots will now use real AI for negotiations!

## 🤖 How Real A2A Works

### Intelligent Agent Architecture

1. **User** → Sends natural language request
2. **Personal Bot (AI)** → Analyzes request using GPT-4, determines strategy
3. **Personal Bot ↔ TATA AIG Bot** → Real AI-to-AI negotiation
4. **TATA AIG Bot (AI)** → Uses company knowledge to create competitive offers
5. **Personal Bot (AI)** → Reviews offer, provides recommendations
6. **User** → Accepts or requests improvements
7. **Renegotiation Loop** → AI bots negotiate improved terms

### AI Capabilities

- **Context Understanding**: Bots remember conversation history
- **Intelligent Analysis**: Real understanding of insurance needs
- **Dynamic Pricing**: AI-generated competitive offers
- **Negotiation Strategy**: Personal Bot advocates for user interests
- **Adaptive Responses**: Learning from user feedback

## 💼 Insurance Types Supported

- 🚗 **Car Insurance**: Comprehensive coverage with AI-optimized rates
- 🏥 **Health Insurance**: Family plans with intelligent benefit selection
- 👨‍👩‍👧‍👦 **Life Insurance**: Term and whole life with AI risk assessment
- 🏠 **Home Insurance**: Property coverage with smart feature bundling

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, Socket.IO
- **AI Engine**: OpenAI GPT-4 for both bots
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Real-time**: WebSocket communication
- **Configuration**: Environment variables with dotenv

## ⚙️ Configuration

### Environment Variables (.env)
```bash
# Required
OPENAI_API_KEY=your_api_key_here

# Optional
PORT=3000
PERSONAL_BOT_MODEL=gpt-4
TATA_AIG_BOT_MODEL=gpt-4
OPENAI_BASE_URL=custom_endpoint  # For Azure OpenAI
```

### Bot Personalities

**Personal Bot**: 
- Friendly, conversational assistant
- Strong user advocacy
- Explains insurance concepts simply
- Remembers user preferences

**TATA AIG Bot**:
- Professional insurance representative
- Company knowledge and policies
- Competitive but fair in negotiations
- Realistic offers with genuine value

## 💬 Example Conversations

### Natural Language Input
```
"I need car insurance for my new Honda City, 
looking for comprehensive coverage under ₹15,000"
```

### AI Response Flow
1. **Personal Bot**: Understands specific needs
2. **A2A Negotiation**: Intelligent back-and-forth
3. **TATA AIG**: Creates tailored offer
4. **Personal Bot**: Recommends best option

## 🔄 Renegotiation Features

- **Smart Feedback**: AI understands specific improvement requests
- **Dynamic Offers**: Real-time offer adjustments
- **Context Retention**: Bots remember previous negotiations
- **User Advocacy**: Personal Bot pushes for better terms

## 📊 Demo Scenarios

### Quick Start Messages
- "I need comprehensive car insurance"
- "Looking for family health insurance"
- "Compare life insurance options"
- "I want better returns on my policy"

### Advanced Negotiations
- "The premium is too high, can you do better?"
- "I need higher coverage for the same price"
- "What additional benefits can you include?"

## 🚦 Installation & Development

### Prerequisites
- Node.js 16+ 
- OpenAI API key
- npm or yarn

### Installation
```bash
# Clone/navigate to directory
cd /path/to/agentic-ai

# Install dependencies
npm install

# Setup configuration
npm run setup

# Start development server
npm run dev
```

### Production Deployment
```bash
# Start production server
npm start

# Or with PM2
pm2 start server.js --name "agentic-chat"
```

## 🔒 Security & Privacy

- **API Key Protection**: Environment variables only
- **Input Sanitization**: XSS protection
- **Rate Limiting**: Prevents API abuse
- **Conversation Privacy**: No permanent storage of sensitive data

## 🎯 Performance

- **Real-time**: Sub-second AI responses
- **Scalable**: Handles multiple concurrent negotiations
- **Efficient**: Optimized API usage with context management
- **Responsive**: 60fps UI with smooth animations

## 🐛 Troubleshooting

### Common Issues

**"Invalid API Key"**
```bash
# Re-run setup with correct key
npm run setup
```

**"Negotiation Failed"**
- Check internet connection
- Verify OpenAI API quota
- Restart server

**"UI Not Loading"**
- Ensure port 3000 is available
- Check console for errors

### Debug Mode
```bash
# Enable detailed logging
DEBUG=* npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-ai-improvements`
3. Test with real API key
4. Commit changes: `git commit -am 'Enhanced AI negotiation'`
5. Push: `git push origin feature-ai-improvements`
6. Submit Pull Request

## 📝 API Usage Notes

- **Cost Optimization**: Conversations are context-managed
- **Model Selection**: Configure models per bot in .env
- **Rate Limits**: Built-in retry logic for API calls
- **Fallback Logic**: Graceful degradation if API fails

## 🎉 Ready for Real AI Demo!

Your agentic chat application now features **genuine AI-powered A2A communication**:

1. **Run Setup**: `npm run setup` (enter your OpenAI API key)
2. **Start Server**: `npm start`
3. **Open Browser**: `http://localhost:3000`
4. **Try Natural Requests**: "I need better car insurance deals"

The Personal Bot will use real AI to understand your needs, negotiate with the TATA AIG Bot (also AI-powered), and secure the best possible deals through intelligent A2A communication!

## 🔮 Advanced Features

- **Context Memory**: Bots remember your preferences
- **Multi-round Negotiation**: Complex back-and-forth discussions
- **Intelligent Renegotiation**: AI-driven offer improvements
- **Natural Language**: Speak naturally, AI understands intent

**Start your AI-powered negotiation experience now!** 🚀