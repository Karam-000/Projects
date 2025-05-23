const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Mock payment data
const paymentData = {
    karam: {
        CardNumber: "1234567812345678",
        ExpiryDate: "2025-12-31",
        CVV: "123"
    },
    Karamm: {
        CardNumber: "1234567812345678",
        ExpiryDate: "2025-12-31",
        CVV: "123"
    }
    
};

// Function to check if a payment card is valid
app.post('/validate-card', (req, res) => {
    const { username, cardNumber, expiryDate, cvv } = req.body;

    if (!paymentData[username]) {
        return res.status(404).json({ success: false, message: "Customer not found." });
    }

    const storedCard = paymentData[username];
    if (
        storedCard.CardNumber === cardNumber &&
        storedCard.ExpiryDate === expiryDate &&
        storedCard.CVV === cvv
    ) {
        return res.json({ success: true, message: "Card is valid." });
    }

    return res.status(400).json({ success: false, message: "Invalid card details." });
});

// Function to confirm payment
app.post('/confirm-payment', (req, res) => {
    const { username, amount } = req.body;

    if (!paymentData[username]) {
        return res.status(404).json({ success: false, message: "Customer not found." });
    }

    // Simulate payment confirmation (for simplicity, always succeed)
    return res.json({
        success: true,
        message: `Payment of $${amount} confirmed for ${username}.`
    });
});

// Start the mock server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Mock payment server running on http://localhost:${PORT}`);
});
