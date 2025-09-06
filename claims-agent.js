const { v4: uuidv4 } = require('uuid');

class ClaimsAgent {
  constructor() {
    this.name = "TATA AIG Claims Agent";
    this.avatar = "🏥";
    this.model = 'gpt-4';
    
    this.systemPrompt = `You are a TATA AIG Claims Processing Agent. Your role is to:

1. Process insurance claims efficiently and fairly
2. Verify claim eligibility based on policy terms
3. Request necessary documentation
4. Provide claim status updates
5. Coordinate with hospitals and service providers

CLAIMS PROCESSING GUIDELINES:
- Always verify policy validity and coverage
- Check for waiting periods and exclusions
- Request proper documentation (bills, reports, photos)
- Provide clear timelines for claim processing
- Be empathetic but follow policy guidelines strictly
- Coordinate with network hospitals for cashless claims

CLAIM TYPES YOU HANDLE:
- Health insurance claims (hospitalization, OPD, medicines)
- Motor insurance claims (accident, theft, damage)
- Life insurance claims (death, critical illness, disability)

Always be professional, empathetic, and solution-oriented while adhering to policy terms.`;
  }

  async processClaimRequest(claimType, claimDetails, userProfile) {
    try {
      const claimId = `CLM${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      // Determine relevant policy based on claim type
      let relevantPolicy = null;
      const claimTypeStr = (claimType || '').toLowerCase();
      const descriptionStr = (claimDetails.description || '').toLowerCase();
      const originalMessageStr = (claimDetails.originalMessage || '').toLowerCase();
      
      // Check all sources for claim type keywords
      const combinedText = `${claimTypeStr} ${descriptionStr} ${originalMessageStr}`;
      
      if (combinedText.includes('health') || combinedText.includes('medical') || combinedText.includes('hospital')) {
        relevantPolicy = userProfile.insurance.healthInsurance;
      } else if (combinedText.includes('motor') || combinedText.includes('car') || combinedText.includes('vehicle') || combinedText.includes('accident')) {
        relevantPolicy = userProfile.cars.find(car => 
          claimDetails.registration?.includes(car.registration) || 
          claimDetails.carModel?.toLowerCase().includes(car.model.toLowerCase())
        )?.insuranceDetails || userProfile.cars[0]?.insuranceDetails; // Default to first car if no specific match
      } else if (combinedText.includes('life')) {
        relevantPolicy = userProfile.insurance.lifeInsurance;
      }

      const claimProcessingSteps = [
        'Receiving claim request...',
        'Verifying policy details and coverage...',
        'Checking eligibility and waiting periods...',
        'Validating submitted documents...',
        'Processing claim assessment...',
        'Finalizing claim approval...'
      ];

      const claimAssessment = await this.assessClaim(claimType, claimDetails, relevantPolicy, userProfile);
      
      return {
        claimId,
        claimProcessingSteps,
        assessment: claimAssessment,
        status: claimAssessment.approved ? 'Approved' : 'Under Review',
        nextSteps: claimAssessment.nextSteps
      };
    } catch (error) {
      console.error('Claims processing error:', error);
      return {
        claimId: `CLM${Date.now()}`,
        claimProcessingSteps: ['Error processing claim...'],
        assessment: { approved: false, reason: 'Technical error occurred' },
        status: 'Error',
        nextSteps: ['Please contact customer support']
      };
    }
  }

  async assessClaim(claimType, claimDetails, policy, userProfile) {
    // Simulate intelligent claim assessment
    const assessment = {
      approved: false,
      amount: 0,
      reason: '',
      requiredDocuments: [],
      nextSteps: []
    };

    if (!policy) {
      assessment.reason = 'No valid policy found for this claim type';
      assessment.nextSteps = ['Please verify your policy details'];
      return assessment;
    }

    // Check policy validity with proper date handling
    const currentDate = new Date();
    const policyEndDate = new Date(policy.validTill);
    
    // For health insurance, be more lenient with date checking
    if (claimType.includes('health')) {
      // Always proceed with health claims if policy exists - let detailed assessment handle validity
      return this.assessHealthClaim(claimDetails, policy, userProfile, assessment);
    } else {
      // For other policies, check expiry strictly
      if (currentDate > policyEndDate) {
        assessment.reason = 'Policy has expired';
        assessment.nextSteps = ['Please renew your policy to proceed with claims'];
        return assessment;
      }
    }

    // Assess based on claim type
    if (claimType.includes('motor')) {
      return this.assessMotorClaim(claimDetails, policy, userProfile, assessment);
    } else if (claimType.includes('life')) {
      return this.assessLifeClaim(claimDetails, policy, userProfile, assessment);
    }

    return assessment;
  }

  assessHealthClaim(claimDetails, policy, userProfile, assessment) {
    const claimAmount = parseInt(claimDetails.amount?.replace(/[^\d]/g, '') || '0');
    const coverageLimit = parseInt(policy.coverage?.replace(/[^\d]/g, '') || '0');
    
    // Check policy validity for health claims specifically
    const currentDate = new Date();
    const policyEndDate = new Date(policy.validTill);
    
    if (currentDate > policyEndDate) {
      assessment.approved = false;
      assessment.reason = 'Health claim under process';
      assessment.nextSteps = ['Please renew your health insurance policy to proceed with claims', 'We will keep you posted on renewal options'];
      return assessment;
    }
    
    // Policy is valid - proceed with assessment
    assessment.reason = 'Health claim under process';
    
    // Check coverage limit
    if (claimAmount > coverageLimit) {
      assessment.approved = false;
      assessment.reason = `Health claim under process - Claim amount (₹${claimAmount.toLocaleString()}) exceeds policy coverage (${policy.coverage})`;
      assessment.nextSteps = ['Consider partial settlement up to policy limit', 'We will keep you posted on the claim status'];
      return assessment;
    }

    // Check if hospital is in network
    const networkHospital = userProfile.health.preferredHospitals.some(hospital => 
      claimDetails.hospital?.toLowerCase().includes(hospital.toLowerCase())
    );

    assessment.approved = true;
    assessment.amount = claimAmount;
    assessment.reason = 'Health claim under process';
    assessment.requiredDocuments = [
      'Hospital discharge summary',
      'Medical bills and receipts',
      'Diagnostic reports',
      'Doctor\'s prescription',
      'Insurance card copy'
    ];
    
    if (networkHospital) {
      assessment.nextSteps = [
        'Cashless claim approved',
        'Hospital will receive direct payment',
        'Claim will be settled within 3-5 working days',
        'We will keep you posted on the settlement progress'
      ];
    } else {
      assessment.nextSteps = [
        'Reimbursement claim approved',
        'Submit original bills for processing',
        'Amount will be credited within 7-10 working days',
        'We will keep you posted on the claim status and settlement'
      ];
    }

    return assessment;
  }

  assessMotorClaim(claimDetails, policy, userProfile, assessment) {
    const claimAmount = parseInt(claimDetails.amount?.replace(/[^\d]/g, '') || '0');
    const idv = parseInt(policy.coverage?.replace(/[^\d]/g, '') || '0');
    
    // Check if comprehensive or third party
    if (policy.policyType.includes('Third Party') && claimDetails.claimType !== 'third-party') {
      assessment.approved = false;
      assessment.reason = 'Own damage not covered under Third Party policy';
      assessment.nextSteps = ['Consider upgrading to Comprehensive coverage'];
      return assessment;
    }

    assessment.approved = true;
    assessment.amount = Math.min(claimAmount, idv);
    assessment.reason = 'Motor claim approved based on policy terms';
    assessment.requiredDocuments = [
      'FIR copy (if applicable)',
      'Driving license copy',
      'RC copy',
      'Repair estimates',
      'Photos of damage',
      'Insurance policy copy'
    ];
    assessment.nextSteps = [
      'Visit authorized garage for repair',
      'Claim will be settled directly with garage',
      'Estimated settlement time: 5-7 working days'
    ];

    return assessment;
  }

  assessLifeClaim(claimDetails, policy, userProfile, assessment) {
    // Life insurance claims require detailed verification
    assessment.approved = false; // Default to manual review
    assessment.reason = 'Life insurance claims require detailed verification';
    assessment.requiredDocuments = [
      'Death certificate (original)',
      'Medical reports',
      'Police report (if applicable)',
      'Nominee identification proof',
      'Policy bond original',
      'Claim form duly filled'
    ];
    assessment.nextSteps = [
      'Submit all required documents',
      'Claim will be reviewed by underwriting team',
      'Verification process may take 15-30 days',
      'Our team will contact you for any additional requirements'
    ];

    return assessment;
  }

  generateClaimSummary(claimData) {
    return {
      claimId: claimData.claimId,
      status: claimData.status,
      amount: claimData.assessment.amount,
      estimatedSettlement: this.getSettlementTimeline(claimData.assessment),
      contactInfo: {
        phone: '1800-266-7780',
        email: 'claims@tataaig.com',
        chatSupport: '24/7 available'
      }
    };
  }

  getSettlementTimeline(assessment) {
    if (assessment.approved) {
      return assessment.nextSteps.find(step => step.includes('days')) || '7-10 working days';
    }
    return 'Pending approval';
  }
}

module.exports = ClaimsAgent;
