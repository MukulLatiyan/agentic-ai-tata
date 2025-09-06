const { v4: uuidv4 } = require('uuid');

class HealthCheckupAgent {
  constructor() {
    this.name = "TATA 1mg Health Checkup Agent";
    this.avatar = "🩺";
    this.model = 'gpt-4';
    
    this.systemPrompt = `You are a TATA 1mg Health Checkup Booking Agent. Your role is to:

1. Help users book comprehensive health checkups
2. Recommend appropriate health packages based on user profile
3. Schedule appointments at convenient times and locations
4. Coordinate with diagnostic centers and labs
5. Provide pre and post checkup guidance

HEALTH CHECKUP SERVICES:
- Basic Health Checkup (₹999)
- Comprehensive Health Checkup (₹2,499)
- Executive Health Checkup (₹4,999)
- Cardiac Health Package (₹3,499)
- Diabetes Care Package (₹1,899)
- Women's Health Package (₹2,999)
- Senior Citizen Package (₹3,999)

AVAILABLE TIME SLOTS:
- Morning: 7:00 AM - 11:00 AM (Fasting tests preferred)
- Afternoon: 2:00 PM - 5:00 PM
- Evening: 6:00 PM - 8:00 PM

LOCATIONS IN MUMBAI:
- Bandra West, Andheri East, Powai, Thane, Navi Mumbai

Always recommend packages based on user's age, health history, and insurance coverage.`;

    this.healthPackages = {
      basic: {
        name: "Basic Health Checkup",
        price: 999,
        tests: ["Complete Blood Count", "Lipid Profile", "Blood Sugar", "Kidney Function", "Liver Function"],
        duration: "2-3 hours",
        fasting: "10-12 hours",
        reportTime: "24 hours"
      },
      comprehensive: {
        name: "Comprehensive Health Checkup",
        price: 2499,
        tests: ["Complete Blood Count", "Lipid Profile", "Diabetes Panel", "Thyroid Profile", "Vitamin Profile", "ECG", "Chest X-Ray", "Ultrasound Abdomen"],
        duration: "3-4 hours",
        fasting: "10-12 hours",
        reportTime: "48 hours"
      },
      executive: {
        name: "Executive Health Checkup",
        price: 4999,
        tests: ["All Comprehensive tests", "Stress Test", "Echo Cardiography", "CT Scan", "Advanced Cancer Markers", "Pulmonary Function Test"],
        duration: "4-5 hours",
        fasting: "10-12 hours",
        reportTime: "72 hours"
      },
      cardiac: {
        name: "Cardiac Health Package",
        price: 3499,
        tests: ["ECG", "Echo Cardiography", "Stress Test", "Lipid Profile", "Cardiac Markers", "Chest X-Ray"],
        duration: "3 hours",
        fasting: "6 hours",
        reportTime: "48 hours"
      },
      diabetes: {
        name: "Diabetes Care Package",
        price: 1899,
        tests: ["HbA1c", "Fasting & PP Blood Sugar", "Insulin Levels", "Kidney Function", "Eye Examination", "Foot Examination"],
        duration: "2-3 hours",
        fasting: "10-12 hours",
        reportTime: "24 hours"
      }
    };

    this.availableSlots = this.generateAvailableSlots();
  }

  generateAvailableSlots() {
    const slots = [];
    const today = new Date();
    
    // Generate slots for next 14 days
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Morning slots (better for fasting tests)
      slots.push({
        date: dateStr,
        day: dayName,
        time: "7:00 AM",
        available: Math.random() > 0.3,
        type: "morning"
      });
      slots.push({
        date: dateStr,
        day: dayName,
        time: "9:00 AM",
        available: Math.random() > 0.4,
        type: "morning"
      });
      
      // Afternoon slots
      slots.push({
        date: dateStr,
        day: dayName,
        time: "2:00 PM",
        available: Math.random() > 0.5,
        type: "afternoon"
      });
      slots.push({
        date: dateStr,
        day: dayName,
        time: "4:00 PM",
        available: Math.random() > 0.6,
        type: "afternoon"
      });
      
      // Evening slots
      slots.push({
        date: dateStr,
        day: dayName,
        time: "6:00 PM",
        available: Math.random() > 0.4,
        type: "evening"
      });
    }
    
    return slots;
  }

  async processHealthCheckupRequest(requestType, userProfile, preferences = {}) {
    try {
      const bookingId = `HC${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      const checkupProcessingSteps = [
        'Analyzing health profile and requirements...',
        'Checking available health packages...',
        'Coordinating with diagnostic centers...',
        'Checking available time slots...',
        'Confirming appointment details...',
        'Generating booking confirmation...'
      ];

      const recommendation = this.recommendHealthPackage(userProfile, preferences);
      const availableSlots = this.getAvailableSlots(preferences);
      
      return {
        bookingId,
        checkupProcessingSteps,
        recommendation,
        availableSlots,
        locations: this.getNearbyLocations(userProfile.location),
        nextSteps: [
          'Select preferred health package',
          'Choose convenient date and time',
          'Confirm booking and make payment',
          'Receive appointment confirmation'
        ]
      };
    } catch (error) {
      console.error('Health checkup booking error:', error);
      return {
        bookingId: `HC${Date.now()}`,
        checkupProcessingSteps: ['Error processing health checkup request...'],
        recommendation: null,
        error: 'Technical error occurred'
      };
    }
  }

  recommendHealthPackage(userProfile, preferences) {
    const age = userProfile.age;
    const healthHistory = userProfile.health;
    const familyHistory = healthHistory.familyMedicalHistory || '';
    
    let recommendedPackage = 'basic';
    let reasons = [];

    // Age-based recommendations
    if (age >= 40) {
      recommendedPackage = 'comprehensive';
      reasons.push('Comprehensive screening recommended for age 40+');
    }
    
    if (age >= 50) {
      recommendedPackage = 'executive';
      reasons.push('Executive package recommended for age 50+ with advanced screenings');
    }

    // Health history based recommendations
    if (familyHistory.toLowerCase().includes('diabetes')) {
      if (recommendedPackage === 'basic') recommendedPackage = 'diabetes';
      reasons.push('Diabetes screening recommended due to family history');
    }
    
    if (familyHistory.toLowerCase().includes('heart') || healthHistory.cholesterol === 'high') {
      if (recommendedPackage === 'basic') recommendedPackage = 'cardiac';
      reasons.push('Cardiac screening recommended due to family history');
    }

    // Lifestyle based recommendations
    if (healthHistory.smoker || userProfile.lifestyle.stressLevel === 'High') {
      recommendedPackage = 'comprehensive';
      reasons.push('Comprehensive screening recommended due to lifestyle factors');
    }

    const packageDetails = this.healthPackages[recommendedPackage];
    
    return {
      packageType: recommendedPackage,
      packageDetails: packageDetails,
      reasons: reasons,
      insuranceCoverage: this.checkInsuranceCoverage(userProfile.insurance, packageDetails.price),
      totalCost: packageDetails.price,
      discountedCost: this.calculateDiscount(packageDetails.price, userProfile)
    };
  }

  checkInsuranceCoverage(insurance, packageCost) {
    const healthInsurance = insurance.healthInsurance;
    if (healthInsurance && healthInsurance.features.includes('Annual health checkup')) {
      return {
        covered: true,
        coverageAmount: Math.min(packageCost, 5000), // Typical coverage limit
        message: 'Health checkup covered under your insurance policy'
      };
    }
    return {
      covered: false,
      message: 'Health checkup not covered, full payment required'
    };
  }

  calculateDiscount(originalPrice, userProfile) {
    let discount = 0;
    let discountReasons = [];
    
    // First time user discount
    discount += originalPrice * 0.15; // 15% first time discount
    discountReasons.push('15% first-time user discount');
    
    // Insurance holder discount
    if (userProfile.insurance.healthInsurance) {
      discount += originalPrice * 0.10; // 10% insurance holder discount
      discountReasons.push('10% insurance holder discount');
    }
    
    return {
      originalPrice,
      discount: Math.round(discount),
      finalPrice: originalPrice - Math.round(discount),
      discountReasons
    };
  }

  getAvailableSlots(preferences = {}) {
    let filteredSlots = this.availableSlots.filter(slot => slot.available);
    
    // Filter by preferred time if specified
    if (preferences.preferredTime) {
      const timeType = preferences.preferredTime.toLowerCase();
      filteredSlots = filteredSlots.filter(slot => slot.type === timeType);
    }
    
    // Filter by preferred days if specified
    if (preferences.preferredDays && preferences.preferredDays.length > 0) {
      filteredSlots = filteredSlots.filter(slot => 
        preferences.preferredDays.includes(slot.day)
      );
    }
    
    return filteredSlots.slice(0, 10); // Return top 10 available slots
  }

  getNearbyLocations(userLocation) {
    const allLocations = [
      {
        name: "TATA 1mg Diagnostics - Bandra West",
        address: "Shop No. 3, Hill Road, Bandra West, Mumbai - 400050",
        distance: "5.2 km",
        facilities: ["Parking Available", "AC Waiting Area", "Online Reports"]
      },
      {
        name: "TATA 1mg Diagnostics - Andheri East",
        address: "Chakala, Andheri East, Mumbai - 400099",
        distance: "12.8 km",
        facilities: ["Home Collection", "Weekend Availability", "Express Reports"]
      },
      {
        name: "TATA 1mg Diagnostics - Powai",
        address: "Hiranandani Gardens, Powai, Mumbai - 400076",
        distance: "15.3 km",
        facilities: ["Premium Center", "Specialist Consultations", "Same Day Reports"]
      }
    ];
    
    // Sort by distance (simulated based on user location)
    return allLocations.sort((a, b) => 
      parseFloat(a.distance) - parseFloat(b.distance)
    );
  }

  async confirmBooking(bookingDetails) {
    const confirmationId = `CONF${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    return {
      confirmationId,
      bookingId: bookingDetails.bookingId,
      packageName: bookingDetails.packageName,
      appointmentDate: bookingDetails.date,
      appointmentTime: bookingDetails.time,
      location: bookingDetails.location,
      totalAmount: bookingDetails.amount,
      paymentStatus: 'Confirmed',
      instructions: [
        `Fast for ${bookingDetails.fastingHours} hours before the appointment`,
        'Carry a valid photo ID',
        'Bring insurance card if applicable',
        'Arrive 15 minutes before appointment time',
        'Wear comfortable clothing'
      ],
      contact: {
        phone: '1800-1mg-1mg',
        email: 'support@1mg.com',
        whatsapp: '+91-8800-1mg-1mg'
      },
      reportDelivery: {
        method: 'Email + Physical Copy',
        timeline: bookingDetails.reportTime,
        trackingUrl: `https://1mg.com/reports/${confirmationId}`
      }
    };
  }
}

module.exports = HealthCheckupAgent;
