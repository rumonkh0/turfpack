import crypto from "crypto";
import { getDatabase, runTransaction, listRecords, findById } from "../db/sqlite.js";

export function getCurrentShares() {
  const db = getDatabase();
  return db.prepare(`
    SELECT psr.*, u.full_name, u.email
    FROM profit_share_ratios psr
    JOIN users u ON u.id = psr.user_id
    WHERE psr.effective_to IS NULL
    ORDER BY psr.share_bp DESC
  `).all();
}

export function getCurrentVersion() {
  const db = getDatabase();
  const row = db.prepare("SELECT MAX(version) as max_version FROM profit_share_ratios").get();
  return row?.max_version || 0;
}

export function reallocateShares(shares, changedBy, reason) {
  const db = getDatabase();

  const totalBp = shares.reduce((sum, s) => sum + s.share_bp, 0);
  if (totalBp !== 10000) {
    throw new Error(`Share sum must equal 10000 bp, got ${totalBp}`);
  }

  for (const share of shares) {
    const user = findById("users", share.user_id);
    if (!user) throw new Error(`User not found: ${share.user_id}`);
    if (user.role !== "partner") throw new Error(`User ${user.full_name} is not a partner`);
  }

  return runTransaction(() => {
    const currentVersion = getCurrentVersion();
    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    if (currentVersion > 0) {
      db.prepare("UPDATE profit_share_ratios SET effective_to = ? WHERE effective_to IS NULL")
        .run(today);
    }

    const insertRatio = db.prepare(`
      INSERT INTO profit_share_ratios (id, user_id, share_bp, effective_from, effective_to, version, created_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?)
    `);

    for (const share of shares) {
      insertRatio.run(crypto.randomUUID(), share.user_id, share.share_bp, today, newVersion, now);
    }

    const snapshot = shares.map((s) => {
      const user = findById("users", s.user_id);
      return { user_id: s.user_id, full_name: user.full_name, share_bp: s.share_bp };
    });

    db.prepare(`
      INSERT INTO profit_share_change_log (id, version, changed_by, reason, snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), newVersion, changedBy, reason || null, JSON.stringify(snapshot), now);

    return { version: newVersion, shares: snapshot };
  });
}

export function assignInitialShare(userId) {
  const currentShares = getCurrentShares();
  if (currentShares.length > 0) {
    throw new Error("Partners already exist. Use reallocate to adjust shares.");
  }

  return runTransaction(() => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const user = findById("users", userId);

    const insertRatio = getDatabase().prepare(`
      INSERT INTO profit_share_ratios (id, user_id, share_bp, effective_from, effective_to, version, created_at)
      VALUES (?, ?, 10000, ?, NULL, 1, ?)
    `);
    insertRatio.run(crypto.randomUUID(), userId, today, now);

    const snapshot = [{ user_id: userId, full_name: user.full_name, share_bp: 10000 }];
    getDatabase().prepare(`
      INSERT INTO profit_share_change_log (id, version, changed_by, reason, snapshot, created_at)
      VALUES (?, 1, ?, 'First partner — auto-assigned 100%', ?, ?)
    `).run(crypto.randomUUID(), userId, JSON.stringify(snapshot), now);

    return { version: 1, shares: snapshot };
  });
}

export function getEffectiveShares(from, to) {
  const db = getDatabase();

  const versions = db.prepare(`
    SELECT DISTINCT version, effective_from, effective_to
    FROM profit_share_ratios
    WHERE effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY version
  `).all(to, from);

  if (versions.length === 0) return [];

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const totalDays = Math.round((toDate - fromDate) / 86400000) + 1;

  const partnerWeights = {};

  for (const ver of versions) {
    const overlapStart = new Date(Math.max(new Date(ver.effective_from), fromDate));
    const overlapEnd = ver.effective_to
      ? new Date(Math.min(new Date(ver.effective_to), toDate))
      : toDate;
    const overlapDays = Math.round((overlapEnd - overlapStart) / 86400000) + 1;

    if (overlapDays <= 0) continue;

    const ratios = db.prepare(
      "SELECT user_id, share_bp FROM profit_share_ratios WHERE version = ?"
    ).all(ver.version);

    for (const r of ratios) {
      if (!partnerWeights[r.user_id]) partnerWeights[r.user_id] = 0;
      partnerWeights[r.user_id] += r.share_bp * (overlapDays / totalDays);
    }
  }

  const result = Object.entries(partnerWeights).map(([user_id, weightedBp]) => ({
    user_id,
    effective_bp: Math.round(weightedBp),
  }));

  const bpSum = result.reduce((s, r) => s + r.effective_bp, 0);
  if (bpSum !== 10000 && result.length > 0) {
    const diff = 10000 - bpSum;
    result.sort((a, b) => {
      const aRem = partnerWeights[a.user_id] - Math.floor(partnerWeights[a.user_id]);
      const bRem = partnerWeights[b.user_id] - Math.floor(partnerWeights[b.user_id]);
      return bRem - aRem;
    });
    result[0].effective_bp += diff;
  }

  return result;
}

export function getShareHistory(limit = 20) {
  return listRecords("profit_share_change_log", {
    sort: "-created_at",
    limit,
  });
}
