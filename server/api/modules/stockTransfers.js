function registerStockTransferRoutes(app, { collections, ObjectId }) {
  const { stockTransferCollection, inventoryCollection } = collections;

  // === STOCK TRANSFER ===
  app.get("/stock-transfers", async (req, res) => {
    try {
      const transfers = await stockTransferCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.send(transfers);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching transfers", error: error.message });
    }
  });
  
  app.post("/stock-transfers", async (req, res) => {
    try {
      const {
        productId,
        productName,
        sourceWarehouse,
        destinationWarehouse,
        quantity,
      } = req.body;
      if (sourceWarehouse === destinationWarehouse)
        return res
          .status(400)
          .send({ message: "Source and destination must be different" });
  
      const sourceInv = await inventoryCollection.findOne({
        productId,
        location: sourceWarehouse,
      });
      if (!sourceInv || sourceInv.stockQty < quantity)
        return res
          .status(400)
          .send({
            message: `Insufficient stock. Available: ${
              sourceInv?.stockQty || 0
            }`,
          });
  
      await inventoryCollection.updateOne(
        { productId, location: sourceWarehouse },
        { $inc: { stockQty: -quantity }, $set: { updatedAt: new Date() } }
      );
  
      const destInv = await inventoryCollection.findOne({
        productId,
        location: destinationWarehouse,
      });
      if (destInv) {
        await inventoryCollection.updateOne(
          { productId, location: destinationWarehouse },
          { $inc: { stockQty: quantity }, $set: { updatedAt: new Date() } }
        );
      } else {
        await inventoryCollection.insertOne({
          productId,
          productName: sourceInv.productName,
          stockQty: quantity,
          location: destinationWarehouse,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
  
      const transfer = {
        productId,
        productName: sourceInv.productName,
        sourceWarehouse,
        destinationWarehouse,
        quantity,
        status: "Completed",
        createdAt: new Date(),
      };
      const result = await stockTransferCollection.insertOne(transfer);
      res.send({ message: "Stock transferred successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error transferring stock", error: error.message });
    }
  });
}

module.exports = registerStockTransferRoutes;
