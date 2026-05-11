function registerBarcodeRoutes(app, { collections, ObjectId }) {
  const { inventoryCollection } = collections;

  // === BARCODE/QR ===
  app.patch("/inventory/:id/barcode", async (req, res) => {
    try {
      const { barcode, qrCode } = req.body;
      if (barcode) {
        const existing = await inventoryCollection.findOne({
          barcode,
          _id: { $ne: new ObjectId(req.params.id) },
        });
        if (existing)
          return res.status(400).send({ message: "Barcode already exists" });
      }
      const updateData = { updatedAt: new Date() };
      if (barcode) updateData.barcode = barcode;
      if (qrCode) updateData.qrCode = qrCode;
      const result = await inventoryCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData }
      );
      res.send({ message: "Barcode updated successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error updating barcode", error: error.message });
    }
  });
}

module.exports = registerBarcodeRoutes;
