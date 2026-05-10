const VALID_ROLES = new Set(["admin", "member"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateInvitationRequest(body) {
  const fields = {};
  const value = {
    teamId: body?.teamId,
    inviteeEmail: body?.inviteeEmail,
    role: body?.role,
  };

  if (value.teamId === null || value.teamId === "") {
    fields.teamId = "teamId is required.";
  }

  if (typeof value.inviteeEmail !== "string" || !EMAIL_PATTERN.test(value.inviteeEmail.trim())) {
    fields.inviteeEmail = "inviteeEmail must be a valid email address.";
  }

  if (typeof value.role !== "string" || !VALID_ROLES.has(value.role)) {
    fields.role = "role must be one of: admin, member.";
  }

  return {
    valid: Object.keys(fields).length === 0,
    fields,
    value: {
      teamId: value.teamId,
      inviteeEmail: typeof value.inviteeEmail === "string" ? value.inviteeEmail.trim() : value.inviteeEmail,
      role: value.role,
    },
  };
}

module.exports = { validateInvitationRequest };
