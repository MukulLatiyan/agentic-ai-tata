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
const ClaimsAgent = require('./claims-agent');
const HealthCheckupAgent = require('./health-checkup-agent');

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

// Initialize services
const tataAigDataService = new TataAigDataService();
const profileManager = new ProfileManager();
const claimsAgent = new ClaimsAgent();
const healthCheckupAgent = new HealthCheckupAgent();
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
    
    // Generate dynamic system prompt for service-focused bot
    this.systemPrompt = `You are PersonalBot, ${userProfile.name}'s trusted insurance service assistant. You help with policy queries, claims processing, and health services.

${userProfile.name.toUpperCase()}'S CURRENT POLICIES:
- Health Insurance: ${userProfile.insurance.healthInsurance.policyNumber} (Coverage: ${userProfile.insurance.healthInsurance.coverage})
- Life Insurance: ${userProfile.insurance.lifeInsurance.policyNumber} (Coverage: ${userProfile.insurance.lifeInsurance.coverage})
- Motor Insurance (Honda City): ${userProfile.cars[0].insuranceDetails.policyNumber}
- Motor Insurance (Swift): ${userProfile.cars[1].insuranceDetails.policyNumber}

CORE SERVICES:
1. 📋 POLICY INFORMATION: Answer questions about existing policy benefits, coverage, terms, and conditions
2. 🚨 CLAIMS PROCESSING: File and track insurance claims (health/motor/life) - requires A2A with Claims Agent
3. 🩺 HEALTH CHECKUP BOOKING: Schedule health checkups through TATA 1mg - requires A2A with Health Agent
4. 💬 GENERAL SUPPORT: Answer general insurance questions and provide guidance

SERVICE ROUTING RULES:
- Policy benefit/coverage questions → serviceType: "policy_info", requiresA2A: false (handle directly)
- Claim filing/processing → serviceType: "claims", requiresA2A: true (initiate A2A with Claims Agent)
  * Health claims: "I need to file a health insurance claim", "medical claim", "hospital bill claim"
  * Motor claims: "car accident claim", "vehicle damage claim", "motor insurance claim"
  * Life claims: "life insurance claim"
- Health checkup booking → serviceType: "health_checkup", requiresA2A: true (initiate A2A with TATA 1mg Agent)
- General questions → serviceType: "general", requiresA2A: false (handle directly)

BEHAVIOR GUIDELINES:
- Act as a knowledgeable service agent who knows all policy details
- For policy queries, provide specific information from their actual policies
- For thank you messages after service completion, respond: "You're welcome!"
- If specific policy details are missing, provide helpful general information and offer to find more details
- ONLY use A2A for claims processing and health checkup booking

Response format:
{
  "response": "Your helpful response with specific information",
  "serviceType": "policy_info|claims|health_checkup|general",
  "requiresA2A": true/false,
  "serviceDetails": "specific details about the service needed - for claims include keywords like 'health', 'motor', 'car', 'medical', 'hospital', etc."
}`;
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
          name: 'process_service_request',
          description: 'Process user service request and determine what type of service is needed',
          parameters: {
            type: 'object',
            properties: {
              response: { type: 'string', description: 'Your response to the user' },
              serviceType: { type: 'string', enum: ['policy_info', 'claims', 'health_checkup', 'general'], description: 'Type of service needed' },
              requiresA2A: { type: 'boolean', description: 'Whether A2A communication is needed' },
              serviceDetails: { type: 'string', description: 'Details about the service needed' }
            },
            required: ['response', 'serviceType', 'requiresA2A']
          }
        }],
        function_call: { name: 'process_service_request' }
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
      if (insuranceType && insuranceType.toLowerCase().includes('car')) {
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
        serviceType: personalBotResponse.serviceType,
        requiresA2A: personalBotResponse.requiresA2A,
        serviceDetails: personalBotResponse.serviceDetails,
        isRecentTransaction: isRecentTransaction,
        hasRecentCompletion: hasRecentCompletion,
        isProceedingMessage: isProceedingMessage
      });

      // Handle A2A only for claims and health checkups
      if (personalBotResponse.requiresA2A && !isRecentTransaction && !hasRecentCompletion) {
        const serviceId = uuidv4();
        
        if (personalBotResponse.serviceType === 'claims') {
          console.log('✅ Claims A2A triggered');
          const claimDetails = {
            claimType: personalBotResponse.serviceDetails || message,
            amount: '50000',
            description: personalBotResponse.serviceDetails || message,
            originalMessage: message
          };
          await handleClaimsA2A(socket, serviceId, claimDetails, userProfile);
          
        } else if (personalBotResponse.serviceType === 'health_checkup') {
          console.log('✅ Health Checkup A2A triggered');
          await handleHealthCheckupA2A(socket, serviceId, personalBotResponse.serviceDetails, userProfile);
          
        } else {
          console.log('⚠️ Unknown A2A service type:', personalBotResponse.serviceType);
        }
      } else {
        console.log('⏸️ A2A not triggered:', {
          serviceType: personalBotResponse.serviceType,
          requiresA2A: personalBotResponse.requiresA2A,
          isRecentTransaction,
          hasRecentCompletion,
          reason: !personalBotResponse.requiresA2A ? 'No A2A needed' :
                  isRecentTransaction ? 'Recent transaction completed' :
                  hasRecentCompletion ? 'Recent completion detected' :
                  'Service handled directly'
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { message: 'Sorry, something went wrong. Please try again.' });
    }
  });

  // Removed old insurance purchase handlers (accept_offer, reject_offer, payment_completed)
  // Since we've moved to service-focused A2A for claims and health checkups only

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

// A2A Handler Functions
async function handleClaimsA2A(socket, serviceId, serviceDetails, userProfile) {
  try {
    socket.emit('negotiation_start', { serviceId, serviceType: 'claims' });
    
    setTimeout(async () => {
      const claimsResult = await claimsAgent.processClaimRequest(
        serviceDetails.claimType, 
        serviceDetails, 
        userProfile
      );

      // Show claims processing steps
      if (claimsResult && claimsResult.claimProcessingSteps) {
        for (let i = 0; i < claimsResult.claimProcessingSteps.length; i++) {
          setTimeout(() => {
            socket.emit('negotiation_update', {
              step: i + 1,
              message: claimsResult.claimProcessingSteps[i],
              timestamp: new Date().toISOString()
            });
          }, (i + 1) * 800);
        }
      }

      // Send claims result
      setTimeout(() => {
        socket.emit('negotiation_complete', { serviceId });
        
        if (claimsResult && claimsResult.claimId) {
          const nextStepsText = claimsResult.assessment?.nextSteps?.length 
            ? claimsResult.assessment.nextSteps.map(step => `• ${step}`).join('\n')
            : '• Please contact customer support for further assistance';
            
          socket.emit('bot_message', {
            bot: 'claims_agent',
            message: `📋 **Claim ${claimsResult.status}**\n\n**Claim ID:** ${claimsResult.claimId}\n**Status:** ${claimsResult.status}\n**Assessment:** ${claimsResult.assessment?.reason || 'Claim processed'}\n\n**Next Steps:**\n${nextStepsText}`,
            claimData: claimsResult,
            avatar: claimsAgent.avatar,
            name: claimsAgent.name
          });

          setTimeout(() => {
            socket.emit('bot_message', {
              bot: 'personal',
              message: `I've processed your claim request with our Claims Agent. Your claim ID is ${claimsResult.claimId}. Is there anything else you need help with?`,
              avatar: personalBot.avatar,
              name: personalBot.name
            });
          }, 2000);
        } else {
          socket.emit('bot_message', {
            bot: 'personal',
            message: `I encountered an issue processing your claim. Please try again or contact customer support.`,
            avatar: personalBot.avatar,
            name: personalBot.name
          });
        }
      }, (claimsResult?.claimProcessingSteps?.length || 3) * 800 + 500);
    }, 2000);
  } catch (error) {
    console.error('Claims A2A Error:', error);
  }
}

async function handleHealthCheckupA2A(socket, serviceId, serviceDetails, userProfile) {
  try {
    socket.emit('negotiation_start', { serviceId, serviceType: 'health_checkup' });
    
    setTimeout(async () => {
      const checkupResult = await healthCheckupAgent.processHealthCheckupRequest(
        serviceDetails.requestType || 'general_checkup',
        userProfile,
        userProfile.preferences
      );

      // Show health checkup processing steps
      for (let i = 0; i < checkupResult.checkupProcessingSteps.length; i++) {
        setTimeout(() => {
          socket.emit('negotiation_update', {
            step: i + 1,
            message: checkupResult.checkupProcessingSteps[i],
            timestamp: new Date().toISOString()
          });
        }, (i + 1) * 800);
      }

      // Send health checkup result
      setTimeout(() => {
        socket.emit('negotiation_complete', { serviceId });
        
        const recommendation = checkupResult.recommendation;
        socket.emit('bot_message', {
          bot: 'health_agent',
          message: `🩺 **Health Checkup Recommendation**\n\n**Package:** ${recommendation.packageDetails.name}\n**Price:** ₹${recommendation.discountedCost.finalPrice} (${recommendation.discountedCost.discountReasons.join(', ')})\n**Tests:** ${recommendation.packageDetails.tests.slice(0, 3).join(', ')}${recommendation.packageDetails.tests.length > 3 ? '...' : ''}\n**Duration:** ${recommendation.packageDetails.duration}\n\n**Available Slots:**\n${checkupResult.availableSlots.slice(0, 3).map(slot => `• ${slot.day}, ${slot.date} at ${slot.time}`).join('\n')}`,
          checkupData: checkupResult,
          avatar: healthCheckupAgent.avatar,
          name: healthCheckupAgent.name
        });

        setTimeout(() => {
          socket.emit('bot_message', {
            bot: 'personal',
            message: `I've found great health checkup options for you! The ${recommendation.packageDetails.name} seems perfect based on your age and health profile. Would you like me to book an appointment?`,
            avatar: personalBot.avatar,
            name: personalBot.name
          });
        }, 2000);
      }, checkupResult.checkupProcessingSteps.length * 800 + 500);
    }, 2000);
  } catch (error) {
    console.error('Health Checkup A2A Error:', error);
  }
}

// Removed handlePurchaseA2A since we're no longer handling insurance purchases

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Agentic Chat Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to start chatting`);
});
