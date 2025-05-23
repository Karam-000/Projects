const { sql, poolPromise } = require('../Database/db');
//=======================================logError==========================================
const logError = async (functionName, errorMessage, context = null) => {
    const pool = await poolPromise; // Use your database connection pool
    try {
      console.error(`Logging error in function ${functionName}: ${errorMessage}`);
      await pool.request()
        .input('FunctionName', sql.NVarChar, functionName)
        .input('ErrorMessage', sql.NVarChar, errorMessage)
        .input('Context', sql.NVarChar, context ? JSON.stringify(context) : null)
        .query(`
          INSERT INTO ErrorLogs (FunctionName, ErrorMessage, Context)
          VALUES (@FunctionName, @ErrorMessage, @Context);
        `);
      console.log(`Error logged successfully for function: ${functionName}`);
    } catch (logError) {
      console.error(`Failed to log error for function ${functionName}: ${logError.message}`);
    }
  };
  //logError('testFunction', 'This is a test error message', { test: 'context' });
  //=======================================deleteErrorLog==========================================
  const deleteErrorLog = async (errorLogId) => {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('ErrorLogID', sql.Int, errorLogId)
        .query(`
          DELETE FROM ErrorLogs
          WHERE ErrorLogID = @ErrorLogID;
        `);
      return result.rowsAffected[0] > 0; // Returns true if deletion was successful
    } catch (error) {
      console.error('Error deleting error log:', error.message);
      throw error;
    }
  };
  //deleteErrorLog(1);
  //---------------------------------------------get error logs-------------------------------------
  const getErrorLogs = async () => {
    const pool = await poolPromise;
    try {
      const result = await pool.request().query(`
        SELECT * 
        FROM ErrorLogs
        ORDER BY CreatedAt DESC;
      `);
      return result.recordset;
    } catch (error) {
      console.error('Error fetching error logs:', error.message);
      throw error;
    }
  };
  async function TestgetErrorLogs() {
  const result=await getErrorLogs();
  console.log(result)
  }
  //TestgetErrorLogs();

  module.exports = {
    logError,
    deleteErrorLog,
    getErrorLogs
  };