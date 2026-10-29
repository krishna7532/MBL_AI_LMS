'use strict';

const prisma = require('../config/db');
require('../routes/admin');

const pendingApprovalWhere = {
  account_state: 'pending_approval',
  // consents: { some: { consent_type: 'terms', withdrawn_at: null } },
  // AND: [{ consents: { some: { consent_type: 'privacy', withdrawn_at: null } } }],
};

exports.getDashboardStats = async () => {
  const [totalUsers, pendingApprovals, activeTrials, paidLearners, expiredLearners] =
    await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: pendingApprovalWhere }),
      prisma.users.count({ where: { account_state: 'trial_active' } }),
      prisma.users.count({ where: { account_state: 'paid_active' } }),
      prisma.users.count({ where: { account_state: 'trial_expired' } }),
    ]);

  return {
    total_users: totalUsers,
    pending_approvals: pendingApprovals,
    active_trials: activeTrials,
    paid_learners: paidLearners,
    expired_learners: expiredLearners,
  };
};

exports.getPendingApprovals = async () =>
  prisma.users.findMany({
    where: pendingApprovalWhere,
    orderBy: { created_at: 'asc' },
  });

exports.getAdmin = async () =>
  prisma.users.findFirst({
    where: { role: 'admin_publisher' },
    select: { id: true },
  });

exports.getAllUser = async () =>
  prisma.users.findMany({
    where: { role: { notIn: ['admin_publisher', 'content_editor'] } },
    orderBy: { created_at: 'asc' },
    include: {
      trials: {
        where: { state: 'active' },
        orderBy: { ends_at: 'desc' },
        take: 1,
      },
      subscriptions: {
        where: { status: 'active' },
        orderBy: { ends_at: 'desc' },
        take: 1,
        include: { plans: true },
      },
      leaderboard_profiles: true,
    },
  });

exports.getAllRevisionNotes = async () =>
  prisma.revision_notes.findMany({
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      created_at: true,
      stable_id: true,
      version: true,
      markdown: true,
      approval_status: true,
      courses: {
        select: {
          code: true,
          display_name: true,
        },
      },
      content_releases: {
        select: {
          release_type: true,
          week_number: true,
          notes_approval_status: true,
          status: true,
        },
      },
    },
  });

exports.getAllAssessment = async () =>
  prisma.assessment_items.findMany({
    orderBy: { created_at: 'asc' },
    select: {
      section: true,
      questions: {
        select: {
          id: true,
          version: true,
          question_id: true,
          question_type: true,
          response_format: true,
          concept_ids: true,
          origin: true,
          approval_status: true,
          marks: true,
          prompt_markdown: true,
          learner_badge: true,
          courses: {
            select: {
              code: true,
              display_name: true,
            },
          },
        },
      },
    },
  });

exports.getAssessmentQuestionById = async (id) =>
  prisma.questions.findUnique({
    where: { id },
    select: {
      id: true,
      question_id: true,
      version: true,
      question_number: true,
      exam_role: true,
      question_type: true,
      response_format: true,
      stem_form: true,
      concept_ids: true,
      prompt_markdown: true,
      options: true,
      correct_option_ids: true,
      explanation_markdown: true,
      directive_verbs: true,
      marks: true,
      sub_issues: true,
      required_authority: true,
      required_output: true,
      assumptions_policy: true,
      rubric: true,
      expected_answer_points: true,
      origin: true,
      source_refs: true,
      pattern_confidence: true,
      approval_status: true,
      learner_badge: true,
      courses: {
        select: {
          code: true,
          display_name: true,
        },
      },
      passages: {
        select: {
          stable_id: true,
          version: true,
          passage_text: true,
        },
      },
      assessment_items: {
        select: {
          section: true,
        },
      },
    },
  });

exports.getAllReleases = async () =>
  prisma.content_releases.findMany({
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      release_id: true,
      release_type: true,
      week_number: true,
      month_number: true,
      version: true,
      status: true,
      publish_at: true,
      content_checksum: true,
      notes_approval_status: true,
      assessment_approval_status: true,
      revision_notes: {
        select: { id: true },
      },
      assessments: {
        select: {
          assessment_items: {
            select: {
              questions: {
                select: { response_format: true },
              },
            },
          },
        },
      },
    },
  });

exports.getReleaseById = async (id) =>
  prisma.content_releases.findUnique({
    where: { id },
    select: {
      id: true,
      release_id: true,
      release_type: true,
      program_year: true,
      week_number: true,
      month_number: true,
      version: true,
      status: true,
      publish_at: true,
      content_checksum: true,
      notes_approval_status: true,
      assessment_approval_status: true,
      academic_years: {
        select: { label: true },
      },
      revision_notes: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          stable_id: true,
          version: true,
          markdown: true,
          courses: {
            select: {
              code: true,
              display_name: true,
            },
          },
        },
      },
      assessments: {
        orderBy: { created_at: 'asc' },
        select: {
          assessment_id: true,
          title: true,
          type: true,
          status: true,
          courses: {
            select: {
              code: true,
              display_name: true,
            },
          },
          assessment_items: {
            orderBy: { item_order: 'asc' },
            select: {
              section: true,
              item_order: true,
              compulsory: true,
              passages: {
                select: {
                  stable_id: true,
                  version: true,
                  passage_text: true,
                },
              },
              questions: {
                select: {
                  question_id: true,
                  version: true,
                  question_number: true,
                  question_type: true,
                  response_format: true,
                  prompt_markdown: true,
                  options: true,
                  correct_option_ids: true,
                  explanation_markdown: true,
                  marks: true,
                  rubric: true,
                  expected_answer_points: true,
                },
              },
            },
          },
        },
      },
    },
  });

exports.getAllAuditEvent = async () =>
  prisma.audit_events.findMany({
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      created_at: true,
      action: true,
      target_type: true,
      target_id: true,
      before_data: true,
      after_data: true,
      reason: true,
      users: {
        select: {
          name: true,
          role: true,
        },
      },
    },
  });


//For preview action querry
exports.getRevisionNoteById = async (id) =>
  prisma.revision_notes.findUnique({
    where: { id },
    select: {
      id: true,
      stable_id: true,
      version: true,
      markdown: true,
      created_at: true,
      approval_status:true,
      courses: {
        select: {
          code: true,
          display_name: true,
        },
      },
      content_releases: {
        select: {
          release_type: true,
          week_number: true,
          month_number: true,
        },
      },
    },
  });

  exports.getAllAssessmentById=async (id)=>
    prisma.assessment_items.findUnique({
      where:{id},
        select: {
      id:true,
      questions: {
        select: {
          prompt_markdown: true,
          options: true,
          courses: {
            select: {
              code: true,
              display_name: true,
            },
          },
        },
      },
    }
    })
exports.getUsersByIds = async (userIds) =>
  prisma.users.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });

exports.getAllCourse=async ()=>
      prisma.courses.findMany({
        orderBy:{created_at:'asc'}
 });

exports.getAllContent=async ()=>
        prisma.content_releases.findMany({
         orderBy :{created_at: 'asc'}
 });
exports.decidePendingUser = async (prismaTransaction, userId, adminId, decision, reason) => {
  const nextAccountState = decision === 'approved' ? 'trial_active' : 'rejected';
  const previousUser = await prismaTransaction.users.findUnique({
    where: { id: userId },
    select: { id: true, account_state: true, role: true },
  });

  if (!previousUser) {
    const error = new Error('The applicant could not be found.');
    error.status = 404;
    throw error;
  }

  const updateResult = await prismaTransaction.users.updateMany({
    where: { id: userId, account_state: 'pending_approval' },
    data: {
      account_state: nextAccountState,
      ...(decision === 'approved' ? { role: 'approved_trial_learner' } : {}),
      updated_at: new Date(),
    },
  });

  if (!updateResult.count) {
    const error = new Error('The applicant is no longer awaiting approval.');
    error.status = 409;
    throw error;
  }

  let trial = null;
  if (decision === 'approved') {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    trial = await prismaTransaction.trials.create({
      data: { user_id: userId, starts_at: startsAt, ends_at: endsAt, state: 'active' },
      select: { starts_at: true, ends_at: true },
    });
  }

  await prismaTransaction.access_approvals.create({
    data: {
      user_id: userId,
      admin_id: adminId,
      decision,
      reason: reason || null,
    },
  });

  await prismaTransaction.audit_events.create({
    data: {
      actor_id: adminId,
      action: decision === 'approved' ? 'user.accepted' : 'user.rejected',
      target_type: 'user',
      target_id: userId,
      before_data: {
        account_state: previousUser.account_state,
        role: previousUser.role,
      },
      after_data: {
        account_state: nextAccountState,
        role: decision === 'approved' ? 'approved_trial_learner' : previousUser.role,
      },
      reason: reason || null,
    },
  });

  return { status: 'ok', trial };
};
