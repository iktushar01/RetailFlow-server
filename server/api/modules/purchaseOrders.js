function registerPurchaseOrderRoutes(app, { collections, ObjectId }) {
  const { purchaseOrderCollection } = collections;

  // --- Purchase Orders ---
  app.get("/purchase-orders", async (req, res) => {
    const purchaseOrders = await purchaseOrderCollection.find({}).toArray();
    res.send(purchaseOrders);
  });
  
  app.post("/purchase-orders", async (req, res) => {
    const newOrder = req.body;
    const result = await purchaseOrderCollection.insertOne(newOrder);
    res.send(result);
  });
  
  app.put("/purchase-orders/:id", async (req, res) => {
    const id = req.params.id;
    const updatedOrder = req.body;
    const result = await purchaseOrderCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedOrder },
      { upsert: false }
    );
    res.send(result);
  });
  
  app.delete("/purchase-orders/:id", async (req, res) => {
    const id = req.params.id;
    const result = await purchaseOrderCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  });
  
  // --- PATCH to send PO ---
  app.patch("/purchase-orders/:id/send", async (req, res) => {
    const id = req.params.id;
  
    // Update status to 'Sent'
    const result = await purchaseOrderCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Sent" } }
    );
  
    // TODO: Call your email API to send PDF to supplier
    // await sendEmailToSupplier(purchaseOrder);
  
    res.send({ message: "PO sent to supplier", result });
  });
}

module.exports = registerPurchaseOrderRoutes;
