# AvvarI for Bharat - Demo Video Script

## Video Duration: 5-7 minutes

---

## Scene 1: Introduction (30 seconds)

**Visual:** Title slide with project logo and tagline

**Narration:**
> "Hello! I'm presenting AvvarI for Bharat - an AI-powered heritage site digitization platform that transforms how visitors experience India's rich cultural heritage. Built entirely on AWS services, this solution makes heritage sites accessible to everyone in their native language."

**Show:**
- Project title
- AWS AI for Bharat Hackathon logo
- Your name/team name

---

## Scene 2: Problem Statement (45 seconds)

**Visual:** Show images of heritage sites, tourists with language barriers

**Narration:**
> "India has thousands of heritage sites, but visitors face several challenges:
> - Language barriers prevent full appreciation
> - Limited multilingual content availability
> - Lack of engaging, interactive experiences
> - No personalized information on-demand
>
> AvvarI solves these problems using AWS AI services."

**Show:**
- Statistics about India's heritage sites
- Images showing the problem
- Transition to solution

---

## Scene 3: Solution Overview (1 minute)

**Visual:** Architecture diagram

**Narration:**
> "Our solution uses a serverless architecture built on AWS:
> - Visitors scan QR codes at heritage sites
> - Amazon Bedrock generates contextual content
> - Amazon Polly creates audio guides in 10+ Indian languages
> - Amazon Translate ensures accurate localization
> - Content is delivered via CloudFront for fast global access
>
> Everything runs on AWS Lambda for automatic scaling, with DynamoDB for data storage and S3 for content repository."

**Show:**
- `avvari-aws-architecture.html` (your architecture diagram)
- Highlight each AWS service as you mention it

---

## Scene 4: Key Features Demo (2-3 minutes)

### Feature 1: QR Code Scanning (30 seconds)

**Visual:** Show QR code scanning flow

**Narration:**
> "Let's see it in action. A visitor scans a QR code at an artifact. Our system instantly identifies the artifact and retrieves relevant information."

**Show:**
- QR code example
- API call to `/qr` endpoint
- Response with artifact details

### Feature 2: Multilingual Content Generation (45 seconds)

**Visual:** Show content in multiple languages

**Narration:**
> "The visitor selects their preferred language - Hindi, Tamil, Telugu, or any of 10+ Indian languages. Amazon Bedrock generates rich, contextual content about the artifact's history, significance, and cultural context."

**Show:**
- Language selection
- Content generation in different languages
- Side-by-side comparison

### Feature 3: AI-Powered Audio Guides (30 seconds)

**Visual:** Show audio generation

**Narration:**
> "Amazon Polly converts the text into natural-sounding audio guides with Indian language voice profiles, making the experience accessible to everyone, including visually impaired visitors."

**Show:**
- Audio generation process
- Playback controls
- Waveform visualization

### Feature 4: Interactive Q&A (45 seconds)

**Visual:** Show RAG-based Q&A system

**Narration:**
> "Visitors can ask questions in their language. Our RAG system, powered by Amazon Bedrock, provides accurate answers based on our heritage knowledge base. The system maintains conversation context for follow-up questions."

**Show:**
- Question input
- AI-generated response
- Follow-up question handling

---

## Scene 5: Technical Highlights (1 minute)

**Visual:** Show code editor with key files

**Narration:**
> "From a technical perspective, our solution features:
> - Serverless architecture with AWS Lambda for automatic scaling
> - 767 passing tests including property-based tests for correctness
> - Intelligent caching for sub-3-second response times
> - Offline functionality for areas with poor connectivity
> - Comprehensive accessibility features
> - Real-time analytics for site administrators"

**Show:**
- Test results: `npm test` output
- Code snippets from key services
- Performance metrics
- GitHub repository

---

## Scene 6: Impact & Scalability (45 seconds)

**Visual:** Show metrics and scalability features

**Narration:**
> "AvvarI is designed for scale:
> - Supports unlimited heritage sites without code changes
> - Handles concurrent users across multiple locations
> - Provides real-time analytics for site administrators
> - Reduces operational costs through serverless architecture
> - Makes India's heritage accessible to millions of visitors"

**Show:**
- Scalability architecture
- Analytics dashboard concept
- Cost optimization features

---

## Scene 7: Demo Walkthrough (1 minute)

**Visual:** Live demo or simulation

**Narration:**
> "Let me show you a complete user journey:
> 1. Visitor arrives at Taj Mahal
> 2. Scans QR code on an artifact
> 3. Selects Hindi as preferred language
> 4. Receives AI-generated content about the artifact
> 5. Listens to audio guide
> 6. Asks follow-up questions
> 7. Explores related artifacts
>
> All of this happens in seconds, creating an immersive, personalized experience."

**Show:**
- Step-by-step walkthrough
- User interface mockups (from your wireframes)
- API responses
- Content delivery

---

## Scene 8: Conclusion & Call to Action (30 seconds)

**Visual:** Summary slide with GitHub link

**Narration:**
> "AvvarI for Bharat demonstrates how AWS AI services can transform heritage tourism in India. The solution is production-ready, fully tested, and designed to scale.
>
> Thank you for watching! The complete source code, documentation, and architecture details are available on GitHub."

**Show:**
- GitHub repository link
- Key achievements summary
- Contact information
- Thank you slide

---

## Recording Tips

### Before Recording:
1. ✅ Test all demos beforehand
2. ✅ Prepare all visuals and slides
3. ✅ Write out your script
4. ✅ Practice 2-3 times
5. ✅ Check audio quality

### During Recording:
1. 🎤 Use a good microphone
2. 🖥️ Record in 1080p (1920x1080)
3. 🎨 Use clean, professional visuals
4. ⏱️ Keep it concise (5-7 minutes max)
5. 🎬 Edit out mistakes

### After Recording:
1. ✂️ Edit for clarity
2. 🎵 Add background music (optional, keep it subtle)
3. 📝 Add captions/subtitles
4. 🔍 Review for errors
5. 📤 Export in high quality (MP4, H.264)

---

## Visual Assets Checklist

- [ ] Title slide with project name
- [ ] Architecture diagram (`avvari-aws-architecture.html`)
- [ ] Wireframes/mockups (`avvari-wireframes-mockups.html`)
- [ ] Code snippets (key services)
- [ ] Test results screenshot
- [ ] GitHub repository page
- [ ] AWS services logos
- [ ] Demo flow diagrams
- [ ] Thank you slide with contact info

---

## Demo Data Preparation

### Sample QR Code Data:
```json
{
  "qrCode": "TAJ-MAHAL-ARTIFACT-001",
  "siteId": "taj-mahal",
  "artifactId": "marble-inlay-panel"
}
```

### Sample Languages to Demo:
- English
- Hindi (हिंदी)
- Tamil (தமிழ்)

### Sample Questions for Q&A:
1. "What materials were used in this artifact?"
2. "When was this created?"
3. "What is the cultural significance?"

---

## Tools & Resources

### Screen Recording:
- **OBS Studio**: https://obsproject.com/
- **Loom**: https://www.loom.com/
- **Windows Game Bar**: Win + G

### Video Editing:
- **DaVinci Resolve** (Free): https://www.blackmagicdesign.com/products/davinciresolve
- **Shotcut** (Free): https://shotcut.org/
- **Windows Video Editor** (Built-in)

### Presentation:
- **PowerPoint** with screen recording
- **Google Slides** with Loom
- **Canva** for graphics

### Audio:
- **Audacity** (Free): https://www.audacityteam.org/
- Built-in Windows Voice Recorder

---

## Submission Checklist

- [ ] Video is 5-7 minutes long
- [ ] Audio is clear and professional
- [ ] All features are demonstrated
- [ ] Architecture is explained
- [ ] GitHub link is shown
- [ ] Video is in MP4 format
- [ ] Resolution is 1080p or higher
- [ ] File size is under submission limit
- [ ] Captions/subtitles added (if required)
- [ ] Tested playback on different devices

---

## Additional Demo Ideas

### Live API Demo:
If you deploy to AWS, you can show live API calls using:
- Postman
- curl commands
- Browser developer tools

### Code Walkthrough:
Show key files:
- `infrastructure/stacks/avvari-stack.ts` - AWS infrastructure
- `src/services/bedrock-service.ts` - AI integration
- `src/services/polly-service.ts` - Audio generation
- `tests/properties/` - Property-based tests

### Metrics & Analytics:
Show test results:
```bash
npm test
# Test Suites: 43 passed, 46 total
# Tests: 767 passed, 769 total
```

---

Good luck with your demo video! 🎬🚀
