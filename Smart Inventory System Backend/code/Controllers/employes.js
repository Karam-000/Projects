//===========================================insert employee===================================
const { sql, poolPromise } = require('../Database/db');
const bcrypt = require('bcryptjs');

async function createEmployee(employee) {
  // Validate that all required fields are provided
  const requiredFields = [
      'FirstName', 'LastName', 'Email', 'Phone', 'Address', 
      'City', 'State', 'ZipCode', 'Country', 'HireDate', 
      'DepartmentID', 'Password', 'Salary'
  ];

  for (const field of requiredFields) {
      if (!employee[field]) {
          throw {
              success: false,
              message: `${field} is required`,
          };
      }
  }

  const saltRounds = 10; // Adjust the number of salt rounds as needed
  const hashedPassword = await bcrypt.hash(employee.Password, saltRounds);

  try {
      const pool = await poolPromise;

      // Check if the email already exists in the database
      const existingEmailResult = await pool.request()
          .input('Email', sql.VarChar(100), employee.Email)
          .query('SELECT 1 FROM Employees WHERE Email = @Email');
      
      if (existingEmailResult.recordset.length > 0) {
          throw {
              success: false,
              message: 'Email already exists',
          };
      }

      // Proceed with inserting the new employee
      const result = await pool.request()
          .input('FirstName', sql.VarChar(50), employee.FirstName)
          .input('LastName', sql.VarChar(50), employee.LastName)
          .input('Email', sql.VarChar(100), employee.Email)
          .input('Phone', sql.VarChar(20), employee.Phone)
          .input('Address', sql.VarChar(255), employee.Address)
          .input('City', sql.VarChar(100), employee.City)
          .input('State', sql.VarChar(50), employee.State)
          .input('ZipCode', sql.VarChar(20), employee.ZipCode)
          .input('Country', sql.VarChar(100), employee.Country)
          .input('HireDate', sql.Date, employee.HireDate)
          .input('DepartmentID', sql.Int, employee.DepartmentID)
          .input('Password', sql.VarChar(255), hashedPassword)
          .input('Salary', sql.Float, employee.Salary)
          .query(`
              INSERT INTO Employees (FirstName, LastName, Email, Phone, Address, City, State, ZipCode, Country, HireDate, DepartmentID, Password, Salary)
              VALUES (@FirstName, @LastName, @Email, @Phone, @Address, @City, @State, @ZipCode, @Country, @HireDate, @DepartmentID, @Password, @Salary);
              
              -- Get the auto-generated EmployeeID
              SELECT SCOPE_IDENTITY() AS EmployeeID;
          `);

      const employeeId = result.recordset[0]?.EmployeeID;

      if (employeeId) {
          return {
              success: true,
              message: 'Employee created successfully',
              employeeId: employeeId,  // Return the auto-generated EmployeeID
          };
      } else {
          throw {
              success: false,
              message: 'Error: Unable to retrieve EmployeeID',
          };
      }
  } catch (err) {
      console.error('SQL error', err);
      throw {
          success: false,
          message: err.message || 'Error creating employee',
          error: err.message,
      };
  }
}


async function addEmployees() {
    // Define the employee data
    const employees = [
        {
            FirstName: 'Karam',
            LastName: 'Abou Sahyoun',
            Email: 'karam.abousahyou00@gmail.com',
            Phone: '1234567890',
            Address: '789 Employee Ave',
            City: 'Tech City',
            State: 'Innovation State',
            ZipCode: '12345',
            Country: 'CountryX',
            HireDate: new Date(),
            DepartmentID: 1, // HR
            Password: 'securepassword123',
            Salary: 5000.00
        },
        {
            FirstName: 'Lama',
            LastName: 'Mawkawi',
            Email: 'lama.mawkawi@gmail.com',
            Phone: '1234567891',
            Address: '101 IT Lane',
            City: 'Tech City',
            State: 'Innovation State',
            ZipCode: '12345',
            Country: 'CountryX',
            HireDate: new Date(),
            DepartmentID: 2, // IT
            Password: 'securepassword123',
            Salary: 5500.00
        },
        {
            FirstName: 'Saja',
            LastName: 'Hakim',
            Email: 'saja.hakim@gmail.com',
            Phone: '1234567892',
            Address: '202 Sales Way',
            City: 'Tech City',
            State: 'Innovation State',
            ZipCode: '12345',
            Country: 'CountryX',
            HireDate: new Date(),
            DepartmentID: 3, // Sales
            Password: 'securepassword123',
            Salary: 4500.00
        },
        {
            FirstName: 'Jana',
            LastName: 'Meslmany',
            Email: 'jana.meslmany@gmail.com',
            Phone: '1234567893',
            Address: '303 Developer Dr',
            City: 'Tech City',
            State: 'Innovation State',
            ZipCode: '12345',
            Country: 'CountryX',
            HireDate: new Date(),
            DepartmentID: 2, // IT
            Password: 'securepassword123',
            Salary: 6000.00
        }
    ];

    // Loop through the employee array and create each employee
    for (const employee of employees) {
        try {
            const result = await createEmployee(employee);
            console.log(`Employee created successfully: ${result.employeeId}`);
        } catch (error) {
            console.error(`Error creating employee: ${error.message}`);
        }
    }
}

// Run the function
//addEmployees();


//===========================================update employee===================================
/*updateEmployee(2,{
    FirstName: 'Jane',
    LastName: 'Smith',
    Email: 'jane.smith@example.com',
    DepartmentID: 1
}
)*/
async function updateEmployee(employeeId, updates) {
    try {
        console.log('Updating employee with ID:', employeeId);
        console.log('Updates:', updates);
        
        const pool = await poolPromise;
        const request = pool.request().input('EmployeeID', sql.Int, employeeId);

        let updateString = '';
        Object.keys(updates).forEach((key, index) => {
            // Normalize key names to match database column names
            const normalizedKey = key.charAt(0).toUpperCase() + key.slice(1); 

            let valueType;
            switch (normalizedKey) {
                case 'FirstName':
                case 'LastName':
                case 'Email':
                case 'Phone':
                case 'Address':
                case 'City':
                case 'State':
                case 'Country':
                case 'ZipCode':
                    valueType = sql.NVarChar;
                    break;
                case 'HireDate':
                    valueType = sql.Date;
                    break;
                case 'DepartmentID':
                    valueType = sql.Int;
                    break;
                case 'Salary':
                    valueType = sql.Float;
                    break;
                default:
                    valueType = sql.NVarChar; // Default to NVarChar if type is not specified
            }

            request.input(normalizedKey, valueType, updates[key]);
            updateString += `${normalizedKey} = @${normalizedKey}`;
            if (index < Object.keys(updates).length - 1) {
                updateString += ', ';
            }
        });

        const query = `UPDATE Employees SET ${updateString} WHERE EmployeeID = @EmployeeID`;
        console.log('Executing query:', query);
        const result = await request.query(query);

        return result.rowsAffected[0];
    } catch (err) {
        console.error('SQL error:', err);
        throw err;
    }
}

//===================================get employee by id ==========================================
async function getEmployeeById(employeeId) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EmployeeID', sql.Int, employeeId)
            .query('SELECT * FROM Employees WHERE EmployeeID = @EmployeeID');
        return result.recordset[0];
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}
//==================================delete employee==============================================
async function deleteEmployee(employeeId) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EmployeeID', sql.Int, employeeId)
            .query('DELETE FROM Employees WHERE EmployeeID = @EmployeeID');
        return result.rowsAffected[0];
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}
//==============================create manager ==================================================
async function createManager(manager) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EmployeeID', sql.Int, manager.EmployeeID)
            .input('DepartmentID', sql.Int, manager.DepartmentID)
            .query(`
                INSERT INTO Manager (EmployeeID, DepartmentID)
                VALUES (@EmployeeID, @DepartmentID)
            `);
        return result.recordset;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}
//================================get manager by id=================================================
async function getManagerById(managerId) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ManagerID', sql.Int, managerId)
            .query('SELECT * FROM Manager WHERE ManagerID = @ManagerID');
        return result.recordset[0];
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}
//==================================delete manager==============================================
async function deleteManager(managerId) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ManagerID', sql.Int, managerId)
            .query('DELETE FROM Manager WHERE ManagerID = @ManagerID');
        return result.rowsAffected[0];
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}
//===================================update manager==============================================
async function updateManager(managerId, updates) {
    try {
        const pool = await poolPromise;
        const request = pool.request().input('ManagerID', sql.Int, managerId);

        let updateString = '';
        Object.keys(updates).forEach((key, index) => {
            // Add input parameter type checking here
            let valueType;
            switch (key) {
                case 'EmployeeID':
                case 'DepartmentID':
                    valueType = sql.Int;
                    break;
                default:
                    valueType = sql.NVarChar; // Default to NVarChar if type is not specified
            }

            request.input(key, valueType, updates[key]);
            updateString += `${key} = @${key}`;
            if (index < Object.keys(updates).length - 1) {
                updateString += ', ';
            }
        });

        const query = `UPDATE Manager SET ${updateString} WHERE ManagerID = @ManagerID`;
        const result = await request.query(query);

        return result.rowsAffected[0];
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}
//===========================================================================================

//------------------------------------------department Crud functions-----------------------------------
async function createDepartment(departmentData) {
    try {
      const pool = await poolPromise; // Assuming you have a poolPromise
      const request = new sql.Request(pool);
  
      request.input('DepartmentName', sql.VarChar(255), departmentData.DepartmentName);
      request.input('BranchID', sql.Int, departmentData.BranchID); // Assuming BranchID is required
  
      const result = await request.query(`
        INSERT INTO Department (DepartmentName, BranchID)
        VALUES (@DepartmentName, @BranchID)
      `);
  
      return result.rowsAffected;
    } catch (err) {
      console.error('Error creating department:', err);
      throw err;
    }
  }
  
  async function getDepartments() {
    try {
      const pool = await poolPromise;
      const request = new sql.Request(pool);
      const result = await request.query('SELECT * FROM Department');
      return result.recordset;
    } catch (err) {
      console.error('Error getting departments:', err);
      throw err;
    }
  }
  
  async function getDepartmentByBranchId(branch) {
    try {
      const pool = await poolPromise;
      const request = new sql.Request(pool);
      request.input('Branch', sql.Int, branch);
      const result = await request.query('SELECT * FROM Department WHERE BranchID = @Branch');
      console.log(result.recordset[0])
      return result.recordset[0]; // Assuming you expect only one department with the given ID
     
    } catch (err) {
      console.error('Error getting department:', err);
      throw err;
    }
  }
  //getDepartmentByBranchId(1)

  async function updateDepartment(departmentId, updatedData) {
    try {
      const pool = await poolPromise;
      const request = new sql.Request(pool);
      request.input('DepartmentID', sql.Int, departmentId);
      request.input('DepartmentName', sql.VarChar(255), updatedData.DepartmentName);
      request.input('BranchID', sql.Int, updatedData.BranchID);
  
      const result = await request.query(`
        UPDATE Department
        SET DepartmentName = @DepartmentName, BranchID = @BranchID
        WHERE DepartmentID = @DepartmentID
      `);
  
      return result.rowsAffected;
    } catch (err) {
      console.error('Error updating department:', err);
      throw err;
    }
  }
  
  async function deleteDepartment(departmentId) {
    try {
      const pool = await poolPromise;
      const request = new sql.Request(pool);
      request.input('DepartmentID', sql.Int, departmentId);
  
      const result = await request.query(`
        DELETE FROM Department
        WHERE DepartmentID = @DepartmentID
      `);
  
      return result.rowsAffected;
    } catch (err) {
      console.error('Error deleting department:', err);
      throw err;
    }
  }
  
 
  const recordTransaction= async (employeeId, employeeName, description) => {
    try {
        const pool = await poolPromise; // Get the SQL connection pool

        // Insert the transaction into the EmployeeTransactions table
        const result = await pool.request()
            .input('EmployeeID', sql.Int, employeeId)
            .input('EmployeeName', sql.VarChar, employeeName)
            .input('Description', sql.NVarChar, description)
            .query(`
                INSERT INTO EmployeeTransactions (EmployeeID, EmployeeName, Description)
                VALUES (@EmployeeID, @EmployeeName, @Description);
            `);

        console.log('Transaction recorded successfully:', result.rowsAffected[0]);
        return {
            success: true,
            message: 'Transaction recorded successfully.',
            transactionID: result.recordset?.TransactionID // Return the transaction ID if needed
        };
    } catch (err) {
        console.error('Error inserting transaction:', err.message);
        return {
            success: false,
            message: 'Error inserting transaction: ' + err.message
        };
    }
};

  module.exports = {createEmployee,updateEmployee ,deleteEmployee,getEmployeeById,recordTransaction};


