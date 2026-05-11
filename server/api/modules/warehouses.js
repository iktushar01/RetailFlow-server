function registerWarehouseRoutes(app, { collections, ObjectId }) {
  const { warehouseCollection, inventoryCollection } = collections;

  // === WAREHOUSES ===
  app.get("/warehouses", async (req, res) => {
    try {
      const warehouses = await warehouseCollection.find({}).toArray();
      const warehousesWithSummary = await Promise.all(
        warehouses.map(async (warehouse) => {
          const inventoryItems = await inventoryCollection
            .find({ location: warehouse.name })
            .toArray();
          return {
            ...warehouse,
            totalProducts: inventoryItems.length,
            totalStock: inventoryItems.reduce(
              (sum, item) => sum + (item.stockQty || 0),
              0
            ),
          };
        })
      );
      res.send(warehousesWithSummary);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching warehouses", error: error.message });
    }
  });
  
  app.post("/warehouses", async (req, res) => {
    try {
      const warehouseData = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await warehouseCollection.insertOne(warehouseData);
      res.send({ message: "Warehouse created successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error creating warehouse", error: error.message });
    }
  });
  
  app.put("/warehouses/:id", async (req, res) => {
    try {
      const warehouseData = req.body;
      delete warehouseData._id;
      warehouseData.updatedAt = new Date();
      const result = await warehouseCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: warehouseData }
      );
      res.send({ message: "Warehouse updated successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error updating warehouse", error: error.message });
    }
  });
  
  app.delete("/warehouses/:id", async (req, res) => {
    try {
      const warehouse = await warehouseCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      const inventoryCount = await inventoryCollection.countDocuments({
        location: warehouse.name,
      });
      if (inventoryCount > 0)
        return res
          .status(400)
          .send({ message: "Cannot delete warehouse with stock" });
      await warehouseCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send({ message: "Warehouse deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error deleting warehouse", error: error.message });
    }
  });
}

module.exports = registerWarehouseRoutes;
