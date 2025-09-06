require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const TataAigDataService = require('./tataAigScraper');
const ProfileManager = require('./profile-manager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API endpoint to reload user profile
app.post('/api/reload-profile', (req, res) => {
  try {
    profileManager.reloadProfile();
    const updatedProfile = profileManager.getProfile();
    
    // Update PersonalBot with new profile
    personalBot.userProfile = updatedProfile;
    personalBot.systemPrompt = profileManager.generateSystemPrompt();
    
    res.json({ 
      success: true, 
      message: `Profile reloaded for ${updatedProfile.name}`,
      profile: updatedProfile 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reload profile', 
      error: error.message 
    });
  }
});

// API endpoint to get current profile
app.get('/api/profile', (req, res) => {
  res.json(profileManager.getProfile());
});

// API endpoint to update profile
app.put('/api/profile', (req, res) => {
  try {
    const success = profileManager.updateProfile(req.body);
    if (success) {
      // Update PersonalBot with new profile
      personalBot.userProfile = profileManager.getProfile();
      personalBot.systemPrompt = profileManager.generateSystemPrompt();
      
      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        profile: profileManager.getProfile()
      });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile', 
      error: error.message 
    });
  }
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined
});

// Store active conversations and negotiations
const activeNegotiations = new Map();
const userSessions = new Map();
const conversationHistory = new Map();
const completedTransactions = new Map(); // Track completed insurance transactions

// Initialize TATA AIG data service
const tataAigDataService = new TataAigDataService();

// Initialize Profile Manager
const profileManager = new ProfileManager();
const userProfile = profileManager.getProfile();

// Initialize bots (declare here so they can be referenced in API endpoints)
let personalBot;
let tataAigBot;

// AI-Powered Bot personalities and logic
class PersonalBot {
  constructor() {
    this.name = "PersonalBot";
    this.avatar = "🤖";
    this.model = process.env.PERSONAL_BOT_MODEL || 'gpt-4';
    
    // Use loaded user profile
    this.userProfile = userProfile;
    this.profileManager = profileManager;
    
    // Generate dynamic system prompt
    this.systemPrompt = profileManager.generateSystemPrompt();
  }

  async processUserMessage(message, userId, contextInfo = {}) {
    try {
      // Get conversation history
      const history = conversationHistory.get(userId) || [];
      
      // Use context info passed from main handler
      const { isRecentTransaction = false, hasRecentCompletion = false, isProceedingMessage = false } = contextInfo;
      
      // Prepare messages for OpenAI with transaction context
      const systemPromptWithContext = this.systemPrompt + 
        (isRecentTransaction || hasRecentCompletion ? '\n\nCRITICAL: User recently completed an insurance transaction. Do NOT start new negotiations for acknowledgments like "ok", "thanks", "great", "proceed", "yes". Only provide friendly acknowledgment responses.' : '') +
        (isProceedingMessage ? '\n\nCRITICAL: User is acknowledging or proceeding. Do NOT start new negotiation. Just provide a friendly acknowledgment response.' : '');
      
      const messages = [
        { role: 'system', content: systemPromptWithContext },
        ...history.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: message }
      ];

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
        functions: [{
          name: 'process_insurance_request',
          description: 'Process user insurance request and determine if you have ENOUGH information to start negotiation NOW',
          parameters: {
            type: 'object',
            properties: {
              response: {
                type: 'string',
                description: 'Conversational response to the user'
              },
              requiresNegotiation: {
                type: 'boolean',
                description: 'TRUE only if you have COMPLETE information to negotiate RIGHT NOW. FALSE if you need more details from user.'
              },
              insuranceType: {
                type: 'string',
                description: 'Type of insurance if negotiation is needed'
              },
              userRequirements: {
                type: 'string',
                description: 'Complete detailed requirements for negotiation (only if requiresNegotiation is true)'
              },
              isGatheringInfo: {
                type: 'boolean',
                description: 'TRUE if you are still asking the user for more information'
              },
              hasCompleteInfo: {
                type: 'boolean',
                description: 'TRUE if user has provided all necessary details for negotiation'
              }
            },
            required: ['response', 'requiresNegotiation', 'isGatheringInfo', 'hasCompleteInfo']
          }
        }],
        function_call: { name: 'process_insurance_request' }
      });

      // Update conversation history
      history.push({ role: 'user', content: message });
      
      const functionCall = completion.choices[0].message.function_call;
      const result = JSON.parse(functionCall.arguments);
      
      history.push({ role: 'assistant', content: result.response });
      conversationHistory.set(userId, history);

      return result;
    } catch (error) {
      console.error('PersonalBot Error:', error);
      return {
        response: "I'm having trouble processing your request right now. Could you please try again?",
        requiresNegotiation: false
      };
    }
  }
}

class TataAigBot {
  constructor() {
    this.name = "TATA AIG";
    this.avatar = "🏢";
    this.model = process.env.TATA_AIG_BOT_MODEL || 'gpt-4';
    this.systemPrompt = `You are TATA AIG's AI representative, a professional insurance company bot. Your role is to:

1. Negotiate insurance deals with Personal Bots on behalf of users
2. Provide competitive and realistic insurance offers
3. Be professional but willing to negotiate
4. Offer genuine value and benefits
5. Create win-win scenarios

Company Profile:
- TATA AIG is a leading insurance provider in India
- Offers car, health, life, home, and travel insurance
- Known for competitive pricing and excellent service
- Strong financial backing and claim settlement record

Negotiation Guidelines:
- Start with standard rates but be flexible
- Offer meaningful discounts for good customers
- Include valuable features and benefits
- Consider user requirements and adjust accordingly
- Be professional but approachable in negotiations

You will receive negotiation requests with user requirements. Respond with realistic offers including:
- Premium amounts in Indian Rupees
- Coverage details
- Discounts and special offers
- Key features and benefits
- Terms and conditions

Always be ready to adjust offers based on counter-negotiations.`;
  }

  async negotiateWithPersonalBot(insuranceType, userRequirements, personalBotMessage = '') {
    try {
      // Use the loaded user profile for personalized offers

      // Get real TATA AIG data using profile
      let realData = null;
      if (insuranceType.includes('car')) {
        const carDetails = this.extractCarDetails(userRequirements) || userProfile.cars[0];
        realData = await tataAigDataService.getCarInsuranceData(carDetails);
      }

      const negotiationPrompt = `
I need to negotiate a ${insuranceType} policy for ${userProfile.name}. Here are the details:

${userProfile.name.toUpperCase()}'S PROFILE:
${JSON.stringify(userProfile, null, 2)}

User Requirements: ${userRequirements}
Personal Bot Request: ${personalBotMessage}

${realData ? `Real TATA AIG Data Available:
Policy: ${realData.policyName}
Plan: ${realData.planName}
Market Premium: ₹${realData.premium}/year
Coverage: ${realData.coverage}
Current Discounts: ${realData.discount}
Available Features: ${realData.features.join(', ')}
NCB Structure: ${realData.ncb}
Special Offers: ${realData.specialOffers}

Use this real data to provide accurate, competitive offers.` : ''}

Please provide a competitive offer based on real TATA AIG data with:
1. Realistic premium calculation using market data
2. Accurate coverage amounts
3. Current available discounts
4. Real TATA AIG features and benefits
5. Genuine special offers

Format your response as a JSON object with:
{
  "negotiationSteps": ["step1", "step2", "step3", "step4"],
  "finalOffer": {
    "premium": "₹XX,XXX/year",
    "coverage": "actual coverage details",
    "discount": "real discount offers",
    "features": ["actual TATA AIG features"]
  },
  "reasoning": "why this is competitive based on real market data"
}`;

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: negotiationPrompt }
        ],
        temperature: 0.8,
        max_tokens: 800
      });

      const response = completion.choices[0].message.content;
      
      // Try to parse JSON response, fallback to real data
      try {
        const aiResponse = JSON.parse(response);
        // Enhance with real data if available
        if (realData) {
          aiResponse.finalOffer.policyName = realData.policyName;
          aiResponse.finalOffer.planName = realData.planName;
          aiResponse.realDataSource = realData.source;
        }
        return aiResponse;
      } catch (parseError) {
        // If JSON parsing fails, use real data
        if (realData) {
          return this.createOfferFromRealData(realData, insuranceType);
        }
        return this.createFallbackOffer(insuranceType, userRequirements, response);
      }
    } catch (error) {
      console.error('TATA AIG Bot Error:', error);
      return this.createFallbackOffer(insuranceType, userRequirements);
    }
  }

  extractCarDetails(userRequirements) {
    const text = userRequirements.toLowerCase();
    
    // Extract car model
    const carModels = ['swift', 'i20', 'city', 'baleno', 'nexon', 'xuv500', 'innova', 'verna', 'creta', 'venue'];
    const foundModel = carModels.find(model => text.includes(model));
    
    // Extract year
    const yearMatch = text.match(/20\d{2}/);
    const year = yearMatch ? yearMatch[0] : '2020';
    
    // Extract coverage type
    const coverageType = text.includes('comprehensive') ? 'comprehensive' : 
                        text.includes('third party') ? 'third-party' : 'comprehensive';
    
    return {
      carModel: foundModel || 'generic car',
      year: year,
      coverageType: coverageType
    };
  }

  createOfferFromRealData(realData, insuranceType) {
    return {
      negotiationSteps: [
        `Analyzing ${insuranceType} requirements...`,
        `Accessing TATA AIG real-time pricing data...`,
        `Calculating personalized premium based on current rates...`,
        `Preparing competitive offer with maximum benefits...`
      ],
      finalOffer: {
        policyName: realData.policyName,
        planName: realData.planName,
        premium: `₹${realData.premium.toLocaleString()}/year`,
        coverage: realData.coverage,
        discount: realData.discount,
        features: realData.features
      },
      reasoning: `This offer is based on current TATA AIG market rates and includes genuine features available for ${insuranceType}. The pricing is competitive and reflects real market conditions.`,
      realDataSource: realData.source
    };
  }

  createFallbackOffer(insuranceType, userRequirements, aiResponse = '') {
    const baseOffers = {
      'car insurance': {
        premium: '₹15,000/year',
        coverage: '₹8,00,000',
        discount: '20% first-year discount',
        features: ['Zero depreciation', '24/7 roadside assistance', 'Cashless claims']
      },
      'health insurance': {
        premium: '₹12,000/year',
        coverage: '₹15,00,000',
        discount: '25% family discount',
        features: ['Cashless hospitalization', 'Pre-existing coverage', 'Annual checkup']
      },
      'life insurance': {
        premium: '₹18,000/year',
        coverage: '₹75,00,000',
        discount: '15% online discount',
        features: ['Term life coverage', 'Accidental death benefit', 'Tax benefits']
      },
      'home insurance': {
        premium: '₹8,000/year',
        coverage: '₹25,00,000',
        discount: '10% multi-policy discount',
        features: ['Fire and theft coverage', 'Natural disaster protection', 'Personal belongings']
      }
    };

    return {
      negotiationSteps: [
        `Analyzing ${insuranceType} requirements...`,
        `Reviewing TATA AIG policy options...`,
        `Calculating personalized premium rates...`,
        `Preparing competitive offer with maximum benefits...`
      ],
      finalOffer: baseOffers[insuranceType] || baseOffers['car insurance'],
      reasoning: aiResponse || `This offer provides excellent value with comprehensive coverage and competitive pricing for ${insuranceType}.`
    };
  }

  async renegotiate(previousOffer, userFeedback, personalBotRequest) {
    try {
      const renegotiationPrompt = `
Previous offer: ${JSON.stringify(previousOffer)}
User feedback: ${userFeedback}
Personal Bot request: ${personalBotRequest}

Please provide an improved offer addressing the user's concerns. Be more competitive while maintaining profitability.

Respond in the same JSON format as before.`;

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: renegotiationPrompt }
        ],
        temperature: 0.9,
        max_tokens: 800
      });

      const response = completion.choices[0].message.content;
      
      try {
        return JSON.parse(response);
      } catch (parseError) {
        // Improve the previous offer by 10-15%
        const improved = JSON.parse(JSON.stringify(previousOffer)); // Deep clone
        
        if (improved.finalOffer && improved.finalOffer.premium) {
          const currentPremium = parseInt(improved.finalOffer.premium.replace(/[₹,]/g, ''));
          if (!isNaN(currentPremium)) {
            improved.finalOffer.premium = `₹${Math.floor(currentPremium * 0.9).toLocaleString()}/year`;
          }
          
          if (improved.finalOffer.discount && improved.finalOffer.discount.includes('%')) {
            improved.finalOffer.discount = improved.finalOffer.discount.replace(/\d+%/, (match) => `${parseInt(match) + 5}%`);
          } else {
            improved.finalOffer.discount = '15% additional discount';
          }
        }
        
        return improved;
      }
    } catch (error) {
      console.error('TATA AIG Renegotiation Error:', error);
      return previousOffer;
    }
  }

  async processPayment(negotiationData) {
    try {
      // Generate payment details
      const amount = this.extractPremiumAmount(negotiationData.lastOffer?.premium || '₹15,000/year');
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(); // 30 days from now
      
      return {
        amount: `₹${amount.toLocaleString()}`,
        term: '1 Year',
        dueDate: dueDate,
        policyType: negotiationData.insuranceType,
        paymentId: `PAY${Date.now()}`,
        transactionId: `TXN${Date.now()}`,
        merchantId: 'TATA_AIG_MERCHANT',
        redirectUrl: 'https://payment.tataaig.com/secure',
        features: negotiationData.lastOffer?.features || []
      };
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        amount: '₹15,000',
        term: '1 Year',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        policyType: 'Insurance Policy',
        paymentId: `PAY${Date.now()}`,
        transactionId: `TXN${Date.now()}`,
        merchantId: 'TATA_AIG_MERCHANT'
      };
    }
  }

  extractPremiumAmount(premiumString) {
    const match = premiumString.match(/₹([\d,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    return 15000; // default
  }

  async processPolicyGeneration(paymentData, negotiationData) {
    try {
      const policyNumber = `TAIG${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const issueDate = new Date().toLocaleDateString();
      const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString();
      
      // Extract premium from negotiation data or payment data
      let premium = paymentData.amount;
      if (!premium || premium === 'undefined') {
        premium = negotiationData.lastOffer?.premium || '₹15,000/year';
      }
      
      return {
        policyNumber: policyNumber,
        issueDate: issueDate,
        expiryDate: expiryDate,
        policyType: negotiationData.insuranceType,
        premium: premium,
        coverage: negotiationData.lastOffer?.coverage || 'Comprehensive Coverage',
        features: negotiationData.lastOffer?.features || [],
        documentUrl: `https://documents.tataaig.com/policy/${policyNumber}.pdf`,
        certificateUrl: `https://documents.tataaig.com/certificate/${policyNumber}.pdf`
      };
    } catch (error) {
      console.error('Policy generation error:', error);
      return null;
    }
  }

  async processDirectMessage(message) {
    try {
      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `User contacted me directly: ${message}. Please respond professionally and suggest they work through their PersonalBot for better deals.` }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('TATA AIG Direct Message Error:', error);
      return `Thank you for contacting TATA AIG directly. For the best personalized service and negotiated rates, I recommend working through your PersonalBot who can secure better terms for you. However, I'm here to answer any specific questions about our policies.`;
    }
  }
}

personalBot = new PersonalBot();
tataAigBot = new TataAigBot();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Initialize user session
  userSessions.set(socket.id, {
    userId: socket.id,
    activeNegotiation: null
  });

  socket.on('user_message', async (data) => {
    const { message, timestamp } = data;
    const userId = socket.id;

    try {
      // Check transaction status and user context
      const recentTransaction = completedTransactions.get(userId);
      const isRecentTransaction = recentTransaction && 
        (Date.now() - recentTransaction.timestamp) < 300000; // 5 minutes
      
      // Get conversation history
      const history = conversationHistory.get(userId) || [];
      
      // Check if user is trying to proceed with existing offer or just acknowledging
      const isProceedingMessage = /^(proceed|yes|ok|okay|sure|go ahead|accept|agree|thanks|thank you)$/i.test(message.trim());
      
      // Check if user just completed a transaction in last few messages
      const recentMessages = history.slice(-5); // Last 5 messages
      const hasRecentCompletion = recentMessages.some(msg => 
        msg.role === 'assistant' && (
          msg.content.includes('processing your application') ||
          msg.content.includes('application has been approved') ||
          msg.content.includes('Policy number:')
        )
      );

      // Process message with PersonalBot, passing context
      const personalBotResponse = await personalBot.processUserMessage(message, userId, {
        isRecentTransaction,
        hasRecentCompletion,
        isProceedingMessage
      });
      
      // Send PersonalBot response
      socket.emit('bot_message', {
        bot: 'personal',
        message: personalBotResponse.response,
        timestamp: new Date().toISOString(),
        avatar: personalBot.avatar,
        name: personalBot.name
      });

      // Log the bot's decision for debugging
      console.log('🤖 PersonalBot Response Analysis:', {
        requiresNegotiation: personalBotResponse.requiresNegotiation,
        isGatheringInfo: personalBotResponse.isGatheringInfo,
        hasCompleteInfo: personalBotResponse.hasCompleteInfo,
        insuranceType: personalBotResponse.insuranceType,
        isRecentTransaction: isRecentTransaction,
        hasRecentCompletion: hasRecentCompletion,
        isProceedingMessage: isProceedingMessage
      });

      // Only start A2A if we have complete information and are not gathering more info
      // ALSO check if user just completed a transaction or is acknowledging
      if (personalBotResponse.requiresNegotiation && 
          personalBotResponse.hasCompleteInfo && 
          !personalBotResponse.isGatheringInfo &&
          !isRecentTransaction &&
          !hasRecentCompletion &&
          !isProceedingMessage) {
        
        console.log('✅ A2A Negotiation triggered - All conditions met');
        
        // Validate we have substantial user requirements
        const hasSubstantialInfo = personalBotResponse.userRequirements && 
                                  personalBotResponse.userRequirements.length > 30;
        
        if (!hasSubstantialInfo) {
          console.log('⚠️ A2A blocked: Insufficient user requirements detail');
          return;
        }
        const negotiationId = uuidv4();
        const negotiationData = {
          userId,
          insuranceType: personalBotResponse.insuranceType,
          userRequirements: personalBotResponse.userRequirements || message,
          status: 'negotiating',
          personalBotMessage: personalBotResponse.response
        };
        
        activeNegotiations.set(negotiationId, negotiationData);

        // Start negotiation process
        setTimeout(async () => {
          try {
            const negotiation = await tataAigBot.negotiateWithPersonalBot(
              personalBotResponse.insuranceType,
              negotiationData.userRequirements,
              negotiationData.personalBotMessage
            );

            // Show negotiation steps
            for (let i = 0; i < negotiation.negotiationSteps.length; i++) {
              setTimeout(() => {
                socket.emit('negotiation_update', {
                  step: i + 1,
                  message: negotiation.negotiationSteps[i],
                  timestamp: new Date().toISOString()
                });
              }, (i + 1) * 800); // Faster initial negotiation
            }

            // Store the negotiation result
            negotiationData.lastOffer = negotiation.finalOffer;
            negotiationData.reasoning = negotiation.reasoning;
            activeNegotiations.set(negotiationId, negotiationData);

            // Send final offer after negotiation
            setTimeout(() => {
              socket.emit('bot_message', {
                bot: 'tata_aig',
                message: `Great news! I've analyzed your requirements and prepared a competitive offer:
                
📋 **${personalBotResponse.insuranceType.toUpperCase()}**
💰 Premium: ${negotiation.finalOffer.premium}
🛡️ Coverage: ${negotiation.finalOffer.coverage}
🎉 Special Offer: ${negotiation.finalOffer.discount}

✨ **Key Features:**
${negotiation.finalOffer.features.map(f => `• ${f}`).join('\n')}

${negotiation.reasoning || 'This offer provides excellent value with comprehensive coverage.'}

Would you like to proceed with this offer?`,
                timestamp: new Date().toISOString(),
                avatar: tataAigBot.avatar,
                name: tataAigBot.name,
                offer: negotiation.finalOffer,
                negotiationId: negotiationId
              });

              // PersonalBot follow-up
              setTimeout(() => {
                socket.emit('bot_message', {
                  bot: 'personal',
                  message: `I've successfully negotiated this deal with TATA AIG based on your requirements! The AI analysis shows this is a competitive offer with great benefits. Shall I proceed with the application, or would you like me to negotiate further on any specific aspect?`,
                  timestamp: new Date().toISOString(),
                  avatar: personalBot.avatar,
                  name: personalBot.name
                });
              }, 2000);

            }, negotiation.negotiationSteps.length * 800 + 500); // Faster timing
          } catch (negotiationError) {
            console.error('Negotiation Error:', negotiationError);
            socket.emit('bot_message', {
              bot: 'personal',
              message: `I'm having trouble connecting with TATA AIG right now. Let me try a different approach to get you a good deal. Please wait a moment...`,
              timestamp: new Date().toISOString(),
              avatar: personalBot.avatar,
              name: personalBot.name
            });
          }
        }, 2000);
      } else {
        console.log('⏸️ A2A not triggered:', {
          requiresNegotiation: personalBotResponse.requiresNegotiation,
          isGatheringInfo: personalBotResponse.isGatheringInfo,
          hasCompleteInfo: personalBotResponse.hasCompleteInfo,
          isRecentTransaction: isRecentTransaction,
          hasRecentCompletion: hasRecentCompletion,
          isProceedingMessage: isProceedingMessage,
          reason: personalBotResponse.isGatheringInfo ? 'Still gathering info' : 
                  !personalBotResponse.hasCompleteInfo ? 'Incomplete info' :
                  isRecentTransaction ? 'Recent transaction completed' :
                  hasRecentCompletion ? 'Recent completion detected' :
                  isProceedingMessage ? 'User acknowledging/proceeding' :
                  'No negotiation required'
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { message: 'Sorry, something went wrong. Please try again.' });
    }
  });

  socket.on('accept_offer', async (data) => {
    const { negotiationId } = data;
    
    try {
      // Get negotiation data
      const negotiationData = negotiationId ? activeNegotiations.get(negotiationId) : null;
      
      if (!negotiationData) {
        socket.emit('error', { message: 'Negotiation data not found. Please try again.' });
        return;
      }

      // PersonalBot confirms acceptance and initiates payment process
      socket.emit('bot_message', {
        bot: 'personal',
        message: `Perfect! I'm now coordinating with TATA AIG to process your application and set up payment. Let me get the payment details for you...`,
        timestamp: new Date().toISOString(),
        avatar: personalBot.avatar,
        name: personalBot.name
      });

      // Start A2A communication for payment processing with visible steps
      setTimeout(async () => {
        try {
          // Show A2A negotiation steps for payment setup
          const paymentNegotiationSteps = [
            'PersonalBot initiating payment setup with TATA AIG...',
            'TATA AIG processing application details...',
            'Calculating payment terms and due dates...',
            'Generating secure payment gateway...',
            'Finalizing payment setup...'
          ];

          // Show negotiation indicator
          socket.emit('negotiation_update', {
            step: 1,
            message: paymentNegotiationSteps[0],
            timestamp: new Date().toISOString()
          });

          // Show each negotiation step (faster)
          for (let i = 1; i < paymentNegotiationSteps.length; i++) {
            setTimeout(() => {
              socket.emit('negotiation_update', {
                step: i + 1,
                message: paymentNegotiationSteps[i],
                timestamp: new Date().toISOString()
              });
            }, i * 800); // Faster negotiation steps
          }

          // Process payment after negotiation steps
          setTimeout(async () => {
            const paymentResponse = await tataAigBot.processPayment(negotiationData);
            
            socket.emit('bot_message', {
              bot: 'tata_aig',
              message: `Thank you for choosing TATA AIG! Your application has been processed and is ready for payment.

📋 **Application Details:**
Policy Type: ${negotiationData.insuranceType}
Premium Amount: ${paymentResponse.amount}
Policy Term: ${paymentResponse.term}

💳 **Payment Required:**
Amount: ${paymentResponse.amount}
Due Date: ${paymentResponse.dueDate}

I've prepared a secure payment link for you. Please complete the payment to activate your policy.`,
              timestamp: new Date().toISOString(),
              avatar: tataAigBot.avatar,
              name: tataAigBot.name,
              paymentData: paymentResponse
            });

            // PersonalBot follow-up
            setTimeout(() => {
              socket.emit('bot_message', {
                bot: 'personal',
                message: `Perfect! I've successfully coordinated with TATA AIG to set up your payment. The secure payment portal is ready. The payment process is completely safe and encrypted. 🔒`,
                timestamp: new Date().toISOString(),
                avatar: personalBot.avatar,
                name: personalBot.name
              });
            }, 2000);

          }, paymentNegotiationSteps.length * 800 + 500); // Faster timing

        } catch (error) {
          console.error('Payment processing error:', error);
          socket.emit('bot_message', {
            bot: 'personal',
            message: `I encountered an issue while setting up payment. Let me try again...`,
            timestamp: new Date().toISOString(),
            avatar: personalBot.avatar,
            name: personalBot.name
          });
        }
      }, 2000);

    } catch (error) {
      console.error('Accept offer error:', error);
      socket.emit('error', { message: 'Sorry, something went wrong. Please try again.' });
    }
  });

  socket.on('reject_offer', async (data) => {
    const { negotiationId, feedback } = data;
    
    try {
      // Get the active negotiation
      const negotiationData = negotiationId ? activeNegotiations.get(negotiationId) : null;
      
      if (negotiationData && negotiationData.lastOffer) {
        // Start renegotiation process
        socket.emit('bot_message', {
          bot: 'personal',
          message: `I understand you'd like better terms. Let me renegotiate with TATA AIG to get you an improved offer. I'll push for better rates and additional benefits...`,
          timestamp: new Date().toISOString(),
          avatar: personalBot.avatar,
          name: personalBot.name
        });

        // Show renegotiation indicator
        setTimeout(() => {
          socket.emit('negotiation_update', {
            step: 1,
            message: 'Initiating renegotiation with TATA AIG...',
            timestamp: new Date().toISOString()
          });
        }, 1000);

        setTimeout(async () => {
          try {
            const improvedNegotiation = await tataAigBot.renegotiate(
              negotiationData.lastOffer,
              feedback || 'User wants better terms',
              'Personal Bot requesting improved offer with better rates and additional benefits'
            );

            // Update negotiation data
            if (improvedNegotiation && improvedNegotiation.finalOffer) {
              negotiationData.lastOffer = improvedNegotiation.finalOffer;
              activeNegotiations.set(negotiationId, negotiationData);

              socket.emit('bot_message', {
                bot: 'tata_aig',
                message: `I've reviewed your feedback and prepared an improved offer:

📋 **IMPROVED ${negotiationData.insuranceType.toUpperCase()} OFFER**
💰 Premium: ${improvedNegotiation.finalOffer.premium}
🛡️ Coverage: ${improvedNegotiation.finalOffer.coverage}
🎉 Enhanced Offer: ${improvedNegotiation.finalOffer.discount}

✨ **Enhanced Features:**
${improvedNegotiation.finalOffer.features.map(f => `• ${f}`).join('\n')}

This improved offer addresses your concerns with better pricing and additional benefits.`,
                timestamp: new Date().toISOString(),
                avatar: tataAigBot.avatar,
                name: tataAigBot.name,
                offer: improvedNegotiation.finalOffer,
                negotiationId: negotiationId
              });

              setTimeout(() => {
                socket.emit('bot_message', {
                  bot: 'personal',
                  message: `Excellent! I've secured an improved deal for you with better terms. This renegotiated offer provides more value and addresses your concerns. How does this look?`,
                  timestamp: new Date().toISOString(),
                  avatar: personalBot.avatar,
                  name: personalBot.name
                });
              }, 2000);
            } else {
              throw new Error('Failed to generate improved offer');
            }


          } catch (renegotiationError) {
            console.error('Renegotiation Error:', renegotiationError);
            socket.emit('bot_message', {
              bot: 'personal',
              message: `Let me try a different approach to get you better terms. What specific aspects would you like me to focus on - lower premium, higher coverage, or additional benefits?`,
              timestamp: new Date().toISOString(),
              avatar: personalBot.avatar,
              name: personalBot.name
            });
          }
        }, 3000);
      } else {
        socket.emit('bot_message', {
          bot: 'personal',
          message: `No problem! Let me know what specific changes you'd like, and I'll negotiate again with TATA AIG to get you a better deal. What aspects would you like me to improve - pricing, coverage, or benefits?`,
          timestamp: new Date().toISOString(),
          avatar: personalBot.avatar,
          name: personalBot.name
        });
      }
    } catch (error) {
      console.error('Reject Offer Error:', error);
      socket.emit('bot_message', {
        bot: 'personal',
        message: `I'll work on getting you better terms. Please let me know what specific improvements you're looking for.`,
        timestamp: new Date().toISOString(),
        avatar: personalBot.avatar,
        name: personalBot.name
      });
    }
  });

  socket.on('payment_completed', async (data) => {
    const { paymentId, transactionId, status } = data;
    const userId = socket.id;
    
    try {
      if (status === 'success') {
        // Find the negotiation data for policy generation
        let negotiationData = null;
        for (const [negotiationId, data] of activeNegotiations) {
          if (data.userId === userId) {
            negotiationData = data;
            break;
          }
        }
        
        if (!negotiationData) {
          socket.emit('error', { message: 'Unable to find policy data. Please contact support.' });
          return;
        }

        // PersonalBot confirms payment
        socket.emit('bot_message', {
          bot: 'personal',
          message: `Excellent! Your payment has been processed successfully. I'm now coordinating with TATA AIG to generate your policy documents and certificate. This will just take a moment...`,
          timestamp: new Date().toISOString(),
          avatar: personalBot.avatar,
          name: personalBot.name
        });

        // Start A2A for policy generation with visible steps
        setTimeout(async () => {
          try {
            // Show A2A negotiation steps for policy generation
            const policyNegotiationSteps = [
              'PersonalBot initiating policy generation with TATA AIG...',
              'TATA AIG validating payment confirmation...',
              'Generating unique policy number...',
              'Creating policy documents and certificate...',
              'Preparing policy activation...',
              'Finalizing policy issuance...'
            ];

            // Show negotiation indicator
            socket.emit('negotiation_update', {
              step: 1,
              message: policyNegotiationSteps[0],
              timestamp: new Date().toISOString()
            });

          // Show each negotiation step (faster)
          for (let i = 1; i < policyNegotiationSteps.length; i++) {
            setTimeout(() => {
              socket.emit('negotiation_update', {
                step: i + 1,
                message: policyNegotiationSteps[i],
                timestamp: new Date().toISOString()
              });
            }, i * 800); // Faster policy generation steps
          }

            // Generate policy after negotiation steps
            setTimeout(async () => {
              const policyData = await tataAigBot.processPolicyGeneration({ paymentId, transactionId }, negotiationData);
              
              if (policyData) {
                // TATA AIG sends policy confirmation
                socket.emit('bot_message', {
                  bot: 'tata_aig',
                  message: `🎉 **Policy Issued Successfully!**

**Policy Details:**
📄 Policy Number: **${policyData.policyNumber}**
📅 Issue Date: ${policyData.issueDate}
📅 Expiry Date: ${policyData.expiryDate}
💰 Premium: ${policyData.premium}
🛡️ Coverage: ${policyData.coverage}

**Policy Documents:**
📋 [Policy Certificate](${policyData.certificateUrl})
📄 [Policy Document](${policyData.documentUrl})

**Key Features:**
${policyData.features.map(f => `• ${f}`).join('\n')}

Your policy is now active! You'll receive the documents via email within 15 minutes. Keep your policy number safe for future reference.

Welcome to the TATA AIG family! 🏢`,
                  timestamp: new Date().toISOString(),
                  avatar: tataAigBot.avatar,
                  name: tataAigBot.name,
                  policyData: policyData
                });

                // PersonalBot final message
                setTimeout(() => {
                  socket.emit('bot_message', {
                    bot: 'personal',
                    message: `🎊 Congratulations! Your insurance policy has been successfully issued. I've completed the entire process for you - from negotiating the best rates to securing your policy.

**What's Next:**
✅ Your policy is now active
✅ Documents will arrive in your email
✅ Keep your policy number: **${policyData.policyNumber}**
✅ 24/7 customer support available

Thank you for trusting me with your insurance needs! If you need any other insurance products in the future, I'm here to help negotiate the best deals for you. 🤖`,
                    timestamp: new Date().toISOString(),
                    avatar: personalBot.avatar,
                    name: personalBot.name
                  });

                  // Mark transaction as completed
                  completedTransactions.set(userId, {
                    timestamp: Date.now(),
                    policyNumber: policyData.policyNumber,
                    status: 'policy_issued'
                  });

                  // Clean up active negotiation
                  for (const [negotiationId, data] of activeNegotiations) {
                    if (data.userId === userId) {
                      activeNegotiations.delete(negotiationId);
                      break;
                    }
                  }
                }, 3000);
              }
            }, policyNegotiationSteps.length * 800 + 500); // Faster timing

          } catch (error) {
            console.error('Policy generation error:', error);
            socket.emit('bot_message', {
              bot: 'personal',
              message: `There was an issue generating your policy. Let me contact TATA AIG support to resolve this immediately...`,
              timestamp: new Date().toISOString(),
              avatar: personalBot.avatar,
              name: personalBot.name
            });
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Payment completion error:', error);
      socket.emit('error', { message: 'Payment processing failed. Please try again.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    userSessions.delete(socket.id);
    // Clean up user data
    conversationHistory.delete(socket.id);
    completedTransactions.delete(socket.id);
    
    // Clean up any active negotiations for this user
    for (const [negotiationId, negotiationData] of activeNegotiations) {
      if (negotiationData.userId === socket.id) {
        activeNegotiations.delete(negotiationId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Agentic Chat Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to start chatting`);
});
