// CandidatureFacile - Backend complet
// npm install express cors multer dotenv resend stripe

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Resend } = require('resend');
const path = require('path');
const fs = require('fs');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY || 're_demo');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer config for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Data directory
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ============ IN-MEMORY DATABASE (remplace by DB in production) ============
const db = {
  candidates: new Map(),
  campaigns: new Map(),
  companies: [],
  emails: new Map()
};

// Load companies data
function loadCompanies() {
  try {
    const data = fs.readFileSync(path.join(DATA_DIR, 'companies.json'), 'utf8');
    db.companies = JSON.parse(data);
  } catch (e) {
    // Default companies
    db.companies = [
      { name: 'Le Restaurant du Coin', email: 'contact@restaurantducoin.fr', address: 'Paris 10e', sector: 'restaurant' },
      { name: 'Boulangerie Artisanale', email: 'contact@boulangerie11.fr', address: 'Paris 11e', sector: 'boulangerie' },
      { name: 'Épicerie Fine du 10e', email: 'bonjour@epiceriefine10.fr', address: 'Paris 10e', sector: 'epicerie' },
      { name: 'Traiteur Oriental', email: 'info@traiteuroriental.fr', address: 'Paris 19e', sector: 'traiteur' },
      { name: 'Chez Maurice', email: 'contact@chezmaurice.fr', address: 'Paris 9e', sector: 'restaurant' },
      { name: 'La Table de Paris', email: 'hello@latabledeparis.fr', address: 'Paris 2e', sector: 'restaurant' },
      { name: 'Le Panier Bio', email: 'contact@lepanierbio.fr', address: 'Paris 12e', sector: 'epicerie' },
      { name: 'Maison du Pain', email: 'info@maison dupain.com', address: 'Paris 3e', sector: 'boulangerie' },
      { name: 'Saveurs du Monde', email: 'contact@saveursdumonde.fr', address: 'Paris 18e', sector: 'restaurant' },
      { name: 'Le Jardin Gourmand', email: 'bonjour@lejardingourmand.fr', address: 'Paris 15e', sector: 'restaurant' }
    ];
  }
}
loadCompanies();

// ============ ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    candidates: db.candidates.size,
    campaigns: db.campaigns.size
  });
});

// Get all companies
app.get('/api/companies', (req, res) => {
  res.json(db.companies);
});

// Submit candidate (after payment)
app.post('/api/submit-candidate', upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'lettre_motivation', maxCount: 1 }
]), async (req, res) => {
  try {
    const { email, phone, nom, prenom } = req.body;
    
    const candidateId = `cand_${Date.now()}`;
    const candidate = {
      id: candidateId,
      email,
      phone,
      nom,
      prenom,
      cv: req.files['cv']?.[0]?.originalname || null,
      lm: req.files['lettre_motivation']?.[0]?.originalname || null,
      paymentStatus: 'paid',
      createdAt: new Date().toISOString(),
      campaignId: null
    };
    
    db.candidates.set(candidateId, candidate);
    
    // Start campaign
    const campaignId = await startCampaign(candidate);
    candidate.campaignId = campaignId;
    
    res.json({ 
      success: true, 
      candidateId,
      campaignId
    });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign status
app.get('/api/campaign/:candidateId', (req, res) => {
  const { candidateId } = req.params;
  const candidate = db.candidates.get(candidateId);
  
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  
  if (candidate.campaignId) {
    const campaign = db.campaigns.get(candidate.campaignId);
    return res.json(campaign);
  }
  
  res.json({ status: 'pending' });
});

// Get all campaigns (admin)
app.get('/api/admin/campaigns', (req, res) => {
  const all = Array.from(db.campaigns.values());
  res.json(all);
});

// Get candidate by ID
app.get('/api/candidate/:id', (req, res) => {
  const candidate = db.candidates.get(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Not found' });
  res.json(candidate);
});

// Update candidate status
app.patch('/api/candidate/:id', (req, res) => {
  const candidate = db.candidates.get(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Not found' });
  
  Object.assign(candidate, req.body);
  db.candidates.set(req.params.id, candidate);
  res.json(candidate);
});

// ============ EMAIL GENERATION ============

function generateEmail(candidate, company) {
  const { nom, prenom } = candidate;
  
  const subjects = [
    "Candidature spontanée - Poste en cuisine",
    "Votre prochain chef serait-il là ?",
    "Passionné de gastronomie cherche équipe",
    "Proposition de collaboration"
  ];
  
  const templates = [
    `Madame, Monsieur,

Passionné par la gastronomie française et fort de mon expérience en cuisine, je me permets de vous contacter afin de vous proposer mes services au sein de votre établissement "${company.name}".

Mon profil correspond parfaitement à vos besoins. Je suis rigoureux, créatif et doté d'un grand sens du travail en équipe.

Je reste à votre disposition pour un entretien à votre convenance.

Cordialement,
${prenom} ${nom}`,
    
    `Bonjour,

Ayant remarqué la qualité de votre établissement, je souhaitais vous proposer ma candidature pour un poste au sein de votre équipe.

Mon expertise en cuisine et ma passion pour les produits frais pourraient contribuer à la réussite de vos projets.

Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.

${prenom} ${nom}`
  ];
  
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const body = templates[Math.floor(Math.random() * templates.length)];
  
  return { subject, body };
}

async function sendEmail(to, subject, body) {
  try {
    const data = await resend.emails.send({
      from: 'CandidatureFacile <onboarding@resend.dev>',
      reply_to: 'yassine@email.com',
      to: [to],
      subject: subject,
      html: body.replace(/\n/g, '<br>')
    });
    
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Resend error:', error);
    return { success: false, error: error.message };
  }
}

async function startCampaign(candidate) {
  const campaignId = `camp_${Date.now()}`;
  const companies = db.companies.slice(0, 50);
  
  const campaign = {
    id: campaignId,
    candidateId: candidate.id,
    candidateEmail: candidate.email,
    companies: companies,
    status: 'running',
    startedAt: new Date().toISOString(),
    stats: {
      total: companies.length,
      sent: 0,
      pending: companies.length,
      replies: 0,
      failed: 0
    },
    emails: []
  };
  
  db.campaigns.set(campaignId, campaign);
  
  // Send emails in batches with delay
  const batchSize = 5;
  const delay = 5000; // 5 seconds between batches
  
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    
    for (const company of batch) {
      const { subject, body } = generateEmail(candidate, company);
      const result = await sendEmail(company.email, subject, body);
      
      const emailRecord = {
        company: company.name,
        email: company.email,
        subject: subject,
        sentAt: new Date().toISOString(),
        status: result.success ? 'sent' : 'failed',
        messageId: result.id || null
      };
      
      campaign.emails.push(emailRecord);
      
      if (result.success) {
        campaign.stats.sent++;
        campaign.stats.pending--;
      } else {
        campaign.stats.failed++;
        campaign.stats.pending--;
      }
    }
    
    // Save progress
    db.campaigns.set(campaignId, campaign);
    
    // Wait before next batch
    if (i + batchSize < companies.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  campaign.status = 'completed';
  campaign.completedAt = new Date().toISOString();
  db.campaigns.set(campaignId, campaign);
  
  console.log(`Campaign ${campaignId} completed: ${campaign.stats.sent} sent, ${campaign.stats.failed} failed`);
  
  return campaignId;
}

// Simulate receiving a reply (for demo)
app.post('/api/simulate-reply/:campaignId', (req, res) => {
  const { campaignId } = req.params;
  const campaign = db.campaigns.get(campaignId);
  
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  
  // Pick a random sent email
  const sentEmails = campaign.emails.filter(e => e.status === 'sent');
  if (sentEmails.length === 0) return res.status(400).json({ error: 'No sent emails' });
  
  const randomEmail = sentEmails[Math.floor(Math.random() * sentEmails.length)];
  
  randomEmail.reply = {
    receivedAt: new Date().toISOString(),
    status: req.body.status || 'positive',
    message: req.body.message || 'Nous sommes intéressés par votre profil. Pouvons-nous échanger ?'
  };
  
  campaign.stats.replies++;
  db.campaigns.set(campaignId, campaign);
  
  res.json({ success: true, email: randomEmail });
});

// ============ STATIC FILES ============
app.use(express.static(path.join(__dirname, '..')));

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🚀 CandidatureFacile Backend
   Server running on http://localhost:${PORT}
   Companies loaded: ${db.companies.length}
  `);
});
