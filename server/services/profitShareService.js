import crypto from "crypto";
import prisma from "../db/prismaClient.js";

export async function getCurrentShares() {
  return await prisma.$queryRawUnsafe(`
    SELECT psr.*, u.full_name, u.email
    FROM profit_share_ratios psr
    JOIN users u ON u.id = psr.user_id
    WHERE psr.effective_to IS NULL
    ORDER BY psr.share_bp DESC
  `);
}

export async function getCurrentVersion() {
  const row = await prisma.$queryRawUnsafe("SELECT MAX(version) as max_version FROM profit_share_ratios");
  return row.length > 0 ? Number(row[0].max_version || 0) : 0;
}

export async function reallocateShares(shares, changedBy, reason) {
  const totalBp = shares.reduce((sum, s) => sum + s.share_bp, 0);
  if (totalBp !== 10000) {
    throw new Error(`Share sum must equal 10000 bp, got ${totalBp}`);
  }

  for (const share of shares) {
    const user = await prisma.user.findUnique({ where: { id: share.user_id } });
    if (!user) throw new Error(`User not found: ${share.user_id}`);
    if (user.role !== "partner") throw new Error(`User ${user.full_name} is not a partner`);
  }

  return await prisma.$transaction(async (tx) => {
    // Cannot call getCurrentVersion within transaction directly if it uses prisma client, 
    // better use tx explicitly:
    const row = await tx.$queryRawUnsafe("SELECT MAX(version) as max_version FROM profit_share_ratios");
    const currentVersion = row.length > 0 ? Number(row[0].max_version || 0) : 0;
    
    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    if (currentVersion > 0) {
      await tx.$queryRawUnsafe("UPDATE profit_share_ratios SET effective_to = ? WHERE effective_to IS NULL", today);
    }

    for (const share of shares) {
      await tx.profitShareRatio.create({
        data: {
          user_id: share.user_id,
          share_bp: share.share_bp,
          effective_from: today,
          version: newVersion,
        }
      });
    }

    const snapshot = [];
    for (const s of shares) {
      const user = await tx.user.findUnique({ where: { id: s.user_id } });
      snapshot.push({ user_id: s.user_id, full_name: user.full_name, share_bp: s.share_bp });
    }

    await tx.profitShareChangeLog.create({
      data: {
        version: newVersion,
        changed_by: changedBy,
        reason: reason || null,
        snapshot: JSON.stringify(snapshot),
      }
    });

    return { version: newVersion, shares: snapshot };
  });
}

export async function assignInitialShare(userId) {
  const currentShares = await getCurrentShares();
  if (currentShares.length > 0) {
    throw new Error("Partners already exist. Use reallocate to adjust shares.");
  }

  return await prisma.$transaction(async (tx) => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const user = await tx.user.findUnique({ where: { id: userId } });

    await tx.profitShareRatio.create({
      data: {
        user_id: userId,
        share_bp: 10000,
        effective_from: today,
        version: 1,
      }
    });

    const snapshot = [{ user_id: userId, full_name: user?.full_name || "Unknown", share_bp: 10000 }];
    
    await tx.profitShareChangeLog.create({
      data: {
        version: 1,
        changed_by: userId,
        reason: 'First partner — auto-assigned 100%',
        snapshot: JSON.stringify(snapshot),
      }
    });

    return { version: 1, shares: snapshot };
  });
}

export async function getEffectiveShares(from, to) {
  const versions = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT version, effective_from, effective_to
    FROM profit_share_ratios
    WHERE effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY version
  `, to, from);

  if (versions.length === 0) return [];

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const totalDays = Math.round((toDate - fromDate) / 86400000) + 1;

  const partnerWeights = {};

    for (const ver of versions) {
      const verNumber = Number(ver.version);
      const overlapStart = new Date(Math.max(new Date(ver.effective_from), fromDate));
      const overlapEnd = ver.effective_to
        ? new Date(Math.min(new Date(ver.effective_to), toDate))
        : toDate;
      const overlapDays = Math.round((overlapEnd - overlapStart) / 86400000) + 1;

      if (overlapDays <= 0) continue;

      const ratios = await prisma.$queryRawUnsafe(
        "SELECT user_id, share_bp FROM profit_share_ratios WHERE version = ?",
        verNumber
      );

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

export async function getShareHistory(limit = 20) {
  return await prisma.profitShareChangeLog.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}
