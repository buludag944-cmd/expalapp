/** Full user object for API responses and auth (keep in sync with /api/profile). */
function serializeUserProfile(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isAdmin: !!user.isAdmin,
    nationality: user.nationality,
    currentCity: user.currentCity,
    company: user.company,
    interests: user.interests,
    industry: user.industry,
    bio: user.bio,
    profileImage: user.profileImage,
    profession: user.profession,
    professionCategory: user.professionCategory,
    homeCountry: user.homeCountry,
    destinationCountry: user.destinationCountry,
    destinationCity: user.destinationCity,
    moveDate: user.moveDate,
    arrivalDate: user.arrivalDate,
    visaType: user.visaType,
    employerName: user.employerName,
    employmentStatus: user.employmentStatus,
    familyStatus: user.familyStatus,
    phase: user.phase || "relocation",
    onboardingComplete: !!user.onboardingComplete,
    concerns: user.concerns,
    isMentor: !!user.isMentor,
    mentorVerified: !!user.mentorVerified,
    availabilityForMentorCalls: !!user.availabilityForMentorCalls,
    languages: user.languages,
    previousCountries: user.previousCountries,
    profilePublic: user.profilePublic !== false,
    lifeAbroadScore: user.lifeAbroadScore || 0,
    languageMilestone: user.languageMilestone || 0,
  };
}

module.exports = { serializeUserProfile };
