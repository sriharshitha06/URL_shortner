process.env.USE_IN_MEMORY_STORE = "true";
process.env.API_KEYS = JSON.stringify({ "test-key-a": "user-1" });

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const teamInvitationsService = require("../src/services/teamInvitations.service");
const app = require("../src/index");

const BASE_PATH = "/team-invitations";
let server;
let baseUrl;

async function request(body, user, apiKey = "test-key-a") {
  const headers = { "Content-Type": "application/json" };

  headers["X-API-Key"] = apiKey;

  if (user && user.email) {
    headers["X-User-Email"] = user.email;
  }

  const response = await fetch(`${baseUrl}${BASE_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let json = null;
  const text = await response.text();

  if (text && response.headers.get("content-type")?.includes("application/json")) {
    json = JSON.parse(text);
  }

  return { response, json, text };
}

test.before(async () => {
  server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (err) => {
      if (err) {
        reject(err);
        return;
      }

      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.beforeEach(() => {
  teamInvitationsService.__test.resetInMemoryStores();
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("returns validation error for invalid request shape", async () => {
  const { response, json } = await request(
    {
      teamId: "team-1",
      inviteeEmail: "not-an-email",
      role: "superadmin",
    },
    { id: "user-1", email: "owner@example.com" }
  );

  assert.equal(response.status, 400);
  assert.equal(json.error.code, "VALIDATION_ERROR");
  assert.equal(json.error.message, "Invalid invitation request.");
  assert.ok(json.error.fields.inviteeEmail);
  assert.ok(json.error.fields.role);
});

test("returns team not found when team is missing", async () => {
  const { response, json } = await request(
    {
      teamId: "team-x",
      inviteeEmail: "invitee@example.com",
      role: "member",
    },
    { id: "user-1", email: "owner@example.com" }
  );

  assert.equal(response.status, 404);
  assert.equal(json.error.code, "TEAM_NOT_FOUND");
});

test("returns team not found when requester is not a member", async () => {
  teamInvitationsService.__test.seedTeam({ teamId: "team-1" });

  const { response, json } = await request(
    {
      teamId: "team-1",
      inviteeEmail: "invitee@example.com",
      role: "member",
    },
    { id: "user-1", email: "owner@example.com" }
  );

  assert.equal(response.status, 404);
  assert.equal(json.error.code, "TEAM_NOT_FOUND");
});

test("returns insufficient permissions when requester is a member without admin role", async () => {
  teamInvitationsService.__test.seedTeam({ teamId: "team-1" });
  teamInvitationsService.__test.seedMembership({
    teamId: "team-1",
    userId: "user-1",
    role: "member",
  });

  const { response, json } = await request(
    {
      teamId: "team-1",
      inviteeEmail: "invitee@example.com",
      role: "member",
    },
    { id: "user-1", email: "owner@example.com" }
  );

  assert.equal(response.status, 403);
  assert.equal(json.error.code, "INSUFFICIENT_TEAM_PERMISSIONS");
  assert.equal(
    json.error.message,
    "You do not have permission to invite members to this team."
  );
});

test("returns self invite not allowed when invitee email is the requester's email", async () => {
  teamInvitationsService.__test.seedTeam({ teamId: "team-1" });
  teamInvitationsService.__test.seedMembership({
    teamId: "team-1",
    userId: "user-1",
    role: "owner",
  });

  const { response, json } = await request(
    {
      teamId: "team-1",
      inviteeEmail: "OWNER@example.com",
      role: "member",
    },
    { id: "user-1", email: "owner@example.com" }
  );

  assert.equal(response.status, 409);
  assert.equal(json.error.code, "SELF_INVITE_NOT_ALLOWED");
});

test("returns duplicate pending invitation when a pending invitation already exists", async () => {
  teamInvitationsService.__test.seedTeam({ teamId: "team-1" });
  teamInvitationsService.__test.seedMembership({
    teamId: "team-1",
    userId: "user-1",
    role: "owner",
  });
  teamInvitationsService.__test.seedPendingInvitation({
    teamId: "team-1",
    inviteeEmail: "invitee@example.com",
    role: "member",
    invitedBy: "user-1",
  });

  const { response, json } = await request(
    {
      teamId: "team-1",
      inviteeEmail: "INVITEE@example.com",
      role: "member",
    },
    { id: "user-1", email: "owner@example.com" }
  );

  assert.equal(response.status, 409);
  assert.equal(json.error.code, "DUPLICATE_PENDING_INVITATION");
});

test("creates a new pending invitation successfully", async () => {
  teamInvitationsService.__test.seedTeam({ teamId: "team-1" });
  teamInvitationsService.__test.seedMembership({
    teamId: "team-1",
    userId: "user-1",
    role: "owner",
  });

  const { response, json } = await request(
    {
      teamId: "team-1",
      inviteeEmail: "invitee@example.com",
      role: "admin",
    },
    { id: "user-1", email: "owner@example.com" }
  );

  assert.equal(response.status, 201);
  assert.equal(json.teamId, "team-1");
  assert.equal(json.inviteeEmail, "invitee@example.com");
  assert.equal(json.role, "admin");
  assert.equal(json.status, "pending");
  assert.equal(json.invitedBy, "user-1");
  assert.ok(json.id);
  assert.ok(json.createdAt);
});

test("returns duplicate pending invitation when createTeamInvitation throws duplicate error during HTTP request", async () => {
  teamInvitationsService.__test.seedTeam({ teamId: "team-1" });
  teamInvitationsService.__test.seedMembership({
    teamId: "team-1",
    userId: "user-1",
    role: "owner",
  });

  const originalCreate = teamInvitationsService.createTeamInvitation;
  teamInvitationsService.createTeamInvitation = async () => {
    throw new teamInvitationsService.DuplicatePendingInvitationError(
      "A pending invitation already exists for this team and email."
    );
  };

  try {
    const { response, json } = await request(
      {
        teamId: "team-1",
        inviteeEmail: "invitee@example.com",
        role: "member",
      },
      { id: "user-1", email: "owner@example.com" }
    );

    assert.equal(response.status, 409);
    assert.equal(json.error.code, "DUPLICATE_PENDING_INVITATION");
  } finally {
    teamInvitationsService.createTeamInvitation = originalCreate;
  }
});

test("translates DB unique violation into duplicate pending invitation error", () => {
  assert.throws(
    () => {
      teamInvitationsService.translateDbErrorToDuplicatePendingInvitationError({
        code: "23505",
      });
    },
    (error) => error instanceof teamInvitationsService.DuplicatePendingInvitationError
  );
});
