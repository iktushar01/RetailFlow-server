function registerBatchRoutes(app, { collections, ObjectId }) {
  const { batchCollection } = collections;

  // === BATCHES ===
  app.get("/batches", async (req, res) => {
    try {
      const batches = await batchCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.send(batches);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching batches", error: error.message });
    }
  });
  
  app.post("/batches", async (req, res) => {
    try {
      const batchData = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const existing = await batchCollection.findOne({
        productId: batchData.productId,
        batchNumber: batchData.batchNumber,
      });
      if (existing)
        return res.status(400).send({ message: "Batch already exists" });
      const result = await batchCollection.insertOne(batchData);
      res.send({ message: "Batch created successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error creating batch", error: error.message });
    }
  });
  
  app.put("/batches/:id", async (req, res) => {
    try {
      const batchData = req.body;
      delete batchData._id;
      batchData.updatedAt = new Date();
      const result = await batchCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: batchData }
      );
      res.send({ message: "Batch updated successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error updating batch", error: error.message });
    }
  });
  
  app.delete("/batches/:id", async (req, res) => {
    try {
      await batchCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send({ message: "Batch deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error deleting batch", error: error.message });
    }
  });
}

module.exports = registerBatchRoutes;
