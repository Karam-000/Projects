
const axios = require('axios');

// Payment server URL
const serverUrl = 'http://localhost:3001';

// Test payment details
const testCardDetails = {
    username: 'karam',
    cardNumber: '1234567812345678',
    expiryDate: '2025-12-31',
    cvv: '123'
};

// Function to test card validation
async function testValidateCard() {
    try {
        const response = await axios.post(`${serverUrl}/validate-card`, testCardDetails);
        console.log('Card Validation Response:', response.data);
    } catch (err) {
        console.error('Error in card validation:', err.response ? err.response.data : err.message);
    }
}

// Function to test payment confirmation
async function testConfirmPayment() {
    try {
        const response = await axios.post(`${serverUrl}/confirm-payment`, {
            username: testCardDetails.username,
            amount: 100.0
        });
        console.log('Payment Confirmation Response:', response.data);
    } catch (err) {
        console.error('Error in payment confirmation:', err.response ? err.response.data : err.message);
    }
}

// Run the tests
async function runTests() {
    console.log('Testing card validation...');
    await testValidateCard();

    console.log('Testing payment confirmation...');
    await testConfirmPayment();
}

runTests();
