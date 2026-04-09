/**
 * Demo Script — Seeds sample data so you can preview the dashboard.
 *
 * Usage: node demo.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");

const demoName = "Matt";
const demoEmail = "demo@example.com";
const hash = crypto.createHash("md5").update(`demo-${Date.now()}`).digest("hex").substring(0, 8);
const clientId = `matt-demo-${hash}`;
const clientDir = path.join(DATA_DIR, clientId);

// Create client directory
if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });

// Save config
fs.writeFileSync(
  path.join(clientDir, "config.json"),
  JSON.stringify({
    clientId,
    name: demoName,
    email: demoEmail,
    createdAt: new Date().toISOString(),
    status: "connected",
  }, null, 2)
);

// Sample CRM contacts (realistic real estate leads)
const contacts = [
  {
    name: "Sarah Thompson",
    phone: "+1-555-0142",
    source: "whatsapp",
    property_type: "3-bedroom house",
    budget: "$850,000 - $1,200,000",
    budget_min: 850000,
    budget_max: 1200000,
    preferred_locations: "North Shore, Mosman",
    lead_status: "hot",
    timeline: "Next 2 months",
    notes: "Pre-approved for $1.1M. Wants harbour views. Husband works in the city. Needs good school district. Saw 42 Pacific Ave and loved it but thought it was overpriced.",
    suggested_followup: "Send her the new Mosman listing at 18 Bay Rd — matches her criteria perfectly",
    follow_up_date: new Date().toISOString().substring(0, 10),
    last_contact: new Date(Date.now() - 86400000).toISOString().substring(0, 10),
    conversation_history: "Mar 15: Asked about 3BR houses in Mosman\nMar 18: Sent 3 listings, she liked 42 Pacific Ave\nMar 22: Visited 42 Pacific Ave, loved layout but price too high\nApr 1: Followed up, still looking\nApr 8: Mentioned new budget approval from bank",
  },
  {
    name: "James Chen",
    phone: "+1-555-0198",
    source: "line",
    property_type: "Investment apartment",
    budget: "$500,000 - $700,000",
    budget_min: 500000,
    budget_max: 700000,
    preferred_locations: "Parramatta, Zetland, Waterloo",
    lead_status: "warm",
    timeline: "3-6 months",
    notes: "Looking for 1-2BR apartment with good rental yield. Already owns 2 investment properties. Interested in off-the-plan. Wants minimum 5% yield.",
    suggested_followup: "Share the Zetland off-the-plan development brochure — 5.2% projected yield",
    follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10),
    last_contact: new Date(Date.now() - 3 * 86400000).toISOString().substring(0, 10),
    conversation_history: "Mar 20: Initial enquiry about investment properties\nMar 25: Discussed budget and yield expectations\nApr 5: Sent Parramatta listings, said too far from CBD",
  },
  {
    name: "Emma Wilson",
    phone: "+1-555-0176",
    source: "whatsapp",
    property_type: "Family home",
    budget: "$1,500,000 - $2,000,000",
    budget_min: 1500000,
    budget_max: 2000000,
    preferred_locations: "Balmain, Rozelle, Drummoyne",
    lead_status: "hot",
    timeline: "ASAP — lease ending May",
    notes: "Relocating from Melbourne. Family of 4, needs 4BR minimum. Works from home — needs a study. Urgently needs to find something before lease ends May 30.",
    suggested_followup: "Arrange inspection at 7 Darling St Balmain this Saturday — 4BR with study, just listed",
    follow_up_date: new Date().toISOString().substring(0, 10),
    last_contact: new Date().toISOString().substring(0, 10),
    conversation_history: "Apr 2: Referred by John Kim\nApr 3: Phone call — discussed requirements\nApr 5: Sent 5 listings in Balmain/Rozelle\nApr 7: She loved 7 Darling St from photos\nApr 9: Wants to inspect ASAP",
  },
  {
    name: "David Park",
    phone: "+1-555-0134",
    source: "email",
    property_type: "Townhouse",
    budget: "$900,000 - $1,100,000",
    budget_min: 900000,
    budget_max: 1100000,
    preferred_locations: "Lane Cove, Chatswood",
    lead_status: "warm",
    timeline: "6 months",
    notes: "Downsizing from 5BR house after kids moved out. Wants low maintenance, single level preferred. Wife has mobility issues — no stairs.",
    suggested_followup: "Check if the Lane Cove retirement-adjacent townhouses accept under-65s",
    follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
    last_contact: new Date(Date.now() - 5 * 86400000).toISOString().substring(0, 10),
    conversation_history: "Mar 10: Met at open house\nMar 15: Discussed downsizing needs\nApr 2: Sent townhouse options, liked Lane Cove area",
  },
  {
    name: "Lisa Martinez",
    phone: "+1-555-0155",
    source: "line",
    property_type: "Studio/1BR apartment",
    budget: "$350,000 - $450,000",
    budget_min: 350000,
    budget_max: 450000,
    preferred_locations: "Surry Hills, Redfern",
    lead_status: "cold",
    timeline: "Not decided yet",
    notes: "First home buyer. Still saving for deposit. Interested but not ready to commit. Works in Surry Hills, wants to walk to work.",
    suggested_followup: "Send first home buyer grant info and check in next month",
    follow_up_date: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
    last_contact: new Date(Date.now() - 14 * 86400000).toISOString().substring(0, 10),
    conversation_history: "Mar 1: Enquired via website\nMar 5: Phone call — explained budget constraints\nMar 25: Sent first home buyer resources",
  },
  {
    name: "Tom & Rachel Hughes",
    phone: "+1-555-0189",
    source: "whatsapp",
    property_type: "4BR house with pool",
    budget: "$2,500,000+",
    budget_min: 2500000,
    budget_max: 3500000,
    preferred_locations: "Vaucluse, Double Bay",
    lead_status: "client",
    timeline: "Settled — post-sale support",
    notes: "Purchased 15 Ocean Ave Vaucluse for $2.8M on Mar 20. Settlement Apr 30. Need to connect with conveyancer and arrange building inspection follow-up.",
    suggested_followup: "Check settlement is on track and send housewarming gift",
    follow_up_date: new Date(Date.now() + 21 * 86400000).toISOString().substring(0, 10),
    last_contact: new Date(Date.now() - 2 * 86400000).toISOString().substring(0, 10),
    conversation_history: "Feb 10: Started search\nFeb 20: Inspected 8 properties\nMar 5: Made offer on 15 Ocean Ave\nMar 12: Negotiated price down from $3M\nMar 20: Contracts exchanged at $2.8M\nApr 7: Confirmed settlement date Apr 30",
  },
  {
    name: "Kevin O'Brien",
    phone: "+1-555-0123",
    source: "email",
    property_type: "Commercial office space",
    budget: "$800,000 - $1,200,000",
    budget_min: 800000,
    budget_max: 1200000,
    preferred_locations: "CBD, North Sydney",
    lead_status: "warm",
    timeline: "3 months",
    notes: "Expanding his accounting firm. Needs 150-200sqm. Current lease ends July. Wants ground floor with street frontage if possible.",
    suggested_followup: "Arrange viewing of the North Sydney listing at 45 Berry St — 180sqm, ground floor",
    follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().substring(0, 10),
    last_contact: new Date(Date.now() - 1 * 86400000).toISOString().substring(0, 10),
    conversation_history: "Mar 28: Initial call about commercial space\nApr 1: Discussed requirements — needs good parking\nApr 8: Sent 4 commercial listings",
  },
  {
    name: "Amy Nguyen",
    phone: "+1-555-0167",
    source: "whatsapp",
    property_type: "2BR apartment",
    budget: "$600,000 - $750,000",
    budget_min: 600000,
    budget_max: 750000,
    preferred_locations: "Bondi, Coogee, Bronte",
    lead_status: "cold",
    timeline: "Browsing",
    notes: "Likes the eastern suburbs lifestyle. Currently renting in Bondi. Not in a rush but would move if the right place came up. Wants ocean views.",
    suggested_followup: "Add to monthly newsletter for eastern suburbs listings",
    follow_up_date: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
    last_contact: new Date(Date.now() - 20 * 86400000).toISOString().substring(0, 10),
    conversation_history: "Feb 28: Met at Bondi open house\nMar 10: Quick chat — not ready yet",
  },
];

// Sample messages (last 24h)
const now = Date.now();
const messages = [
  { sender: "Sarah Thompson", content: "Hi Matt! Just got the updated pre-approval from the bank — we're good for $1.1M now. Are there any new listings in Mosman this week?", type: "text", room: "", timestamp: new Date(now - 3600000 * 6).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 6) / 1000, phone: "+1-555-0142" },
  { sender: "Sarah Thompson", content: "[Voice message]", type: "voice", room: "", timestamp: new Date(now - 3600000 * 5.5).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 5.5) / 1000, phone: "+1-555-0142" },
  { sender: "Emma Wilson", content: "Matt, I NEED to see that Balmain place this weekend. Can you arrange a Saturday morning inspection? My husband can come too.", type: "text", room: "", timestamp: new Date(now - 3600000 * 4).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 4) / 1000, phone: "+1-555-0176" },
  { sender: "James Chen", content: "Hey mate, had a look at those Parramatta ones. Too far from CBD for good tenants imo. Anything closer? Zetland or Green Square area?", type: "text", room: "", timestamp: new Date(now - 3600000 * 3).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 3) / 1000, phone: "+1-555-0198" },
  { sender: "Kevin O'Brien", content: "Matt those 4 listings you sent are good. The North Sydney one at Berry St looks promising. Can we do a walkthrough tomorrow or Thursday?", type: "text", room: "", timestamp: new Date(now - 3600000 * 2).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 2) / 1000, phone: "+1-555-0123" },
  { sender: "Tom & Rachel Hughes", content: "Hi Matt, just checking — is everything on track for the Apr 30 settlement? Our solicitor mentioned something about a delayed council certificate.", type: "text", room: "", timestamp: new Date(now - 3600000 * 1).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 1) / 1000, phone: "+1-555-0189" },
  { sender: "David Park", content: "[Image]", type: "image", room: "", timestamp: new Date(now - 3600000 * 0.5).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 0.5) / 1000, phone: "+1-555-0134" },
  { sender: "David Park", content: "Saw this townhouse in Lane Cove while driving past. Is this one of yours? Looks like what we want!", type: "text", room: "", timestamp: new Date(now - 3600000 * 0.4).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 0.4) / 1000, phone: "+1-555-0134" },
  { sender: "Sarah Thompson", content: "Also — do you know if 18 Bay Rd is still available? My friend drove past and said it looked amazing", type: "text", room: "", timestamp: new Date(now - 3600000 * 0.2).toISOString().replace("T", " ").substring(0, 19), timestamp_unix: (now - 3600000 * 0.2) / 1000, phone: "+1-555-0142" },
];

// Save CRM
fs.writeFileSync(path.join(clientDir, "crm.json"), JSON.stringify(contacts, null, 2));

// Save messages
fs.writeFileSync(path.join(clientDir, "messages.json"), JSON.stringify(messages, null, 2));

console.log("");
console.log("==========================================");
console.log("  Demo data created!");
console.log("==========================================");
console.log("");
console.log(`  Client ID: ${clientId}`);
console.log(`  Dashboard: http://localhost:3000/dashboard/${clientId}`);
console.log("");
console.log("  8 contacts (2 hot, 3 warm, 2 cold, 1 client)");
console.log("  9 messages from today");
console.log("");
console.log("  Start the server: bash server-start.sh");
console.log("  Then open the dashboard URL above.");
console.log("");
