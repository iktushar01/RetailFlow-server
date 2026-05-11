function registerInventoryRoutes(app, { collections, ObjectId }) {
  const { inventoryCollection } = collections;

  // --- Inventory ---
  
  // Get all inventory
  app.get("/inventory", async (req, res) => {
    try {
      const inventory = await inventoryCollection.find({}).toArray();
      res.send(inventory);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching inventory", error: error.message });
    }
  });
  
  // Get inventory by product ID
  app.get("/inventory/product/:productId", async (req, res) => {
    try {
      const productId = req.params.productId;
      const inventory = await inventoryCollection.findOne({ productId });
  
      if (!inventory) {
        return res
          .status(404)
          .send({ message: "Product not found in inventory" });
      }
  
      res.send(inventory);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching inventory", error: error.message });
    }
  });
  
  // Update inventory by ID
  app.put("/inventory/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const updateData = req.body;
  
      // Remove _id from update data if present
      delete updateData._id;
      updateData.updatedAt = new Date();
  
      const result = await inventoryCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
  
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Inventory item not found" });
      }
  
      res.send({ message: "Inventory updated successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error updating inventory", error: error.message });
    }
  });
}

module.exports = registerInventoryRoutes;
