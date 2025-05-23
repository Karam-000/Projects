CREATE TABLE Company (
    CompanyID INT identity(1,1) PRIMARY KEY,
    CompanyName VARCHAR(255) NOT NULL,
    Address VARCHAR(255),
    City VARCHAR(100),
    State VARCHAR(100),   
);




	  

CREATE TABLE Branch (
    BranchID INT identity(1,1) PRIMARY KEY,
    CompanyID INT,
    BranchName VARCHAR(255) NOT NULL,
    Address VARCHAR(255),
    City VARCHAR(100),
    State VARCHAR(100),
    FOREIGN KEY (CompanyID) REFERENCES Company(CompanyID)
);


CREATE TABLE Department (
    DepartmentID INT identity(1,1) PRIMARY KEY,
    BranchID INT,
    DepartmentName VARCHAR(255) NOT NULL,
    FOREIGN KEY (BranchID) REFERENCES Branch(BranchID)
);
CREATE TABLE Employees (
    EmployeeID INT identity(1,1) PRIMARY KEY,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Email VARCHAR(100) UNIQUE,
    salary float,
    Phone VARCHAR(20),
    Address VARCHAR(255),
    City VARCHAR(100),
    State VARCHAR(50),
    ZipCode VARCHAR(20),
    Country VARCHAR(100),
    HireDate DATE,
    DepartmentID INT,
	Password VARCHAR(255),
    FOREIGN KEY (DepartmentID) REFERENCES Department(DepartmentID)
);


CREATE TABLE Manager (
    ManagerID INT identity(1,1) PRIMARY KEY,
    EmployeeID INT,
    DepartmentID INT,
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
    FOREIGN KEY (DepartmentID) REFERENCES Department(DepartmentID)
);

CREATE TABLE Product (
    ProductID INT identity(1,1) PRIMARY KEY,
    ProductName VARCHAR(255) NOT NULL,
    Description TEXT,
    Price DECIMAL(10, 2),
	ImageUrl VARCHAR(255),
    BarcodePath VARCHAR(255)
	
);











CREATE TABLE Inventory (
    InventoryID INT identity(1,1) PRIMARY KEY,
    BranchID INT,
    ProductID INT,
    Quantity INT,
    ExpirationDate DATE, -- Column for expiration date
    PurchaseDate DATE, -- Column for the date the product was bought
	Location NVARCHAR(255),
    FOREIGN KEY (BranchID) REFERENCES Branch(BranchID),
    FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
	);

CREATE TABLE Discount (
    DiscountID INT identity(1,1) PRIMARY KEY,
    InventoryID INT,
    DiscountAmount DECIMAL(5, 2),
    ExpirationDate DATE,
    FOREIGN KEY (InventoryID) REFERENCES Inventory(InventoryID)
);






CREATE TABLE Shelf (
    ShelfID INT identity(1,1) PRIMARY KEY,
    ShelfName VARCHAR(255) NOT NULL,
	BranchID int,
	Rows_size int,
	Column_size int,
	FOREIGN KEY (BranchID) REFERENCES Branch(BranchID)
);
CREATE TABLE ShelfLocation (
    LocationID INT IDENTITY(1,1) PRIMARY KEY,
    RowNum INT,
    ColumnNum INT,
    ProductID INT,
    ShelfID INT,
	isEmpty BIT NOT NULL DEFAULT 1, -- 1 for empty, 0 for occupied
    FOREIGN KEY (ProductID) REFERENCES Product(ProductID),
    FOREIGN KEY (ShelfID) REFERENCES Shelf(ShelfID)
);







 

CREATE TABLE Customers (
    CustomerID INT identity(1,1) PRIMARY KEY,
    Username VARCHAR(50) UNIQUE,
    PasswordHash VARCHAR(255),
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Email VARCHAR(100) UNIQUE,
    Phone VARCHAR(20),
    RegistrationDate DATE,
    IsEmailVerified BIT NOT NULL DEFAULT 0 ,
    IsDeleted bit
);
CREATE TABLE EmailVerificationTokens (
    TokenID INT IDENTITY PRIMARY KEY,
    CustomerID INT NOT NULL,
    Token VARCHAR(255) NOT NULL UNIQUE,
    ExpirationDate DATETIME NOT NULL,
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
);
-- Create DeliveryLocation table
CREATE TABLE DeliveryLocation (
    DeliveryLocationID INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID INT FOREIGN KEY REFERENCES Customers(CustomerID),
    Address VARCHAR(255),
    City VARCHAR(100),
    State VARCHAR(50),
    ZipCode VARCHAR(20)
);
CREATE TABLE Payment (
    PaymentID INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID INT FOREIGN KEY REFERENCES Customers(CustomerID),
    PaymentMethod VARCHAR(50),
    CardNumber VARCHAR(16),
    ExpiryDate DATE,
    CVV VARCHAR(4)
);


CREATE TABLE UserSessions (
    SessionID INT IDENTITY(1,1) PRIMARY KEY,
    Username VARCHAR(50) NOT NULL,
    Token NVARCHAR(500) NOT NULL,
    SessionStart DATETIME DEFAULT GETDATE(),
	
	FOREIGN KEY (Username) REFERENCES Customers(Username)
);


CREATE TABLE Orders (
    OrderID INT identity(1,1) PRIMARY KEY,
    Username VARCHAR(50),
	BranchID INT,
    OrderDate DATE,
    TotalAmount DECIMAL(10, 2),
    Status VARCHAR(50),

    FOREIGN KEY (Username) REFERENCES Customers(Username)
);




CREATE TABLE OrderItems (
    OrderItemID INT identity(1,1)  PRIMARY KEY,
    OrderID INT,
    ProductID INT,
    Quantity INT,
    UnitPrice DECIMAL(10, 2),
    TotalPrice DECIMAL(10, 2),
    FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
    FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
);

CREATE TABLE Cart(
    CartID INT IDENTITY PRIMARY KEY,
    ProductID INT,
    Username VARCHAR(50),
    InventoryID INT,       -- Newly added column
    Quantity INT,
    UnitPrice DECIMAL(10, 2),
    TotalPrice DECIMAL(10, 2),
    Discount BIT,
    FOREIGN KEY (ProductID) REFERENCES Product(ProductID),
    FOREIGN KEY (Username) REFERENCES Customers(Username),
    FOREIGN KEY (InventoryID) REFERENCES Inventory(InventoryID)  -- New foreign key
);







CREATE TABLE WarehouseURL (
    WarehouseURLID INT IDENTITY(1,1) PRIMARY KEY,
    BranchID INT UNIQUE NOT NULL, -- Each branch has one webhook URL
    WebhookURL VARCHAR(255) NOT NULL,
    FOREIGN KEY (BranchID) REFERENCES Branch(BranchID)
);

CREATE TABLE Tasks (
    TaskID INT IDENTITY(1,1) PRIMARY KEY,
    TaskType VARCHAR(100), -- e.g., fetch product, update inventory
    ProductID INT,
    Quantity INT,
    BranchID INT,
    ShelfID INT,
    Status VARCHAR(50), -- e.g., pending, in-progress, completed
    AssignedTime DATETIME,
    CompletedTime DATETIME,
    FOREIGN KEY (ProductID) REFERENCES Product(ProductID),
    FOREIGN KEY (BranchID) REFERENCES Branch(BranchID),
    FOREIGN KEY (ShelfID) REFERENCES Shelf(ShelfID)
	
);
CREATE TABLE ErrorLogs (
    ErrorLogID INT PRIMARY KEY IDENTITY(1,1),
    FunctionName NVARCHAR(255) NOT NULL,
    ErrorMessage NVARCHAR(MAX) NOT NULL,
    Context NVARCHAR(MAX), -- Optional: Store additional context like OrderID, Username, etc.
    CreatedAt DATETIME DEFAULT GETDATE()
);
CREATE TABLE EmployeeLogin (
    LoginID INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeID INT,
    LoginTime DATETIME DEFAULT GETDATE(),
    Token VARCHAR(500),
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE ResetPasswordTokens (
    Token VARCHAR(255) PRIMARY KEY,
    Username VARCHAR(50),
    ExpirationDate DATETIME,
    Used BIT DEFAULT 0,
    FOREIGN KEY (Username) REFERENCES Customers(Username)
);

CREATE TABLE EmployeeTransactions (
    TransactionID INT IDENTITY(1,1) PRIMARY KEY, -- Auto-incrementing unique ID for each transaction
    EmployeeID INT NOT NULL, -- Employee ID
    EmployeeName VARCHAR(100) NOT NULL, -- Employee name
    TransactionDate DATETIME DEFAULT GETDATE(), -- Date and time of the transaction (default to current time)
    Description NVARCHAR(MAX) NOT NULL, -- Description of the transaction/process made
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) -- Assuming Employees table exists
);

CREATE PROCEDURE ResetDatabase
AS
BEGIN
    SET NOCOUNT ON;

    -- Disable foreign key constraints temporarily
    EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL";

    -- Delete rows and reset IDENTITY for all tables
    DECLARE @TableName NVARCHAR(MAX);
    DECLARE TableCursor CURSOR FOR
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE';

    OPEN TableCursor;
    FETCH NEXT FROM TableCursor INTO @TableName;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC('DELETE FROM ' + @TableName);
        EXEC('DBCC CHECKIDENT (''' + @TableName + ''', RESEED, 0)');
        FETCH NEXT FROM TableCursor INTO @TableName;
    END;

    CLOSE TableCursor;
    DEALLOCATE TableCursor;

    -- Re-enable foreign key constraints
    EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL";
END;
EXEC ResetDatabase;

