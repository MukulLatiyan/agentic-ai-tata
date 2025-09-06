// Initialize Socket.IO connection
const socket = io();

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const charCount = document.getElementById('charCount');
const connectionStatus = document.getElementById('connectionStatus');
const negotiationIndicator = document.getElementById('negotiationIndicator');
const negotiationStep = document.getElementById('negotiationStep');
const offerModal = document.getElementById('offerModal');

// State
let currentOffer = null;
let isNegotiating = false;

// Socket Event Listeners
socket.on('connect', () => {
    updateConnectionStatus(true);
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    updateConnectionStatus(false);
    console.log('Disconnected from server');
});

socket.on('bot_message', (data) => {
    addMessage(data.message, 'bot', data.name, data.avatar, data.timestamp);
    
    // If this message contains an offer, show the modal
    if (data.offer) {
        currentOffer = {
            ...data.offer,
            negotiationId: data.negotiationId
        };
        showOfferModal(data.offer, data.message);
    }
    
    // If this message contains payment data, show payment modal
    if (data.paymentData) {
        showPaymentModal(data.paymentData);
    }
    
    // Hide negotiation indicator when bot responds
    if (isNegotiating) {
        hideNegotiationIndicator();
    }
});

socket.on('negotiation_update', (data) => {
    showNegotiationIndicator();
    updateNegotiationStep(data.message);
    isNegotiating = true;
});

socket.on('error', (data) => {
    addMessage(`❌ Error: ${data.message}`, 'bot', 'System', '⚠️');
});

// UI Functions
function updateConnectionStatus(connected) {
    const statusDot = connectionStatus.querySelector('.status-dot');
    const statusText = connectionStatus.querySelector('span');
    
    if (connected) {
        statusDot.style.background = '#4CAF50';
        statusText.textContent = 'Connected';
    } else {
        statusDot.style.background = '#f44336';
        statusText.textContent = 'Disconnected';
    }
}

function addMessage(message, type, botName = '', avatar = '', timestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let messageHTML = '';
    
    if (type === 'bot') {
        // Format the message for better display
        const formattedMessage = formatBotMessage(message);
        
        messageHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="bot-avatar">${avatar}</span>
                    <span class="bot-name">${botName}</span>
                </div>
                <div class="message-text">${formattedMessage}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    } else {
        messageHTML = `
            <div class="message-content">
                <div class="message-text">${escapeHtml(message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    
    messageDiv.innerHTML = messageHTML;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function formatBotMessage(message) {
    // Convert markdown-like formatting to HTML
    let formatted = escapeHtml(message);
    
    // Bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points
    formatted = formatted.replace(/^• (.*$)/gim, '<div style="margin: 0.25rem 0;">• $1</div>');
    
    // Convert line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showNegotiationIndicator() {
    negotiationIndicator.style.display = 'block';
    isNegotiating = true;
}

function hideNegotiationIndicator() {
    negotiationIndicator.style.display = 'none';
    isNegotiating = false;
}

function updateNegotiationStep(step) {
    negotiationStep.textContent = step;
}

function showOfferModal(offer, message) {
    const offerDetails = document.getElementById('offerDetails');
    
    // Extract insurance type from message - look for the pattern in the message
    const insuranceTypeMatch = message.match(/📋 \*\*(.*?)\*\*/);
    let insuranceType = insuranceTypeMatch ? insuranceTypeMatch[1] : 'Insurance Policy';
    
    // Replace "CAR INSURANCE" with "MotorCare"
    if (insuranceType.toUpperCase().includes('CAR')) {
        insuranceType = 'MotorCare';
    } else if (insuranceType.toUpperCase().includes('IMPROVED CAR')) {
        insuranceType = 'Enhanced MotorCare';
    }
    
    // Extract premium, coverage, and discount from the message to ensure accuracy
    const premiumMatch = message.match(/💰 Premium: ([^\n]+)/);
    const coverageMatch = message.match(/🛡️ Coverage: ([^\n]+)/);
    const discountMatch = message.match(/🎉 (?:Special Offer|Enhanced Offer): ([^\n]+)/);
    
    const premium = premiumMatch ? premiumMatch[1].trim() : offer.premium;
    const coverage = coverageMatch ? coverageMatch[1].trim() : offer.coverage;
    const discount = discountMatch ? discountMatch[1].trim() : offer.discount;
    
    // Extract features from message
    const featuresSection = message.match(/✨ \*\*(?:Key Features|Enhanced Features):\*\*\n((?:• .+\n?)+)/);
    let features = offer.features;
    
    if (featuresSection) {
        const featuresText = featuresSection[1];
        features = featuresText.split('\n')
            .filter(line => line.trim().startsWith('•'))
            .map(line => line.replace('•', '').trim())
            .filter(feature => feature.length > 0);
    }
    
    offerDetails.innerHTML = `
        <div class="offer-details">
            <div class="offer-header">
                <div class="offer-type">${insuranceType}</div>
            </div>
            
            <div class="offer-grid">
                <div class="offer-item">
                    <div class="offer-label">💰 Premium</div>
                    <div class="offer-value">${premium}</div>
                </div>
                <div class="offer-item">
                    <div class="offer-label">🛡️ Coverage</div>
                    <div class="offer-value">${coverage}</div>
                </div>
                <div class="offer-item">
                    <div class="offer-label">🎉 Special Offer</div>
                    <div class="offer-value">${discount}</div>
                </div>
            </div>
            
            <div class="offer-features">
                <h4>✨ Key Features</h4>
                <ul>
                    ${features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    
    offerModal.style.display = 'flex';
}

function closeOfferModal() {
    offerModal.style.display = 'none';
}

function acceptOffer() {
    socket.emit('accept_offer', { 
        offer: currentOffer,
        negotiationId: currentOffer?.negotiationId 
    });
    closeOfferModal();
    addMessage('✅ I accept this offer! Please proceed with the application.', 'user');
}

function rejectOffer() {
    // Close the offer modal first
    closeOfferModal();
    
    // Show custom renegotiation modal
    showRenegotiationModal();
}

function showRenegotiationModal() {
    const modalHtml = `
        <div class="modal-overlay" id="renegotiationModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔄 Renegotiate Offer</h3>
                    <button class="modal-close" onclick="closeRenegotiationModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>What specific improvements would you like me to negotiate for?</p>
                    <textarea id="renegotiationFeedback" placeholder="e.g., Lower premium, better coverage, more benefits, higher discount..." rows="4" style="width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 8px; font-family: inherit; resize: vertical;"></textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeRenegotiationModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="submitRenegotiation()">Renegotiate</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('renegotiationFeedback').focus();
}

function closeRenegotiationModal() {
    const modal = document.getElementById('renegotiationModal');
    if (modal) {
        modal.remove();
    }
}

function submitRenegotiation() {
    const feedback = document.getElementById('renegotiationFeedback').value.trim() || 'Better terms requested';
    
    socket.emit('reject_offer', { 
        offer: currentOffer,
        negotiationId: currentOffer?.negotiationId,
        feedback: feedback
    });
    
    closeRenegotiationModal();
    addMessage(`🔄 I'd like to renegotiate this offer. ${feedback}`, 'user');
}

// Message Sending
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Send to server
    socket.emit('user_message', {
        message: message,
        timestamp: new Date().toISOString()
    });
    
    // Clear input
    messageInput.value = '';
    updateCharCount();
    
    // Disable send button temporarily
    sendButton.disabled = true;
    setTimeout(() => {
        sendButton.disabled = false;
    }, 1000);
}

function sendQuickMessage(message) {
    messageInput.value = message;
    sendMessage();
}

function updateCharCount() {
    const count = messageInput.value.length;
    charCount.textContent = `${count}/500`;
    
    if (count > 450) {
        charCount.style.color = '#f44336';
    } else if (count > 400) {
        charCount.style.color = '#ff9800';
    } else {
        charCount.style.color = '#666';
    }
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', updateCharCount);

// Close modal when clicking outside
offerModal.addEventListener('click', (e) => {
    if (e.target === offerModal) {
        closeOfferModal();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape' && offerModal.style.display === 'flex') {
        closeOfferModal();
    }
    
    // Focus input with Ctrl/Cmd + K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        messageInput.focus();
    }
});

// Auto-focus input on page load
window.addEventListener('load', () => {
    messageInput.focus();
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible, check connection
        if (!socket.connected) {
            socket.connect();
        }
    }
});

// Payment Modal Functions
function showPaymentModal(paymentData) {
    const modalHtml = `
        <div class="modal-overlay" id="paymentModal" style="display: flex;">
            <div class="modal-content payment-modal">
                <div class="modal-header">
                    <h3>💳 Secure Payment</h3>
                    <button class="modal-close" onclick="closePaymentModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="payment-details">
                        <h4>Payment Summary</h4>
                        <div class="payment-info">
                            <div class="payment-item">
                                <span class="label">Amount:</span>
                                <span class="value">${paymentData.amount}</span>
                            </div>
                            <div class="payment-item">
                                <span class="label">Policy Term:</span>
                                <span class="value">${paymentData.term}</span>
                            </div>
                            <div class="payment-item">
                                <span class="label">Due Date:</span>
                                <span class="value">${paymentData.dueDate}</span>
                            </div>
                            <div class="payment-item">
                                <span class="label">Transaction ID:</span>
                                <span class="value">${paymentData.transactionId}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="payment-form">
                        <h4>Payment Method</h4>
                        <div class="credit-card-form">
                            <div class="form-group">
                                <label>Card Number</label>
                                <input type="text" id="cardNumber" value="4532 1234 5678 9012" readonly>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Expiry</label>
                                    <input type="text" id="cardExpiry" value="12/25" readonly>
                                </div>
                                <div class="form-group">
                                    <label>CVV</label>
                                    <input type="text" id="cardCvv" value="123" readonly>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Cardholder Name</label>
                                <input type="text" id="cardName" value="JOHN SMITH" readonly>
                            </div>
                        </div>
                    </div>
                    
                    <div class="payment-security">
                        <div class="security-badges">
                            <span class="badge">🔒 SSL Secured</span>
                            <span class="badge">✅ PCI Compliant</span>
                            <span class="badge">🛡️ Bank Grade Security</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closePaymentModal()">Cancel</button>
                    <button class="btn btn-primary payment-btn" onclick="processPayment('${paymentData.paymentId}', '${paymentData.transactionId}')">
                        💳 Pay ${paymentData.amount}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.remove();
    }
}

function processPayment(paymentId, transactionId) {
    // Show processing state
    const paymentBtn = document.querySelector('.payment-btn');
    paymentBtn.innerHTML = '⏳ Processing...';
    paymentBtn.disabled = true;
    
    // Simulate payment processing
    setTimeout(() => {
        socket.emit('payment_completed', {
            paymentId: paymentId,
            transactionId: transactionId,
            status: 'success'
        });
        
        closePaymentModal();
        addMessage('✅ Payment completed successfully! Processing policy documents...', 'user');
    }, 2000);
}

// Initialize
updateCharCount();
console.log('🚀 Agentic Chat App initialized');
