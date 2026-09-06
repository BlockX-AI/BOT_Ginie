const express = require('express');
const { ethers } = require('ethers');

/**
 * @swagger
 * components:
 *   schemas:
 *     Citation:
 *       type: object
 *       required:
 *         - citingPaperId
 *         - citedPaperId
 *         - citer
 *       properties:
 *         citingPaperId:
 *           type: string
 *           description: ID of the paper doing the citing
 *         citedPaperId:
 *           type: string
 *           description: ID of the paper being cited
 *         citer:
 *           type: string
 *           description: Address of the user creating the citation
 */

module.exports = (citationRegistry) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/citations/record:
   *   post:
   *     summary: Record a new citation
   *     tags: [Citations]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Citation'
   *     responses:
   *       200:
   *         description: Citation successfully recorded
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 citationId:
   *                   type: string
   *                 txHash:
   *                   type: string
   */
  router.post('/record', async (req, res) => {
    try {
      const { citingPaperId, citedPaperId, citer } = req.body;
      
      if (!citingPaperId || !citedPaperId || !citer) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const tx = await citationRegistry.recordCitation(
        citingPaperId,
        citedPaperId,
        citer
      );
      
      const receipt = await tx.wait();
      
      // Get the citation ID from the event
      const event = receipt.logs
        .filter(log => log.fragment && log.fragment.name === 'CitationRecorded')
        .map(log => citationRegistry.interface.parseLog(log))[0];
      
      const citationId = event ? event.args.citationId.toString() : null;
      
      res.json({
        success: true,
        citationId,
        txHash: receipt.hash
      });
    } catch (error) {
      console.error('Error recording citation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/citations/verify/{id}:
   *   post:
   *     summary: Verify a citation
   *     tags: [Citations]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the citation to verify
   *     responses:
   *       200:
   *         description: Citation successfully verified
   */
  router.post('/verify/:id', async (req, res) => {
    try {
      const citationId = req.params.id;
      
      const tx = await citationRegistry.verifyCitation(citationId);
      const receipt = await tx.wait();
      
      res.json({
        success: true,
        citationId,
        txHash: receipt.hash
      });
    } catch (error) {
      console.error('Error verifying citation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/citations/paper/{id}:
   *   get:
   *     summary: Get all citations for a paper
   *     tags: [Citations]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper
   *     responses:
   *       200:
   *         description: Array of citation IDs
   */
  router.get('/paper/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const citations = await citationRegistry.getCitations(paperId);
      
      // Convert BigInt to string to make it JSON serializable
      const citationIds = citations.map(id => id.toString());
      
      res.json({ citations: citationIds });
    } catch (error) {
      console.error('Error fetching paper citations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/citations/cited-by/{id}:
   *   get:
   *     summary: Get all papers cited by a paper
   *     tags: [Citations]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper
   *     responses:
   *       200:
   *         description: Array of citation IDs
   */
  router.get('/cited-by/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const citations = await citationRegistry.getCitedPapers(paperId);
      
      // Convert BigInt to string to make it JSON serializable
      const citationIds = citations.map(id => id.toString());
      
      res.json({ citations: citationIds });
    } catch (error) {
      console.error('Error fetching cited papers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/citations/count/{id}:
   *   get:
   *     summary: Get citation count for a paper
   *     tags: [Citations]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper
   *     responses:
   *       200:
   *         description: Number of citations for the paper
   */
  router.get('/count/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const count = await citationRegistry.getCitationCount(paperId);
      
      res.json({ count: count.toString() });
    } catch (error) {
      console.error('Error fetching citation count:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/citations/verified-count/{id}:
   *   get:
   *     summary: Get verified citation count for a paper
   *     tags: [Citations]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper
   *     responses:
   *       200:
   *         description: Number of verified citations for the paper
   */
  router.get('/verified-count/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const count = await citationRegistry.getVerifiedCitationCount(paperId);
      
      res.json({ count: count.toString() });
    } catch (error) {
      console.error('Error fetching verified citation count:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/citations/{id}:
   *   get:
   *     summary: Get details of a citation
   *     tags: [Citations]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the citation
   *     responses:
   *       200:
   *         description: Citation details
   */
  router.get('/:id', async (req, res) => {
    try {
      const citationId = req.params.id;
      
      const details = await citationRegistry.getCitationDetails(citationId);
      
      const formattedDetails = {
        citingPaperId: details[0].toString(),
        citedPaperId: details[1].toString(),
        citer: details[2],
        timestamp: details[3].toString(),
        isVerified: details[4]
      };
      
      res.json(formattedDetails);
    } catch (error) {
      console.error('Error fetching citation details:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
