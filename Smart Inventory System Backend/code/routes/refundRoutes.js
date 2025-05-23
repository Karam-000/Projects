const express = require('express');
const multer = require('multer');
const router = express.Router();
const nodemailer = require('nodemailer');
const { sql, poolPromise } = require('../Database/db');
const fs = require('fs');
const path = require('path');
const { removeItemFromShelf } = require('../Controllers/Products');
const { getBranchByID } = require('../Controllers/Company');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


router.post('/damaged', upload.single('image'), async (req, res) => {
    try {
      const { description, inventoryId, branchId } = req.body;
      const image = req.file;
  
      if (!description || !inventoryId || !branchId || !image) {
        return res
          .status(400)
          .json({ success: false, message: 'Missing required fields.' });
      }
  
      console.log('Description:', description);
      console.log('Inventory ID:', inventoryId);
      console.log('Branch ID:', branchId);
      console.log('Image:', image.originalname);
  
      // Send the refund email
      //await sendRefundEmail(description, image, 'karamabousahyoun00@gmail.com');
      console.log('✅ Refund email sent');

      // Get product name from inventoryId
      const productName = await getproductName(inventoryId);
      console.log('Product Name:', productName);
  
      // Remove item from shelf
      await removeItemFromShelf(inventoryId, branchId);
      console.log('✅ Item removed from shelf');
  
      // Log refund to CSV with base64 encoded image
      logRefundToCSV(description, inventoryId, branchId, image.buffer);
      console.log('✅ Refund data logged to CSV');
  
      console.log('Done');
      res
        .status(200)
        .json({ success: true, message: 'Data received, email sent, and logged.' });
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
const sendRefundEmail = async (description, image, recipientEmail) => {
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

    if (!recipientEmail || !image || !description) {
        throw new Error('Missing required fields: Image, description, or recipient email.');
    }

    const options = {
        from: 'lamamawlawi9@gmail.com',
        to: recipientEmail,
        subject: 'Refund Request',
        text: `Description: ${description}`,
        text: 'Please find the attached image of the damaged item.',
        
        attachments: [
            {
                filename: image.originalname,
                content: image.buffer
                
            }
        ],
        text:'please send me the refund for the damaged item and process it accordingly.',
    };

    try {
        const info = await transporter.sendMail(options);
        console.log('Email sent:', info);
    } catch (err) {
        console.error('Error sending email:', err);
    }
};


// sendRefundEmail('Damaged item', imageFile, 'karamabousahyoun00@gmail.com');

async function getproductName(inventoryId) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('inventoryId', sql.Int, inventoryId)
            .query('SELECT ProductID FROM Inventory WHERE inventoryId = @inventoryId');
        if (result.recordset.length === 0) {
            throw new Error('Inventory item not found');
        }
        const productID= result.recordset[0].ProductID;
        console.log('Product ID:', productID);
        const productNameResult = await pool.request()
            .input('productID', sql.Int, productID)
            .query('SELECT productName FROM Product WHERE ProductID = @productID');
        if (productNameResult.recordset.length === 0) {
            throw new Error('Product not found');
        }
        const productName = productNameResult.recordset[0].productName;
        console.log('Product Name:', productName);
        return productName;
    } catch (err) {
        console.error('Error fetching product name:', err);
        throw err;
    }
}
//getproductName(16)
// Ensure the CSV has a header row when first created
const CSV_PATH = path.join(__dirname, '../refundData/refund.csv');
const HEADER = 'timestamp,description,inventoryId,branchId,imageBase64\n';

// Initialize CSV file with header if it doesn't exist
if (!fs.existsSync(CSV_PATH)) {
  fs.writeFileSync(CSV_PATH, HEADER);
}

/**
 * Append a refund record with base64 encoded image to the CSV file.
 * @param {string} description
 * @param {string} inventoryId
 * @param {string} branchId
 * @param {Buffer} imageBuffer
 */
async function logRefundToCSV(description, inventoryId, branchId, imageBuffer,productName) {
  const timestamp = new Date().toISOString();
  // Base64 encode the image buffer
  const imageBase64 = imageBuffer.toString('base64');
  
  const branchName=  await getBranchByID(branchId);
  console.log('Branch Name:', branchName);
  BranchName= branchName.BranchName;
  console.log('Branch Name:', BranchName);

  // Escape any double-quotes in fields
  const safe = (str) => `"${String(str).replace(/"/g, '""')}"`;

  const line =
    safe(timestamp) +
    ',' +
    safe(description) +
    ',' +
    safe(inventoryId) +
    ',' +
    safe(branchId) +
    ',' +
    safe(BranchName) +
    ',' +
    safe(productName) +
    ',' +
    safe(imageBase64) +
    '\n';

  fs.appendFile(CSV_PATH, line, (err) => {
    if (err) console.error('Error writing refund CSV:', err);
  });
}
//logRefundToCSV('Damaged item', 16, 1, Buffer.from('dummy image data'), 'test product name');


// CSV path where you stored the refunds


function displayDamagedBoxesFromCSV() {
  fs.readFile(CSV_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading CSV:', err);
      return;
    }

    const lines = data.trim().split('\n');

    // Optional: skip header if you have one
    // lines.shift();

    lines.forEach((line, index) => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));

      const [timestamp, description, inventoryId, branchId,productName,BranchName ,imageBase64] = values;

      console.log(`\n🔹 Entry #${index + 1}`);
      console.log(`Timestamp    : ${timestamp}`);
      console.log(`Description  : ${description}`);
      console.log(`Inventory ID : ${inventoryId}`);
      console.log(`Branch ID    : ${branchId}`);
      console.log(`Branch Name   : ${BranchName}`);
      console.log(`Product Name   : ${productName}`);
      

      // Save image
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const imagePath = path.join(__dirname, '../refundData',`damaged_box_${index + 1}.jpg`);
      fs.writeFileSync(imagePath, imageBuffer);
      console.log(`Image saved  : ${imagePath}`);
    });
  });
}
// Call the function to display damaged boxes from CSV
 //displayDamagedBoxesFromCSV();
 const filePath = path.join(__dirname, '../refundData/refund.csv');
console.log('CSV file path:', filePath);

module.exports = router;