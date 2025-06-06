import cron from "node-cron";
import { processAbandonedCarts } from "../jobs/abandonedOrder.Job.js";

export const startAbandonedCartScheduler = () => {
    cron.schedule("0 */12 * * *", async () => {
        console.log("⏰ Running abandoned cart job at", new Date().toISOString());
        try {
            await processAbandonedCarts();
        } catch (error) {
            console.error("❌ Error running abandoned cart job:", error.message);
        }
    });
};
