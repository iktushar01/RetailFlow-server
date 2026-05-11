function registerProductRoutes(app, { collections, ObjectId }) {
  const { productCollection } = collections;

  // --- Products ---
  app.get("/products", async (req, res) => {
    const products = await productCollection.find({}).toArray();
    res.send(products);
  });
  
  app.post("/products", async (req, res) => {
    const newProduct = req.body;
    const result = await productCollection.insertOne(newProduct);
    res.send(result);
  });
  
  app.put("/products/:id", async (req, res) => {
    const id = req.params.id;
    const updatedProduct = req.body;
    const result = await productCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedProduct },
      { upsert: false }
    );
    res.send(result);
  });
  
  app.delete("/products/:id", async (req, res) => {
    const id = req.params.id;
    const result = await productCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  });
}

module.exports = registerProductRoutes;
