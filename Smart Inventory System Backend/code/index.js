const express = require('express');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const employeeRoutes = require('./routes/employeesRoutes');
const refundRoutes = require('./routes/refundRoutes');
const cors = require('cors');
const os = require('os');



const app = express();
app.use(express.json()); // Middleware for parsing JSON
app.use(cors()); // This will allow all domains to access your API
// Register routes
app.use('/auth', authRoutes); // Authentication routes
app.use('/users', customerRoutes);
app.use('/employee', employeeRoutes);
app.use('/refund', refundRoutes);
app.use('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to the API',
    });
});

// Catch-all route for unmatched paths
app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'The requested resource could not be found.',
    });
    });
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
// Function to get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
      for (const config of iface) {
          if (config.family === 'IPv4' && !config.internal) {
              return config.address;
          }
      }
  }
  return 'localhost'; // Fallback to localhost if no external IP is found
}

const PORT2 = 5000;
app.listen(PORT2, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`Server running at:`);

  console.log(`- Network: http://${ip}:${PORT2}`);
});