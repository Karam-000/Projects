const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../Database/db');
const bcrypt = require('bcryptjs');
//===========================================login employee===================================

async function loginEmployee(employeeId, password) {
    try {
      const pool = await poolPromise;
  
      // Begin transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
  
      try {
        // Login validation
        const request = new sql.Request(transaction);
        request.input('EmployeeID', sql.Int, employeeId);
        const loginResult = await request.query(' SELECT  e.Password, e.FirstName, e.LastName, d.DepartmentName FROM Employees e jOIN Department d ON e.DepartmentID = d.DepartmentID WHERE e.EmployeeID = @EmployeeID;');
  
        if (loginResult.recordset.length === 0) {
          return { success: false, message: 'Employee not found' }
        }
  
        const employee = loginResult.recordset[0];
        const match = await bcrypt.compare(password, employee.Password);
  
        if (!match) {
          return { success: false, message: 'Incorrect Password' }
         
        }
  
        // Generate token
        const tokenPayload = { DepartmentName:`${employee.DepartmentName}` ,employeeId, employeeName: ` ${employee.FirstName} ${employee.LastName}` };
        const token = jwt.sign(tokenPayload, '1234', { expiresIn: '1h' }); // Replace '1234' with a strong secret key
  
        // Insert login data
        const insertRequest = new sql.Request(transaction);
        insertRequest.input('EmployeeID', sql.Int, employeeId);
        insertRequest.input('LoginTime', sql.DateTimeOffset, new Date());
        insertRequest.input('Token', sql.VarChar(255), token); // Adjust VARCHAR length as needed
        await insertRequest.query('INSERT INTO EmployeeLogin (EmployeeID, LoginTime, Token) VALUES (@EmployeeID, @LoginTime, @Token)');
  
        // Commit transaction
        await transaction.commit();
  
        console.log(token);
        return { success: true,  token };;
  
      } catch (innerError) {
        // Rollback transaction on error
        await transaction.rollback();
        throw innerError; 
      }
  
    } catch (err) {
      console.error('Login error:', err);
      throw err; 
    }
  }
//===================================================================================================
// Example usage
async function testLogin() {
    const result = await loginEmployee(1, 'securepassword123');
    console.log(result);
  }
//testLogin();
  module.exports = { loginEmployee };