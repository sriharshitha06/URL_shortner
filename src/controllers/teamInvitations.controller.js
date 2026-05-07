const { sendError } = require("../http-response");
const { validateInvitationRequest } = require("../validators/teamInvitations.validator");
const teamInvitationsService = require("../services/teamInvitations.service");

function sendValidationError(res, fields) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid invitation request.",
      fields,
    },
  });
}

function sendStandardError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function getRequesterId(req) {
  return req.principal_id || null;
}

function getRequesterEmail(req) {
  return req.header('x-user-email') || null;
}

async function handleCreateTeamInvitation(req, res, next) {
  try {
    const validation = validateInvitationRequest(req.body);

    if (!validation.valid) {
      return sendValidationError(res, validation.fields);
    }

    const teamId = String(validation.value.teamId);
    const inviteeEmail = validation.value.inviteeEmail;
    const normalizedInviteeEmail = teamInvitationsService.normalizeInviteeEmail(inviteeEmail);
    const role = validation.value.role;
    const requesterId = getRequesterId(req);

    if (!requesterId) {
      return sendError(req, res, 401, "UNAUTHORIZED", "Missing or invalid API key");
    }

    const membership = await teamInvitationsService.getMembershipRole({
      teamId,
      userId: requesterId,
    });

    if (membership.status === "team_missing" || membership.status === "not_member") {
      return sendStandardError(res, 404, "TEAM_NOT_FOUND", "Team not found.");
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return sendStandardError(
        res,
        403,
        "INSUFFICIENT_TEAM_PERMISSIONS",
        "You do not have permission to invite members to this team."
      );
    }

    const requesterEmail = getRequesterEmail(req);

    if (
      typeof requesterEmail === "string" &&
      teamInvitationsService.normalizeInviteeEmail(requesterEmail) === normalizedInviteeEmail
    ) {
      return sendStandardError(
        res,
        409,
        "SELF_INVITE_NOT_ALLOWED",
        "You cannot invite yourself to the team."
      );
    }

    const existingInvite = await teamInvitationsService.findPendingInvitation({
      teamId,
      normalizedInviteeEmail,
    });

    if (existingInvite) {
      return sendStandardError(
        res,
        409,
        "DUPLICATE_PENDING_INVITATION",
        "A pending invitation already exists for this team and email."
      );
    }

    const invitation = await teamInvitationsService.createTeamInvitation({
      teamId,
      normalizedInviteeEmail,
      role,
      invitedBy: requesterId,
    });

    return res.status(201).json({
      id: String(invitation.id),
      teamId: invitation.team_id,
      inviteeEmail: invitation.normalized_invitee_email,
      role: invitation.role,
      status: invitation.status,
      invitedBy: invitation.invited_by,
      createdAt: invitation.created_at,
    });
  } catch (error) {
    if (error instanceof teamInvitationsService.DuplicatePendingInvitationError) {
      return sendStandardError(
        res,
        409,
        "DUPLICATE_PENDING_INVITATION",
        "A pending invitation already exists for this team and email."
      );
    }

    return next(error);
  }
}

module.exports = { handleCreateTeamInvitation };
