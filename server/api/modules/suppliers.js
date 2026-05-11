function registerSupplierRoutes(app, { collections, ObjectId }) {
  const { supplierCollaction } = collections;

  // --- Suppliers ---
  app.get("/suppliers", async (req, res) => {
    const suppliers = await supplierCollaction.find({}).toArray();
    res.send(suppliers);
  });
  
  app.post("/suppliers", async (req, res) => {
    const newSupplier = req.body;
    const result = await supplierCollaction.insertOne(newSupplier);
    res.send(result);
  });
  
  app.put("/suppliers/:id", async (req, res) => {
    const id = req.params.id;
    const updatedSupplier = req.body;
    const result = await supplierCollaction.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedSupplier },
      { upsert: false }
    );
    res.send(result);
  });
  
  app.delete("/suppliers/:id", async (req, res) => {
    const id = req.params.id;
    const result = await supplierCollaction.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  });
}

module.exports = registerSupplierRoutes;
