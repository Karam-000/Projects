const { sql, poolPromise } = require('../Database/db');
//=====================================create company=========================================
async function createCompany(companyName, address, city, state) {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        request.input('CompanyName', sql.VarChar(255), companyName);
        request.input('Address', sql.VarChar(255), address);
        request.input('City', sql.VarChar(100), city);
        request.input('State', sql.VarChar(100), state);
        
        const result = await request.query(`
            INSERT INTO Company (CompanyName, Address, City, State)
            VALUES (@CompanyName, @Address, @City, @State);
        `);

        return result;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//===========================================================================================
//=====================================GEt all company=========================================
async function getAllCompanies() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Company');
        return result.recordset;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//======================================================================================
//=====================================get  company ID=========================================
async function getCompanyByID(companyID) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('CompanyID', sql.Int, companyID)
            .query('SELECT * FROM Company WHERE CompanyID = @CompanyID');
        
        return result.recordset[0];
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//=====================================Update company=========================================
async function updateCompany(companyID, companyName, address, city, state) {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const updateFields = [];
        
        // Check each parameter and add to updateFields if not null or undefined
        if (companyName !== undefined) {
            request.input('CompanyName', sql.VarChar(255), companyName);
            updateFields.push('CompanyName = @CompanyName');
        }
        if (address !== undefined) {
            request.input('Address', sql.VarChar(255), address);
            updateFields.push('Address = @Address');
        }
        if (city !== undefined) {
            request.input('City', sql.VarChar(100), city);
            updateFields.push('City = @City');
        }
        if (state !== undefined) {
            request.input('State', sql.VarChar(100), state);
            updateFields.push('State = @State');
        }

        // Construct the dynamic SQL query
        const sqlQuery = `
            UPDATE Company
            SET ${updateFields.join(', ')}
            WHERE CompanyID = @CompanyID;
        `;

        // Add CompanyID parameter
        request.input('CompanyID', sql.Int, companyID);

        // Execute the query
        const result = await request.query(sqlQuery);

        return result;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}

//===========================================================================================
async function deleteCompany(companyID) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('CompanyID', sql.Int, companyID)
            .query('DELETE FROM Company WHERE CompanyID = @CompanyID');
        
        return result;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//===========================================================================================
//===================================create branch================================================
async function createBranch(companyID, branchName, address, city, state) {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        request.input('CompanyID', sql.Int, companyID);
        request.input('BranchName', sql.VarChar(255), branchName);
        request.input('Address', sql.VarChar(255), address);
        request.input('City', sql.VarChar(100), city);
        request.input('State', sql.VarChar(100), state);
        
        const result = await request.query(`
            INSERT INTO Branch (CompanyID, BranchName, Address, City, State)
            VALUES (@CompanyID, @BranchName, @Address, @City, @State);
        `);

        return result;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//====================================Get all branches===========================================
async function getAllBranches() {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .query('SELECT b.BranchID, b.BranchName, b.Address, b.City, b.State, c.CompanyName FROM Branch b INNER JOIN Company c ON b.CompanyID = c.CompanyID');
        
        return result.recordset;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//===========================================================================================
//====================================Get branch by id ============================================
async function getBranchByID(branchID) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('BranchID', sql.Int, branchID)
            .query(`
                SELECT b.BranchID, b.BranchName, b.Address, b.City, b.State, c.CompanyName
                FROM Branch b
                INNER JOIN Company c ON b.CompanyID = c.CompanyID
                WHERE b.BranchID = @BranchID
            `);
        
        return result.recordset[0];
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//===================================Update branch===============================================
async function updateBranch(branchID, branchName, address, city, state) {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const updateFields = [];

        // Check each parameter and add to updateFields if not null or undefined
        if (branchName !== undefined) {
            request.input('BranchName', sql.VarChar(255), branchName);
            updateFields.push('BranchName = @BranchName');
        }
        if (address !== undefined) {
            request.input('Address', sql.VarChar(255), address);
            updateFields.push('Address = @Address');
        }
        if (city !== undefined) {
            request.input('City', sql.VarChar(100), city);
            updateFields.push('City = @City');
        }
        if (state !== undefined) {
            request.input('State', sql.VarChar(100), state);
            updateFields.push('State = @State');
        }

        // Construct the dynamic SQL query
        const sqlQuery = `
            UPDATE Branch
            SET ${updateFields.join(', ')}
            WHERE BranchID = @BranchID;
        `;

        // Add BranchID parameter
        request.input('BranchID', sql.Int, branchID);

        // Execute the query
        const result = await request.query(sqlQuery);

        return result;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//===========================================================================================
//======================================Delete branch==============================================
async function deleteBranch(branchID) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('BranchID', sql.Int, branchID)
            .query('DELETE FROM Branch WHERE BranchID = @BranchID');
        
        return result;
    } catch (err) {
        console.error('SQL error:', err.message);
        throw err;
    }
}
//===========================================================================================

  // Test data
  const testCompanies = [
    {
      companyName: 'Tech Innovators Inc',
      address: '123 Innovation Dr',
      city: 'Tech City',
      state: 'TC'
    },
    {
      companyName: 'Global Solutions LLC',
      address: '456 Global Ave',
      city: 'World City',
      state: 'WC'
    }
  ];
  
  const testBranches = [
    {
      companyID: 1, // This should match an existing company ID after creation
      branchName: 'Downtown Branch',
      address: '789 Main St',
      city: 'Central City',
      state: 'CC'
    }
  ];
  
  // Test functions
  async function testCreateCompanies() {
    try {
      for (const company of testCompanies) {
        const result = await createCompany(
          company.companyName,
          company.address,
          company.city,
          company.state
        );
        console.log('Company created:', result);
      }
    } catch (err) {
      console.error('Error creating companies:', err);
    }
  }
  
  async function testCreateBranches() {
    try {
      for (const branch of testBranches) {
        const result = await createBranch(
          branch.companyID,
          branch.branchName,
          branch.address,
          branch.city,
          branch.state
        );
        console.log('Branch created:', result);
      }
    } catch (err) {
      console.error('Error creating branches:', err);
    }
  }
  
  async function testGetAllCompanies() {
    try {
      const companies = await getAllCompanies();
      console.log('All companies:', companies);
    } catch (err) {
      console.error('Error getting companies:', err);
    }
  }
  
  async function testCompanyUpdates() {
    try {
      // Update first company (assuming ID 1 exists)
      const updateResult = await updateCompany(
        1,
        'Updated Company Name',
        'New Address 123',
        'Updated City',
        'UC'
      );
      console.log('Update result:', updateResult);
      
      // Get updated company
      const updatedCompany = await getCompanyByID(1);
      console.log('Updated company:', updatedCompany);
    } catch (err) {
      console.error('Error during company update test:', err);
    }
  }
  
  async function testCleanup() {
    try {
      // Delete test branches first
      await deleteBranch(1); // Assuming branch ID 1 exists
      // Delete test companies
      await deleteCompany(1);
      await deleteCompany(2);
      console.log('Test data cleaned up');
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
  }
  
  // // Run tests in order
  // (async () => {
  //   try {
  //     await testCreateCompanies();
  //     await testCreateBranches();
  //     await testGetAllCompanies();
  //     await testCompanyUpdates();
  //     // await testCleanup(); // Uncomment to clean up after testing
  //   } catch (err) {
  //     console.error('Test sequence failed:', err);
  //   }
  // })();
module.exports = {
    createCompany,
    getAllCompanies,
    getCompanyByID,
    updateCompany,
    createBranch,
    getAllBranches,
    getBranchByID,
    updateBranch,
    deleteBranch,
    deleteCompany,
    getBranchByID
};
