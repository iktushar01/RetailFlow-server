function registerGrnRoutes(app, { collections, ObjectId }) {
  const { grnCollection, inventoryCollection, purchaseOrderCollection, paymentsCollection } = collections;

  // --- GRN (Goods Receive Note) ---
  
  // Get all GRNs
  app.get("/grn", async (req, res) => {
    try {
      const grns = await grnCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.send(grns);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching GRNs", error: error.message });
    }
  });
  
  // Get cumulative received quantities for a specific PO
  app.get("/grn/po/:poId/received", async (req, res) => {
    try {
      const poId = req.params.poId;
  
      // Get all GRNs for this PO
      const grns = await grnCollection.find({ poId }).toArray();
  
      // Calculate cumulative received quantities
      const cumulativeReceived = {};
      grns.forEach((grn) => {
        grn.items.forEach((item) => {
          const key = item.productId;
          if (!cumulativeReceived[key]) {
            cumulativeReceived[key] = {
              productId: item.productId,
              productName: item.productName,
              totalReceived: 0,
            };
          }
          cumulativeReceived[key].totalReceived += item.receivedQty || 0;
        });
      });
  
      res.send(Object.values(cumulativeReceived));
    } catch (error) {
      res
        .status(500)
        .send({
          message: "Error fetching cumulative received quantities",
          error: error.message,
        });
    }
  });
  // Get single GRN by ID
  app.get("/grn/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const grn = await grnCollection.findOne({ _id: new ObjectId(id) });
  
      if (!grn) {
        return res.status(404).send({ message: "GRN not found" });
      }
  
      res.send(grn);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching GRN", error: error.message });
    }
  });
  
  // Create new GRN
  app.post("/grn", async (req, res) => {
    try {
      const grnData = req.body;
  
      // Validate required fields
      if (
        !grnData.poId ||
        !grnData.receivedDate ||
        !grnData.destinationWarehouse ||
        !grnData.items ||
        grnData.items.length === 0
      ) {
        return res.status(400).send({ message: "Missing required fields" });
      }
  
      // Add timestamps
      grnData.createdAt = new Date();
      grnData.updatedAt = new Date();
  
      // Get the Purchase Order
      const po = await purchaseOrderCollection.findOne({
        _id: new ObjectId(grnData.poId),
      });
  
      if (!po) {
        return res.status(404).send({ message: "Purchase Order not found" });
      }
  
      // Get all existing GRNs for this PO to calculate cumulative received quantities
      const existingGRNs = await grnCollection
        .find({ poId: grnData.poId })
        .toArray();
  
      // Calculate cumulative received quantities per product
      const cumulativeReceived = {};
      existingGRNs.forEach((grn) => {
        grn.items.forEach((item) => {
          const key = item.productId;
          if (!cumulativeReceived[key]) {
            cumulativeReceived[key] = 0;
          }
          cumulativeReceived[key] += item.receivedQty || 0;
        });
      });
  
      // Validate that new received quantities don't exceed remaining quantities
      for (const item of grnData.items) {
        if (item.receivedQty > 0) {
          const poItem = po.items.find(
            (pi) =>
              pi.product === item.productId || pi.productId === item.productId
          );
  
          if (!poItem) {
            return res.status(400).send({
              message: `Product ${item.productName} not found in Purchase Order`,
            });
          }
  
          const orderedQty = poItem.quantity || poItem.orderedQty || 0;
          const alreadyReceived = cumulativeReceived[item.productId] || 0;
          const remainingQty = orderedQty - alreadyReceived;
  
          if (item.receivedQty > remainingQty) {
            return res.status(400).send({
              message: `Cannot receive ${item.receivedQty} of ${item.productName}. Only ${remainingQty} remaining to receive (Ordered: ${orderedQty}, Already received: ${alreadyReceived})`,
            });
          }
        }
      }
  
      // Insert GRN
      const grnResult = await grnCollection.insertOne(grnData);
  
      // Update Inventory - Add received quantities with proper batch tracking
      for (const item of grnData.items) {
        if (item.receivedQty > 0) {
          // Check if product exists in inventory
          const existingInventory = await inventoryCollection.findOne({
            productId: item.productId,
          });
  
          if (existingInventory) {
            // Update existing inventory - add stock
            await inventoryCollection.updateOne(
              { productId: item.productId },
              {
                $inc: { stockQty: item.receivedQty },
                $set: {
                  // Update batch and expiry if provided, otherwise keep existing
                  ...(item.batch && { batch: item.batch }),
                  ...(item.expiry && { expiry: item.expiry }),
                  updatedAt: new Date(),
                },
              }
            );
          } else {
            // Create new inventory record
            await inventoryCollection.insertOne({
              productId: item.productId,
              productName: item.productName,
              stockQty: item.receivedQty,
              batch: item.batch || null,
              expiry: item.expiry || null,
              location: grnData.destinationWarehouse,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
  
      // Update cumulative received in current session
      grnData.items.forEach((item) => {
        const key = item.productId;
        if (!cumulativeReceived[key]) {
          cumulativeReceived[key] = 0;
        }
        cumulativeReceived[key] += item.receivedQty || 0;
      });
  
      // Update PO Status based on cumulative quantities
      let allFullyReceived = true;
      let someReceived = false;
  
      for (const poItem of po.items) {
        const productId = poItem.product || poItem.productId;
        const orderedQty = poItem.quantity || poItem.orderedQty || 0;
        const receivedQty = cumulativeReceived[productId] || 0;
  
        if (receivedQty > 0) {
          someReceived = true;
        }
  
        if (receivedQty < orderedQty) {
          allFullyReceived = false;
        }
      }
  
      let newPOStatus = po.status;
      if (allFullyReceived && someReceived) {
        newPOStatus = "Fully Received";
      } else if (someReceived) {
        newPOStatus = "Partially Received";
      }
  
      // Update PO with new status
      await purchaseOrderCollection.updateOne(
        { _id: new ObjectId(grnData.poId) },
        {
          $set: {
            status: newPOStatus,
            updatedAt: new Date(),
            lastGRNDate: new Date(),
          },
        }
      );
  
      // Create or Update Payment Record
      const existingPayment = await paymentsCollection.findOne({
        poId: grnData.poId,
      });
  
      if (
        newPOStatus === "Fully Received" ||
        newPOStatus === "Partially Received"
      ) {
        // Calculate total amount based on cumulative received quantities
        let totalAmount = 0;
        for (const poItem of po.items) {
          const productId = poItem.product || poItem.productId;
          const receivedQty = cumulativeReceived[productId] || 0;
          const unitPrice = poItem.unitPrice || 0;
          totalAmount += receivedQty * unitPrice;
        }
  
        // Add tax if applicable
        const taxAmount = (totalAmount * (po.tax || 0)) / 100;
        const finalAmount = totalAmount + taxAmount;
  
        if (!existingPayment) {
          // Create new payment record
          await paymentsCollection.insertOne({
            poId: grnData.poId,
            grnId: grnResult.insertedId.toString(),
            supplierId: grnData.supplierId,
            poNumber: grnData.poNumber,
            grnNumber: grnData.grnNumber,
            amountDue: finalAmount,
            amountPaid: 0,
            status: "Due",
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          // Update existing payment with new amount
          await paymentsCollection.updateOne(
            { poId: grnData.poId },
            {
              $set: {
                amountDue: finalAmount,
                updatedAt: new Date(),
              },
            }
          );
        }
      }
  
      res.send({
        message: "GRN created successfully. Inventory and PO updated.",
        result: grnResult,
        grnId: grnResult.insertedId,
        poStatus: newPOStatus,
      });
    } catch (error) {
      console.error("Error creating GRN:", error);
      res
        .status(500)
        .send({ message: "Error creating GRN", error: error.message });
    }
  });
  
  // Update GRN
  app.put("/grn/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const updatedGRN = req.body;
  
      // Remove _id from update data if present
      delete updatedGRN._id;
  
      updatedGRN.updatedAt = new Date();
  
      const result = await grnCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedGRN }
      );
  
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "GRN not found" });
      }
  
      res.send({ message: "GRN updated successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error updating GRN", error: error.message });
    }
  });
  
  // Delete GRN
  app.delete("/grn/:id", async (req, res) => {
    try {
      const id = req.params.id;
  
      // Get GRN before deleting to revert inventory changes
      const grn = await grnCollection.findOne({ _id: new ObjectId(id) });
  
      if (!grn) {
        return res.status(404).send({ message: "GRN not found" });
      }
  
      // Only allow deletion if not approved
      if (grn.status === "Approved") {
        return res.status(400).send({
          message:
            "Cannot delete approved GRN. Please contact administrator.",
        });
      }
  
      // Revert inventory changes
      for (const item of grn.items) {
        if (item.receivedQty > 0) {
          const existingInventory = await inventoryCollection.findOne({
            productId: item.productId,
          });
  
          if (existingInventory) {
            const newStockQty = Math.max(
              0,
              (existingInventory.stockQty || 0) - item.receivedQty
            );
  
            if (newStockQty === 0) {
              // Remove inventory record if stock becomes 0
              await inventoryCollection.deleteOne({
                productId: item.productId,
              });
            } else {
              // Update inventory with reduced stock
              await inventoryCollection.updateOne(
                { productId: item.productId },
                {
                  $set: {
                    stockQty: newStockQty,
                    updatedAt: new Date(),
                  },
                }
              );
            }
          }
        }
      }
  
      // Delete the GRN first
      await grnCollection.deleteOne({ _id: new ObjectId(id) });
  
      // Recalculate PO status based on remaining GRNs
      const po = await purchaseOrderCollection.findOne({
        _id: new ObjectId(grn.poId),
      });
  
      if (po) {
        // Get all remaining GRNs for this PO
        const remainingGRNs = await grnCollection
          .find({ poId: grn.poId })
          .toArray();
  
        // Recalculate cumulative received quantities
        const cumulativeReceived = {};
        remainingGRNs.forEach((remainingGrn) => {
          remainingGrn.items.forEach((item) => {
            const key = item.productId;
            if (!cumulativeReceived[key]) {
              cumulativeReceived[key] = 0;
            }
            cumulativeReceived[key] += item.receivedQty || 0;
          });
        });
  
        // Determine new PO status
        let allFullyReceived = true;
        let someReceived = false;
  
        for (const poItem of po.items) {
          const productId = poItem.product || poItem.productId;
          const orderedQty = poItem.quantity || poItem.orderedQty || 0;
          const receivedQty = cumulativeReceived[productId] || 0;
  
          if (receivedQty > 0) {
            someReceived = true;
          }
  
          if (receivedQty < orderedQty) {
            allFullyReceived = false;
          }
        }
  
        let newPOStatus = "Sent";
        if (allFullyReceived && someReceived) {
          newPOStatus = "Fully Received";
        } else if (someReceived) {
          newPOStatus = "Partially Received";
        }
  
        // Update PO status
        await purchaseOrderCollection.updateOne(
          { _id: new ObjectId(grn.poId) },
          { $set: { status: newPOStatus, updatedAt: new Date() } }
        );
  
        // Update or delete payment record
        if (newPOStatus === "Sent") {
          // Delete payment if no items received
          await paymentsCollection.deleteOne({ poId: grn.poId });
        } else {
          // Recalculate payment amount
          let totalAmount = 0;
          for (const poItem of po.items) {
            const productId = poItem.product || poItem.productId;
            const receivedQty = cumulativeReceived[productId] || 0;
            const unitPrice = poItem.unitPrice || 0;
            totalAmount += receivedQty * unitPrice;
          }
  
          const taxAmount = (totalAmount * (po.tax || 0)) / 100;
          const finalAmount = totalAmount + taxAmount;
  
          await paymentsCollection.updateOne(
            { poId: grn.poId },
            {
              $set: {
                amountDue: finalAmount,
                updatedAt: new Date(),
              },
            }
          );
        }
      }
  
      res.send({
        message:
          "GRN deleted successfully. Inventory and PO status reverted.",
      });
    } catch (error) {
      console.error("Error deleting GRN:", error);
      res
        .status(500)
        .send({ message: "Error deleting GRN", error: error.message });
    }
  });
  
  // Approve GRN
  app.patch("/grn/:id/approve", async (req, res) => {
    try {
      const id = req.params.id;
  
      const result = await grnCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: "Approved",
            approvedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
  
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "GRN not found" });
      }
  
      res.send({ message: "GRN approved successfully", result });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error approving GRN", error: error.message });
    }
  });
}

module.exports = registerGrnRoutes;
