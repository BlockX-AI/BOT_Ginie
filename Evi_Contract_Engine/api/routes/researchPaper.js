const express = require('express');
const { ethers } = require('ethers');

/**
 * @swagger
 * components:
 *   schemas:
 *     Paper:
 *       type: object
 *       required:
 *         - ipfsHash
 *         - title
 *         - tokenURI
 *         - keywords
 *       properties:
 *         ipfsHash:
 *           type: string
 *           description: IPFS hash of the paper content
 *         title:
 *           type: string
 *           description: Title of the research paper
 *         tokenURI:
 *           type: string
 *           description: URI for the paper metadata
 *         keywords:
 *           type: array
 *           items:
 *             type: string
 *           description: Keywords for the paper
 *         coAuthors:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of co-author addresses
 */

module.exports = (researchPaper) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/papers:
   *   post:
   *     summary: Register a new research paper
   *     tags: [Papers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Paper'
   *     responses:
   *       200:
   *         description: Paper successfully registered
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 paperId:
   *                   type: string
   *                 txHash:
   *                   type: string
   */
  router.post('/', async (req, res) => {
    try {
      const { ipfsHash, title, tokenURI, keywords, coAuthors = [] } = req.body;
      
      if (!ipfsHash || !title || !tokenURI || !keywords) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const tx = await researchPaper.registerPaper(
        ipfsHash,
        title,
        tokenURI,
        keywords,
        coAuthors || []
      );
      
      const receipt = await tx.wait();
      
      // Find the PaperRegistered event
      const event = receipt.logs
        .filter(log => log.fragment && log.fragment.name === 'PaperRegistered')
        .map(log => researchPaper.interface.parseLog(log))[0];
      
      const paperId = event ? event.args.paperId.toString() : null;
      
      res.json({
        success: true,
        paperId,
        txHash: receipt.hash
      });
    } catch (error) {
      console.error('Error registering paper:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/papers/cite:
   *   post:
   *     summary: Cite a paper
   *     tags: [Papers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - citingPaperId
   *               - citedPaperId
   *             properties:
   *               citingPaperId:
   *                 type: string
   *               citedPaperId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Citation successfully created
   */
  router.post('/cite', async (req, res) => {
    try {
      const { citingPaperId, citedPaperId } = req.body;
      
      if (!citingPaperId || !citedPaperId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const tx = await researchPaper.citePaper(
        citingPaperId,
        citedPaperId
      );
      
      const receipt = await tx.wait();
      
      res.json({
        success: true,
        citationId: receipt.logs[0].args?.citationId?.toString() || null,
        txHash: receipt.hash
      });
    } catch (error) {
      console.error('Error citing paper:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/papers/{id}:
   *   get:
   *     summary: Get paper details
   *     tags: [Papers]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper
   *     responses:
   *       200:
   *         description: Paper details
   */
  router.get('/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const paperDetails = await researchPaper.getPaperDetails(paperId);
      
      // Convert BigInt to string to make it JSON serializable
      const formattedDetails = {
        ipfsHash: paperDetails[0],
        researcher: paperDetails[1],
        publishDate: paperDetails[2].toString(),
        title: paperDetails[3],
        citationCount: paperDetails[4].toString(),
        isVerified: paperDetails[5]
      };
      
      // Get additional details
      const keywords = await researchPaper.getPaperKeywords(paperId);
      const coAuthors = await researchPaper.getPaperCoAuthors(paperId);
      
      res.json({
        ...formattedDetails,
        keywords,
        coAuthors
      });
    } catch (error) {
      console.error('Error fetching paper details:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/papers/researcher/{address}:
   *   get:
   *     summary: Get all papers by researcher
   *     tags: [Papers]
   *     parameters:
   *       - in: path
   *         name: address
   *         schema:
   *           type: string
   *         required: true
   *         description: Ethereum address of the researcher
   *     responses:
   *       200:
   *         description: Array of paper IDs
   */
  router.get('/researcher/:address', async (req, res) => {
    try {
      const address = req.params.address;
      
      const papers = await researchPaper.getPapersByResearcher(address);
      
      // Convert BigInt to string to make it JSON serializable
      const paperIds = papers.map(id => id.toString());
      
      res.json({ papers: paperIds });
    } catch (error) {
      console.error('Error fetching researcher papers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/papers/keyword/{keyword}:
   *   get:
   *     summary: Get all papers by keyword
   *     tags: [Papers]
   *     parameters:
   *       - in: path
   *         name: keyword
   *         schema:
   *           type: string
   *         required: true
   *         description: Keyword to search for
   *     responses:
   *       200:
   *         description: Array of paper IDs
   */
  router.get('/keyword/:keyword', async (req, res) => {
    try {
      const keyword = req.params.keyword;
      
      const papers = await researchPaper.getPapersByKeyword(keyword);
      
      // Convert BigInt to string to make it JSON serializable
      const paperIds = papers.map(id => id.toString());
      
      res.json({ papers: paperIds });
    } catch (error) {
      console.error('Error fetching papers by keyword:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/papers/verify/{id}:
   *   post:
   *     summary: Verify a paper
   *     tags: [Papers]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the paper to verify
   *     responses:
   *       200:
   *         description: Paper successfully verified
   */
  router.post('/verify/:id', async (req, res) => {
    try {
      const paperId = req.params.id;
      
      const tx = await researchPaper.verifyPaper(paperId);
      const receipt = await tx.wait();
      
      res.json({
        success: true,
        paperId,
        txHash: receipt.hash
      });
    } catch (error) {
      console.error('Error verifying paper:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
