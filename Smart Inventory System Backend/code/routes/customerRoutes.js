const express = require('express');
const router = express.Router();
const {authenticateCustomer} = require('../middlewares/authMiddleware'); // Import the middleware
const { getProductInventory } = require('../Controllers/Products'); // Assuming helper function for fetching product inventory
const Fuse = require('fuse.js'); // Fuzzy search library
const { addProductToCart, decrementCartItem,removeCartItem,getCartItems } = require('../Services/order'); 
const{getCustomerByUsername,updateCustomer,getCustomerOrders}=require('../Controllers/customers');
const {verifyPassword} = require('../Services/Login'); 
const{deleteCustomer,addPayment,
    addDeliveryLocation,
    deletePayment,
    updatePayment,
    readPayment,
    updateDeliveryLocation,
    deleteDeliveryLocation,
    getDeliveryLocations,}=require('../Controllers/customers');
const { checkEmailVerifiedUsers } = require('../Services/Login');
const { placeOrder } = require('../Services/order');



// Route for getting product inventory
router.get('/products', authenticateCustomer, async (req, res) => {
    try {
        // Fetch product inventory
        const productDetails = await getProductInventory();
        
        // Check if productDetails is empty or null, and return a message if so
        if (!productDetails || productDetails.length === 0) {
            return res.status(404).json({ status: 'error', message: 'No products found' });
        }

        res.status(200).json({
            status: 'success',
            data: productDetails
        });
    } catch (error) {
        console.error('Error retrieving product inventory:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});

// Route for searching products
router.get('/searchProduct', authenticateCustomer, async (req, res) => {
    try {
        // Parse search query
        const searchTerm = req.query.q?.trim().toLowerCase();

        if (!searchTerm) {
            return res.status(400).json({ status: 'error', message: 'Search term is required' });
        }

        // Get all products
        const products = Object.values(await getProductInventory());

        // If no products found
        if (!products || products.length === 0) {
            return res.status(404).json({ status: 'error', message: 'No products available' });
        }

        // Configure fuse.js options for fuzzy search
        const options = {
            keys: ['ProductName', 'Description'],
            threshold: 0.4, // Allow more fuzzy matches
            tokenize: true,  // Enable tokenization for multi-word search terms
        };

        const fuse = new Fuse(products, options);
        const results = fuse.search(searchTerm);

        // Check if no results were found
        if (results.length === 0) {
            console.log('No matches found.');
        }

        // Sort results by relevance score
        results.sort((a, b) => a.score - b.score);

        res.status(200).json({
            status: 'success',
            data: results.map(result => result.item), // Extract matched products
            meta: {
                search_term: searchTerm,
                results_count: results.length
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});
// Route for adding a product to the cart
router.post('/addToCart', authenticateCustomer, async (req, res) => {
    try {
        const { inventoryId, quantity } = req.body;

        // Validate inventoryId format
        if (!inventoryId || isNaN(parseInt(inventoryId))) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Invalid inventory ID' }));
            return;
        }

        // Validate quantity
        if (!quantity || quantity <= 0 || isNaN(quantity)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Invalid quantity' }));
            return;
        }

        const username = req.user.username; // Extract username from authenticated user
        console.log(`Adding product ${inventoryId} to cart for user ${username} with quantity ${quantity}`);
        const success = await addProductToCart(username, inventoryId, quantity);
        if (success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: `Product ${inventoryId} added to cart with quantity ${quantity}` }));
        }
        else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Failed to add product to cart' }));
        }

       
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});
// Route for decrementing cart items 
router.post('/decrementCart', authenticateCustomer, async (req, res) => {
try {
    const { inventoryId } = req.body;
    const username = req.user.username; 
    const success = await decrementCartItem(username, inventoryId);
            
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success, message: success ? 'Cart item decremented' : 'Item not found' }));
} catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: error.message }));
}
});
// Route for removing cart items
router.post('/removeCart', authenticateCustomer, async (req, res) => {
    try {
        const { inventoryId } = req.body;
        const username = req.user.username;
        const success = await removeCartItem(username, inventoryId);
        if (success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Cart item removed' }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Item not found' }));
        }
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: error.message }));
    }
});
// Route for getting cart items
router.get('/cart', authenticateCustomer, async (req, res) => {
    try {
        const username = req.user.username;
        const cartItems = await getCartItems(username);
        if (!cartItems || cartItems.length === 0) {
            return res.status(404).json({ status: 'error', message: 'No items in cart' });
        }
       
        const response = {
          success: true,
          totalItems: cartItems.length,
          items: cartItems.map(item => ({
            cartId: item.CartID,
            product: item.ProductName,
            quantity: item.Quantity,
            unitPrice: item.UnitPrice,
            totalPrice: item.TotalPrice,
            discountApplied: item.DiscountAmount ? true : false,
            discountAmount: item.DiscountAmount || 0,
            expires: item.ExpirationDate ? item.ExpirationDate.toISOString() : null
          }))
        };
    
        res.status(200).json(response);
        
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error retrieving cart',
          error: error.message
        });
      }
    });

// Route for checking out
router.post('/placeOrder', authenticateCustomer, async (req, res) => {
    try {
      const { branchId, deliveryLocationId, paymentId } = req.body;
      const username = req.user.username;
  
      // Validate required parameters
      if (!branchId || !deliveryLocationId || !paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: branchId, deliveryLocationId, or paymentId'
        });
      }
  
      // Check email verification status
      const emailCheck = await checkEmailVerifiedUsers(username);
      
      if (!emailCheck.success) {
        return res.status(400).json({
          success: false,
          message: emailCheck.message || 'Email verification check failed'
        });
      }
  
      if (!emailCheck.verified) {
        return res.status(403).json({
          success: false,
          message: 'Email not verified. A new verification link has been sent to your email.'
        });
      }
  
      // Proceed with order placement
      const orderResult = await placeOrder(username, branchId, deliveryLocationId, paymentId);
      
      res.status(200).json({
        success: true,
        message: 'Order placed successfully',
        order: orderResult
      });
  
    } catch (error) {
      console.error('Order error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Order placement failed'
      });
    }
  });
//Route to get customer information
router.get('/getCustomerInfo', authenticateCustomer, async (req, res) => {

    try {
        const username = req.user.username; 
        
       const customerInfo= await getCustomerByUsername(username)
        res.writeHead(200, { 'Content-Type': 'application/json' });
            res.write(JSON.stringify(customerInfo));
            res.end();
        } catch (error) {
            console.error('Error retrieving customer information:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.write(JSON.stringify({ success: false, message: 'Internal Server Error' }));
            res.end();
        }
} );
//Route to Update customer info 
router.patch('/updateCustomerInfo', authenticateCustomer, async (req, res) => {
    try {
      const username = req.user.username;
      const { CustomerID, ...updates } = req.body;
  
      // Input validation
      if (!CustomerID) {
        return res.status(400).json({
          success: false,
          message: 'CustomerID is required'
        });
      }
  
      // Validate updates (add your own validation rules)
      const allowedFields = ['Email', 'PhoneNumber', 'Address'];
      const invalidFields = Object.keys(updates).filter(
        field => !allowedFields.includes(field)
      );
      
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid fields: ${invalidFields.join(', ')}`
        });
      }
  
      // Perform update
      const result = await updateCustomer(CustomerID, updates);
      
      // Check if customer exists
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }
  
      res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        updatedFields: updates
      });
  
    } catch (error) {
      console.error('Update error:', error);
      res.status(500).json({
        success: false,
        message: 'Update failed',
        error: error.message
      });
    }
  });
router.delete('/delete-account', authenticateCustomer, async (req, res) => {
    try {
      const { password } = req.body;
      const username = req.user.username;
  
      // Validate required parameters
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }
  
      // Verify password
      const isValid = await verifyPassword(username, password);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }
  
      // Delete account
      const deleteResult = await deleteCustomer(username);
      if (!deleteResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Account deletion failed'
        });
      }
  
      // Successful deletion
      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
  
    } catch (error) {
      console.error('Deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
// Payment Routes
router.post('/add-payment', authenticateCustomer, async (req, res) => {
    try {
      const { paymentDetails } = req.body;
      const { username, customerId } = req.user;
  
      if (!paymentDetails) {
        return res.status(400).json({
          success: false,
          message: 'Payment details are required'
        });
      }
  
      await addPayment(username, paymentDetails);
      res.status(201).json({
        success: true,
        message: 'Payment added successfully'
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
router.patch('/update-payment', authenticateCustomer, async (req, res) => {
    try {
      const { paymentId, updates } = req.body;
      const { customerId } = req.user;
  
      if (!paymentId || !updates) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID and updates are required'
        });
      }
  
      await updatePayment(customerId, paymentId, updates);
      res.status(200).json({
        success: true,
        message: 'Payment updated successfully'
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
router.delete('/delete-payment', authenticateCustomer, async (req, res) => {
    try {
      const { paymentId } = req.body;
      const { customerId } = req.user;
  
      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }
  
      await deletePayment(customerId, paymentId);
      res.status(200).json({
        success: true,
        message: 'Payment deleted successfully'
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
router.get('/get-payment', authenticateCustomer, async (req, res) => {
    try {
      const { username } = req.user;
      const payments = await readPayment(username);
      
      res.status(200).json({
        success: true,
        payments
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
  // Delivery Location Routes
router.post('/add-delivery-location', authenticateCustomer, async (req, res) => {
    try {
      const { location } = req.body;
      const { username, customerId } = req.user;
  
      if (!location) {
        return res.status(400).json({
          success: false,
          message: 'Location details are required'
        });
      }
  
      await addDeliveryLocation(username, location);
      res.status(201).json({
        success: true,
        message: 'Delivery location added successfully'
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
router.patch('/update-delivery-location', authenticateCustomer, async (req, res) => {
    try {
      const { deliveryLocationID, updates } = req.body;
  
      if (!deliveryLocationID || !updates) {
        return res.status(400).json({
          success: false,
          message: 'Location ID and updates are required'
        });
      }
  
      await updateDeliveryLocation(deliveryLocationID, updates);
      res.status(200).json({
        success: true,
        message: 'Delivery location updated successfully'
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
router.delete('/delete-delivery-location', authenticateCustomer, async (req, res) => {
    try {
      const { deliveryLocationID } = req.body;
  
      if (!deliveryLocationID) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }
  
      await deleteDeliveryLocation(deliveryLocationID);
      res.status(200).json({
        success: true,
        message: 'Delivery location deleted successfully'
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
  
router.get('/get-delivery-locations', authenticateCustomer, async (req, res) => {
    try {
      const { username } = req.user;
      const locations = await getDeliveryLocations(username);
      
      res.status(200).json({
        success: true,
        locations
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
router.get('/Orders/History', authenticateCustomer, async (req, res) => {
    try {
        const username = req.user.username; // Extract username from authenticated user
       // const username = 'Karamm'; // Extract username from query parameters
        const orders = await getCustomerOrders(username); // Fetch customer orders
        if (!orders || orders.length === 0) {
            return res.status(404).json({ status: 'error', message: 'No orders found' });
        }
        res.status(200).json({
            status: 'success',
            data: orders
        });
    } catch (error) {
        console.error('Error retrieving customer orders:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});
  // 19 Routes for Customers
module.exports = router;
