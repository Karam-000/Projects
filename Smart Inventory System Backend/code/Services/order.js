const { sql, poolPromise } = require('../Database/db');
const {getProductById} = require('..\\Controllers\\Products.js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const {sendEmail} = require('./email');
const { response } = require('express');
const axios = require('axios');
const http = require('http');
const { logError } = require('./errorLogs.js'); 


//=======================================add to cart==========================================
//addProductToCart("Karamm",16,1);




async function addProductToCart(username, inventoryId, quantity) {
  if (!username || !inventoryId || !quantity || quantity <= 0) {
    const errorMessage = 'Invalid parameters';
    await logError('addProductToCart', errorMessage, { username, inventoryId, quantity });
    throw new Error(errorMessage);
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Check customer exists
      const customerCheckResult = await new sql.Request(transaction)
        .input('Username', sql.VarChar, username)
        .query(`
          SELECT * FROM Customers 
          WHERE Username = @Username;
        `);

      if (customerCheckResult.recordset.length === 0) {
        const errorMessage = 'Customer not found';
        await logError('addProductToCart -> Customer Check', errorMessage, { username });
        throw new Error(errorMessage);
      }

      // Check existing cart entry
      const existingCartResult = await new sql.Request(transaction)
        .input('Username', sql.VarChar, username)
        .input('InventoryID', sql.Int, inventoryId)
        .query(`
          SELECT Quantity 
          FROM Cart 
          WHERE Username = @Username 
            AND InventoryID = @InventoryID;
        `);

      const totalRequiredQuantity = existingCartResult.recordset[0]?.Quantity + quantity || quantity;

      // Validate inventory quantity (ignoring other carts)
      const inventoryCheckResult = await new sql.Request(transaction)
        .input('InventoryID', sql.Int, inventoryId)
        .input('Quantity', sql.Int, totalRequiredQuantity)
        .query(`
          SELECT 
            i.ProductID,
            i.Quantity,
            p.Price,
            d.DiscountAmount,
            d.ExpirationDate
          FROM Inventory i
          JOIN Product p ON i.ProductID = p.ProductID
          LEFT JOIN Discount d ON i.InventoryID = d.InventoryID
          WHERE 
            i.InventoryID = @InventoryID 
            AND i.Quantity >= @Quantity;  -- Only check raw inventory
        `);

      if (inventoryCheckResult.recordset.length === 0) {
        const errorMessage = 'Inventory item unavailable';
        await logError('addProductToCart -> Inventory Check', errorMessage, { username, inventoryId, totalRequiredQuantity });
        throw new Error(errorMessage);
      }
      
      const { ProductID, Price, DiscountAmount, ExpirationDate } = inventoryCheckResult.recordset[0];
      var isDiscountValid = DiscountAmount && ExpirationDate >= new Date();
      if (isDiscountValid==null){
        isDiscountValid=0;
      }
      const unitPrice = Price -  (isDiscountValid ? DiscountAmount : 0)  ;
      const totalPrice = unitPrice * totalRequiredQuantity;
      
      // Update or insert cart entry
      if (existingCartResult.recordset.length > 0) {
        await new sql.Request(transaction)
          .input('Username', sql.VarChar, username)
          .input('InventoryID', sql.Int, inventoryId)
          .input('NewQuantity', sql.Int, totalRequiredQuantity)
          .input('NewUnitPrice', sql.Decimal(10, 2), unitPrice)
          .input('NewTotalPrice', sql.Decimal(10, 2), totalPrice)
          .input('NewDiscount', sql.Bit, isDiscountValid)
          .query(`
            UPDATE Cart 
            SET 
              Quantity = @NewQuantity,
              UnitPrice = @NewUnitPrice,
              TotalPrice = @NewTotalPrice,
              Discount = @NewDiscount
            WHERE 
              Username = @Username 
              AND InventoryID = @InventoryID;
          `);
      } else {
        await new sql.Request(transaction)
          .input('Username', sql.VarChar, username)
          .input('ProductID', sql.Int, ProductID)
          .input('InventoryID', sql.Int, inventoryId)
          .input('Quantity', sql.Int, quantity)
          .input('UnitPrice', sql.Decimal(10, 2), unitPrice)
          .input('TotalPrice', sql.Decimal(10, 2), totalPrice)
          .input('Discount', sql.Bit, isDiscountValid)
          .query(`
            INSERT INTO Cart 
            (ProductID, Username, InventoryID, Quantity, UnitPrice, TotalPrice, Discount)
            VALUES 
            (@ProductID, @Username, @InventoryID, @Quantity, @UnitPrice, @TotalPrice, @Discount);
          `);
      }

      await transaction.commit();
      return true;
    } catch (err) {
      await transaction.rollback();
      const errorMessage = `Transaction failed: ${err.message}`;
      await logError('addProductToCart -> Transaction', errorMessage, { username, inventoryId, quantity });
      throw err;
    }
  } catch (err) {
    const errorMessage = `Function failed: ${err.message}`;
    await logError('addProductToCart', errorMessage, { username, inventoryId, quantity });
    console.error('SQL error:', err.message);
    return false;
  }
}
// -----------------1. Function to decrement quantity and auto-remove if zero-------------------------------------
// 1. Decrement function
async function decrementCartItem(username, inventoryId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('Username', sql.VarChar, username)
      .input('InventoryID', sql.Int, inventoryId)
      .query('SELECT Quantity FROM Cart WHERE Username = @Username AND InventoryID = @InventoryID');

    const cartItems = result.recordset;
    if (cartItems.length === 0) return false;

    const newQuantity = cartItems[0].Quantity - 1;

    if (newQuantity > 0) {
      await pool
        .request()
        .input('Username', sql.VarChar, username)
        .input('InventoryID', sql.Int, inventoryId)
        .input('NewQuantity', sql.Int, newQuantity)
        .query(`
          UPDATE Cart 
          SET Quantity = @NewQuantity, 
              TotalPrice = @NewQuantity * UnitPrice 
          WHERE Username = @Username AND InventoryID = @InventoryID
        `);
    } else {
      await pool
        .request()
        .input('Username', sql.VarChar, username)
        .input('InventoryID', sql.Int, inventoryId)
        .query('DELETE FROM Cart WHERE Username = @Username AND InventoryID = @InventoryID');
    }
    return true;
  } catch (err) {
    console.error('SQL error:', err.message);
    throw err;
  }
}
//decrementCartItem('petergrifin',7)
//------------------------------------------------------------------------------------------------
async function removeCartItem(username, inventoryId) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('Username', sql.VarChar, username)
      .input('InventoryID', sql.Int, inventoryId)
      .query('DELETE FROM Cart WHERE Username = @Username AND InventoryID = @InventoryID');

    // Correctly check the number of affected rows
    const OUTPUT = result.rowsAffected[0] > 0;
    return OUTPUT;
  } catch (err) {
    console.error('SQL error:', err.message);
    throw err;
  }
}

//removeCartItem('petergrifin',6)
//=======================================get cart items==========================================
 async function getCartItems(username) {
  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Get cart items with product and discount details
    const result = await request
      .input('Username', sql.VarChar, username)
      .query(`
        SELECT 
          c.CartID,
          p.ProductName,
          c.Quantity,
          c.UnitPrice,
          c.TotalPrice,
          c.Discount,
          i.ExpirationDate,
          d.DiscountAmount
        FROM Cart c
        JOIN Product p ON c.ProductID = p.ProductID
        JOIN Inventory i ON c.InventoryID = i.InventoryID
        LEFT JOIN Discount d ON i.InventoryID = d.InventoryID
        WHERE 
          c.Username = @Username
          AND (d.ExpirationDate IS NULL OR d.ExpirationDate >= GETDATE());
      `);

    return result.recordset;
  } catch (err) {
    console.error('Error fetching cart:', err.message);
    throw err;
  }
}
async function testgetCartItems(username ) {
  
    const result=await getCartItems(username);
    console.log(result);
    return result;
  }
//testgetCartItems('petergrifin')
    
//=======================================removeExpiredDiscounts==========================================
async function removeExpiredDiscounts() {
  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Delete expired discounts
    const result = await request.query(`
      DELETE FROM Discount 
      WHERE ExpirationDate < GETDATE(); -- Remove discounts past their expiration
    `);

    console.log(`Deleted ${result.rowsAffected} expired discounts`);
    return result.rowsAffected;
  } catch (err) {
    console.error('Error removing expired discounts:', err.message);
    throw err;
  }
}
//=======================================send reciept to customer==========================================


const sendRecipt = async (subject, message, recipientEmail, sent_from, attachments = []) => {
  try {
    // Validate attachments
    if (!Array.isArray(attachments)) {
      const errorMessage = 'Attachments must be an array';
      await logError('sendRecipt', errorMessage, { subject, message, recipientEmail, sent_from, attachments });
      throw new Error(errorMessage);
    }

    // Create the transporter for sending the email
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: 'lamamawlawi9@gmail.com',
        pass: 'njbtlegnwuayifto',
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log('Sending email to:', recipientEmail);
    console.log('Attachments:', attachments);

    // Validate recipient email
    if (!recipientEmail) {
      const errorMessage = 'No recipient email address provided';
      await logError('sendRecipt', errorMessage, { subject, message, recipientEmail, sent_from, attachments });
      throw new Error(errorMessage);
    }

    // Validate each attachment object
    attachments.forEach((attachment, index) => {
      if (!attachment.filename || !attachment.path) {
        const errorMessage = `Invalid attachment at index ${index}: Missing filename or path`;
        logError('sendRecipt', errorMessage, { subject, message, recipientEmail, sent_from, attachments });
        throw new Error(errorMessage);
      }
    });

    // Prepare email options
    const options = {
      from:  sent_from,
      to: recipientEmail,
      subject: subject,
      html: message,
      attachments: attachments,
    };

    // Send the email
    const info = await transporter.sendMail(options);
    console.log('Email sent:', info);
  } catch (err) {
    // Log the error
    const errorMessage = `Error sending email: ${err.message}`;
    await logError('sendRecipt', errorMessage, { subject, message, recipientEmail, sent_from, attachments });
    console.error(errorMessage);
    throw err; // Re-throw the error after logging
  }
};
// const attachments2 = [
//         {
//           filename: `receipt_4.pdf`,
//           path: `C:\\Users\\karam\\OneDrive\\Documents\\Desktop\\FYP\\FYP\\code\\Services\\Reciept\\receipt_4.pdf`,
//           contentType: 'application/pdf',
//         },
//       ];
// sendRecipt('Order Confirmation', 'Thank you for your order!','karamabousahyoun00@gmail.com', 'karam',attachments2)


//========================================================================================
//=========================================generate reciept pdf=================================


const generateReceiptPDF = async (orderId, customer, totalAmount, orderItemsDetails, deliveryLocation) => {
  try {
    // Validate order items details
    if (!orderItemsDetails || !Array.isArray(orderItemsDetails)) {
      const errorMessage = 'Invalid order items details';
      await logError('generateReceiptPDF', errorMessage, { orderId, customer, totalAmount, orderItemsDetails, deliveryLocation });
      throw new Error(errorMessage);
    }

    const filePath = path.join(__dirname,'Reciept', `receipt_${orderId}.pdf`);
    const doc = new PDFDocument({ margin: 50 });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Set font styles
    doc.font('Helvetica-Bold').fontSize(24);

    // Title and header
    doc.text('Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(`Order ID: ${orderId}`, { align: 'center' });
    doc.moveDown();

    // Customer information
    doc.font('Helvetica').fontSize(12);
    doc.text(`Customer: ${customer.FirstName} ${customer.LastName}`);
    doc.text(`Email: ${customer.Email}`);
    doc.moveDown();

    // Delivery Location
    doc.text('Delivery Location:', { underline: true });
    doc.text(`Address: ${deliveryLocation.Address}`);
    doc.text(`City: ${deliveryLocation.City}`);
    doc.text(`State: ${deliveryLocation.State}`);
    doc.text(`Zip Code: ${deliveryLocation.ZipCode}`);
    doc.moveDown();

    // Stylish separator
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#000');
    doc.moveDown();

    // Table Header
    doc.font('Helvetica-Bold').fontSize(12);
    const tableTop = doc.y;
    const colWidths = [60, 150, 60, 90, 100, 80, 90];
    const colStartX = [50, 110, 260, 320, 410, 510];
    const headers = ['Product ID', 'Product Name', 'Quantity', 'Initial Price', 'Price After Discount', 'Discount', 'Total Price'];

    colStartX.forEach((x, i) => {
      doc.text(headers[i], x, tableTop, { width: colWidths[i], align: 'left' });
    });

    doc.moveTo(50, tableTop + 25).lineTo(550, tableTop + 25).stroke('#000');
    doc.moveDown();

    let yPosition = tableTop + 30;
    doc.font('Helvetica');

    for (const item of orderItemsDetails) {
      try {
        const productName = await getProductById(item.ProductID);
        console.log('Product Name:', productName);
        console.log('Product Name:', productName?.name);
        console.log('InitialPrice', item.InitialPrice);
        console.log('UnitPrice', item.UnitPrice);
        console.log('Discount', item.Discount);
        console.log('TotalPrice', item.TotalPrice);

        const values = [
          item.ProductID,
          productName,
          item.Quantity,
          `$${item.InitialPrice.toFixed(2)}`,
          `$${item.UnitPrice.toFixed(2)}`,
          `$${item.Discount.toFixed(2)}`,
          `$${item.TotalPrice.toFixed(2)}`,
        ];

        colStartX.forEach((x, i) => {
          doc.text(values[i], x, yPosition, { width: colWidths[i], align: 'left' });
        });

        yPosition += 20;
        if (yPosition > 720) {
          doc.addPage();
          yPosition = 50;
        }
      } catch (productError) {
        const errorMessage = `Error retrieving product name for ProductID ${item.ProductID}: ${productError.message}`;
        await logError('generateReceiptPDF -> getProductById', errorMessage, { orderId, item });
        throw new Error(errorMessage);
      }
    }

    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke('#000');
    yPosition += 10;

    // Total amount
    doc.font('Helvetica-Bold').fontSize(16);
    doc.text(`Total Price: $${totalAmount.toFixed(2)}`, 50, yPosition, { align: 'center', width: 500 });
    yPosition += 30;

    // Thank you message
    doc.fontSize(14).text('Thank you for your order!', { align: 'center', width: 500 });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => {
        const errorMessage = `Error writing PDF file: ${err.message}`;
        logError('generateReceiptPDF -> File Write', errorMessage, { orderId, filePath });
        reject(err);
      });
    });
  } catch (error) {
    const errorMessage = `Error generating receipt PDF: ${error.message}`;
    await logError('generateReceiptPDF', errorMessage, { orderId, customer, totalAmount, orderItemsDetails, deliveryLocation });
    console.error(errorMessage);
    throw error; // Re-throw the error after logging
  }
};

  
  
  
//Usage example:
const testLocation = {
    Address: '123 Test Street',
    City: 'Testville',
    State: 'Test State',
    ZipCode: '12345'
  };
  
  // Test Data
  const testOrderId = '12345';
  const testCustomer = {
    FirstName: 'John',
    LastName: 'Doe',
    Email: 'john.doe@example.com'
  };
  const testTotalAmount = 150.75;
  const testOrderItemsDetails = [
    {
      ProductID: '7',
      Quantity: 2,
      InitialPrice: 40.00,
      UnitPrice: 35.00,
      Discount: 10.00,
      TotalPrice: 70.00
    },
    {
      ProductID: '8',
      Quantity: 1,
      InitialPrice: 50.00,
      UnitPrice: 45.00,
      Discount: 5.00,
      TotalPrice: 45.00
    },
    {
      ProductID: '7',
      Quantity: 1,
      InitialPrice: 40.00,
      UnitPrice: 35.75,
      Discount: 4.25,
      TotalPrice: 35.75
    }
  ];

// generateReceiptPDF(testOrderId, testCustomer, testTotalAmount, testOrderItemsDetails,testLocation)
//   .then(filePath => {
//     console.log(`PDF generated: ${filePath}`);
//   })
//   .catch(err => {
//     console.error(`Error generating PDF: ${err}`);
//   });


  
  //========================================================================================

  const notifyWarehouseOrder = async (orderId, warehouseTasks) => {
    let pool;
    try {
      pool = await poolPromise;
  
      // Group tasks by branch for efficient processing
      const branchGroups = {};
  
      for (const task of warehouseTasks) {
        try {
          const { BranchID, ProductID, ShelfID, ShelfName, RowNum, ColumnNum, Quantity } = task;
  
          // Create a description for the task
          const taskDescription = `Prepare ${Quantity} units of product ${ProductID} from shelf ${ShelfName} [Row ${RowNum}, Column ${ColumnNum}]`;
  
          // Group tasks by branch
          if (!branchGroups[BranchID]) {
            branchGroups[BranchID] = {
              tasks: [],
              webhookUrl: null,
            };
          }
  
          branchGroups[BranchID].tasks.push({
            processId: `task-${Date.now()}-${ProductID}`, // Generate a unique process ID
            processType: 'order_preparation',
            description: taskDescription,
            product: {
              id: ProductID,
              name: `Product-${ProductID}`, // You can fetch the product name if needed
              quantity: Quantity,
            },
            shelf: {
              name: ShelfName,
              row: RowNum,
              column: ColumnNum,
            },
            branchId: BranchID,
            assignedTime: new Date().toISOString(),
          });
        } catch (itemError) {
          const errorMessage = `Error processing warehouse task for ProductID ${task.ProductID}: ${itemError.message}`;
          await logError('notifyWarehouseOrder -> Task Processing', errorMessage, { orderId, task });
          throw new Error(errorMessage);
        }
      }
  
      // Send notifications to each branch
      for (const branchId of Object.keys(branchGroups)) {
        try {
          const group = branchGroups[branchId];
  
          // Get branch webhook URL
          const urlResult = await pool.request()
            .input('branchId', sql.Int, branchId)
            .query(`
              SELECT WebhookURL 
              FROM WarehouseURL 
              WHERE BranchID = @branchId;
            `);
  
          if (!urlResult.recordset.length) {
            const errorMessage = `No WebhookURL found for branch ${branchId}`;
            await logError('notifyWarehouseOrder -> Webhook URL Check', errorMessage, { orderId, branchId });
            throw new Error(errorMessage);
          }
  
          const webhookUrl = urlResult.recordset[0].WebhookURL + '/prepare-delivery';
          console.log('Sending notification to:', webhookUrl);
          console.log('Post data:', group.tasks);
  
          // Prepare HTTP request payload
          const postData = JSON.stringify({
            orderId,
            items: group.tasks,
          });
  
          const options = {
            hostname: new URL(webhookUrl).hostname,
            port: new URL(webhookUrl).port || 80,
            path: new URL(webhookUrl).pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
            },
          };
  
          // Send HTTP request
          await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => resolve(data));
            });
  
            req.on('error', (err) => {
              const errorMessage = `HTTP request failed for branch ${branchId}: ${err.message}`;
              logError('notifyWarehouseOrder -> HTTP Request', errorMessage, { orderId, branchId, webhookUrl });
              reject(err);
            });
  
            req.write(postData);
            req.end();
          });
        } catch (notificationError) {
          const errorMessage = `Error sending notification for branch ${branchId}: ${notificationError.message}`;
          await logError('notifyWarehouseOrder -> Notification', errorMessage, { orderId, branchId });
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = `Error notifying warehouse for order ${orderId}: ${error.message}`;
      await logError('notifyWarehouseOrder', errorMessage, { orderId, warehouseTasks });
      console.error(errorMessage);
      throw error; // Re-throw the error after logging
    }
  };


  //================================placing order ========================================
  




  const placeOrder = async (username, branchId, deliveryLocationId, paymentId) => {
    // Validate required parameters
    if (!username || !branchId || !deliveryLocationId || !paymentId) {
      throw new Error('Missing required parameters: username, branchId, deliveryLocationId, or paymentId');
    }
  
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
  
    try {
      await transaction.begin();
  
      // Step 1: Check the cart for items
      console.log(`Checking cart for user: ${username}`);
      const cartCheckResult = await new sql.Request(transaction)
        .input('Username', sql.VarChar, username)
        .query(`
          SELECT COUNT(*) AS CartItemCount
          FROM Cart
          WHERE Username = @Username;
        `);
      const cartItemCount = cartCheckResult.recordset[0].CartItemCount;
      console.log(`Cart item count: ${cartItemCount}`);
      if (cartItemCount === 0) {
        console.log('Cart is empty');
        await transaction.commit();
        return null;
      }
  
      // Step 2: Insert a new order record
      console.log('Inserting into Orders table');
      const orderResult = await new sql.Request(transaction)
        .input('Username', sql.VarChar, username)
        .input('OrderDate', sql.DateTime, new Date())
        .input('Status', sql.VarChar, 'pending')
        .input('BranchID', sql.Int, branchId)
        .query(`
          INSERT INTO Orders (Username, OrderDate, TotalAmount, Status, BranchID)
          VALUES (@Username, @OrderDate, 0, @Status, @BranchID);
          SELECT SCOPE_IDENTITY() AS OrderID;
        `);
      const orderId = orderResult.recordset[0].OrderID;
      console.log(`Order ID: ${orderId}`);
  
      // Step 3: Retrieve cart items along with product details
      console.log('Retrieving cart items and checking inventory');
      const itemsResult = await new sql.Request(transaction)
        .input('Username', sql.VarChar, username)
        .query(`
          SELECT 
            c.ProductID, 
            c.Quantity, 
            c.UnitPrice, 
            c.TotalPrice, 
            c.InventoryID,
            p.Price AS InitialPrice,
            COALESCE(d.DiscountAmount, 0) AS Discount
          FROM Cart c
          INNER JOIN Product p ON c.ProductID = p.ProductID
          LEFT JOIN Discount d ON c.InventoryID = d.InventoryID
          WHERE c.Username = @Username;
        `);
      const cartItems = itemsResult.recordset;
      console.log('Cart items:', cartItems);
      
  
      let totalAmount = 0;
  
      // Step 4: Collect all necessary data for warehouse notification
      console.log('Collecting data for warehouse notification');
      const warehouseTasks = [];
      for (const item of cartItems) {
        console.log(`Processing item: item.ProductID ${item.ProductID}, InventoryID ${item.InventoryID}`);
        // Get inventory details
        const inventoryCheckResult = await new sql.Request(transaction)
          .input('InventoryID', sql.Int, item.InventoryID)
          .query(`
            SELECT 
              i.BranchID,
              i.ProductID,
              i.Quantity,
              i.Location,
              sl.RowNum,
              sl.ColumnNum,
              s.ShelfID,
              s.ShelfName
            FROM Inventory i
            JOIN ShelfLocation sl ON i.ProductID = sl.ProductID
            JOIN Shelf s ON sl.ShelfID = s.ShelfID
            WHERE i.InventoryID = @InventoryID;
          `);
        const inventory = inventoryCheckResult.recordset[0];
        if (!inventory) {
          throw new Error(`Inventory not found for InventoryID ${item.InventoryID}`);
        }
        if (inventory.Quantity < item.Quantity) {
          throw new Error(`Insufficient quantity in Inventory for ProductID ${item.ProductID}`);
        }
  
        // Collect task data for warehouse notification
        warehouseTasks.push({
          BranchID: inventory.BranchID,
          ProductID: inventory.ProductID,
          ShelfID: inventory.ShelfID,
          ShelfName: inventory.Location,
          RowNum: inventory.RowNum,
          ColumnNum: inventory.ColumnNum,
          Quantity: item.Quantity,
        });
      }
      console.log('Warehouse tasks:', warehouseTasks);
      console.log('Updating Carts table with discount details');
      // Step 5: Update each cart item with discount details (if available)
      for (const item of cartItems) {
        console.log('Updating Carts table with discount details');
        const discountResult = await new sql.Request(transaction)
          .input('InventoryID', sql.Int, item.InventoryID)
          .query(`
            SELECT TOP 1 DiscountAmount 
            FROM Discount 
            WHERE InventoryID = @InventoryID 
            ORDER BY ExpirationDate DESC;
          `);
        const discountAmount = discountResult.recordset.length > 0 ? discountResult.recordset[0].DiscountAmount : 0;
        const finalPrice = item.UnitPrice - discountAmount;
        console.log(`Final price for ProductID ${item.ProductID}: $${finalPrice}`);
        console.log(`Discount amount for ProductID ${item.ProductID}: $${discountAmount}`);
        item.TotalPrice = finalPrice * item.Quantity;
        console.log(`Total price for ProductID ${item.ProductID}: $${item.TotalPrice}`);
        totalAmount += item.TotalPrice;
      }
  
      // Step 6: Insert order items and calculate the total amount
      for (const item of cartItems) {
        await new sql.Request(transaction)
          .input('OrderID', sql.Int, orderId)
          .input('ProductID', sql.Int, item.ProductID)
          .input('Quantity', sql.Int, item.Quantity)
          .input('UnitPrice', sql.Decimal(10, 2), item.UnitPrice)
          .input('TotalPrice', sql.Decimal(10, 2), item.TotalPrice)
          .query(`
            INSERT INTO OrderItems (OrderID, ProductID, Quantity, UnitPrice, TotalPrice)
            VALUES (@OrderID, @ProductID, @Quantity, @UnitPrice, @TotalPrice);
          `);
      }
  
      // Step 7: Update the Orders table with the total amount and new status
      await new sql.Request(transaction)
        .input('OrderID', sql.Int, orderId)
        .input('TotalAmount', sql.Decimal(10, 2), totalAmount)
        .query(`
          UPDATE Orders
          SET TotalAmount = @TotalAmount, Status = 'waiting for delivery'
          WHERE OrderID = @OrderID;
        `);
  
      // Step 8: Clear the user's cart
      console.log('Clearing the cart');
      await new sql.Request(transaction)
        .input('Username', sql.VarChar, username)
        .query(`
          DELETE FROM Cart
          WHERE Username = @Username;
        `);
  
      // Step 9: Update inventory and shelf location for each cart item
      console.log('Updating inventory and shelf location');
      for (const item of cartItems) {
        const inventoryCheckResult = await new sql.Request(transaction)
          .input('InventoryID', sql.Int, item.InventoryID)
          .query(`
            SELECT Quantity, Location
            FROM Inventory
            WHERE InventoryID = @InventoryID;
          `);
        const inventory = inventoryCheckResult.recordset[0];
  
        // Decrement the inventory quantity
        await new sql.Request(transaction)
          .input('InventoryID', sql.Int, item.InventoryID)
          .input('Quantity', sql.Int, item.Quantity)
          .query(`
            UPDATE Inventory
            SET Quantity = Quantity - @Quantity
            WHERE InventoryID = @InventoryID;
          `);
  
        // Check updated quantity and delete records if zero
        const updatedInventoryResult = await new sql.Request(transaction)
          .input('InventoryID', sql.Int, item.InventoryID)
          .query(`
            SELECT Quantity
            FROM Inventory
            WHERE InventoryID = @InventoryID;
          `);
        const updatedQuantity = updatedInventoryResult.recordset[0].Quantity;
        if (updatedQuantity === 0) {
          await new sql.Request(transaction)
            .input('InventoryID', sql.Int, item.InventoryID)
            .query(`
              DELETE FROM Discount
              WHERE InventoryID = @InventoryID;
            `);
          await new sql.Request(transaction)
            .input('InventoryID', sql.Int, item.InventoryID)
            .query(`
              DELETE FROM Inventory
              WHERE InventoryID = @InventoryID;
            `);
        }
        console.log(inventory.Location)
        const shelfResult = await new sql.Request(transaction)
        .input('Location', sql.VarChar, inventory.Location)
        .query(`SELECT ShelfID FROM Shelf WHERE ShelfName = @Location`);
      
      console.log('Shelf result:', shelfResult.recordset); // Check full result
      console.log('Shelf result:', shelfResult.recordset[0].ShelfID); // Access first item
        await new sql.Request(transaction)
          .input('ProductID', sql.Int, item.ProductID)
          .input('ShelfID', sql.Int, shelfResult.recordset[0].ShelfID)
          .query(`
            UPDATE ShelfLocation
            SET isEmpty = 1, ProductID = NULL
            WHERE ProductID = @ProductID AND ShelfID = @ShelfID;
          `);
      }
  
      // Step 10: Check the delivery location exists
      console.log('Checking delivery location');
      const deliveryLocationResult = await new sql.Request(transaction)
        .input('Username', sql.VarChar, username)
        .input('DeliveryLocationID', sql.Int, deliveryLocationId)
        .query(`
          SELECT 
    dl.Address, dl.City, dl.State, dl.ZipCode
FROM 
    DeliveryLocation dl
JOIN 
    Customers c ON dl.CustomerID = c.CustomerID
WHERE 
    c.Username = @Username;
        `);
      if (deliveryLocationResult.recordset.length === 0) {
        console.log('Delivery location not found');
        await transaction.rollback();
        return 'Delivery location not found';
      }
  
      // Step 11: Check the payment method exists
      console.log('Checking payment method');
      const paymentMethodResult = await new sql.Request(transaction)
        .input('Username', sql.VarChar, username) 
        .input('PaymentID', sql.Int, paymentId)
        .query(`
          SELECT 
    p.PaymentMethod, p.CardNumber, p.ExpiryDate, p.CVV
FROM 
    Payment p
JOIN 
    Customers c ON p.CustomerID = c.CustomerID
WHERE 
    c.Username = @Username 
    AND p.PaymentID = @PaymentID;
        `);
      if (paymentMethodResult.recordset.length === 0) {
        console.log('Payment method not found');
        await transaction.rollback();
        return 'Payment method not found';
      }
  
      // Step 12: Confirm payment using an external service
      try {
        console.log(`Confirming payment with amount: ${totalAmount}`);
        const response = await axios.post(`http://localhost:3001/confirm-payment`, {
          username: username,
          amount: totalAmount,
        });
        if (response.data.success !== true) {
          console.log('Payment failed');
          await transaction.rollback();
          return 'Payment failed';
        }
        console.log('Payment confirmed');
      } catch (err) {
        console.error(`Error during payment confirmation for user ${username}: ${err.response ? err.response.data : err.message}`);
        await transaction.rollback();
        return 'Payment confirmation error';
      }
  
      // Step 13: Notify the warehouse to prepare products for delivery
      try {
        await notifyWarehouseOrder(orderId, warehouseTasks);
        console.log('Warehouse notified successfully.');
      } catch (notifyError) {
        console.error('Warehouse notification error, please check manual intervention:', notifyError.message);
      }
  
      // Step 14: Retrieve customer information for the receipt
      const customerResult = await new sql.Request(pool)
        .input('Username', sql.VarChar, username)
        .query(`
          SELECT FirstName, LastName, Email
          FROM Customers
          WHERE Username = @Username;
        `);
      const customer = customerResult.recordset[0];
      console.log(cartItems[0].Discount);
      // Step 15: Generate the receipt PDF
      const receiptFilePath = await generateReceiptPDF(
        orderId,
        customer,
        totalAmount,
        cartItems,
        deliveryLocationResult.recordset[0]
      );
  
      // Step 16: Send the receipt via email with the PDF attachment
      const attachments = [
        {
          filename: `receipt_${orderId}.pdf`,
          path: receiptFilePath,
          contentType: 'application/pdf',
        },
      ];
      // await sendRecipt(
      //   'Your Order Receipt',
      //   `Dear ${customer.FirstName} ${customer.LastName},\nYour receipt is attached.`,
      //   customer.Email,
      //   'no-reply@example.com',
      //   attachments
      // );
  
      await transaction.commit();
      console.log(`Order placed successfully: Order ID ${orderId}`);
      return orderId;
    } catch (error) {
      console.error(`Transaction error in placeOrder for user ${username} (branch ${branchId}): ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
      await transaction.rollback();
      throw error;
    }
  };
//placeOrder('Karamm', 1, 2, 3)
//========================================================================================
    
//======================================Alert function and used for resupply =================================
//checkInventoryAlert();
async function checkInventoryAlert() {
  try {
      console.debug('🔍 Starting inventory alert check');

      const pool = await poolPromise;
      console.debug('✅ Database pool acquired');

      const request = new sql.Request(pool);
      console.debug('📝 SQL request object created');

      // Query to get distinct BranchIDs from Inventory
      console.debug('📡 Executing query to fetch distinct BranchIDs');
      const branchesResult = await request.query(`
          SELECT DISTINCT BranchID
          FROM Inventory;
      `);
      console.debug(`📥 branchesResult.recordset:`, branchesResult.recordset);

      // Process each branch separately
      for (const branch of branchesResult.recordset) {
          const branchId = branch.BranchID;
          console.debug(`\n🏷️  Processing BranchID ${branchId}`);

          // Query total inventory for each ProductID in the current branch where the total quantity is less than 2
          const inventoryQuery = `
              SELECT 
                  ProductID, 
                  SUM(Quantity) AS TotalQuantity
              FROM 
                  Inventory
              WHERE 
                  BranchID = ${branchId}
              GROUP BY 
                  ProductID
              HAVING 
                  SUM(Quantity) < 2;
          `;
          console.debug(`📡 Executing inventory query for BranchID ${branchId}:`, inventoryQuery.trim());

          const inventoryResult = await request.query(inventoryQuery);
          console.debug(`📥 inventoryResult.recordset:`, inventoryResult.recordset);

          // Log alerts if there are any inventory alerts for the current branch
          if (inventoryResult.recordset.length > 0) {
              console.log(`🛎️  Inventory Alerts for BranchID ${branchId}:`);
              inventoryResult.recordset.forEach(item => {
                  console.log(`  • ProductID ${item.ProductID}: Total Quantity ${item.TotalQuantity}, Quantity to order: 5`);
              });

              // Construct email message
              let message = `Inventory Alerts for BranchID ${branchId}:<br>`;
              inventoryResult.recordset.forEach(item => {
                  message += `- ProductID ${item.ProductID}:<br>`;
                  message += `&nbsp;&nbsp;Total Quantity: ${item.TotalQuantity}<br>`;
                  message += `&nbsp;&nbsp;Quantity to order: 5<br>`;
              });
              console.debug('✉️  Email message constructed:', message);

              // Send email notification
              console.debug('📧 Sending email notification...');
              await sendEmail(
                  'Inventory Alert',
                  message,
                  'lym075@student.bau.edu.lb',
                  'lamamawlawi9@gmail.com'
              );
              console.log(`✅ Email sent for BranchID ${branchId}`);
          } else {
              console.debug(`✅ No low-stock products for BranchID ${branchId}`);
          }
      }

      console.debug('🔍 Inventory alert check completed');
  } catch (error) {
      console.error('❌ Error checking inventory:', error);
      throw error;
  }
}

//checkInventoryAlert();

//========================================================================================



async function getFinancialData() {
    try {
      const pool = await poolPromise;
  
      // Base data queries
      const [totalRevenueResult, yearlyRevenueResult, orderStatsResult] = await Promise.all([
        pool.request().query(`
          SELECT 
            COALESCE(SUM(TotalAmount), 0) AS TotalRevenue,
            COALESCE(COUNT(DISTINCT OrderID), 0) AS TotalOrders,
            COALESCE(COUNT(DISTINCT Username), 0) AS TotalCustomers
          FROM Orders
        `),
        pool.request()
          .input('currentYear', new Date().getFullYear())
          .input('lastYear', new Date().getFullYear() - 1)
          .query(`
            SELECT 
              COALESCE(SUM(CASE WHEN YEAR(OrderDate) = @currentYear THEN TotalAmount END), 0) AS ThisYearRevenue,
              COALESCE(SUM(CASE WHEN YEAR(OrderDate) = @lastYear THEN TotalAmount END), 0) AS LastYearRevenue
            FROM Orders
          `),
        pool.request().query(`
          SELECT 
            COALESCE(AVG(TotalAmount), 0) AS AverageOrderValue,
            COALESCE(MAX(TotalAmount), 0) AS LargestOrder,
            COALESCE(MIN(TotalAmount), 0) AS SmallestOrder
          FROM Orders
        `)
      ]);
  
      // Revenue calculations
      const totalRevenue = totalRevenueResult.recordset[0].TotalRevenue;
      const totalOrders = totalRevenueResult.recordset[0].TotalOrders;
      const totalCustomers = totalRevenueResult.recordset[0].TotalCustomers;
      
      const thisYearRevenue = yearlyRevenueResult.recordset[0].ThisYearRevenue;
      const lastYearRevenue = yearlyRevenueResult.recordset[0].LastYearRevenue;
      const revenueDifference = thisYearRevenue - lastYearRevenue;
      const revenueDifferencePercentage = lastYearRevenue > 0 
        ? (revenueDifference / lastYearRevenue) * 100 
        : 0;
  
      // Order statistics
      const averageOrderValue = orderStatsResult.recordset[0]?.AverageOrderValue || 0;
      const largestOrder = orderStatsResult.recordset[0]?.LargestOrder || 0;
      const smallestOrder = orderStatsResult.recordset[0]?.SmallestOrder || 0;
  
      // Product performance analysis (IMPROVED SORTING LOGIC)
      const [productPerformance, unsoldProducts] = await Promise.all([
        pool.request().query(`
          SELECT 
            p.ProductID,
            p.ProductName,
            COALESCE(SUM(oi.Quantity), 0) AS TotalSold,
            COALESCE(SUM(oi.Quantity * oi.UnitPrice), 0) AS TotalRevenue,
            COALESCE(
              ROUND(
                SUM(oi.Quantity) * 100.0 / NULLIF(SUM(SUM(oi.Quantity)) OVER (), 0),
                2
              ), 0
            ) AS SalesPercentage
          FROM Product p
          LEFT JOIN OrderItems oi ON p.ProductID = oi.ProductID
          GROUP BY p.ProductID, p.ProductName
          ORDER BY 
            TotalSold ASC, 
            TotalRevenue ASC, 
            p.ProductID
        `),
        pool.request().query(`
          SELECT ProductID, ProductName
          FROM Product
          WHERE ProductID NOT IN (SELECT DISTINCT ProductID FROM OrderItems)
        `)
      ]);
  
      // Customer analysis
      const [topCustomer, customerOrderStats] = await Promise.all([
        pool.request().query(`
          SELECT TOP 1 
            Username, 
            COUNT(OrderID) AS OrderCount,
            SUM(TotalAmount) AS TotalSpent
          FROM Orders
          GROUP BY Username
          ORDER BY TotalSpent DESC
        `),
        pool.request().query(`
          SELECT 
            COUNT(CASE WHEN OrderCount = 1 THEN 1 END) AS OneTimeCustomers,
            COUNT(CASE WHEN OrderCount > 1 THEN 1 END) AS RepeatCustomers
          FROM (
            SELECT Username, COUNT(OrderID) AS OrderCount
            FROM Orders
            GROUP BY Username
          ) AS CustomerOrders
        `)
      ]);
  
      // Format product performance results
      const sortedProducts = productPerformance.recordset;
      const bestSeller = sortedProducts[sortedProducts.length - 1] || 
        { ProductID: null, ProductName: 'N/A', TotalSold: 0 };
      const worstSeller = sortedProducts[0] || 
        { ProductID: null, ProductName: 'N/A', TotalSold: 0 };
  
      return {
        auditSummary: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalOrders,
          totalCustomers,
          averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
          largestOrder: parseFloat(largestOrder.toFixed(2)),
          smallestOrder: parseFloat(smallestOrder.toFixed(2)),
          thisYearRevenue: parseFloat(thisYearRevenue.toFixed(2)),
          lastYearRevenue: parseFloat(lastYearRevenue.toFixed(2)),
          revenueGrowth: {
            absolute: parseFloat(revenueDifference.toFixed(2)),
            percentage: parseFloat(revenueDifferencePercentage.toFixed(2))
          }
        },
        productAnalysis: {
          bestSeller: {
            ProductID: bestSeller.ProductID,
            ProductName: bestSeller.ProductName,
            TotalSold: bestSeller.TotalSold,
            TotalRevenue: parseFloat(bestSeller.TotalRevenue.toFixed(2))
          },
          worstSeller: {
            ProductID: worstSeller.ProductID,
            ProductName: worstSeller.ProductName,
            TotalSold: worstSeller.TotalSold,
            TotalRevenue: parseFloat(worstSeller.TotalRevenue.toFixed(2))
          },
          unsoldProducts: unsoldProducts.recordset,
          salesDistribution: sortedProducts.map(p => ({
            ProductID: p.ProductID,
            ProductName: p.ProductName,
            TotalSold: p.TotalSold,
            Revenue: parseFloat(p.TotalRevenue.toFixed(2)),
            SalesPercentage: parseFloat(p.SalesPercentage.toFixed(2))
          }))
        },
        customerInsights: {
          topCustomer: topCustomer.recordset.length > 0
            ? {
                Username: topCustomer.recordset[0].Username,
                TotalSpent: parseFloat(topCustomer.recordset[0].TotalSpent.toFixed(2)),
                OrderCount: topCustomer.recordset[0].OrderCount
              }
            : { Username: null, TotalSpent: 0, OrderCount: 0 },
          customerSegments: {
            oneTime: customerOrderStats.recordset[0]?.OneTimeCustomers || 0,
            repeat: customerOrderStats.recordset[0]?.RepeatCustomers || 0
          }
        }
      };
  
    } catch (err) {
      console.error('Error getting financial data:', err);
      return {
        auditSummary: {
          totalRevenue: 0,
          totalOrders: 0,
          totalCustomers: 0,
          averageOrderValue: 0,
          largestOrder: 0,
          smallestOrder: 0,
          thisYearRevenue: 0,
          lastYearRevenue: 0,
          revenueGrowth: { absolute: 0, percentage: 0 }
        },
        productAnalysis: {
          bestSeller: { ProductID: null, ProductName: 'N/A', TotalSold: 0 },
          worstSeller: { ProductID: null, ProductName: 'N/A', TotalSold: 0 },
          unsoldProducts: [],
          salesDistribution: []
        },
        customerInsights: {
          topCustomer: { Username: null, TotalSpent: 0, OrderCount: 0 },
          customerSegments: { oneTime: 0, repeat: 0 }
        }
      };
    }
  }
  async function testFinancialData() {
    try {
      const result = await getFinancialData();
      
      console.log('\n\n--- Financial Report ---');
      
      // Audit Summary
      console.log('\nAudit Summary:');
      console.log(`Total Revenue: $${result.auditSummary.totalRevenue}`);
      console.log(`Total Orders: ${result.auditSummary.totalOrders}`);
      console.log(`Total Customers: ${result.auditSummary.totalCustomers}`);
      console.log(`Average Order Value: $${result.auditSummary.averageOrderValue}`);
      console.log(`Largest Order: $${result.auditSummary.largestOrder}`);
      console.log(`Smallest Order: $${result.auditSummary.smallestOrder}`);
      console.log(`This Year Revenue: $${result.auditSummary.thisYearRevenue}`);
      console.log(`Last Year Revenue: $${result.auditSummary.lastYearRevenue}`);
      console.log(`Revenue Growth: $${result.auditSummary.revenueGrowth.absolute} (${result.auditSummary.revenueGrowth.percentage}%)`);
  
      // Product Analysis
      console.log('\nProduct Analysis:');
      console.log('Best Seller:');
      console.log(`- Product ID: ${result.productAnalysis.bestSeller.ProductID}`);
      console.log(`- Name: ${result.productAnalysis.bestSeller.ProductName}`);
      console.log(`- Total Sold: ${result.productAnalysis.bestSeller.TotalSold}`);
      console.log(`- Revenue: $${result.productAnalysis.bestSeller.TotalRevenue}`);
  
      console.log('\nWorst Seller:');
      console.log(`- Product ID: ${result.productAnalysis.worstSeller.ProductID}`);
      console.log(`- Name: ${result.productAnalysis.worstSeller.ProductName}`);
      console.log(`- Total Sold: ${result.productAnalysis.worstSeller.TotalSold}`);
      console.log(`- Revenue: $${result.productAnalysis.worstSeller.TotalRevenue}`);
  
      console.log('\nSales Distribution:');
      result.productAnalysis.salesDistribution.forEach(product => {
        console.log(`- ${product.ProductName} (ID: ${product.ProductID})`);
        console.log(`  Sold: ${product.TotalSold} | Revenue: $${product.Revenue} | ${product.SalesPercentage}% of sales`);
      });
  
      // Customer Insights
      console.log('\nCustomer Insights:');
      console.log('Top Customer:');
      console.log(`- Username: ${result.customerInsights.topCustomer.Username}`);
      console.log(`- Total Spent: $${result.customerInsights.topCustomer.TotalSpent}`);
      console.log(`- Orders: ${result.customerInsights.topCustomer.OrderCount}`);
  
      console.log('\nCustomer Segments:');
      console.log(`- One-time customers: ${result.customerInsights.customerSegments.oneTime}`);
      console.log(`- Repeat customers: ${result.customerInsights.customerSegments.repeat}`);
  
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
  
  // Run the test
  //testFinancialData();

module.exports = {
    //checkInventoryAlert,
    addProductToCart,
    placeOrder,
    decrementCartItem,
    removeCartItem,
    getFinancialData,
    getCartItems
  
  };

