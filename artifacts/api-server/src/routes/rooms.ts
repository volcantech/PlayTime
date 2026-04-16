import { Router } from "express";
import { getRoomByCode } from "../lib/gameEngine";
import { getC4RoomByCode } from "../lib/connect4Engine";
import { getUCRoomByCode } from "../lib/undercoverEngine";
import { getPBRoomByCode } from "../lib/petitBacEngine";

const router = Router();

router.get("/:code", (req, res) => {
  const code = req.params.code.toUpperCase();

  const bmc = getRoomByCode(code);
  if (bmc) return res.json({ code, gameType: "bmc" });

  const c4 = getC4RoomByCode(code);
  if (c4) return res.json({ code, gameType: "connect4" });

  const uc = getUCRoomByCode(code);
  if (uc) return res.json({ code, gameType: "undercover" });

  const pb = getPBRoomByCode(code);
  if (pb) return res.json({ code, gameType: "petitbac" });

  return res.status(404).json({ error: "Salle introuvable." });
});

export default router;
