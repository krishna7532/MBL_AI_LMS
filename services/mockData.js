/**
 * MBL-AI LMS — Mock Data
 * Comprehensive mock data following PRD v0.6 specifications.
 * This module is required by Express routes to render EJS templates during Stage 1.
 */

// ─── Demo Users ───────────────────────────────────────────────────────────────

const demoUser = {
  _id: 'usr_001',
  name: 'Priya Sharma',
  email: 'priya.sharma@example.com',
  phone: '+91 98765 43210',
  role: 'approved_trial_learner',
  accountState: 'trial_active',
  avatar: null,
  leaderboardAlias: 'LegalEagle42',
  leaderboardOptIn: true,
  trial: {
    startDate: '2026-09-01T00:00:00+05:30',
    endDate: '2026-09-15T00:00:00+05:30',
    daysRemaining: 6,
    isActive: true
  },
  subscription: null,
  consents: {
    terms: { accepted: true, version: '1.0', date: '2026-09-01' },
    privacy: { accepted: true, version: '1.0', date: '2026-09-01' }
  },
  createdAt: '2026-09-01T00:00:00+05:30'
};

const adminUser = {
  _id: 'usr_admin_001',
  name: 'Krishna_Kumar',
  email: 'lokap@mbl-ai.com',
  phone: '+91 99887 66554',
  role: 'admin',
  accountState: 'active',
  avatar: null,
  createdAt: '2026-01-15T00:00:00+05:30'
};

const allUsers = [
  demoUser,
  adminUser,
  {
    _id: 'usr_002',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@example.com',
    phone: '+91 87654 32109',
    role: 'paid_learner',
    accountState: 'paid_active',
    avatar: null,
    leaderboardAlias: 'CorporateCounsel',
    leaderboardOptIn: true,
    trial: { startDate: '2026-07-01', endDate: '2026-07-15', daysRemaining: 0, isActive: false },
    subscription: { plan: 'annual', startDate: '2026-07-15', endDate: '2027-07-15', status: 'active' },
    createdAt: '2026-07-01T00:00:00+05:30'
  },
  {
    _id: 'usr_003',
    name: 'Sneha Reddy',
    email: 'sneha.r@example.com',
    phone: '+91 76543 21098',
    role: 'approved_trial_learner',
    accountState: 'trial_active',
    avatar: null,
    leaderboardAlias: 'StatuteSeeker',
    leaderboardOptIn: false,
    trial: { startDate: '2026-09-03', endDate: '2026-09-17', daysRemaining: 8, isActive: true },
    subscription: null,
    createdAt: '2026-09-03T00:00:00+05:30'
  },
  {
    _id: 'usr_004',
    name: 'Rohit Iyer',
    email: 'rohit.iyer@example.com',
    phone: '+91 65432 10987',
    role: 'expired_learner',
    accountState: 'trial_expired',
    avatar: null,
    leaderboardAlias: null,
    leaderboardOptIn: false,
    trial: { startDate: '2026-08-01', endDate: '2026-08-15', daysRemaining: 0, isActive: false },
    subscription: null,
    createdAt: '2026-08-01T00:00:00+05:30'
  },
  {
    _id: 'usr_005',
    name: 'Kavya Nair',
    email: 'kavya.nair@example.com',
    phone: '+91 54321 09876',
    role: 'applicant',
    accountState: 'pending_approval',
    avatar: null,
    createdAt: '2026-09-08T00:00:00+05:30'
  },
  {
    _id: 'usr_006',
    name: 'Vikram Das',
    email: 'vikram.das@example.com',
    phone: '+91 43210 98765',
    role: 'paid_learner',
    accountState: 'paid_active',
    avatar: null,
    leaderboardAlias: 'LawNavigator',
    leaderboardOptIn: true,
    trial: { startDate: '2026-06-01', endDate: '2026-06-15', daysRemaining: 0, isActive: false },
    subscription: { plan: 'completion', startDate: '2026-06-15', endDate: '2031-06-15', status: 'active' },
    createdAt: '2026-06-01T00:00:00+05:30'
  },
  {
    _id: 'usr_007',
    name: 'Meera Joshi',
    email: 'meera.j@example.com',
    phone: '+91 32109 87654',
    role: 'applicant',
    accountState: 'pending_approval',
    avatar: null,
    createdAt: '2026-09-09T00:00:00+05:30'
  }
];

// ─── Courses ──────────────────────────────────────────────────────────────────

const courses = [
  {
    _id: 'C01',
    code: 'C01',
    name: 'Contract Law',
    programYear: 'Y1',
    description: 'Principles of contract formation, performance, breach, and remedies under Indian contract law including the Indian Contract Act, 1872.',
    modules: [
      { id: 'C01-M01', name: 'Formation of Contract', topics: 4, completed: true },
      { id: 'C01-M02', name: 'Consideration and Capacity', topics: 3, completed: true },
      { id: 'C01-M03', name: 'Free Consent', topics: 5, completed: true },
      { id: 'C01-M04', name: 'Void and Voidable Agreements', topics: 4, completed: false },
      { id: 'C01-M05', name: 'Performance of Contracts', topics: 3, completed: false },
      { id: 'C01-M06', name: 'Breach and Remedies', topics: 4, completed: false }
    ],
    totalModules: 6,
    completedModules: 3,
    progress: 50,
    weekday: 'Monday',
    active: true
  },
  {
    _id: 'C02',
    code: 'C02',
    name: 'Banking Law',
    programYear: 'Y1',
    description: 'Banking regulation, negotiable instruments, RBI framework, SARFAESI Act, and modern banking law in India.',
    modules: [
      { id: 'C02-M01', name: 'Banking Regulation Act', topics: 4, completed: true },
      { id: 'C02-M02', name: 'Negotiable Instruments', topics: 5, completed: true },
      { id: 'C02-M03', name: 'RBI and Monetary Policy', topics: 3, completed: false },
      { id: 'C02-M04', name: 'SARFAESI and Recovery', topics: 4, completed: false },
      { id: 'C02-M05', name: 'Digital Banking and Fintech', topics: 3, completed: false }
    ],
    totalModules: 5,
    completedModules: 2,
    progress: 40,
    weekday: 'Tuesday',
    active: true
  },
  {
    _id: 'C03',
    code: 'C03',
    name: 'Corporate Law',
    programYear: 'Y1',
    description: 'Company formation, governance, directors\' duties, shareholder rights, and corporate restructuring under the Companies Act, 2013.',
    modules: [
      { id: 'C03-M01', name: 'Incorporation and Memorandum', topics: 3, completed: true },
      { id: 'C03-M02', name: 'Share Capital and Membership', topics: 4, completed: false },
      { id: 'C03-M03', name: 'Directors and Governance', topics: 5, completed: false },
      { id: 'C03-M04', name: 'Meetings and Resolutions', topics: 3, completed: false },
      { id: 'C03-M05', name: 'Mergers and Winding Up', topics: 4, completed: false }
    ],
    totalModules: 5,
    completedModules: 1,
    progress: 20,
    weekday: 'Wednesday',
    active: true
  },
  {
    _id: 'C04',
    code: 'C04',
    name: 'Industrial Relations Law',
    programYear: 'Y1',
    description: 'Labour welfare, industrial disputes, trade unions, and workplace regulation under the Industrial Relations Code, 2020.',
    modules: [
      { id: 'C04-M01', name: 'Industrial Disputes Act', topics: 5, completed: true },
      { id: 'C04-M02', name: 'Trade Unions and Collective Bargaining', topics: 3, completed: true },
      { id: 'C04-M03', name: 'Standing Orders', topics: 2, completed: false },
      { id: 'C04-M04', name: 'Strikes and Lockouts', topics: 3, completed: false },
      { id: 'C04-M05', name: 'IR Code 2020', topics: 4, completed: false }
    ],
    totalModules: 5,
    completedModules: 2,
    progress: 40,
    weekday: 'Thursday',
    active: true
  },
  {
    _id: 'C05',
    code: 'C05',
    name: 'Environmental Law',
    programYear: 'Y1',
    description: 'Environmental protection legislation, pollution control, EIA framework, NGT, and sustainable development principles.',
    modules: [
      { id: 'C05-M01', name: 'Environment Protection Act', topics: 3, completed: true },
      { id: 'C05-M02', name: 'Air and Water Pollution', topics: 4, completed: false },
      { id: 'C05-M03', name: 'EIA and Clearances', topics: 3, completed: false },
      { id: 'C05-M04', name: 'NGT and Judicial Activism', topics: 4, completed: false },
      { id: 'C05-M05', name: 'Climate Change and SDGs', topics: 3, completed: false }
    ],
    totalModules: 5,
    completedModules: 1,
    progress: 20,
    weekday: 'Friday',
    active: true
  }
];

// Year 2 placeholder courses (not active in MVP)
const year2Courses = [
  { _id: 'C06', code: 'C06', name: 'Investment Laws', programYear: 'Y2', active: false },
  { _id: 'C07', code: 'C07', name: 'Insurance Laws', programYear: 'Y2', active: false },
  { _id: 'C08', code: 'C08', name: 'International Commercial Transactions & Foreign Trade', programYear: 'Y2', active: false },
  { _id: 'C09', code: 'C09', name: 'Intellectual Property Laws', programYear: 'Y2', active: false },
  { _id: 'C10', code: 'C10', name: 'Taxes on Corporations & Commodities', programYear: 'Y2', active: false }
];

// ─── Weekly Sprint Data ───────────────────────────────────────────────────────

const weeklySprintNotes = {
  courseId: 'C01',
  weekNumber: 7,
  title: 'Free Consent — Coercion, Undue Influence & Misrepresentation',
  readTime: '15 min',
  content: `
## Free Consent under the Indian Contract Act, 1872

### 1. Consent (Section 13)
Two or more persons are said to consent when they agree upon the same thing in the same sense. This is sometimes called *consensus ad idem*.

### 2. Free Consent (Section 14)
Consent is said to be free when it is not caused by:
- **Coercion** (Section 15)
- **Undue Influence** (Section 16)
- **Fraud** (Section 17)
- **Misrepresentation** (Section 18)
- **Mistake** (Sections 20–22)

### 3. Coercion (Section 15)
Coercion is committing, or threatening to commit, any act forbidden by the Indian Penal Code, or unlawfully detaining or threatening to detain any property, with the intention of causing any person to enter into an agreement.

**Key case:** *Ranganayakamma v. Alwar Setti* (1889) — A widow was prevented from removing her husband's body for cremation until she adopted a boy. Held: consent obtained by coercion.

### 4. Undue Influence (Section 16)
A contract is said to be induced by undue influence where the relations subsisting between the parties are such that one party is in a position to dominate the will of the other, and uses that position to obtain an unfair advantage.

**Key case:** *Allcard v. Skinner* (1887) — Gift to religious superior set aside on grounds of undue influence.

### 5. Misrepresentation (Section 18)
Misrepresentation includes:
- A positive assertion of fact that is not true, though the person believes it to be true.
- A breach of duty that gains an advantage by misleading another.
- Causing a mistake about the subject matter, however innocently.

### 6. Effect on Contract
| Vitiating Factor | Effect |
|---|---|
| Coercion | Voidable at the option of the aggrieved party |
| Undue Influence | Voidable; court may set aside or modify |
| Misrepresentation | Voidable; aggrieved party may also sue for damages |
| Fraud | Voidable; right to damages exists |
| Mistake of fact (bilateral) | Void |

> **Revision note:** This material assumes you have attended or watched the relevant lectures and reviewed prescribed material. It is designed for revision and assessment practice.
  `.trim(),
  completed: false
};

const weeklyMCQs = [
  {
    _id: 'MBL-Q-001001',
    questionNumber: 1,
    courseId: 'C01',
    conceptIds: ['free_consent', 'coercion'],
    examRole: 'weekly',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'Under Section 15 of the Indian Contract Act, 1872, coercion includes which of the following?',
    options: [
      { id: 'A', text: 'Committing any act forbidden by the Indian Penal Code' },
      { id: 'B', text: 'Making a false promise about future conduct' },
      { id: 'C', text: 'Exercising lawful authority to detain property' },
      { id: 'D', text: 'Offering a higher price than market value' }
    ],
    correctOptionIds: ['A'],
    explanation: 'Section 15 defines coercion as committing, or threatening to commit, any act forbidden by the IPC, or unlawfully detaining property. Option B relates to fraud, C involves lawful detention (not coercion), and D is a commercial decision.',
    marks: 2,
    origin: 'pyq_reused',
    originBadge: 'Past Year Question — Contract Law, 2024',
    difficulty: 'medium'
  },
  {
    _id: 'MBL-Q-001002',
    questionNumber: 2,
    courseId: 'C01',
    conceptIds: ['free_consent', 'undue_influence'],
    examRole: 'weekly',
    questionType: 'application',
    responseFormat: 'single_choice_mcq',
    stemForm: 'scenario',
    prompt: 'A spiritual guru tells his devotee that refusing to transfer property to the ashram will bring divine punishment. The devotee transfers the property out of fear. Under the Indian Contract Act, this transaction is:',
    options: [
      { id: 'A', text: 'Valid, as the devotee acted voluntarily' },
      { id: 'B', text: 'Void, as it involves a mistake of fact' },
      { id: 'C', text: 'Voidable due to undue influence under Section 16' },
      { id: 'D', text: 'Voidable due to coercion under Section 15' }
    ],
    correctOptionIds: ['C'],
    explanation: 'The guru holds a position of spiritual dominance over the devotee. Using that position to obtain an unfair advantage constitutes undue influence under Section 16. The threat of divine punishment is not an IPC offence, so Section 15 (coercion) does not apply.',
    marks: 2,
    origin: 'practice_reused',
    originBadge: 'Practice Question',
    difficulty: 'medium'
  },
  {
    _id: 'MBL-Q-001003',
    questionNumber: 3,
    courseId: 'C01',
    conceptIds: ['free_consent', 'misrepresentation'],
    examRole: 'weekly',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'Which of the following best describes misrepresentation under Section 18 of the Indian Contract Act?',
    options: [
      { id: 'A', text: 'A deliberate lie told to deceive the other party' },
      { id: 'B', text: 'A positive assertion of fact believed to be true but actually false' },
      { id: 'C', text: 'A promise made without intending to perform it' },
      { id: 'D', text: 'Silence about material facts in a non-fiduciary relationship' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Section 18 requires that the person making the assertion believes it to be true. A deliberate lie (Option A) falls under fraud (Section 17), not misrepresentation.',
    marks: 2,
    origin: 'ai_generated',
    originBadge: 'AI-Generated',
    difficulty: 'easy'
  },
  {
    _id: 'MBL-Q-001004',
    questionNumber: 4,
    courseId: 'C01',
    conceptIds: ['free_consent', 'coercion'],
    examRole: 'weekly',
    questionType: 'application',
    responseFormat: 'single_choice_mcq',
    stemForm: 'scenario',
    prompt: 'In Ranganayakamma v. Alwar Setti, the widow was prevented from removing her husband\'s body until she adopted a boy. The court held the adoption was:',
    options: [
      { id: 'A', text: 'Valid because adoption is a personal choice' },
      { id: 'B', text: 'Void because of bilateral mistake' },
      { id: 'C', text: 'Voidable because consent was obtained through coercion' },
      { id: 'D', text: 'Unenforceable because the consideration was past' }
    ],
    correctOptionIds: ['C'],
    explanation: 'The court held that preventing cremation until the widow agreed to adopt constituted unlawful detention of property (the deceased\'s body), amounting to coercion under Section 15. The consent was therefore not free, making the agreement voidable.',
    marks: 2,
    origin: 'pyq_reused',
    originBadge: 'Past Year Question — Contract Law, 2023',
    difficulty: 'medium'
  },
  {
    _id: 'MBL-Q-001005',
    questionNumber: 5,
    courseId: 'C01',
    conceptIds: ['free_consent', 'undue_influence'],
    examRole: 'weekly',
    questionType: 'exception_trap',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'Which of the following relationships does NOT create a presumption of undue influence under Indian law?',
    options: [
      { id: 'A', text: 'Doctor and patient' },
      { id: 'B', text: 'Parent and minor child' },
      { id: 'C', text: 'Husband and wife' },
      { id: 'D', text: 'Solicitor and client' }
    ],
    correctOptionIds: ['C'],
    explanation: 'Under Indian law, husband and wife are not in a relationship where undue influence is presumed. Unlike English law, Indian courts require independent proof of domination in spousal relationships. Doctor–patient, parent–child, and solicitor–client relationships all carry a presumption.',
    marks: 2,
    origin: 'adapted',
    originBadge: 'Adapted from PYQ — Contract Law, 2022',
    difficulty: 'hard'
  },
  {
    _id: 'MBL-Q-001006',
    questionNumber: 6,
    courseId: 'C01',
    conceptIds: ['free_consent'],
    examRole: 'weekly',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'Consent is defined under which section of the Indian Contract Act, 1872?',
    options: [
      { id: 'A', text: 'Section 10' },
      { id: 'B', text: 'Section 13' },
      { id: 'C', text: 'Section 14' },
      { id: 'D', text: 'Section 15' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Section 13 defines consent as agreement upon the same thing in the same sense. Section 14 defines free consent, Section 15 defines coercion, and Section 10 lists essentials of a valid contract.',
    marks: 2,
    origin: 'practice_reused',
    originBadge: 'Practice Question',
    difficulty: 'easy'
  },
  {
    _id: 'MBL-Q-001007',
    questionNumber: 7,
    courseId: 'C01',
    conceptIds: ['free_consent', 'fraud'],
    examRole: 'weekly',
    questionType: 'application',
    responseFormat: 'single_choice_mcq',
    stemForm: 'scenario',
    prompt: 'A sells a horse to B, knowing that the horse is unsound. A says nothing about the unsoundness to B. Under the Indian Contract Act:',
    options: [
      { id: 'A', text: 'A is guilty of fraud because silence amounts to fraud' },
      { id: 'B', text: 'A is not guilty of fraud because there is no duty to disclose' },
      { id: 'C', text: 'A is guilty of misrepresentation' },
      { id: 'D', text: 'The contract is void ab initio' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Under Section 17, mere silence is not fraud unless circumstances make it the duty of the person keeping silence to speak, or unless silence is itself equivalent to speech. In an ordinary sale, there is no fiduciary duty to disclose.',
    marks: 2,
    origin: 'ai_generated',
    originBadge: 'AI-Generated',
    difficulty: 'medium'
  },
  {
    _id: 'MBL-Q-001008',
    questionNumber: 8,
    courseId: 'C01',
    conceptIds: ['free_consent', 'mistake'],
    examRole: 'weekly',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'A bilateral mistake as to the existence of the subject matter under Section 20 makes the agreement:',
    options: [
      { id: 'A', text: 'Voidable at the option of either party' },
      { id: 'B', text: 'Void' },
      { id: 'C', text: 'Valid but unenforceable' },
      { id: 'D', text: 'Voidable at the option of the party in mistake' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Section 20 states that where both parties are under a mistake as to a matter of fact essential to the agreement, the agreement is void. This is different from unilateral mistake (Section 22), which generally does not affect validity.',
    marks: 2,
    origin: 'practice_reused',
    originBadge: 'Practice Question',
    difficulty: 'easy'
  },
  {
    _id: 'MBL-Q-001009',
    questionNumber: 9,
    courseId: 'C01',
    conceptIds: ['free_consent', 'undue_influence'],
    examRole: 'weekly',
    questionType: 'application',
    responseFormat: 'single_choice_mcq',
    stemForm: 'scenario',
    prompt: 'An elderly landlord, dependent on his managing agent for daily needs, gifts the agent a property worth ₹50 lakh. The agent claims the gift was voluntary. In a dispute, the burden of proving the absence of undue influence falls on:',
    options: [
      { id: 'A', text: 'The landlord, as the plaintiff' },
      { id: 'B', text: 'The managing agent, as the dominant party' },
      { id: 'C', text: 'Both parties equally' },
      { id: 'D', text: 'The court, through independent inquiry' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Under Section 16(3), when a person is in a position to dominate the will of another and the transaction appears unconscionable, the burden of proving absence of undue influence shifts to the dominant party — here, the managing agent.',
    marks: 2,
    origin: 'web_sourced',
    originBadge: 'External Practice Question',
    difficulty: 'hard'
  },
  {
    _id: 'MBL-Q-001010',
    questionNumber: 10,
    courseId: 'C01',
    conceptIds: ['free_consent', 'fraud'],
    examRole: 'weekly',
    questionType: 'exception_trap',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'A contract induced by fraud is:',
    options: [
      { id: 'A', text: 'Void ab initio' },
      { id: 'B', text: 'Voidable at the option of the party defrauded' },
      { id: 'C', text: 'Valid unless challenged within one year' },
      { id: 'D', text: 'Unenforceable but not void' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Under Section 19, a contract induced by fraud is voidable at the option of the party whose consent was obtained by fraud. It is not void ab initio — the aggrieved party may choose to affirm or avoid the contract.',
    marks: 2,
    origin: 'pyq_reused',
    originBadge: 'Past Year Question — Contract Law, 2024',
    difficulty: 'easy'
  },
  {
    _id: 'MBL-Q-001011',
    questionNumber: 11,
    courseId: 'C01',
    conceptIds: ['free_consent', 'coercion'],
    examRole: 'weekly',
    questionType: 'application',
    responseFormat: 'single_choice_mcq',
    stemForm: 'scenario',
    prompt: 'X threatens Y that he will file a false FIR against Y unless Y sells his car at half price. Y agrees. The agreement is:',
    options: [
      { id: 'A', text: 'Valid, as threats of legal action are not coercion' },
      { id: 'B', text: 'Void, as the consideration is inadequate' },
      { id: 'C', text: 'Voidable, as it was induced by coercion' },
      { id: 'D', text: 'Voidable, as it was induced by undue influence' }
    ],
    correctOptionIds: ['C'],
    explanation: 'Filing a false FIR is an act forbidden by the IPC (Section 182/211 IPC). Threatening such an act to induce an agreement constitutes coercion under Section 15, making the agreement voidable under Section 19.',
    marks: 2,
    origin: 'ai_generated',
    originBadge: 'AI-Generated',
    difficulty: 'medium'
  },
  {
    _id: 'MBL-Q-001012',
    questionNumber: 12,
    courseId: 'C01',
    conceptIds: ['free_consent'],
    examRole: 'weekly',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'Free consent under Section 14 requires that consent is NOT caused by:',
    options: [
      { id: 'A', text: 'Coercion, undue influence, fraud, misrepresentation, or mistake' },
      { id: 'B', text: 'Coercion, undue influence, fraud, or inadequate consideration' },
      { id: 'C', text: 'Coercion, fraud, mistake, or impossibility of performance' },
      { id: 'D', text: 'Fraud, misrepresentation, mistake, or frustration of purpose' }
    ],
    correctOptionIds: ['A'],
    explanation: 'Section 14 lists exactly five vitiating factors: coercion (S.15), undue influence (S.16), fraud (S.17), misrepresentation (S.18), and mistake (S.20–22). Inadequate consideration and impossibility are separate concepts.',
    marks: 2,
    origin: 'practice_reused',
    originBadge: 'Practice Question',
    difficulty: 'easy'
  },
  {
    _id: 'MBL-Q-001013',
    questionNumber: 13,
    courseId: 'C01',
    conceptIds: ['free_consent', 'misrepresentation'],
    examRole: 'weekly',
    questionType: 'application',
    responseFormat: 'single_choice_mcq',
    stemForm: 'scenario',
    prompt: 'P tells Q that a painting is by a famous artist, genuinely believing this based on a dealer\'s assurance. The painting turns out to be a copy. Q sues P. This is:',
    options: [
      { id: 'A', text: 'Fraud, as P made a false statement about the painting' },
      { id: 'B', text: 'Misrepresentation, as P believed the statement to be true' },
      { id: 'C', text: 'Neither fraud nor misrepresentation, as P relied on expert opinion' },
      { id: 'D', text: 'Mistake of law, making the contract void' }
    ],
    correctOptionIds: ['B'],
    explanation: 'P made a positive assertion of fact that he believed to be true (based on the dealer\'s assurance) but was actually false. This squarely falls under misrepresentation (Section 18), not fraud (which requires intent to deceive).',
    marks: 2,
    origin: 'adapted',
    originBadge: 'Adapted from PYQ — Contract Law, 2023',
    difficulty: 'medium'
  },
  {
    _id: 'MBL-Q-001014',
    questionNumber: 14,
    courseId: 'C01',
    conceptIds: ['free_consent', 'fraud'],
    examRole: 'weekly',
    questionType: 'exception_trap',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'In contracts of insurance, silence about a material fact amounts to:',
    options: [
      { id: 'A', text: 'Coercion' },
      { id: 'B', text: 'Fraud' },
      { id: 'C', text: 'Undue influence' },
      { id: 'D', text: 'Misrepresentation only' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Insurance contracts are contracts of uberrimae fidei (utmost good faith). There is a duty to disclose all material facts. Silence about material facts in such contracts amounts to fraud under the proviso to Section 17.',
    marks: 2,
    origin: 'pyq_reused',
    originBadge: 'Past Year Question — Contract Law, 2022',
    difficulty: 'hard'
  },
  {
    _id: 'MBL-Q-001015',
    questionNumber: 15,
    courseId: 'C01',
    conceptIds: ['free_consent', 'undue_influence'],
    examRole: 'weekly',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    stemForm: 'standalone',
    prompt: 'Under Section 19A, when consent is caused by undue influence, the court may:',
    options: [
      { id: 'A', text: 'Only set aside the contract entirely' },
      { id: 'B', text: 'Set aside the contract entirely or modify its terms' },
      { id: 'C', text: 'Only award damages' },
      { id: 'D', text: 'Declare the contract void and order restitution' }
    ],
    correctOptionIds: ['B'],
    explanation: 'Section 19A gives the court discretion either to set aside the contract entirely or to modify it on terms the court considers just. This is broader than the remedy for coercion or fraud, which is simply avoidance.',
    marks: 2,
    origin: 'ai_generated',
    originBadge: 'AI-Generated',
    difficulty: 'medium'
  }
];

const weeklySubjective = {
  _id: 'MBL-Q-002001',
  courseId: 'C01',
  conceptIds: ['free_consent', 'coercion', 'undue_influence'],
  examRole: 'weekly',
  questionType: 'scenario_advice',
  responseFormat: 'subjective',
  prompt: 'Anand, an elderly retired teacher, lives alone and depends on his nephew Kiran for daily groceries and medicine. Kiran tells Anand that he will stop all support unless Anand transfers his ancestral house to Kiran for ₹1 lakh (market value ₹80 lakh). Anand, feeling helpless, agrees and signs the sale deed.\n\nThree months later, Anand\'s daughter Priya discovers the transfer. She wants to challenge it in court.\n\n(a) Identify and explain the vitiating factor(s) affecting Anand\'s consent.\n(b) Can Priya succeed in getting the transfer set aside? Discuss with reference to relevant provisions and case law.\n(c) Would the outcome change if Kiran were Anand\'s doctor instead of nephew?',
  marks: 10,
  subParts: ['a', 'b', 'c'],
  origin: 'ai_generated',
  originBadge: 'AI-Generated',
  rubric: [
    { criterion: 'Identification of undue influence under Section 16', marks: 2 },
    { criterion: 'Analysis of dominant position and unconscionable transaction', marks: 2 },
    { criterion: 'Application of Section 19A remedies', marks: 2 },
    { criterion: 'Reference to relevant case law', marks: 2 },
    { criterion: 'Discussion of doctor-patient variation and reasoning', marks: 2 }
  ]
};

// ─── Weekly Sprint Summary ────────────────────────────────────────────────────

const weeklySprints = [
  {
    _id: 'sprint_w07_C01',
    courseId: 'C01',
    courseName: 'Contract Law',
    weekNumber: 7,
    weekday: 'Monday',
    title: 'Free Consent — Coercion, Undue Influence & Misrepresentation',
    status: 'not_started',
    bestScore: null,
    maxScore: 40,
    mcqCount: 15,
    subjectiveCount: 1,
    publishedAt: '2026-09-08T00:00:00+05:30'
  },
  {
    _id: 'sprint_w07_C02',
    courseId: 'C02',
    courseName: 'Banking Law',
    weekNumber: 7,
    weekday: 'Tuesday',
    title: 'Negotiable Instruments — Promissory Notes & Bills of Exchange',
    status: 'completed',
    bestScore: 34,
    maxScore: 40,
    mcqCount: 15,
    subjectiveCount: 1,
    publishedAt: '2026-09-08T00:00:00+05:30'
  },
  {
    _id: 'sprint_w07_C03',
    courseId: 'C03',
    courseName: 'Corporate Law',
    weekNumber: 7,
    weekday: 'Wednesday',
    title: 'Memorandum of Association — Alteration and Doctrine of Ultra Vires',
    status: 'test_in_progress',
    bestScore: null,
    maxScore: 40,
    mcqCount: 15,
    subjectiveCount: 1,
    publishedAt: '2026-09-08T00:00:00+05:30'
  },
  {
    _id: 'sprint_w07_C04',
    courseId: 'C04',
    courseName: 'Industrial Relations Law',
    weekNumber: 7,
    weekday: 'Thursday',
    title: 'Collective Bargaining and Trade Union Recognition',
    status: 'notes_completed',
    bestScore: null,
    maxScore: 40,
    mcqCount: 15,
    subjectiveCount: 1,
    publishedAt: '2026-09-08T00:00:00+05:30'
  },
  {
    _id: 'sprint_w07_C05',
    courseId: 'C05',
    courseName: 'Environmental Law',
    weekNumber: 7,
    weekday: 'Friday',
    title: 'Environmental Impact Assessment and Public Participation',
    status: 'evaluation_pending',
    bestScore: null,
    maxScore: 40,
    mcqCount: 15,
    subjectiveCount: 1,
    publishedAt: '2026-09-08T00:00:00+05:30'
  }
];

// ─── Monthly Simulation Data ──────────────────────────────────────────────────

const monthlySimulations = [
  {
    _id: 'sim_m02_C01',
    courseId: 'C01',
    courseName: 'Contract Law',
    month: 2,
    title: 'Contract Law — Monthly Simulation (Weeks 5–8)',
    duration: 180,
    totalMarks: 100,
    status: 'available',
    sections: {
      partA: { passages: 5, mcqsPerPassage: 5, marksPerMcq: 2, total: 50 },
      partB: { questions: 3, marksPerQuestion: 10, total: 30 },
      partC: { questions: 2, marksPerQuestion: 10, total: 20 }
    },
    bestScore: null,
    attempts: 0,
    publishedAt: '2026-09-01T00:00:00+05:30'
  },
  {
    _id: 'sim_m02_C02',
    courseId: 'C02',
    courseName: 'Banking Law',
    month: 2,
    title: 'Banking Law — Monthly Simulation (Weeks 5–8)',
    duration: 180,
    totalMarks: 100,
    status: 'completed',
    sections: {
      partA: { passages: 5, mcqsPerPassage: 5, marksPerMcq: 2, total: 50 },
      partB: { questions: 3, marksPerQuestion: 10, total: 30 },
      partC: { questions: 2, marksPerQuestion: 10, total: 20 }
    },
    bestScore: 72,
    attempts: 1,
    publishedAt: '2026-09-01T00:00:00+05:30'
  }
];

const simulationPassages = [
  {
    _id: 'passage_001',
    passageNumber: 1,
    courseId: 'C01',
    title: 'Passage 1: Formation of Contract',
    text: 'Alpha Ltd. placed an advertisement in a national newspaper offering to sell surplus office furniture at 50% of the listed price. Beta Corp. sent a letter expressing interest in purchasing 20 desks at the advertised price. Before Beta\'s letter arrived, Alpha published a revised advertisement increasing prices by 10%. Alpha received Beta\'s letter and replied accepting the purchase but at the revised price. Beta insists the original advertisement constitutes an offer and the contract was concluded when they posted their acceptance.',
    questions: [
      {
        _id: 'MBL-Q-003001',
        questionNumber: 1,
        prompt: 'The original newspaper advertisement by Alpha Ltd. is best classified as:',
        options: [
          { id: 'A', text: 'An offer open to acceptance by any reader' },
          { id: 'B', text: 'An invitation to treat' },
          { id: 'C', text: 'A standing offer under Section 5' },
          { id: 'D', text: 'A cross-offer requiring counter-acceptance' }
        ],
        correctOptionIds: ['B'],
        explanation: 'A newspaper advertisement offering goods for sale is generally an invitation to treat, not an offer. The advertiser invites offers from potential buyers.',
        marks: 2
      },
      {
        _id: 'MBL-Q-003002',
        questionNumber: 2,
        prompt: 'Beta\'s letter expressing interest in purchasing 20 desks at the advertised price is:',
        options: [
          { id: 'A', text: 'An acceptance of Alpha\'s offer' },
          { id: 'B', text: 'An offer to purchase, capable of being accepted by Alpha' },
          { id: 'C', text: 'A counter-offer that terminates Alpha\'s original offer' },
          { id: 'D', text: 'An invitation to treat from Beta to Alpha' }
        ],
        correctOptionIds: ['B'],
        explanation: 'Since the advertisement was an invitation to treat, Beta\'s response expressing interest at the specified price constitutes an offer by Beta to Alpha.',
        marks: 2
      },
      {
        _id: 'MBL-Q-003003',
        questionNumber: 3,
        prompt: 'Alpha\'s reply accepting the purchase but at the revised price constitutes:',
        options: [
          { id: 'A', text: 'A valid acceptance forming a binding contract' },
          { id: 'B', text: 'A counter-offer that rejects Beta\'s original offer' },
          { id: 'C', text: 'A conditional acceptance that needs Beta\'s confirmation' },
          { id: 'D', text: 'An acceptance subject to minor modifications' }
        ],
        correctOptionIds: ['B'],
        explanation: 'An acceptance with a different price is not a valid acceptance but a counter-offer. Under Section 7, acceptance must be absolute and unqualified.',
        marks: 2
      },
      {
        _id: 'MBL-Q-003004',
        questionNumber: 4,
        prompt: 'Under the Indian Contract Act, at what point was there a concluded contract between Alpha and Beta?',
        options: [
          { id: 'A', text: 'When Alpha published the advertisement' },
          { id: 'B', text: 'When Beta posted the letter' },
          { id: 'C', text: 'When Alpha replied at the revised price' },
          { id: 'D', text: 'There was no concluded contract' }
        ],
        correctOptionIds: ['D'],
        explanation: 'The advertisement was an invitation to treat. Beta\'s letter was an offer. Alpha\'s reply at a different price was a counter-offer, not acceptance. No concluded contract was formed.',
        marks: 2
      },
      {
        _id: 'MBL-Q-003005',
        questionNumber: 5,
        prompt: 'If Beta had posted a letter accepting Alpha\'s counter-offer, the contract would be complete:',
        options: [
          { id: 'A', text: 'When Beta posted the letter (postal rule)' },
          { id: 'B', text: 'When Alpha received the letter' },
          { id: 'C', text: 'When Beta signed the letter' },
          { id: 'D', text: 'Only when both parties sign a formal agreement' }
        ],
        correctOptionIds: ['A'],
        explanation: 'Under Section 4 of the Indian Contract Act, acceptance is complete as against the proposer when the letter is put in the course of transmission (postal rule).',
        marks: 2
      }
    ]
  }
];

const simulationPartB = [
  {
    _id: 'MBL-Q-004001',
    questionNumber: 1,
    sectionLabel: 'Part B — Question 1',
    prompt: 'Ravi contracts with SkyBuild Ltd. to construct a commercial complex for ₹5 crore, to be completed within 18 months. After 12 months and 60% completion, SkyBuild demands an additional ₹1.5 crore citing unprecedented increase in steel prices. Ravi reluctantly agrees and signs a supplementary agreement. SkyBuild completes the project but Ravi now refuses to pay the additional amount.\n\n(a) Analyse whether the supplementary agreement for additional payment is supported by fresh consideration.\n(b) Can Ravi argue that his consent to the supplementary agreement was not free? Discuss.\n(c) Advise SkyBuild on whether they can enforce the supplementary agreement.',
    marks: 10,
    examRole: 'part_b',
    questionType: 'scenario_advice'
  },
  {
    _id: 'MBL-Q-004002',
    questionNumber: 2,
    sectionLabel: 'Part B — Question 2',
    prompt: 'MediCorp enters into an agreement with PharmaSolutions to exclusively supply vaccines for government hospitals in a state for two years. The agreement includes a clause that PharmaSolutions will not supply vaccines to any other government entity in the same state during this period.\n\n(a) Examine the validity of the exclusive supply agreement in light of Section 27.\n(b) Does the restraint clause amount to restraint of trade? Discuss.\n(c) How would the analysis differ if PharmaSolutions were a sole proprietorship instead of a company?',
    marks: 10,
    examRole: 'part_b',
    questionType: 'scenario_advice'
  },
  {
    _id: 'MBL-Q-004003',
    questionNumber: 3,
    sectionLabel: 'Part B — Question 3',
    prompt: 'Lakshmi, a property developer, enters into a contract with Green Estates to purchase a 5-acre plot for ₹2 crore. The contract stipulates completion within 90 days. On Day 60, Lakshmi discovers that the land has an existing mortgage that Green Estates failed to disclose. Lakshmi wants to rescind the contract and recover the advance of ₹50 lakh already paid.\n\n(a) Identify the vitiating factor(s) in the formation of this contract.\n(b) What remedies are available to Lakshmi under the Indian Contract Act?\n(c) Can Green Estates argue that the mortgage is a matter of public record and Lakshmi should have checked?',
    marks: 10,
    examRole: 'part_b',
    questionType: 'multi_party_liability'
  }
];

const simulationPartC = [
  {
    _id: 'MBL-Q-005001',
    questionNumber: 1,
    sectionLabel: 'Part C — Question 1',
    prompt: '"The doctrine of frustration under Section 56 of the Indian Contract Act differs fundamentally from the English common law doctrine of frustration in both scope and application."\n\nCritically analyse this statement with reference to:\n(a) The statutory basis of Section 56 versus the common law development in English law.\n(b) At least two landmark Indian cases and two English cases.\n(c) The practical implications of these differences for commercial contracts in India.',
    marks: 10,
    examRole: 'part_c',
    questionType: 'doctrinal_explanation'
  },
  {
    _id: 'MBL-Q-005002',
    questionNumber: 2,
    sectionLabel: 'Part C — Question 2',
    prompt: '"Quantum meruit as a remedy provides a fair balance between unjust enrichment and contractual certainty."\n\nDiscuss this proposition with reference to:\n(a) The legal basis of quantum meruit under Indian contract law.\n(b) The relationship between quantum meruit and Section 65 and Section 70 of the Indian Contract Act.\n(c) Cases where quantum meruit has been allowed and where it has been denied, and the principles distinguishing the two.',
    marks: 10,
    examRole: 'part_c',
    questionType: 'critical_proposition'
  }
];

// ─── Results / Attempt Data ──────────────────────────────────────────────────

const sampleResult = {
  _id: 'attempt_001',
  userId: 'usr_001',
  sprintId: 'sprint_w07_C02',
  courseId: 'C02',
  courseName: 'Banking Law',
  weekNumber: 7,
  attemptNumber: 1,
  status: 'completed',
  submittedAt: '2026-09-09T14:30:00+05:30',
  scores: {
    mcq: { earned: 24, max: 30, correct: 12, incorrect: 3, unanswered: 0 },
    subjective: { earned: 8, max: 10, status: 'evaluated' },
    total: { earned: 32, max: 40, percentage: 80 }
  },
  feedback: {
    score: '8/10',
    breakdown: [
      { criterion: 'Issue identification', marks: '2/2', comment: 'Correctly identified all three sub-issues' },
      { criterion: 'Legal principles and statutory provisions', marks: '2/2', comment: 'Accurate citation of NI Act sections' },
      { criterion: 'Application to facts', marks: '1.5/2', comment: 'Application to the cheque dishonour scenario was partially incomplete' },
      { criterion: 'Case law reference', marks: '1.5/2', comment: 'Referenced Dashrath Rupsingh but missed NEPC Micon' },
      { criterion: 'Structure and conclusion', marks: '1/2', comment: 'Conclusion could have been more definitive' }
    ],
    whatCorrect: 'You correctly identified the holder in due course requirements and applied Section 138 provisions effectively.',
    whatWrong: 'The analysis of the bank\'s liability for wrongful dishonour was incomplete — you did not discuss the bank\'s statutory obligation under Section 31 of the NI Act.',
    couldAdd: 'Discuss the distinction between Section 138 (criminal liability) and Section 30 (liability of drawer) for a more complete analysis.',
    betterStructure: 'Structure your answer as: (1) Issue identification per sub-part, (2) Applicable law with section numbers, (3) Application to facts, (4) Conclusion with remedy/advice.'
  }
};

// ─── Leaderboard Data ─────────────────────────────────────────────────────────

const weeklyLeaderboard = [
  { rank: 1, alias: 'CorporateCounsel', score: 38, maxScore: 40, courseId: 'C02', courseName: 'Banking Law', weekNumber: 7 },
  { rank: 2, alias: 'LawNavigator', score: 36, maxScore: 40, courseId: 'C02', courseName: 'Banking Law', weekNumber: 7 },
  { rank: 3, alias: 'LegalEagle42', score: 34, maxScore: 40, courseId: 'C02', courseName: 'Banking Law', weekNumber: 7 },
  { rank: 4, alias: 'BriefWriter99', score: 32, maxScore: 40, courseId: 'C02', courseName: 'Banking Law', weekNumber: 7 },
  { rank: 5, alias: 'PrecedentHunter', score: 30, maxScore: 40, courseId: 'C02', courseName: 'Banking Law', weekNumber: 7 },
  { rank: 6, alias: 'ConstitutionFan', score: 28, maxScore: 40, courseId: 'C02', courseName: 'Banking Law', weekNumber: 7 },
  { rank: 7, alias: 'EquityScholar', score: 26, maxScore: 40, courseId: 'C02', courseName: 'Banking Law', weekNumber: 7 }
];

const aggregateLeaderboard = [
  { rank: 1, alias: 'CorporateCounsel', weeklyTotal: 178, monthlyTotal: 82, cumulativeScore: 260, academicYear: 'AY-2026' },
  { rank: 2, alias: 'LawNavigator', weeklyTotal: 172, monthlyTotal: 78, cumulativeScore: 250, academicYear: 'AY-2026' },
  { rank: 3, alias: 'LegalEagle42', weeklyTotal: 168, monthlyTotal: 72, cumulativeScore: 240, academicYear: 'AY-2026' },
  { rank: 4, alias: 'BriefWriter99', weeklyTotal: 160, monthlyTotal: 68, cumulativeScore: 228, academicYear: 'AY-2026' },
  { rank: 5, alias: 'PrecedentHunter', weeklyTotal: 152, monthlyTotal: 65, cumulativeScore: 217, academicYear: 'AY-2026' },
  { rank: 6, alias: 'ConstitutionFan', weeklyTotal: 148, monthlyTotal: 60, cumulativeScore: 208, academicYear: 'AY-2026' },
  { rank: 7, alias: 'EquityScholar', weeklyTotal: 140, monthlyTotal: 55, cumulativeScore: 195, academicYear: 'AY-2026' },
  { rank: 8, alias: 'TortReformer', weeklyTotal: 132, monthlyTotal: 50, cumulativeScore: 182, academicYear: 'AY-2026' }
];

// ─── Notifications ────────────────────────────────────────────────────────────

const notifications = [
  {
    _id: 'notif_001',
    type: 'content_published',
    title: 'Week 7 sprints published',
    message: 'All five course sprints for Week 7 are now available. Start with Contract Law on Monday.',
    read: false,
    createdAt: '2026-09-08T08:00:00+05:30'
  },
  {
    _id: 'notif_002',
    type: 'evaluation_complete',
    title: 'Banking Law — subjective evaluated',
    message: 'Your Week 7 Banking Law subjective answer has been evaluated. Score: 8/10.',
    read: false,
    createdAt: '2026-09-09T10:15:00+05:30'
  },
  {
    _id: 'notif_003',
    type: 'trial_reminder',
    title: 'Trial expiring in 6 days',
    message: 'Your 14-day trial expires on 15 September 2026. Upgrade to continue access.',
    read: true,
    createdAt: '2026-09-09T06:00:00+05:30'
  },
  {
    _id: 'notif_004',
    type: 'simulation_available',
    title: 'Monthly simulation available',
    message: 'Contract Law monthly simulation (Weeks 5–8) is now available. 3-hour, 100-mark exam.',
    read: true,
    createdAt: '2026-09-01T08:00:00+05:30'
  },
  {
    _id: 'notif_005',
    type: 'leaderboard_update',
    title: 'Leaderboard updated',
    message: 'You are ranked #3 in Banking Law Week 7 leaderboard with a score of 34/40.',
    read: true,
    createdAt: '2026-09-09T14:45:00+05:30'
  }
];

// ─── Content Releases ─────────────────────────────────────────────────────────

const releases = [
  {
    _id: 'MBL-R-2026-W07-V1',
    releaseId: 'MBL-R-2026-W07-V1',
    releaseType: 'weekly',
    academicYearId: 'AY-2026',
    programYear: 'Y1',
    weekNumber: 7,
    version: 1,
    status: 'published',
    publishedAt: '2026-09-08T00:00:00+05:30',
    notesCount: 5,
    mcqCount: 75,
    subjectiveCount: 5,
    approval: { notes: 'approved', assessment: 'approved' },
    checksum: 'sha256:a1b2c3d4e5f6...'
  },
  {
    _id: 'MBL-R-2026-W06-V1',
    releaseId: 'MBL-R-2026-W06-V1',
    releaseType: 'weekly',
    academicYearId: 'AY-2026',
    programYear: 'Y1',
    weekNumber: 6,
    version: 1,
    status: 'published',
    publishedAt: '2026-09-01T00:00:00+05:30',
    notesCount: 5,
    mcqCount: 75,
    subjectiveCount: 5,
    approval: { notes: 'approved', assessment: 'approved' },
    checksum: 'sha256:f6e5d4c3b2a1...'
  },
  {
    _id: 'MBL-R-2026-M02-V1',
    releaseId: 'MBL-R-2026-M02-V1',
    releaseType: 'monthly',
    academicYearId: 'AY-2026',
    programYear: 'Y1',
    weekNumber: null,
    month: 2,
    version: 1,
    status: 'published',
    publishedAt: '2026-09-01T00:00:00+05:30',
    notesCount: 0,
    mcqCount: 125,
    subjectiveCount: 25,
    approval: { notes: 'n/a', assessment: 'approved' },
    checksum: 'sha256:1a2b3c4d5e6f...'
  },
  {
    _id: 'MBL-R-2026-W08-V1',
    releaseId: 'MBL-R-2026-W08-V1',
    releaseType: 'weekly',
    academicYearId: 'AY-2026',
    programYear: 'Y1',
    weekNumber: 8,
    version: 1,
    status: 'draft',
    publishedAt: null,
    notesCount: 3,
    mcqCount: 45,
    subjectiveCount: 3,
    approval: { notes: 'draft', assessment: 'draft' },
    checksum: null
  }
];

// ─── Audit Logs ───────────────────────────────────────────────────────────────

const auditLogs = [
  {
    _id: 'audit_001',
    timestamp: '2026-09-09T14:30:00+05:30',
    actor: 'Lokap Sahu',
    actorRole: 'admin',
    action: 'user.approved',
    entity: 'User',
    entityId: 'usr_003',
    entityName: 'Sneha Reddy',
    details: 'Trial started: 2026-09-03 to 2026-09-17',
    result: 'success'
  },
  {
    _id: 'audit_002',
    timestamp: '2026-09-08T10:00:00+05:30',
    actor: 'Lokap Sahu',
    actorRole: 'admin',
    action: 'release.published',
    entity: 'Release',
    entityId: 'MBL-R-2026-W07-V1',
    entityName: 'Week 7 Release',
    details: 'Published 5 notes, 75 MCQs, 5 subjective questions',
    result: 'success'
  },
  {
    _id: 'audit_003',
    timestamp: '2026-09-08T09:55:00+05:30',
    actor: 'Lokap Sahu',
    actorRole: 'admin',
    action: 'release.approved',
    entity: 'Release',
    entityId: 'MBL-R-2026-W07-V1',
    entityName: 'Week 7 Release',
    details: 'Notes and assessment approved after review',
    result: 'success'
  },
  {
    _id: 'audit_004',
    timestamp: '2026-09-07T16:00:00+05:30',
    actor: 'Lokap Sahu',
    actorRole: 'admin',
    action: 'user.rejected',
    entity: 'User',
    entityId: 'usr_rejected_001',
    entityName: 'Test User',
    details: 'Application rejected: Could not verify MBL enrollment',
    result: 'success'
  },
  {
    _id: 'audit_005',
    timestamp: '2026-09-06T11:00:00+05:30',
    actor: 'Lokap Sahu',
    actorRole: 'admin',
    action: 'evaluation.retried',
    entity: 'Evaluation',
    entityId: 'eval_failed_001',
    entityName: 'C02 Week 6 subjective',
    details: 'Evaluation retry after API timeout',
    result: 'success'
  },
  {
    _id: 'audit_006',
    timestamp: '2026-09-05T14:30:00+05:30',
    actor: 'System',
    actorRole: 'system',
    action: 'trial.expired',
    entity: 'User',
    entityId: 'usr_004',
    entityName: 'Rohit Iyer',
    details: 'Trial period ended. Account state changed to trial_expired.',
    result: 'success'
  },
  {
    _id: 'audit_007',
    timestamp: '2026-09-01T08:00:00+05:30',
    actor: 'Lokap Sahu',
    actorRole: 'admin',
    action: 'release.published',
    entity: 'Release',
    entityId: 'MBL-R-2026-M02-V1',
    entityName: 'Month 2 Simulation',
    details: 'Published monthly simulation for 5 courses',
    result: 'success'
  }
];

// ─── Admin Dashboard Stats ────────────────────────────────────────────────────

const adminStats = {
  totalUsers: 7,
  pendingApprovals: 2,
  activeTrials: 2,
  paidLearners: 2,
  expiredLearners: 1,
  totalCourses: 5,
  publishedReleases: 3,
  weeklyAttempts: 18,
  monthlyAttempts: 4,
  evaluationsPending: 3
};

// ─── Content Management Data ──────────────────────────────────────────────────

const contentItems = [
  {
    _id: 'content_001',
    courseId: 'C01',
    courseName: 'Contract Law',
    type: 'revision_notes',
    title: 'Free Consent — Coercion, Undue Influence & Misrepresentation',
    topic: 'Free Consent',
    weekNumber: 7,
    version: 1,
    source: 'ai_generated',
    approvalStatus: 'approved',
    lastUpdated: '2026-09-07T15:00:00+05:30'
  },
  {
    _id: 'content_002',
    courseId: 'C02',
    courseName: 'Banking Law',
    type: 'revision_notes',
    title: 'Negotiable Instruments — Promissory Notes & Bills of Exchange',
    topic: 'Negotiable Instruments',
    weekNumber: 7,
    version: 1,
    source: 'adapted',
    approvalStatus: 'approved',
    lastUpdated: '2026-09-07T15:30:00+05:30'
  },
  {
    _id: 'content_003',
    courseId: 'C01',
    courseName: 'Contract Law',
    type: 'revision_notes',
    title: 'Consideration and Capacity to Contract',
    topic: 'Consideration',
    weekNumber: 8,
    version: 1,
    source: 'ai_generated',
    approvalStatus: 'draft',
    lastUpdated: '2026-09-09T10:00:00+05:30'
  }
];

const assessmentItems = [
  {
    _id: 'MBL-Q-001001',
    courseId: 'C01',
    courseName: 'Contract Law',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    topic: 'Free Consent',
    difficulty: 'medium',
    origin: 'pyq_reused',
    originBadge: 'Past Year Question — Contract Law, 2024',
    approvalStatus: 'approved',
    marks: 2,
    version: 1,
    prompt: 'Under Section 15 of the Indian Contract Act, 1872, coercion includes which of the following?'
  },
  {
    _id: 'MBL-Q-001002',
    courseId: 'C01',
    courseName: 'Contract Law',
    questionType: 'application',
    responseFormat: 'single_choice_mcq',
    topic: 'Undue Influence',
    difficulty: 'medium',
    origin: 'practice_reused',
    originBadge: 'Practice Question',
    approvalStatus: 'approved',
    marks: 2,
    version: 1,
    prompt: 'A spiritual guru tells his devotee that refusing to transfer property...'
  },
  {
    _id: 'MBL-Q-002001',
    courseId: 'C01',
    courseName: 'Contract Law',
    questionType: 'scenario_advice',
    responseFormat: 'subjective',
    topic: 'Free Consent',
    difficulty: 'hard',
    origin: 'ai_generated',
    originBadge: 'AI-Generated',
    approvalStatus: 'approved',
    marks: 10,
    version: 1,
    prompt: 'Anand, an elderly retired teacher...'
  },
  {
    _id: 'MBL-Q-006001',
    courseId: 'C02',
    courseName: 'Banking Law',
    questionType: 'concept',
    responseFormat: 'single_choice_mcq',
    topic: 'NI Act',
    difficulty: 'easy',
    origin: 'pyq_reused',
    originBadge: 'Past Year Question — Banking Law, 2024',
    approvalStatus: 'needs_review',
    marks: 2,
    version: 1,
    prompt: 'Under Section 138 of the Negotiable Instruments Act...'
  }
];

// ─── Pricing Plans ────────────────────────────────────────────────────────────

const plans = [
  {
    code: 'annual',
    name: 'Annual Plan',
    price: 20000,
    currency: 'INR',
    duration: '1 year',
    description: 'Full access to all Year 1 courses, weekly sprints, and monthly simulations for one year.',
    features: [
      'All 5 Year 1 courses',
      'Weekly revision sprints',
      'Monthly exam simulations',
      'AI-assisted evaluation',
      'Leaderboard participation',
      'Full result history'
    ]
  },
  {
    code: 'completion',
    name: 'Completion Plan',
    price: 35000,
    currency: 'INR',
    duration: '5 years',
    description: 'Full access for the entire MBL program duration including Year 1 and Year 2 when available.',
    features: [
      'Everything in Annual Plan',
      'Year 2 courses when available',
      '5-year continuous access',
      'Priority support',
      'Best value for full program'
    ]
  }
];

module.exports = {
  demoUser,
  adminUser,
  allUsers,
  courses,
  year2Courses,
  weeklySprintNotes,
  weeklyMCQs,
  weeklySubjective,
  weeklySprints,
  monthlySimulations,
  simulationPassages,
  simulationPartB,
  simulationPartC,
  sampleResult,
  weeklyLeaderboard,
  aggregateLeaderboard,
  notifications,
  releases,
  auditLogs,
  adminStats,
  contentItems,
  assessmentItems,
  plans
};
