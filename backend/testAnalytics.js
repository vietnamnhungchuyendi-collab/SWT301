import 'dotenv/config';
import { poolPromise } from './config/db.js';

async function run() {
  try {
    const pool = await poolPromise;
    console.log("Database connected.");
    
    const tablesRes = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    console.log("Tables in database:", tablesRes.recordset.map(r => r.TABLE_NAME));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
}

run();
