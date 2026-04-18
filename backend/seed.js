const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Question = require("./models/Question");

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/surveyDB";

const sampleQuestions = [
  {
    key: "p1_role",
    code: "P1",
    section: "profile",
    prompt: "Your current role:",
    type: "single-choice",
    options: [
      { value: "founder_ceo", label: "Founder / CEO" },
      { value: "c_suite", label: "COO / CFO / CTO / C-suite" },
      { value: "vp_director", label: "VP / Director" },
      { value: "other_senior_leader", label: "Other senior leader" },
    ],
    required: true,
    order: 1,
  },
  {
    key: "p2_company_size",
    code: "P2",
    section: "profile",
    prompt: "Company size (headcount):",
    type: "single-choice",
    options: [
      { value: "under_50", label: "Under 50" },
      { value: "50_200", label: "50-200" },
      { value: "200_1000", label: "200-1,000" },
      { value: "1000_plus", label: "1,000+" },
    ],
    required: true,
    order: 2,
  },
  {
    key: "p3_industry",
    code: "P3",
    section: "profile",
    prompt: "Primary industry:",
    type: "single-choice",
    options: [
      { value: "technology_saas", label: "Technology / SaaS" },
      { value: "financial_services", label: "Financial services / Fintech" },
      { value: "healthcare", label: "Healthcare / Life sciences" },
      { value: "manufacturing", label: "Manufacturing / Industrial" },
      {
        value: "professional_services",
        label: "Professional services / Consulting",
      },
      { value: "other", label: "Other" },
    ],
    required: true,
    order: 3,
  },
  {
    key: "p3_industry_other",
    code: "P3-OTHER",
    section: "profile",
    prompt: "Other industry",
    type: "text",
    placeholder: "Please specify your industry",
    required: true,
    conditions: [
      {
        questionKey: "p3_industry",
        operator: "equals",
        value: "other",
      },
    ],
    order: 4,
  },
  {
    key: "p4_hq_location",
    code: "P4",
    section: "profile",
    prompt: "Company HQ location:",
    type: "single-choice",
    options: [
      { value: "north_america", label: "North America (US/Canada)" },
      { value: "europe", label: "Europe" },
      { value: "asia_pacific", label: "Asia-Pacific" },
      { value: "middle_east", label: "Middle East" },
      { value: "latin_america", label: "Latin America" },
      { value: "other", label: "Other" },
    ],
    required: true,
    order: 5,
  },
  {
    key: "p4_hq_location_other",
    code: "P4-OTHER",
    section: "profile",
    prompt: "Other HQ location",
    type: "text",
    placeholder: "Please specify the location",
    required: true,
    conditions: [
      {
        questionKey: "p4_hq_location",
        operator: "equals",
        value: "other",
      },
    ],
    order: 6,
  },
  {
    key: "q1_expertise_gap_frequency",
    code: "Q1",
    section: "research",
    prompt:
      "In the last 12 months, how often has your organization needed very specific expertise that your team or network couldn't provide fast enough?",
    type: "single-choice",
    options: [
      { value: "frequently", label: "Frequently (monthly+)" },
      { value: "occasionally", label: "Occasionally (quarterly)" },
      { value: "rarely", label: "Rarely (1-2 times)" },
      { value: "never", label: "Never" },
    ],
    required: true,
    order: 7,
  },
  {
    key: "q2_external_expertise_approach",
    code: "Q2",
    section: "research",
    prompt:
      "When you need external expertise, what's your typical approach? (Select all that apply)",
    type: "multiple-choice",
    options: [
      {
        value: "large_consulting",
        label: "Large consulting firm (McKinsey, Deloitte, etc.)",
      },
      { value: "boutique_consulting", label: "Boutique consulting firm" },
      {
        value: "expert_networks",
        label: "Expert networks (GLG, AlphaSights, etc.)",
      },
      {
        value: "freelance_platforms",
        label: "Freelance platforms (Toptal, Upwork, etc.)",
      },
      { value: "personal_network", label: "Personal network / warm intros" },
      {
        value: "industry_marketplaces",
        label: "Industry-specific marketplaces",
      },
      {
        value: "internal_workarounds",
        label: "We usually work around it internally",
      },
    ],
    required: true,
    minSelections: 1,
    conditions: [
      {
        questionKey: "q1_expertise_gap_frequency",
        operator: "notEquals",
        value: "never",
      },
    ],
    order: 8,
  },
  {
    key: "q3_frustrations",
    code: "Q3",
    section: "research",
    prompt:
      "What are your biggest frustrations with current options? (Select top 2-3)",
    type: "multiple-choice",
    options: [
      {
        value: "too_expensive",
        label: "Too expensive relative to scope of work",
      },
      {
        value: "takes_too_long",
        label: "Takes too long to find the right person",
      },
      {
        value: "hard_to_verify",
        label: "Hard to verify expertise/credentials upfront",
      },
      {
        value: "cant_find_niche",
        label: "Can't find niche or regional specialists",
      },
      {
        value: "over_engineered",
        label: "Over-engineered solutions for simple questions",
      },
      { value: "quality_inconsistency", label: "Quality inconsistency" },
      {
        value: "unclear_pricing",
        label: "Unclear pricing or billing structure",
      },
      { value: "other", label: "Other" },
    ],
    required: true,
    minSelections: 2,
    maxSelections: 3,
    conditions: [
      {
        questionKey: "q1_expertise_gap_frequency",
        operator: "notEquals",
        value: "never",
      },
    ],
    order: 9,
  },
  {
    key: "q3_frustrations_other",
    code: "Q3-OTHER",
    section: "research",
    prompt: "Other frustration",
    type: "text",
    placeholder: "Please describe the frustration",
    required: true,
    conditions: [
      {
        questionKey: "q3_frustrations",
        operator: "includes",
        value: "other",
      },
      {
        questionKey: "q1_expertise_gap_frequency",
        operator: "notEquals",
        value: "never",
      },
    ],
    order: 10,
  },
  {
    key: "q4_domains",
    code: "Q4",
    section: "research",
    prompt:
      "What domains do you most often need external expertise in? (Select all that apply)",
    type: "multiple-choice",
    options: [
      {
        value: "technology_engineering",
        label: "Technology / software engineering",
      },
      {
        value: "ai_ml_data_science",
        label: "AI / machine learning / data science",
      },
      {
        value: "regulatory_compliance_legal",
        label: "Regulatory / compliance / legal",
      },
      {
        value: "finance_strategy",
        label: "Finance / M&A / commercial strategy",
      },
      {
        value: "sales_gtm_market_entry",
        label: "Sales / go-to-market / market entry",
      },
      { value: "operations_supply_chain", label: "Operations / supply chain" },
      { value: "product_design_ux", label: "Product / design / UX" },
      { value: "healthcare_clinical", label: "Healthcare / clinical" },
      { value: "esg_sustainability", label: "ESG / sustainability" },
      { value: "other", label: "Other" },
    ],
    required: true,
    minSelections: 1,
    conditions: [
      {
        questionKey: "q1_expertise_gap_frequency",
        operator: "notEquals",
        value: "never",
      },
    ],
    order: 11,
  },
  {
    key: "q4_domains_other",
    code: "Q4-OTHER",
    section: "research",
    prompt: "Other domain",
    type: "text",
    placeholder: "Please specify the domain",
    required: true,
    conditions: [
      {
        questionKey: "q4_domains",
        operator: "includes",
        value: "other",
      },
      {
        questionKey: "q1_expertise_gap_frequency",
        operator: "notEquals",
        value: "never",
      },
    ],
    order: 12,
  },
  {
    key: "q5_annual_spend",
    code: "Q5",
    section: "research",
    prompt:
      "Roughly, what do you currently spend annually on external experts/consultants?",
    type: "single-choice",
    options: [
      { value: "under_10k", label: "Under $10K" },
      { value: "10k_50k", label: "$10K-$50K" },
      { value: "50k_250k", label: "$50K-$250K" },
      { value: "250k_1m", label: "$250K-$1M" },
      { value: "1m_plus", label: "$1M+" },
      { value: "prefer_not_to_say", label: "Prefer not to say" },
    ],
    required: true,
    conditions: [
      {
        questionKey: "q1_expertise_gap_frequency",
        operator: "notEquals",
        value: "never",
      },
    ],
    order: 13,
  },
  {
    key: "q6_confidence_signals",
    code: "Q6",
    section: "research",
    prompt:
      "Which of the following would MOST increase your confidence when hiring an external expert? (Rank your top 3)",
    description: "Return your top three options in ranked order.",
    type: "ranking",
    options: [
      {
        value: "ai_assessment",
        label: "Standardized AI assessment with scored competencies",
      },
      {
        value: "project_portfolio",
        label: "Portfolio of past client projects / case studies",
      },
      {
        value: "testimonials_ratings",
        label: "Client testimonials and ratings (4-5 star reviews)",
      },
      {
        value: "live_interview",
        label: "Live technical interview conducted by your team",
      },
      {
        value: "trial_consultation",
        label: "Trial consultation at reduced rate (test before commit)",
      },
      {
        value: "video_linkedin",
        label: "Video introduction and verified LinkedIn profile",
      },
      {
        value: "money_back_guarantee",
        label: "Money-back guarantee / quality assurance",
      },
    ],
    required: true,
    minSelections: 3,
    maxSelections: 3,
    order: 14,
  },
  {
    key: "q7_likelihood",
    code: "Q7",
    section: "research",
    prompt:
      "If a platform could match you with verified specialists 2-3x faster than your current approach, how likely would you be to try it for your next expertise need?",
    type: "single-choice",
    options: [
      {
        value: "very_likely",
        label: "Very likely-send me early access when ready",
      },
      {
        value: "somewhat_likely",
        label: "Somewhat likely-I'd explore it",
      },
      {
        value: "neutral",
        label: "Neutral-I would need to see pricing and details first",
      },
      {
        value: "unlikely",
        label: "Unlikely-satisfied with current solutions",
      },
    ],
    required: true,
    order: 15,
  },
  {
    key: "q7_email",
    code: "Q7-EMAIL",
    section: "follow-up",
    prompt: "Email (for early access)",
    type: "email",
    placeholder: "name@company.com",
    required: true,
    conditions: [
      {
        questionKey: "q7_likelihood",
        operator: "in",
        value: ["very_likely", "somewhat_likely"],
      },
    ],
    order: 16,
  },
  {
    key: "q7_use_case",
    code: "Q7-USE-CASE",
    section: "follow-up",
    prompt: "Specific use case you'd try first (optional)",
    type: "text",
    placeholder: "Describe the first problem you would use the platform for",
    required: false,
    conditions: [
      {
        questionKey: "q7_likelihood",
        operator: "in",
        value: ["very_likely", "somewhat_likely"],
      },
    ],
    order: 17,
  },
];

async function seedDatabase() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB: ${MONGODB_URI}`);

    await Question.deleteMany({});
    console.log("Cleared existing questions");

    const inserted = await Question.insertMany(sampleQuestions);
    console.log(`Inserted ${inserted.length} survey questions`);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

seedDatabase();
