/**
 * Clear demo/simulated data only. Real Nomba webhook payments are preserved.
 * Run: npx tsx src/scripts/reset-for-live.ts
 */
import "../models";
import { sequelize } from "../db";
import { Partner, Payment } from "../models";
import { nairaToKobo, rebuildPartnerLedger } from "../services/ledger";
import { Op } from "sequelize";

async function main() {
  await sequelize.sync();

  const destroyed = await Payment.destroy({
    where: {
      [Op.or]: [
        { requestId: { [Op.like]: "demo_%" } },
        { requestId: { [Op.like]: "sim_%" } },
        { requestId: { [Op.like]: "test-manual%" } },
        { nombaTransactionId: { [Op.like]: "DEMO-%" } },
      ],
    },
  });

  const now = new Date();
  const trackingStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const partners = await Partner.findAll();
  for (const p of partners) {
    if (p.virtualAccountNumber === "6087240289") {
      p.monthlyCommitmentKobo = nairaToKobo(50);
      p.pledgeTotalKobo = nairaToKobo(600);
      p.commitmentFrequency = "monthly";
      p.installmentCount = 12;
      p.fullName = "Sister Grace Adeyemi";
    } else if (p.virtualAccountNumber === "5903473362") {
      p.monthlyCommitmentKobo = nairaToKobo(100);
      p.pledgeTotalKobo = nairaToKobo(1200);
      p.commitmentFrequency = "monthly";
      p.installmentCount = 12;
      p.fullName = "Brother Ade Okafor";
    }
    p.joinedAt = trackingStart;
    p.creditBalanceKobo = 0;
    await p.save();
    await rebuildPartnerLedger(p.id);
  }

  const realPayments = await Payment.count({
    where: { nombaTransactionId: { [Op.ne]: null } },
  });

  console.log(`Removed ${destroyed} demo/simulated payment(s).`);
  console.log(`Real Nomba webhook payments preserved: ${realPayments}`);
  for (const p of partners) {
    const count = await Payment.count({ where: { partnerId: p.id } });
    console.log({ name: p.fullName, va: p.virtualAccountNumber, payments: count });
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
