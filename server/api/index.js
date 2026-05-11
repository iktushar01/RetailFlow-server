const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const serverless = require("serverless-http");

const registerSupplierRoutes = require("./modules/suppliers");
const registerProductRoutes = require("./modules/products");
const registerPurchaseOrderRoutes = require("./modules/purchaseOrders");
const registerGrnRoutes = require("./modules/grn");
const registerInventoryRoutes = require("./modules/inventory");
const registerPaymentRoutes = require("./modules/payments");
const registerWarehouseRoutes = require("./modules/warehouses");
const registerBatchRoutes = require("./modules/batches");
const registerBarcodeRoutes = require("./modules/barcodes");
const registerStockTransferRoutes = require("./modules/stockTransfers");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

if (!process.env.MONGODB_URI) {
  console.error("Missing required environment variable: MONGODB_URI");
  app.use((req, res, next) => {
    if (req.path === "/") {
      return next();
    }

    return res.status(500).send({
      message: "Server configuration error: MONGODB_URI is not set",
    });
  });
} else {
  // MongoDB setup
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  const database = client.db("POS_System_DB");
  const collections = {
    supplierCollaction: database.collection("suppliers"),
    productCollection: database.collection("products"),
    purchaseOrderCollection: database.collection("purchaseOrders"),
    grnCollection: database.collection("grn"),
    inventoryCollection: database.collection("inventory"),
    paymentsCollection: database.collection("payments"),
    warehouseCollection: database.collection("warehouses"),
    batchCollection: database.collection("batches"),
    stockTransferCollection: database.collection("stockTransfers"),
  };

  const routeContext = { collections, ObjectId };

  registerSupplierRoutes(app, routeContext);
  registerProductRoutes(app, routeContext);
  registerPurchaseOrderRoutes(app, routeContext);
  registerGrnRoutes(app, routeContext);
  registerInventoryRoutes(app, routeContext);
  registerPaymentRoutes(app, routeContext);
  registerWarehouseRoutes(app, routeContext);
  registerBatchRoutes(app, routeContext);
  registerBarcodeRoutes(app, routeContext);
  registerStockTransferRoutes(app, routeContext);

  console.log("MongoDB routes registered successfully!");
}

// Default route
app.get("/", (req, res) => {
  res.send("POS System Server is running on Vercel");
});

// Export handler for Vercel
module.exports = app;
module.exports.handler = serverless(app);
