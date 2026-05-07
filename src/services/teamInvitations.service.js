const { query } = require("../db");
const env = require("../../config/env");

const DUPLICATE_ERROR_CODE = "23505";

let nextInMemoryInvitationId = 1;
const inMemoryTeams = new Set();
const inMemoryMemberships = [];
const inMemoryInvitations = [];

function normalizeTeamId(teamId) {
  return String(teamId);
}

function normalizeInviteeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function ensureTeamTables() {
  if (env.useInMemoryStore) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS team_teams (
      id TEXT PRIMARY KEY
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS team_memberships (
      id BIGSERIAL PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES team_teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      UNIQUE(team_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS team_invitations (
      id BIGSERIAL PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES team_teams(id) ON DELETE CASCADE,
      normalized_invitee_email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      invited_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_unique_idx
    ON team_invitations (team_id, normalized_invitee_email)
    WHERE status = 'pending'
  `);
}

class DuplicatePendingInvitationError extends Error {}

function translateDbErrorToDuplicatePendingInvitationError(error) {
  if (error && error.code === DUPLICATE_ERROR_CODE) {
    const duplicateError = new DuplicatePendingInvitationError(
      "A pending invitation already exists for this team and email."
    );
    duplicateError.originalError = error;
    throw duplicateError;
  }

  throw error;
}

async function getMembershipRole({ teamId, userId }) {
  const normalizedTeamId = normalizeTeamId(teamId);
  const normalizedUserId = String(userId);

  if (env.useInMemoryStore) {
    if (!inMemoryTeams.has(normalizedTeamId)) {
      return { status: "team_missing", role: null };
    }

    const membership = inMemoryMemberships.find(
      (row) => row.team_id === normalizedTeamId && row.user_id === normalizedUserId
    );

    if (!membership) {
      return { status: "not_member", role: null };
    }

    return { status: "member_with_role", role: membership.role };
  }

  await ensureTeamTables();

  const teamResult = await query(
    `SELECT id FROM team_teams WHERE id = $1`,
    [normalizedTeamId]
  );

  if (!teamResult.rows.length) {
    return { status: "team_missing", role: null };
  }

  const membershipResult = await query(
    `SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2`,
    [normalizedTeamId, normalizedUserId]
  );

  if (!membershipResult.rows.length) {
    return { status: "not_member", role: null };
  }

  return { status: "member_with_role", role: membershipResult.rows[0].role };
}

async function findPendingInvitation({ teamId, normalizedInviteeEmail }) {
  const normalizedTeamId = normalizeTeamId(teamId);

  if (env.useInMemoryStore) {
    return inMemoryInvitations.find(
      (row) =>
        row.team_id === normalizedTeamId &&
        row.normalized_invitee_email === normalizedInviteeEmail &&
        row.status === "pending"
    );
  }

  await ensureTeamTables();

  const result = await query(
    `
      SELECT id, team_id, normalized_invitee_email, role, invited_by, status, created_at
      FROM team_invitations
      WHERE team_id = $1
        AND normalized_invitee_email = $2
        AND status = 'pending'
      LIMIT 1
    `,
    [normalizedTeamId, normalizedInviteeEmail]
  );

  return result.rows[0] || null;
}

async function createTeamInvitation({
  teamId,
  normalizedInviteeEmail,
  role,
  invitedBy,
}) {
  const normalizedTeamId = normalizeTeamId(teamId);

  if (env.useInMemoryStore) {
    const row = {
      id: nextInMemoryInvitationId,
      team_id: normalizedTeamId,
      normalized_invitee_email: normalizedInviteeEmail,
      role,
      invited_by: invitedBy,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    nextInMemoryInvitationId += 1;
    inMemoryInvitations.unshift(row);
    return row;
  }

  await ensureTeamTables();

  try {
    const result = await query(
      `
        INSERT INTO team_invitations (
          team_id,
          normalized_invitee_email,
          role,
          invited_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, team_id, normalized_invitee_email, role, invited_by, status, created_at
      `,
      [normalizedTeamId, normalizedInviteeEmail, role, invitedBy]
    );

    return result.rows[0];
  } catch (error) {
    if (error && error.code === DUPLICATE_ERROR_CODE) {
      throw new DuplicatePendingInvitationError(
        "A pending invitation already exists for this team and email."
      );
    }

    throw error;
  }
}

function resetInMemoryStores() {
  inMemoryTeams.clear();
  inMemoryMemberships.length = 0;
  inMemoryInvitations.length = 0;
  nextInMemoryInvitationId = 1;
}

function seedTeam({ teamId }) {
  inMemoryTeams.add(normalizeTeamId(teamId));
}

function seedMembership({ teamId, userId, role }) {
  inMemoryTeams.add(normalizeTeamId(teamId));
  inMemoryMemberships.push({
    team_id: normalizeTeamId(teamId),
    user_id: String(userId),
    role,
  });
}

function seedPendingInvitation({
  teamId,
  inviteeEmail,
  role,
  invitedBy,
  status = "pending",
}) {
  inMemoryTeams.add(normalizeTeamId(teamId));

  inMemoryInvitations.unshift({
    id: nextInMemoryInvitationId,
    team_id: normalizeTeamId(teamId),
    normalized_invitee_email: normalizeInviteeEmail(inviteeEmail),
    role,
    invited_by: invitedBy,
    status,
    created_at: new Date().toISOString(),
  });

  nextInMemoryInvitationId += 1;
}

module.exports = {
  normalizeInviteeEmail,
  getMembershipRole,
  findPendingInvitation,
  createTeamInvitation,
  translateDbErrorToDuplicatePendingInvitationError,
  DuplicatePendingInvitationError,
  __test: {
    resetInMemoryStores,
    seedTeam,
    seedMembership,
    seedPendingInvitation,
  },
};
