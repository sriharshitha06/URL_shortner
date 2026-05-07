const express = require("express");
const { requireApiKey } = require("../auth");
const { handleCreateTeamInvitation } = require("../controllers/teamInvitations.controller");

const router = express.Router();

router.post(
  "/team-invitations",
  requireApiKey,
  handleCreateTeamInvitation
);

module.exports = router;
