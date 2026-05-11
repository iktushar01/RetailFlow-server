function registerPaymentRoutes(app, { collections, ObjectId }) {
  const { paymentsCollection } = collections;

  // --- Payments ---
  
  // Get all payments
  app.get("/payments", async (req, res) => {
    try {
      const payments = await paymentsCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.send(payments);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching payments", error: error.message });
    }
  });
  
  // Get payment by ID
  app.get("/payments/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const payment = await paymentsCollection.findOne({
        _id: new ObjectId(id),
      });
  
      if (!payment) {
        return res.status(404).send({ message: "Payment not found" });
      }
  
      res.send(payment);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching payment", error: error.message });
    }
  });
  
  // Update payment (for recording payment)
  app.put("/payments/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const paymentData = req.body;
  
      delete paymentData._id;
      paymentData.updatedAt = new Date();
  
      // If amount paid equals amount due, mark as paid
      if (paymentData.amountPaid >= paymentData.amountDue) {
        paymentData.status = "Paid";
        paymentData.paidAt = new Date();
      } else if (paymentData.amountPaid > 0) {
        paymentData.status = "Partial";
      }
  
      const result = await paymentsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: paymentData }
      );
  
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Payment not found" });
      }
  
      res.send({ message: "Payment updated successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error updating payment", error: error.message });
    }
  });
}

module.exports = registerPaymentRoutes;
