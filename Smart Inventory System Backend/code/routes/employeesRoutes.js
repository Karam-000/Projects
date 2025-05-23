const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../middlewares/authMiddleware');
const { checkValidEmployeeToken } = require('../Helpers/helpers');
const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('../Database/db');
const { createBranch } = require('../Controllers/Company');
const { deleteErrorLog, getErrorLogs}=require('../Services/errorLogs');
const { updateEmployee,recordTransaction,getEmployeeById,deleteEmployee,createEmployee } = require('../Controllers/employes');
const {updateProduct, deleteProduct,addProductToShelf,createShelf,getEmptySpaces}= require('../Controllers/Products');
const {getFinancialData}= require('../Services/order');

router.get('/GetFinancialData', adminMiddleware('Finance'), async (req, res) => {
    try {
       
    
    
        const financialData = await getFinancialData();
    
        if (!financialData) {
            return res.status(404).json({ success: false, message: 'No financial data found' });
        }
    
        // Record transaction
        const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Viewed financial data from ${startDate} to ${endDate}`);
    
        res.status(200).json({ success: true, data: financialData, transactionId: transaction.TransactionID });
    } catch (err) {
        console.error('Error getting financial data:', err.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
    });

router.patch('/UpdateEmployee', adminMiddleware('HR'), async (req, res) => {
  try {
      const { Updateid, Updates } = req.body;

      if (!Updateid || !Updates || typeof Updates !== 'object') {
          return res.status(400).json({ success: false, message: 'Valid Updateid and Updates are required' });
      }

      await updateEmployee(Updateid, Updates);
     
      // Record transaction
      const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Updated employee ${Updateid} information`);

      res.status(200).json({
          success: true,
          message: 'Employee updated successfully',
          transactionId: transaction.TransactionID
      });
  } catch (error) {
      console.error('Update error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/DeleteEmployee', adminMiddleware('HR'), async (req, res) => {
  try {
      const { Deleteid } = req.body;

      if (!Deleteid || isNaN(parseInt(Deleteid, 10))) {
          return res.status(400).json({ success: false, message: 'Valid Deleteid is required' });
      }

      await deleteEmployee(parseInt(Deleteid, 10));

      // Record transaction
      const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Deleted employee ${Deleteid}`);

      res.status(200).json({
          success: true,
          message: `Employee ${Deleteid} deleted successfully`,
          transactionId: transaction.TransactionID
      });
  } catch (err) {
      console.error('Error deleting employee:', err.message);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

router.get('/GetEmployeeInfo', adminMiddleware('HR'), async (req, res) => {
  try {
      const { employeeid } = req.query;

      if (!employeeid) {
          return res.status(400).json({ success: false, message: 'Missing employeeid' });
      }

      const employeeInfo = await getEmployeeById(employeeid);

      if (!employeeInfo) {
          return res.status(404).json({ success: false, message: `Employee ${employeeid} not found` });
      }

      // Record transaction
      const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Viewed employee ${employeeid} information`);

      res.status(200).json({ success: true, data: employeeInfo, transactionId: transaction.TransactionID });
  } catch (err) {
      console.error('Error getting employee info:', err.message);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// 🔹 Create Employee (HR Only)
router.post('/CreateEmployee', adminMiddleware('HR'), async (req, res) => {
  try {
      const message = await createEmployee(req.body.employee);
      const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, message);
      res.status(200).json({ success: true, message, transactionId: transaction.TransactionID });
  } catch (error) {
      res.status(400).json({ success: false, message: error.message });
  }
});
// 🔹 Change Employee Password (IT Only)
router.patch('/ChangeEmployeePassword', adminMiddleware('IT'), async (req, res) => {
  try {
      const { employeeid, NewPassword } = req.body;
      const hashedPassword = await bcrypt.hash(NewPassword, 10);

      const pool = await poolPromise;
      await pool.request()
          .input('EmployeeID', sql.Int, employeeid)
          .input('NewPassword', sql.NVarChar, hashedPassword)
          .query(`UPDATE Employees SET Password = @NewPassword WHERE EmployeeID = @EmployeeID`);

      const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Changed password`);
      res.status(200).json({ success: true, message: 'Password updated successfully', transactionId: transaction.TransactionID });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// 🔹 Update Product Info (IT Only)
router.put('/UpdateProduct', adminMiddleware('IT'), async (req, res) => {
  try {
      const { productId, updateParams } = req.body;
      if (!productId || !updateParams || typeof updateParams !== 'object') {
          return res.status(400).json({ success: false, message: 'Invalid request format' });
      }

      const rowsAffected = await updateProduct(productId, updateParams);
      const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Updated product ${productId}`);

      if (rowsAffected && rowsAffected[0] > 0) {
          return res.status(200).json({ success: true, message: `Product ${productId} updated`, transactionId: transaction.TransactionID });
      }

      res.status(404).json({ success: false, message: `No product found with ID ${productId}` });
  } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// 🔹 Delete Product (IT Only)
router.delete('/DeleteProduct', adminMiddleware('IT'), async (req, res) => {
  try {
      const { productId } = req.body;
      if (!productId) {
          return res.status(400).json({ success: false, message: 'Invalid request format' });
      }

      const rowsAffected = await deleteProduct(productId);
      const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Deleted product ${productId}`);

      if (rowsAffected > 0) {
          return res.status(200).json({ success: true, message: `Product ${productId} deleted`, transactionId: transaction.TransactionID });
      }

      res.status(404).json({ success: false, message: `No product found with ID ${productId}` });
  } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// 🔹 Delete an Error Log (IT Only)
router.delete('/error-logs/:id', adminMiddleware('IT'), async (req, res) => {
  try {
      const errorLogId = parseInt(req.params.id, 10);
      if (isNaN(errorLogId)) {
          return res.status(400).json({ success: false, message: 'Invalid ErrorLogID' });
      }

      const isDeleted = await deleteErrorLog(errorLogId);
      if (isDeleted) {
          return res.status(200).json({ success: true, message: `Error log ${errorLogId} deleted` });
      }

      res.status(404).json({ success: false, message: `No error log found with ID ${errorLogId}` });
  } catch (error) {
      console.error('Error deleting error log:', error.message);
      res.status(500).json({ success: false, message: 'Failed to delete error log' });
  }
});
// 🔹 Get All Error Logs (IT Only)
router.get('/error-logs', adminMiddleware('IT'), async (req, res) => {
  try {
      const logs = await getErrorLogs();
      res.status(200).json({ success: true, logs });
  } catch (error) {
      console.error('Error fetching error logs:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch error logs' });
  }
});
router.post('/CreateShelf', adminMiddleware('Warehouse'), async (req, res) => {
    try {
        const { shelfName, branchId, rowNum, columnNum } = req.body;
        if (!shelfName || !branchId || !rowNum || !columnNum) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }
        const result = await createShelf(shelfName, branchId, rowNum, columnNum);
        const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Created shelf ${shelfName}`);
    
        res.status(200).json({
            success: true,
            message: 'Shelf created successfully',
            data: result,
            transactionId: transaction.TransactionID
        });
    } catch (error) {
        console.error('Error creating shelf:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
    }
);
router.get('/shelfEmptySpaces', adminMiddleware('Warehouse'), async (req, res) => {
    try{
        const {shelfName, branchId} = req.query;
        if (!shelfName || !branchId) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }
        const emptySpaces = await getEmptySpaces(shelfName, branchId);
        if (emptySpaces.length === 0) {
            return res.status(404).json({ success: false, message: 'No empty spaces found' });
        }
        res.status(200).json({ success: true, emptySpaces });
    } catch (error) {
        console.error('Error fetching empty spaces:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });

    }
});
router.post('/addToShelf',adminMiddleware('Warehouse'),async(req,res)=>{
  try {
    const { productId, shelfName, branchId, expiryDate } = req.body;
    const EmployeeId = req.employee.Id;
    const validToken = req.employee;
    
    if (!productId || !shelfName || !branchId || !expiryDate) {
      throw new Error('Missing required parameters');
  }
  // Call the addProductToShelf function
  const result = await addProductToShelf(productId, shelfName, branchId, expiryDate);

  // Record transaction
  const description = `Added product ${productId} to shelf ${shelfName} (Location: ${result.rowNum},${result.columnNum})`;
  await recordTransaction(EmployeeId, validToken.employeeName, description);

  // Send success response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
      success: true,
      message: 'Product added to shelf successfully',
      data: {
          shelfId: result.shelfId,
          locationId: result.locationId,
          coordinates: `${result.rowNum},${result.columnNum}`,
          expiryDate: result.expiryDate
      }
  }));

} catch (error) {
  console.error('Error adding product to shelf:', error.message);
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: error.message }));
}

})
router.post('/CreateNewBranch',adminMiddleware('IT'),async(req,res)=>{
    try{
        const { companyID, branchName, address, city, state } = req.body;
        if (!companyID || !branchName || !address || !city || !state) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

   
    const result = await createBranch(companyID, branchName, address, city, state);
    const transaction = await recordTransaction(req.employee.Id, req.employee.EmployeeName, `Created new branch ${branchName}`);
    res.status(200).json({
        success: true,
        message: 'Branch created successfully',
        data: result,
        transactionId: transaction.TransactionID
    });
} catch (error) {
        console.error('Error creating branch:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});



//13 routes for employees





module.exports = router;