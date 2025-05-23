const { sql, poolPromise } = require('../Database/db');
const fs = require('fs');
const bwipjs = require('bwip-js');
const path = require('path');
const http = require("http");
const {logError}  = require("../Services/errorLogs");
// Function to generate a barcode
async function generateBarcode(data, productName) {
  try {
    // Generate the barcode
    const buffer = await bwipjs.toBuffer({
      bcid: 'code128',    // Barcode type (e.g., 'code39', 'code128')
      text: data,         // Text to encode
      scale: 3,           // 3x scaling factor
      height: 10,         // Bar height, in millimeters
      width: 200,         // Bar width, in millimeters
      includetext: true,  // Include text below the barcode
      textxalign: 'center' // Align text to the center
    });

    // Generate output path based on data
    const sanitizedData = productName.replace(/[^a-z0-9]/gi, '_').toLowerCase(); // Sanitize data for filename
    const outputPath = path.join(__dirname, 'ProductsBarcode', `${productName}.png`);

    // Write the buffer to a file
    fs.writeFileSync(outputPath, buffer);
    console.log(`Barcode generated and saved to ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error('Error generating barcode:', err);
  }
}
//==========================================================================================
//====================================create product and insert it into products table====================
async function createProduct(product) {
  try {
    const pool = await poolPromise;

    // Insert product into the database
    const result = await pool.request()
      .input('ProductName', sql.VarChar(255), product.ProductName)
      .input('Description', sql.Text, product.Description)
      .input('Price', sql.Decimal(10, 2), product.Price)
      .input('ImageUrl', sql.VarChar(255), product.imageUrl || null) // Add imageUrl with nullish coalescing operator
      .query(`
        INSERT INTO Product (ProductName, Description, Price, ImageUrl)
        VALUES (@ProductName, @Description, @Price, @ImageUrl);
        SELECT SCOPE_IDENTITY() AS ProductID;
      `);

    const productID = result.recordset[0].ProductID;

    // Generate the barcode and get the path (assuming generateBarcode is implemented elsewhere)
    const barcodePath = await generateBarcode(productID.toString(), product.ProductName);

    // Update the product record with the barcode path
    await pool.request()
      .input('ProductID', sql.Int, productID)
      .input('BarcodePath', sql.VarChar(255), barcodePath)
      .query(`
        UPDATE Product
        SET BarcodePath = @BarcodePath
        WHERE ProductID = @ProductID;
      `);

    return productID;

  } catch (err) {
    console.error('SQL error:', err);
    throw err;
  }
}

const products = [
  {
    ProductName: 'Smartphone X1',
    Description: 'A high-end smartphone with cutting-edge features.',
    Price: 999.99,
    imageUrl: "C:\\Users\\karam\\OneDrive\\Documents\\Desktop\\FYP\\Images\\phoneX1.jpeg"
  },
  {
    ProductName: 'Laptop Pro 14',
    Description: 'A powerful laptop for professionals.',
    Price: 1299.99,
    imageUrl: '"C:\\Users\\karam\\OneDrive\\Documents\\Desktop\\FYP\\Images\\LaptopPro14.jpeg"'
  },
  {
    ProductName: 'Wireless Headphones',
    Description: 'Comfortable over-ear wireless headphones.',
    Price: 199.99,
    imageUrl: "C:\\Users\\karam\\OneDrive\\Documents\\Desktop\\FYP\\Images\\WirelessHeadphones.jpeg"
  }
];

async function addProducts() {
  try {
    for (const product of products) {
      const productID = await createProduct(product);
      console.log(`Product added with ID: ${productID}`);
    }
  } catch (err) {
    console.error('Error adding products:', err);
  }
}

//addProducts();

 //------------------------------------------------------------------------------------------------ 
  




//=======================add items to shef===================================================
//addProductToShelf(1, 'TestShelf',1,'2025-12-30')

/**
 * notifyWarehouseNewProduct - Sends a POST request with new product placement details to the warehouse.
 *
 * @param {Object} details - An object containing product and shelf details.
 * @returns {Promise<Object>} - Resolves with the JSON response from the warehouse service.
 */
async function notifyWarehouseNewProduct(taskDetails) {
  try {
    // Validate taskDetails
    if (!taskDetails || !taskDetails.branchId) {
      const errorMessage = 'Invalid task details: Missing branchId or other required fields';
      await logError('notifyWarehouseNewProduct', errorMessage, { taskDetails });
      throw new Error(errorMessage);
    }

    // Get the webhook URL for the branch
    const pool = await poolPromise;
    const urlResult = await pool.request()
      .input('branchId', sql.Int, taskDetails.branchId)
      .query(`
        SELECT WebhookURL 
        FROM WarehouseURL 
        WHERE BranchID = @branchId;
      `);

    if (urlResult.recordset.length === 0) {
      const errorMessage = `No WebhookURL found for branch ${taskDetails.branchId}`;
      await logError('notifyWarehouseNewProduct -> Webhook URL Check', errorMessage, { taskDetails });
      throw new Error(errorMessage);
    }

    const webhookUrl = urlResult.recordset[0].WebhookURL + '/add-product';

    // Prepare POST data
    const postData = JSON.stringify({
      processId: taskDetails.taskId, // Unique identifier for the process
      processType: taskDetails.processType, // e.g., "restock_loading"
      description: taskDetails.description, // e.g., "Loading shelf Aisle-5"
      product: {
        id: taskDetails.productId,
        name: taskDetails.productName,
        quantity: taskDetails.quantity
      },
      shelf: {
        name: taskDetails.shelfName,
        row: taskDetails.rowNum,
        column: taskDetails.columnNum
      },
      branchId: taskDetails.branchId,
      inventoryId: taskDetails.InventoryID,
      assignedTime: taskDetails.assignedTime // Explicitly set to null
    });
    console.log('POST Data:', postData);

    // Configure HTTP request options
    const options = {
      hostname: new URL(webhookUrl).hostname,
      port: new URL(webhookUrl).port || 80,
      path: new URL(webhookUrl).pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', (err) => {
        const errorMessage = `HTTP request failed for branch ${taskDetails.branchId}: ${err.message}`;
        logError('notifyWarehouseNewProduct -> HTTP Request', errorMessage, { taskDetails, webhookUrl });
        reject(err);
      });

      req.write(postData);
      req.end();
    });

  } catch (err) {
    const errorMessage = `Error notifying warehouse for branch ${taskDetails?.branchId}: ${err.message}`;
    await logError('notifyWarehouseNewProduct', errorMessage, { taskDetails });
    console.error(errorMessage);
    throw err; // Re-throw the error after logging
  }
}

//addProductToShelf(2, 'TestShelf',1,'2025-5-30')
/**
 * addProductToShelf - Adds a product to a shelf location and then notifies the warehouse.
 *
 * @param {number} productId - ID of the product.
 * @param {string} shelfName - Name of the shelf.
 * @param {number} branchId - Branch ID.
 * @param {string|Date} expiryDate - Expiry date of the product.
 * @returns {Promise<Object>} - Returns the shelf and location details.
 */


async function addProductToShelf(productId, shelfName, branchId, expiryDate) {
  let transaction = null;
  
  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Step 1: Find ShelfID
    const shelfResult = await transaction.request()
      .input('branchId', sql.Int, branchId)
      .input('shelfName', sql.VarChar(255), shelfName)
      .query(`
        SELECT ShelfID 
        FROM Shelf 
        WHERE BranchID = @branchId AND ShelfName = @shelfName;
      `);

    if (shelfResult.recordset.length === 0) {
      throw new Error(`Shelf '${shelfName}' not found in branch ${branchId}`);
    }

    const shelfId = shelfResult.recordset[0].ShelfID;

    // Step 2: Find empty location
    const locationResult = await transaction.request()
      .input('shelfId', sql.Int, shelfId)
      .query(`
        SELECT TOP 1 LocationID, RowNum, ColumnNum 
        FROM ShelfLocation 
        WHERE ShelfID = @shelfId AND isEmpty = 1;
      `);

    if (locationResult.recordset.length === 0) {
      throw new Error(`No available space on shelf ${shelfName}`);
    }

    const { LocationID: locationId, RowNum: rowNum, ColumnNum: columnNum } = locationResult.recordset[0];

    // Step 3: Update shelf location
    await transaction.request()
      .input('productId', sql.Int, productId)
      .input('locationId', sql.Int, locationId)
      .query(`
        UPDATE ShelfLocation 
        SET ProductID = @productId, isEmpty = 0 
        WHERE LocationID = @locationId;
      `);

    // Step 4: Update inventory with location
    const result = await transaction.request()
      .input('branchId', sql.Int, branchId)
      .input('productId', sql.Int, productId)
      .input('expiryDate', sql.Date, expiryDate)
      .input('shelfName', sql.NVarChar(255), shelfName)
      .query(`
        MERGE INTO Inventory AS target
        USING (VALUES (@branchId, @productId, @expiryDate)) 
          AS source(BranchID, ProductID, ExpirationDate)
        ON target.BranchID = source.BranchID 
           AND target.ProductID = source.ProductID 
           AND target.ExpirationDate = source.ExpirationDate
        WHEN MATCHED THEN
          UPDATE SET 
            Quantity += 1,
            Location = @shelfName
        WHEN NOT MATCHED THEN
          INSERT (BranchID, ProductID, Quantity, ExpirationDate, PurchaseDate, Location)
          VALUES (@branchId, @productId, 1, @expiryDate, GETDATE(), @shelfName)
          OUTPUT inserted.InventoryID; 
      `);
      if (result.recordset && result.recordset.length > 0) {
        const inventoryId = result.recordset[0].InventoryID;
        console.log('Affected Inventory ID:', inventoryId);
        // You can now use the inventoryId variable
      } else {
        console.log('No Inventory ID returned.');
      }
     // console.log('Affected Inventory ID:', result.recordset[0].InventoryID);
    const inventoryId = result.recordset[0].InventoryID;
  
      //console.log('Affected Inventory ID:', inventoryId);
    // Step 5: Create task and get task ID
    const taskResult = await transaction.request()
      .input('branchId', sql.Int, branchId)
      .input('productId', sql.Int, productId)
      .input('shelfId', sql.Int, shelfId)
      .query(`
        INSERT INTO Tasks (BranchID, ProductID, ShelfID, TaskType, Status,AssignedTime)
        OUTPUT INSERTED.TaskID
        VALUES (@branchId, @productId, @shelfId, 'restock_loading', 'pending',GETDATE());
      `);

    const taskId = taskResult.recordset[0].TaskID;
    
    // Step 6: Get product details
    const productResult = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        SELECT ProductName 
        FROM Product 
        WHERE ProductID = @productId;
      `);

    // Step 7: Notify warehouse with detailed info
    await notifyWarehouseNewProduct({
      taskId: taskId,
      processType: 'restock_loading',
      description: `Loading product to shelf ${shelfName} [Row ${rowNum}, Column ${columnNum}]`,
      productId: productId,
      productName: productResult.recordset[0].ProductName,
      quantity: 1, // Quantity added in this operation
      shelfName: shelfName,
      rowNum: rowNum,
      columnNum: columnNum,
      InventoryID: inventoryId,
      branchId: branchId,
      assignedTime: new Date().toString()

    });

    await transaction.commit();

  } catch (err) {
    if (transaction && transaction.started) {
      await transaction.rollback();
    }
    console.error('Error:', err.message);
    throw err;
  }
}

async function printEmptySlots(shelfName, branchId) {
  try {
      const pool = await poolPromise;

      // Step 1: Find the ShelfID based on branchId and shelfName
      const findShelfQuery = `
          SELECT ShelfID
          FROM Shelf
          WHERE BranchID = @branchId AND ShelfName = @shelfName;
      `;
      const shelfResult = await pool.request()
          .input('branchId', sql.Int, branchId)
          .input('shelfName', sql.VarChar(255), shelfName)
          .query(findShelfQuery);

      if (shelfResult.recordset.length === 0) {
          throw new Error(`Shelf '${shelfName}' not found for BranchID ${branchId}.`);
      }

      const shelfId = shelfResult.recordset[0].ShelfID;

      // Step 2: Query for empty slots on the shelf
      const emptySlotsQuery = `
          SELECT LocationID, RowNum, ColumnNum
          FROM ShelfLocation
          WHERE ShelfID = @shelfId AND isEmpty = 1;
      `;
      const emptySlotsResult = await pool.request()
          .input('shelfId', sql.Int, shelfId)
          .query(emptySlotsQuery);

      // Print the results in tabular format
      console.log(`Empty Slots in Shelf '${shelfName}' (ShelfID ${shelfId}):`);
      console.log('+------------+--------+-----------+');
      console.log('| LocationID | RowNum | ColumnNum |');
      console.log('+------------+--------+-----------+');

      emptySlotsResult.recordset.forEach(slot => {
          console.log(`| ${slot.LocationID.toString().padEnd(11)} | ${slot.RowNum.toString().padEnd(6)} | ${slot.ColumnNum.toString().padEnd(9)} |`);
      });

      console.log('+------------+--------+-----------+');
  } catch (err) {
      console.error('Error printing empty slots:', err.message);
      throw err; // Rethrow the error for higher level handling
  }
}
//=======================Print shelf modified ===================================================
//printShelfStatus('Shelf B', 1)
async function printShelfStatus(shelfName, branchId) {
  try {
      const pool = await poolPromise;

      // Step 1: Find the ShelfID based on branchId and shelfName
      const findShelfQuery = `
          SELECT ShelfID, Rows_size, Column_size
          FROM Shelf
          WHERE BranchID = @branchId AND ShelfName = @shelfName;
      `;
      const shelfResult = await pool.request()
          .input('branchId', sql.Int, branchId)
          .input('shelfName', sql.VarChar(255), shelfName)
          .query(findShelfQuery);

      if (shelfResult.recordset.length === 0) {
          throw new Error(`Shelf '${shelfName}' not found for BranchID ${branchId}.`);
      }

      const shelfId = shelfResult.recordset[0].ShelfID;
      const rowsSize = shelfResult.recordset[0].Rows_size;
      const columnSize = shelfResult.recordset[0].Column_size;

      // Step 2: Query for empty and occupied slots on the shelf
      const shelfStatusQuery = `
          SELECT RowNum, ColumnNum, CASE WHEN isEmpty = 1 THEN '1' ELSE '0' END AS SlotStatus
          FROM ShelfLocation
          WHERE ShelfID = @shelfId;
      `;
      const shelfStatusResult = await pool.request()
          .input('shelfId', sql.Int, shelfId)
          .query(shelfStatusQuery);

      // Create an array to represent the shelf structure
      const shelfStructure = Array.from({ length: rowsSize }, () => Array(columnSize).fill('-'));

      // Update the shelf structure based on the database results
      shelfStatusResult.recordset.forEach(slot => {
          shelfStructure[slot.RowNum - 1][slot.ColumnNum - 1] = slot.SlotStatus;
      });

      // Print the shelf structure
      console.log(`Shelf '${shelfName}' (ShelfID ${shelfId})`);
      console.log(`Size: ${rowsSize} rows x ${columnSize} columns`);
      console.log(shelfStructure.map(row => row.join(' ')).join('\n'));
  } catch (err) {
      console.error('Error printing shelf status:', err.message);
      throw err; // Rethrow the error for higher level handling
  }
}

//==========================================================================================
//======================================getEmptySpaces=========================================
async function getEmptySpaces(shelfName, branchId) {
  try {
      const pool = await poolPromise;
      const emptySpacesQuery = `
          SELECT sl.LocationID, sl.RowNum, sl.ColumnNum
          FROM ShelfLocation sl
          JOIN Shelf s ON sl.ShelfID = s.ShelfID
          WHERE sl.isEmpty = 1 AND s.ShelfName = @shelfName AND s.BranchID = @branchId;
      `;
      const result = await pool.request()
          .input('shelfName', sql.VarChar(255), shelfName)
          .input('branchId', sql.Int, branchId)
          .query(emptySpacesQuery);
      if (result.recordset.length === 0) {
          console.log(`No empty spaces found in shelf '${shelfName}' for Branch ID ${branchId}.`);
          return [];
      }
      console.log(`Empty spaces in shelf '${shelfName}' for Branch ID ${branchId}:`);
      console.log('+------------+--------+-----------+'); 
      console.log('| LocationID | RowNum | ColumnNum |');
      console.log('+------------+--------+-----------+');
      result.recordset.forEach(space => {
          console.log(`| ${space.LocationID.toString().padEnd(11)} | ${space.RowNum.toString().padEnd(6)} | ${space.ColumnNum.toString().padEnd(9)} |`);
      });
      console.log('+------------+--------+-----------+');
      return result.recordset;
  } catch (err) {
      console.error('Error getting empty spaces:', err.message);
      throw err;
  }
}
//getEmptySpaces('TestShelf', 1)
//======================================Get product location ==========================================
async function getProductLocation(branchId, productId) {
  try {
      const pool = await poolPromise;

      const productLocationQuery = `
          SELECT s.ShelfName, sl.RowNum, sl.ColumnNum, s.BranchID
          FROM ShelfLocation sl
          JOIN Shelf s ON sl.ShelfID = s.ShelfID
          WHERE sl.ProductID = @productId AND s.BranchID = @branchId;
      `;
      const result = await pool.request()
          .input('productId', sql.Int, productId)
          .input('branchId', sql.Int, branchId)
          .query(productLocationQuery);

      if (result.recordset.length === 0) {
          console.log(`Product with ID ${productId} not found in any shelf for Branch ID ${branchId}.`);
          return null; // Returning null to indicate the product was not found
      }

      const location = result.recordset[0];
      console.log(`Product ${productId} is located at Shelf '${location.ShelfName}', BranchID ${location.BranchID}, Row ${location.RowNum}, Column ${location.ColumnNum}`);
      return location;
  } catch (err) {
      console.error('Error getting product location:', err.message);
      throw err;
  }
}



//==========================================================================================
//======================================remove item from shelf ==========================================
async function removeItemFromShelf(branchId, inventoryId) {
  try {
    const pool = await poolPromise;

    // Step 1: Get the product ID from the Inventory table
    const getProductQuery = `
        SELECT ProductID, Quantity 
        FROM Inventory 
        WHERE InventoryID = @inventoryId;
    `;

    const productResult = await pool.request()
        .input('inventoryId', sql.Int, inventoryId)
        .query(getProductQuery);

    if (productResult.recordset.length === 0) {
        throw new Error(`Inventory item with ID ${inventoryId} not found.`);
    }

    const { ProductID: productId, Quantity: currentQuantity } = productResult.recordset[0];

    if (currentQuantity <= 0) {
        throw new Error(`No stock available for Product ID ${productId}.`);
    }
    else if (currentQuantity === 1) {
        // If quantity is 1, we will delete the inventory record
        const deleteInventoryQuery = `
            DELETE FROM Inventory 
            WHERE InventoryID = @inventoryId;
        `;
        await pool.request()
            .input('inventoryId', sql.Int, inventoryId)
            .query(deleteInventoryQuery);
    } else {
        // If quantity is more than 1, we will just decrement the quantity

    // Step 2: Decrement the product quantity in Inventory
    const decrementQuantityQuery = `
        UPDATE Inventory 
        SET Quantity = Quantity - 1 
        WHERE InventoryID = @inventoryId;
    `;
    
    await pool.request()
        .input('inventoryId', sql.Int, inventoryId)
        .query(decrementQuantityQuery);
    }
    // Step 3: Find the shelf location of the product
    const findLocationQuery = `
        SELECT sl.LocationID
        FROM ShelfLocation sl
        JOIN Shelf s ON sl.ShelfID = s.ShelfID
        WHERE sl.ProductID = @productId AND s.BranchID = @branchId;
    `;
    
    const locationResult = await pool.request()
        .input('productId', sql.Int, productId)
        .input('branchId', sql.Int, branchId)
        .query(findLocationQuery);

    if (locationResult.recordset.length === 0) {
        throw new Error(`Product with ID ${productId} not found on any shelf for Branch ID ${branchId}.`);
    }

    const locationId = locationResult.recordset[0].LocationID;

    // Step 4: Remove the product from the shelf
    const removeProductQuery = `
        UPDATE ShelfLocation
        SET ProductID = NULL, isEmpty = 1
        WHERE LocationID = @locationId;
    `;

    await pool.request()
        .input('locationId', sql.Int, locationId)
        .query(removeProductQuery);

    console.log(`Product ${productId} removed from shelf location ${locationId} in Branch ID ${branchId}.`);

  } catch (err) {
    console.error('Error removing product from shelf:', err.message);
    throw err;
  }
}
//removeItemFromShelf(1, 8)
//=================================================================================================
//========================================Create shelf====================================
async function createShelf(shelfName, branchId, rowsSize, columnSize) {
  try {
      const pool = await poolPromise;

      // Step 1: Insert new shelf record
      const insertShelfQuery = `
          INSERT INTO Shelf (ShelfName, BranchID, Rows_size, Column_size)
          OUTPUT INSERTED.ShelfID
          VALUES (@shelfName, @branchId, @rowsSize, @columnSize);
      `;

      const insertShelfResult = await pool.request()
          .input('shelfName', sql.VarChar(255), shelfName)
          .input('branchId', sql.Int, branchId)
          .input('rowsSize', sql.Int, rowsSize)
          .input('columnSize', sql.Int, columnSize)
          .query(insertShelfQuery);

      const shelfId = insertShelfResult.recordset[0].ShelfID;
      console.log('New Shelf ID:', shelfId);

      // Step 2: Initialize shelf locations
      console.log('Initializing shelf locations...');
      let locationId = 1;

      for (let row = 1; row <= rowsSize; row++) {
          for (let col = 1; col <= columnSize; col++) {
              const initializeLocationQuery = `
                  INSERT INTO ShelfLocation (RowNum, ColumnNum, ShelfID, isEmpty)
                  VALUES (@rowNum, @colNum, @shelfId, 1); -- Initialize as empty
              `;

              await pool.request()
                  .input('rowNum', sql.Int, row)
                  .input('colNum', sql.Int, col)
                  .input('shelfId', sql.Int, shelfId)
                  .query(initializeLocationQuery);

              locationId++;
          }
      }

      // Return success message
      return `Created shelf '${shelfName}' with ${rowsSize} rows and ${columnSize} columns.`;
  } catch (err) {
      console.error('SQL error', err.message);
      throw err;
  }
}

//createShelf("TestShelf",1,3,3)

//==========================================================================================






// READ operation
async function getProductById(productId) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ProductID', sql.Int, productId)
      .query('SELECT ProductName FROM Product WHERE ProductID = @ProductID');

    if (result.recordset.length > 0) {
      return result.recordset[0].ProductName; // Return only the first element's ProductName
    } else {
      return 'Product Not Found'; // Handle case where product is not found
    }

  } catch (err) {
    console.error('SQL error:', err);
    throw err;
  }
}

async function main() {
  const test = await getProductById(3);
  console.log(test);
}

//main();


//===================================================================================================
//===================================================================================================
// UPDATE operation (dynamic)
async function updateProduct(productId, updateParams) {
  try {
    const pool = await poolPromise;
    const updateQuery = Object.keys(updateParams).map(key => `${key} = @${key}`).join(', ');

    // Log the update query for debugging
    console.log(updateQuery);

    const request = pool.request().input('ProductID', sql.Int, productId);

    // Add each parameter from updateParams to the request
    Object.keys(updateParams).forEach(key => {
      request.input(key, updateParams[key]); // Assuming all values are of compatible types
    });

    const result = await request.query(`
        UPDATE Product 
        SET ${updateQuery}
        WHERE ProductID = @ProductID;
    `);
    
    return result.rowsAffected;
  } catch (err) {
    console.error('SQL error:', err);
    throw err;
  }
}

//updateProduct('7', { Price: 5 });
//===================================================================================================
// DELETE operation
async function deleteProduct(productId) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ProductID', sql.Int, productId)
      .query('DELETE FROM Product WHERE ProductID = @ProductID');

    return result.rowsAffected;
  } catch (err) {
    console.error('SQL error:', err);
    throw err;
  }
}

//===================================================================================================

async function getProductInventory() {
  try {
      const pool = await poolPromise;

      const result = await pool.request()
          .query(`
              SELECT 
                  p.ProductID, 
                  p.ProductName, 
                  p.Description, 
                  p.Price, 
                  i.InventoryID,
                  i.Quantity,
                  i.Location,
                  i.ExpirationDate,
                  i.PurchaseDate,
                  d.DiscountAmount AS Discount, 
                  sl.ShelfID,
                  sl.RowNum,
                  sl.ColumnNum,
                  sl.isEmpty,
                  b.BranchID,
                  b.BranchName,
                  p.ImageUrl
              FROM Product p
              LEFT JOIN Inventory i ON p.ProductID = i.ProductID
              LEFT JOIN ShelfLocation sl ON p.ProductID = sl.ProductID
              LEFT JOIN Shelf s ON sl.ShelfID = s.ShelfID
              LEFT JOIN Discount d ON i.InventoryID = d.InventoryID
              LEFT JOIN Branch b ON i.BranchID = b.BranchID
          `);

      const productInventory = {};

      result.recordset.forEach(row => {
          if (!productInventory[row.ProductID]) {
              productInventory[row.ProductID] = {
                  ProductID: row.ProductID,
                  ProductName: row.ProductName,
                  Description: row.Description,
                  Price: row.Price,
                  ImageUrl: row.ImageUrl,
                  InventoryID: row.InventoryID,
                  Branches: []
              };
              // console.log('image:', row.ImageUrl);
              // console.log('inventory:', row.InventoryID);
          }

          const branchInfo = productInventory[row.ProductID].Branches.find(b => b.BranchID === row.BranchID);
          if (!branchInfo && row.BranchID) {  // Only add if BranchID exists
              productInventory[row.ProductID].Branches.push({
                  BranchID: row.BranchID,
                  BranchName: row.BranchName,
                  Quantity: row.Quantity,
                  Location: row.Location,
                  ExpirationDate: row.ExpirationDate,
                  PurchaseDate: row.PurchaseDate,
                  Shelf: {
                      ShelfID: row.ShelfID,
                      RowNum: row.RowNum,
                      ColumnNum: row.ColumnNum,
                      isEmpty: row.isEmpty
                  },
                  Discount: row.Discount  // Now properly mapped from DiscountAmount
              });
          }
      });

      return productInventory;

  } catch (err) {
      console.error('SQL error:', err);
      throw err;
  }
}
async function test() {
  const test= await getProductInventory();
  console.log(test);
  console.log(test[1].ImageUrl);
}
//test()
async function displayProductInventory() {
    try {
        const inventory = await getProductInventory();

        console.log("===== Product Inventory =====");
        Object.values(inventory).forEach(product => {
            console.log(`\nProduct ID: ${product.ProductID}`);
            console.log(`Name: ${product.ProductName}`);
            console.log(`Description: ${product.Description}`);
            console.log(`Price: $${product.Price.toFixed(2)}`);
            console.log(`Image URL: ${product.ImageUrl}`);
            console.log(`Inventory ID: ${product.InventoryID}`);
            console.log("------------------------------");

            if (product.Branches.length > 0) {
                console.log("\nAvailable at branches:");
                product.Branches.forEach(branch => {
                    console.log(`- Branch ID: ${branch.BranchID} (${branch.BranchName})`);
                    console.log(`  Quantity: ${branch.Quantity}`);
                    console.log(`  Location: ${branch.Location}`);
                    console.log(`  Expiration Date: ${branch.ExpirationDate}`);
                    console.log(`  Purchase Date: ${branch.PurchaseDate}`);

                    console.log("  Shelf Details:");
                    console.log(`    Shelf ID: ${branch.Shelf.ShelfID}`);
                    console.log(`    Row: ${branch.Shelf.RowNum}, Column: ${branch.Shelf.ColumnNum}`);
                    console.log(`    Empty: ${branch.Shelf.isEmpty ? "Yes" : "No"}`);

                    console.log(`  Discount: $${branch.Discount ? branch.Discount.toFixed(2) : "No Discount"}`);
                    console.log("------------------------------");
                });
            } else {
                console.log("Not available at any branch.");
            }
        });
    } catch (error) {
        console.error("Error retrieving product inventory:", error);
    }
}

// Call the function to display inventory
displayProductInventory();

//===================================================================================================
//applyExpiryDiscounts()
//-------------------------------------------------------------------------------------------
async function applyExpiryDiscounts() {
  try {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      const currentDate = new Date();
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(currentDate.getMonth() + 6);

      // Find expiring inventory items
      const inventoryQuery = `
        SELECT 
            i.InventoryID, 
            i.ExpirationDate, 
            DATEDIFF(day, @currentDate, i.ExpirationDate) AS DaysToExpiry, 
            p.Price
        FROM Inventory i
        JOIN Product p ON i.ProductID = p.ProductID
        WHERE i.ExpirationDate <= @sixMonthsLater
          AND i.ExpirationDate > @currentDate;  -- Ensure not already expired
      `;

      const inventoryResult = await transaction.request()
        .input('currentDate', sql.Date, currentDate)
        .input('sixMonthsLater', sql.Date, sixMonthsLater)
        .query(inventoryQuery);

      for (const row of inventoryResult.recordset) {
        const { InventoryID, ExpirationDate, DaysToExpiry, Price } = row;
        let discountPercentage = 0;

        // Determine discount based on remaining days
        if (DaysToExpiry <= 30) {
          discountPercentage = 70; // 70% off
        } else if (DaysToExpiry <= 60) {
          discountPercentage = 50; // 50% off
        } else if (DaysToExpiry <= 90) {
          discountPercentage = 40; // 40% off
        } else if (DaysToExpiry <= 180) {
          discountPercentage = 30; // 30% off
        }

        if (discountPercentage > 0) {
          const discountAmount = Price * (discountPercentage / 100);

          // Insert discount with validity until product expiry
          const insertQuery = `
            INSERT INTO Discount 
              (InventoryID, DiscountAmount, ExpirationDate)
            VALUES 
              (@inventoryId, @discountAmount, @expirationDate);
          `;

          await transaction.request()
            .input('inventoryId', sql.Int, InventoryID)
            .input('discountAmount', sql.Decimal(5, 2), discountAmount)
            .input('expirationDate', sql.Date, ExpirationDate)
            .query(insertQuery);

          

          console.log(`Applied ${discountPercentage}% discount to InventoryID ${InventoryID}`);
        }
      }

      await transaction.commit();
      console.log('Discounts applied successfully');

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (err) {
    console.error('Error applying discounts:', err);
    throw err;
  }
}
//===================================================================================================
module.exports = {
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductInventory,
  applyExpiryDiscounts,
  removeItemFromShelf,
  createShelf,
  printShelfStatus,
  getProductLocation,
  getEmptySpaces,
  addProductToShelf,
  printEmptySlots,
  notifyWarehouseNewProduct,
  generateBarcode,
  
};






