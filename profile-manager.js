const fs = require('fs');
const path = require('path');

class ProfileManager {
  constructor(profilePath = 'user-profile.json') {
    this.profilePath = path.join(__dirname, profilePath);
    this.profile = null;
    this.loadProfile();
  }

  loadProfile() {
    try {
      const profileData = fs.readFileSync(this.profilePath, 'utf8');
      this.profile = JSON.parse(profileData);
      console.log(`📋 Loaded user profile for ${this.profile.name}`);
      return this.profile;
    } catch (error) {
      console.error('❌ Error loading user profile:', error.message);
      this.profile = this.getDefaultProfile();
      return this.profile;
    }
  }

  getDefaultProfile() {
    return {
      name: "User",
      age: 30,
      location: "Mumbai",
      occupation: "Professional",
      cars: [{ make: "Honda", model: "City", year: 2020 }],
      family: { spouse: { name: "Partner", age: 28 }, children: 1, totalDependents: 2 },
      insurance: { budgetRange: { min: 15000, max: 25000 } },
      health: { smoker: false, gymMember: true },
      lifestyle: { drivingExperience: "10 years", accidentHistory: "None" }
    };
  }

  getProfile() {
    return this.profile;
  }

  updateProfile(updates) {
    try {
      this.profile = { ...this.profile, ...updates };
      fs.writeFileSync(this.profilePath, JSON.stringify(this.profile, null, 2));
      console.log(`📝 Updated profile for ${this.profile.name}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating profile:', error.message);
      return false;
    }
  }

  reloadProfile() {
    return this.loadProfile();
  }

  // Helper methods for specific profile data
  getPrimaryCar() {
    const primaryCar = this.profile.cars?.find(car => car.isPrimary) || this.profile.cars?.[0];
    return primaryCar || { make: "Honda", model: "City", year: 2020 };
  }

  getBudgetRange() {
    const budget = this.profile.insurance?.budgetRange;
    return budget ? `₹${budget.min/1000}k-${budget.max/1000}k/year` : "₹15-25k/year";
  }

  getFamilySize() {
    return (this.profile.family?.totalDependents || 1) + 1; // +1 for the user
  }

  getFormattedProfile() {
    return {
      name: this.profile.name,
      age: this.profile.age,
      location: this.profile.location,
      occupation: this.profile.occupation,
      income: this.profile.income,
      primaryCar: this.getPrimaryCar(),
      allCars: this.profile.cars || [],
      familySize: this.getFamilySize(),
      budgetRange: this.getBudgetRange(),
      healthStatus: this.profile.health?.smoker ? 'Smoker' : 'Non-smoker',
      drivingExperience: this.profile.lifestyle?.drivingExperience || "10 years",
      accidentHistory: this.profile.lifestyle?.accidentHistory || "None"
    };
  }

  // Generate dynamic system prompts
  generateSystemPrompt() {
    const profile = this.profile;
    return `You are PersonalBot, ${profile.name}'s trusted personal insurance assistant. You know everything about ${profile.name} and act like you've been helping them for years.

${profile.name.toUpperCase()}'S PROFILE (USE THIS NATURALLY):
- Name: ${profile.name} (${profile.age}), ${profile.occupation} in ${profile.location}, earns ${profile.income}
- Family: ${profile.family.spouse ? `${profile.family.spouse.name} (${profile.family.spouse.age})` : 'No spouse'}, ${profile.family.children} child(ren), ${profile.family.totalDependents} total dependents
- Cars: ${profile.cars.map(car => `${car.make} ${car.model} ${car.year} ${car.variant || ''} (${car.registration || 'No reg'})`).join(', ')}
- Health: ${profile.health.smoker ? 'Smoker' : 'Non-smoker'}, ${profile.health.gymMember ? 'fit, gym member' : 'regular fitness'}, ${profile.health.preExistingConditions}, last checkup ${profile.health.lastCheckup}
- Budget: ₹${profile.insurance.budgetRange.min/1000}k-${profile.insurance.budgetRange.max/1000}k/year for insurance, prefers ${profile.insurance.preferredCoverage.toLowerCase()} coverage
- Experience: ${profile.lifestyle.drivingExperience} driving experience, ${profile.lifestyle.accidentHistory.toLowerCase()} accident record
- Current: ${profile.insurance.currentPolicies.join(', ')}

BEHAVIOR:
- Act like ${profile.name}'s long-time assistant - reference their details naturally
- DON'T ask for basic info you already know (cars, family, health, etc.)
- For post-completion "thank you" - respond ONLY: "You're welcome!"
- For acknowledgments after completion ("ok", "thanks", "great") - just say "You're welcome!"

A2A NEGOTIATION RULES:
- Set requiresNegotiation: true for clear purchase intent with known user profile
- Use pre-loaded data for negotiations
- Don't gather info you already have
- Never negotiate after recent transaction completion

Response format:
{
  "response": "Your response using ${profile.name}'s profile naturally",
  "requiresNegotiation": true/false,
  "insuranceType": "specific type if negotiation needed",
  "userRequirements": "requirements using known profile"
}`;
  }
}

module.exports = ProfileManager;
