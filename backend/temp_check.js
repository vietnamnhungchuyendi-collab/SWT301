import { sql, poolPromise } from './config/db.js';

(async () => {
    try {
        const pool = await poolPromise;
        const res = await pool.request().query("SELECT ISNULL(SUM(amount), 0) as total FROM WalletTransaction WHERE transaction_type = 'SERVICE_FEE'");
        console.log("TOTAL SYSTEM FEES:", res.recordset[0].total);
        
        const res2 = await pool.request().query("SELECT ISNULL(SUM(amount), 0) as total FROM payments WHERE payment_status = 'COMPLETED'");
        console.log("TOTAL REVENUE (payments):", res2.recordset[0].total);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
