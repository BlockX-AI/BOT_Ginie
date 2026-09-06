const express = require('express');
const { ethers } = require('ethers');

/**
 * @swagger
 * components:
 *   schemas:
 *     RoyaltyPayment:
 *       type: object
 *       required:
 *         - paperId
 *         - researcher
 *         - reason
 *       properties:
 *         paperId:
 *           type: string
 *           description: ID of the paper to pay royalties for
 *         researcher:
 *           type: string
 *           description: Address of the researcher to receive royalty
 *         reason:
 *           type: string
 *           description: Reason for the payment (e.g., "citation", "access")
 */

module.exports = (royaltyDistributor) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/royalties/pay:
   *   post:
   *     summary: Pay royalties for a paper
   *     tags: [Royalties]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RoyaltyPayment'
   *     responses:
   *       200:
   *         description: Royalty payment successfully recorded
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 paymentId:
   *                   type: string
   *                 txHash:
   *                   type: string
   */
  router.post('/pay', async (req, res) => {
    try {
      const { paperId, researcher, reason, amount } = req.body;
      
      if (!paperId || !researcher || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const paymentAmount = amount ? ethers.parseEther(amount) : ethers.parseEther("0.01");
      
      const tx = await royaltyDistributor.payRoyalty(
        paperId,
        researcher,
        reason,
        { value: paymentAmount }
      );
      
      const receipt = await tx.wait();
      
      // Get the payment ID from the event
      const event = receipt.logs
        .filter(log => log.fragment && log.fragment.name === 'RoyaltyPaid')
        .map(log => royaltyDistributor.interface.parseLog(log))[0];
      
      const paymentId = event ? event.args.paymentId.toString() : null;
      
      res.json({
        success: true,
        paymentId,
        txHash: receipt.hash,
        amount: ethers.formatEther(paymentAmount)
      });
    } catch (error) {
      console.error('Error paying royalty:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/royalties/withdraw:
   *   post:
   *     summary: Withdraw accumulated royalties
   *     tags: [Royalties]
   *     responses:
   *       200:
   *         description: Royalties successfully withdrawn
   */
  router.post('/withdraw', async (req, res) => {
    try {
      const tx = await royaltyDistributor.withdrawRoyalties();
      const receipt = await tx.wait();
      
      // Get the withdrawal amount from the event
      const event = receipt.logs
        .filter(log => log.fragment && log.fragment.name === 'RoyaltyWithdrawn')
        .map(log => royaltyDistributor.interface.parseLog(log))[0];
      
      const amount = event ? ethers.formatEther(event.args.amount) : null;
      
      res.json({
        success: true,
        amount,
        txHash: receipt.hash
      });
    } catch (error) {
      console.error('Error withdrawing royalties:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/royalties/batch-pay:
   *   post:
   *     summary: Batch pay royalties to multiple researchers
   *     tags: [Royalties]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - paperIds
   *               - researchers
   *               - reasons
   *               - amounts
   *             properties:
   *               paperIds:
   *                 type: array
   *                 items:
   *                   type: string
   *               researchers:
   *                 type: array
   *                 items:
   *                   type: string
   *               reasons:
   *                 type: array
   *                 items:
   *                   type: string
   *               amounts:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Batch payment successful
   */
  router.post('/batch-pay', async (req, res) => {
    try {
      const { paperIds, researchers, reasons, amounts } = req.body;
      
      if (!paperIds || !researchers || !reasons || !amounts) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      if (paperIds.length !== researchers.length || 
          researchers.length !== reasons.length || 
          reasons.length !== amounts.length) {
        return res.status(400).json({ error: 'Arrays must have the same length' });
      }
      
      const parsedAmounts = amounts.map(amt => ethers.parseEther(amt));
      const totalAmount = parsedAmounts.reduce(
        (sum, amt) => sum + BigInt(amt.toString()), 
        BigInt(0)
      );
      
      const tx = await royaltyDistributor.batchPayRoyalties(
        paperIds,
        researchers,
        reasons,
        parsedAmounts,
        { value: totalAmount }
      );
      
      const receipt = await tx.wait();
      
      res.json({
        success: true,
        txHash: receipt.hash,
        totalAmount: ethers.formatEther(totalAmount)
      });
    } catch (error) {
      console.error('Error batch paying royalties:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/royalties/balance/{address}:
   *   get:
   *     summary: Get researcher balance
   *     tags: [Royalties]
   *     parameters:
   *       - in: path
   *         name: address
   *         schema:
   *           type: string
   *         required: true
   *         description: Ethereum address of the researcher
   *     responses:
   *       200:
   *         description: Researcher balance
   */
  router.get('/balance/:address', async (req, res) => {
    try {
      const address = req.params.address;
      
      const balance = await royaltyDistributor.getResearcherBalance(address);
      
      res.json({ 
        balance: ethers.formatEther(balance),
        address 
      });
    } catch (error) {
      console.error('Error fetching researcher balance:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/royalties/paper/{id}:
   *   get:
   *     summary: Get all payments for a paper
   *     tags: [Royalties]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper
   *     responses:
   *       200:
   *         description: Array of payment IDs
   */
  router.get('/paper/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const payments = await royaltyDistributor.getPaperPayments(paperId);
      
      // Convert BigInt to string to make it JSON serializable
      const paymentIds = payments.map(id => id.toString());
      
      res.json({ payments: paymentIds });
    } catch (error) {
      console.error('Error fetching paper payments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/royalties/researcher/{address}:
   *   get:
   *     summary: Get all payments for a researcher
   *     tags: [Royalties]
   *     parameters:
   *       - in: path
   *         name: address
   *         schema:
   *           type: string
   *         required: true
   *         description: Ethereum address of the researcher
   *     responses:
   *       200:
   *         description: Array of payment IDs
   */
  router.get('/researcher/:address', async (req, res) => {
    try {
      const address = req.params.address;
      
      const payments = await royaltyDistributor.getResearcherPayments(address);
      
      // Convert BigInt to string to make it JSON serializable
      const paymentIds = payments.map(id => id.toString());
      
      res.json({ payments: paymentIds });
    } catch (error) {
      console.error('Error fetching researcher payments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/royalties/payment/{id}:
   *   get:
   *     summary: Get payment details
   *     tags: [Royalties]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the payment
   *     responses:
   *       200:
   *         description: Payment details
   */
  router.get('/payment/:id', async (req, res) => {
    try {
      const paymentId = req.params.id;
      
      const details = await royaltyDistributor.getPaymentDetails(paymentId);
      
      const formattedDetails = {
        paperId: details[0].toString(),
        researcher: details[1],
        amount: ethers.formatEther(details[2]),
        timestamp: details[3].toString(),
        payer: details[4],
        reason: details[5]
      };
      
      res.json(formattedDetails);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/royalties/total/{id}:
   *   get:
   *     summary: Get total royalties paid for a paper
   *     tags: [Royalties]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper
   *     responses:
   *       200:
   *         description: Total royalties paid
   */
  router.get('/total/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const total = await royaltyDistributor.getTotalRoyaltiesForPaper(paperId);
      
      res.json({ 
        total: ethers.formatEther(total),
        paperId 
      });
    } catch (error) {
      console.error('Error fetching total royalties:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
