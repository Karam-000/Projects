# Smart Inventory System Backend Documentation

This document provides a comprehensive overview of the Smart Inventory System backend, including setup instructions, architectural details, and API endpoint documentation.

## Project Setup

To get the backend running locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    ```

2.  **Navigate to the backend directory:**
    ```bash
    cd "Smart Inventory System Backend/code"
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Set up environment variables:**
    Create a `.env` file in the `code` directory and add the following variables.

    ```
    # Database Credentials
    DB_USER=<your_database_user>
    DB_PASS=<your_database_password>
    DB_SERVER=<your_database_server>
    DB_DATABASE=<your_database_name>

    # JWT Secrets
    JWT_SECRET=<your_jwt_secret>
    EMPLOYEE_SECRET=<your_employee_jwt_secret>

    # Email Configuration
    SMTP_USER=<your_smtp_user>
    SMTP_PASS=<your_smtp_password>

    # Stripe API Keys
    STRIPE_SECRET_KEY=<your_stripe_secret_key>
    STRIPE_PUBLISHABLE_KEY=<your_stripe_publishable_key>

    # Twilio Credentials
    TWILIO_ACCOUNT_SID=<your_twilio_account_sid>
    TWILIO_AUTH_TOKEN=<your_twilio_auth_token>
    TWILIO_PHONE_NUMBER=<your_twilio_phone_number>
    ```

5.  **Start the server:**
    ```bash
    npm start
    ```

    The server will be running at `http://localhost:3000`.

## Architecture Overview

The backend is a Node.js application built with the Express.js framework. It follows a modular architecture, with a clear separation of concerns.

*   **`index.js`:** The main entry point of the application. It sets up the Express server, registers middleware, and mounts the various route handlers.
*   **`routes/`:** This directory contains the route definitions for the different parts of the application (e.g., `authRoutes.js`, `customerRoutes.js`). Each file in this directory defines a set of endpoints related to a specific feature.
*   **`Controllers/`:** This directory contains the business logic for the application. The controllers are responsible for handling incoming requests, interacting with the services and helpers, and sending a response.
*   **`Services/`:** This directory contains services that interact with external systems, such as the database, email providers, and payment gateways.
*   **`Helpers/`:** This directory contains helper functions that can be reused throughout the application.
*   **`Database/`:** This directory contains the database connection configuration.
*   **`middlewares/`:** This directory contains custom middleware for the Express application, such as authentication and error handling.

## API Endpoints

The following is a list of the available API endpoints.

### Authentication (`/auth`)

*   **`POST /login`**: Logs in a customer.
    *   **Request Body**: `{ "username": "...", "password": "..." }`
    *   **Response**: `{ "status": "success", "user": { ... }, "token": "..." }`
*   **`POST /signup`**: Registers a new customer.
    *   **Request Body**: `{ "Username": "...", "Password": "...", "FirstName": "...", "LastName": "...", "Email": "...", "Phone": "..." }`
    *   **Response**: `{ "success": true, "message": "Verification email sent" }`
*   **`POST /LoginEmloyee`**: Logs in an employee.
    *   **Request Body**: `{ "employeeId": "...", "password": "..." }`
    *   **Response**: `{ "token": "..." }`

### Customers (`/users`)

*   **`GET /`**: Get all customers.
*   **`GET /:id`**: Get a customer by ID.

### Employees (`/employee`)

*   **`GET /GetFinancialData`**: Get financial data (requires 'Finance' role).
*   **`PATCH /UpdateEmployee`**: Update an employee's information (requires 'HR' role).
*   **`DELETE /DeleteEmployee`**: Delete an employee (requires 'HR' role).

And many more. Please refer to the files in the `routes/` directory for a complete list of endpoints and their functionality.
