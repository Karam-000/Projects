const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../Database/db');
const bcrypt = require('bcryptjs');
//===========================================login employee===================================

async function loginEmployee(employeeId, password) {
    try {
      const pool = await poolPromise;
      const request = new sql.Request(pool);
  
      // Login validation
      request.input('EmployeeID', sql.Int, employeeId);
      const loginResult = await request.query(' SELECT  e.Password, e.FirstName, e.LastName, d.DepartmentName FROM Employees e jOIN Department d ON e.DepartmentID = d.DepartmentID WHERE e.EmployeeID = @EmployeeID;');

      if (loginResult.recordset.length === 0) {
        return { success: false, message: 'Employee not found' };
      }

      const employee = loginResult.recordset[0];
      const match = await bcrypt.compare(password, employee.Password);

      if (!match) {
        return { success: false, message: 'Incorrect Password' };
      }

      // Generate token
      const tokenPayload = { DepartmentName:`${employee.DepartmentName}` ,employeeId, employeeName: ` ${employee.FirstName} ${employee.LastName}` };
      const token = jwt.sign(tokenPayload, process.env.EMPLOYEE_SECRET, { expiresIn: '1h' });

      console.log(token);
      return { success: true,  token };

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
