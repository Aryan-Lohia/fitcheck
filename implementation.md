# AI Fashion Platform

## Full-Stack Technical Implementation Document

---

## 1. Product Summary

This product is a mobile-first fashion intelligence platform with two major parts:

**Part 1: User Panel**

* Standard user accounts
* User + Freelance Fashion Expert accounts
* Virtual fit analysis on fashion product pages
* AI fashion chat with photo and text input
* Human fashion expert booking via calendar and video call
* Centralized media vault with S3-backed storage

**Part 2: Admin Panel**

* Manage users, freelancers, verification, bookings, trial usage, storage, and API usage
* Monitor system health and usage costs
* Approve or reject freelance fashion experts

The application is designed as a **single Next.js codebase** with shared authentication, shared data models, shared storage, and role-based access control.

---

## 2. Core Product Goals

1. Make fashion shopping more personalized and measurable.
2. Convert product pages from any supported store into structured fashion data.
3. Help the user judge fit before purchase using their own profile.
4. Combine AI assistance with real human fashion experts.
5. Keep cost low enough for Indian-scale consumer pricing.
6. Keep all modules inside one maintainable Next.js app.

---

## 3. User Roles and Access Model

### 3.1 Roles

* **USER**: normal customer account
* **FREELANCE_USER**: user account with fashion expert application workflow, can later access expert tools after approval
* **ADMIN**: internal management account

### 3.2 Permission Matrix

| Feature                           | USER | FREELANCE_USER (Pending) | FREELANCE_USER (Approved) | ADMIN |
| --------------------------------- | ---: | -----------------------: | ------------------------: | ----: |
| Signup / Login                    |  Yes |                      Yes |                       Yes |   Yes |
| Edit Profile                      |  Yes |                      Yes |                       Yes |   Yes |
| Skin tone / measurements / photos |  Yes |                      Yes |                       Yes |   Yes |
| Product page import               |  Yes |                      Yes |                       Yes |   Yes |
| Check Fit                         |  Yes |                      Yes |                       Yes |   Yes |
| AI fashion chat                   |  Yes |                      Yes |                       Yes |   Yes |
| Book human expert                 |  Yes |                      Yes |                       Yes |   Yes |
| Receive expert requests           |   No |                       No |                       Yes |    No |
| Confirm and accept requests       |   No |                       No |                       Yes |    No |
| Send meeting link                 |   No |                       No |                       Yes |    No |
| View all users                    |   No |                       No |                        No |   Yes |
| View storage usage                |   No |                       No |                        No |   Yes |
| View API usage                    |   No |                       No |                        No |   Yes |
| Approve freelancer profile        |   No |                       No |                        No |   Yes |

---

## 4. High-Level Architecture

### 4.1 System Diagram

```text
Client (Mobile Web / Responsive Web)
  └── Next.js App Router UI
        ├── User Panel
        ├── Freelancer Panel
        └── Admin Panel

Server Layer (same Next.js app)
  ├── Auth / Session / RBAC
  ├── Product Import Service
  ├── AI Recommendation Service
  ├── Booking Service
  ├── Meeting Link / Email Service
  ├── Storage Service
  ├── Usage Metering Service
  ├── Admin Reporting Service

Infrastructure
  ├── PostgreSQL + Prisma
  ├── AWS S3 for media
  ├── Queue / Jobs (BullMQ, Upstash QStash, or cron workers)
  ├── Email SMTP via Gmail App Passwords
  └── Optional video provider / Google Meet workflow
```

### 4.2 Important Design Choice

The app should be implemented as a **modular monolith** first. Do not split into microservices unless traffic forces it. Humans love premature architecture and then act surprised when maintenance becomes a circus.

---

## 5. Recommended Tech Stack

### Frontend

* Next.js App Router
* TypeScript
* Tailwind CSS
* shadcn/ui for system components
* React Hook Form + Zod for forms
* TanStack Query for client caching
* Zustand for local UI state where needed
* Framer Motion for lightweight transitions

### Backend

* Next.js Route Handlers and Server Actions
* Prisma ORM
* PostgreSQL
* Zod validation at API boundaries
* Background jobs for scraping, notifications, file cleanup, and usage aggregation

### Storage

* AWS S3 for all user-uploaded media
* Pre-signed upload URLs only
* No direct public bucket writes
* CloudFront optional if image CDN is needed later

### AI

* Gemini API for multimodal understanding and chat
* One low-cost default model for general tasks
* Separate routing for higher-intelligence tasks only when needed
* Strict token budgets and prompt trimming

### Email and Calendar

* SMTP via Gmail app password for sending meeting invites
* Calendar booking UI with availability blocks
* Optional Google Calendar / Meet integration if OAuth is added later

### Deployment

* Docker for local development
* Vercel for production web app
* PostgreSQL managed externally
* S3 managed externally

---

## 6. Product Scope Breakdown

# PART 1: USER PANEL

---

## 7. User Signup and Profile System

### 7.1 Signup Flow

User signs up with:

* Name
* Email
* Password
* Role choice:

  * User
  * User + Freelance Fashion Expert

### 7.2 Profile Fields

The profile must support fashion-accurate personalization.

#### Core fields

* Full name
* Gender
* Age group optional
* Skin tone picker
* Body front photo
* Body back photo
* Height
* Weight optional
* Chest
* Waist
* Hip
* Shoulder
* Inseam
* Sleeve length
* Neck
* Arm length
* Thigh
* Bust (if applicable)
* Body shape category optional
* Preferred style tags
* Preferred fit type (slim, regular, oversized, tailored)
* Preferred occasion tags
* Preferred color palette
* Brand size history

#### Profile UX rules

* Mobile first
* Step-by-step profile completion
* Save draft support
* Profile completion percentage
* Soft reminders to finish incomplete measurements
* Allow later edits with history tracking

### 7.3 Skin Tone Picker

Implement as a palette picker with:

* simple preset color swatches
* optional hex selector
* saved tone confidence label
* tone use in AI suggestions

Do not try to infer skin tone from the photo alone as a primary source. That becomes brittle, culturally awkward, and technically unreliable.

---

## 8. Body Measurement Model

### 8.1 Measurement Data Structure

Store measurements as structured JSON, but also keep indexed numeric columns for key dimensions.

Example:

```ts
{
  heightCm: 172,
  chestCm: 96,
  waistCm: 84,
  hipCm: 98,
  shoulderCm: 44,
  sleeveCm: 60,
  inseamCm: 78,
  fitPreference: "regular",
  notes: "prefers slightly relaxed shirts"
}
```

### 8.2 Validation Rules

* Accept units in cm and inches
* Normalize all stored values to cm
* Enforce reasonable ranges
* Flag suspicious values for user review
* Allow expert override with notes

### 8.3 Measurement Confidence

Each field should support:

* user-entered
* expert-entered
* estimated
* updated timestamp

This allows the AI to know how trustworthy the profile is.

---

## 9. Media Vault and Storage

### 9.1 Requirements

* Single centralized media storage
* Upload, download, share, delete
* Storage limit: **1 GB per user**
* Allow users to delete old photos to free space
* Mobile first media browser
* Fast previews for images and documents

### 9.2 S3 Implementation

Use S3 with:

* private bucket
* pre-signed PUT upload
* pre-signed GET download
* pre-signed DELETE or server-side delete only

### 9.3 Folder Structure

```text
users/{userId}/profile/front/{fileId}.jpg
users/{userId}/profile/back/{fileId}.jpg
users/{userId}/measurements/{fileId}.json
users/{userId}/tryon/{fileId}.jpg
users/{userId}/expert-chat/{fileId}.jpg
users/{userId}/bookings/{fileId}.pdf
```

### 9.4 Storage Enforcement

On every upload request:

1. Calculate current used storage for user.
2. Reject upload if it exceeds 1 GB.
3. Allow delete-before-upload flow.
4. Optionally show a “free up space” list sorted by oldest or largest files.

### 9.5 Media Metadata

Store metadata in PostgreSQL:

* owner userId
* file key
* mime type
* size bytes
* category
* createdAt
* deletedAt
* isShared
* share token

---

## 10. The Three Main User Tabs

---

## 10.1 Tab 1: Product Import + Check Fit

### Goal

When the user opens or pastes a fashion product page, the app should extract product data and evaluate fit against the user profile.

### Supported Sources

* WordPress / WooCommerce
* Shopify
* Myntra-like public product pages
* Meesho-like product pages
* Ajio-like product pages
* Any fashion-related page with public metadata or accessible HTML

### Important Technical Note

Do not depend on a single platform's markup. Build a **generic extraction pipeline** with platform adapters and fallback parsing.

### 10.1.1 Input Methods

* Paste product URL
* Share page URL into app
* Browser-based fetch from supported page
* Optional extension or in-app browser capture later

### 10.1.2 Extraction Pipeline

1. Receive URL
2. Validate domain and content type
3. Fetch page HTML server-side
4. Parse metadata using:

   * Open Graph tags
   * schema.org Product markup
   * platform-specific selectors
   * fallback heuristics
5. Extract:

   * product name
   * brand
   * images
   * price
   * sizes
   * size chart tables
   * measurement chart text
   * color options
   * variants
   * returns policy if visible
6. Save normalized product object
7. Run fit engine
8. Show **Check Fit** CTA

### 10.1.3 What to Extract

* product photos
* gallery images
* available sizes
* size chart
* garment measurements
* variant options
* material and stretch info
* product category
* gender targeting
* style keywords
* fit description

### 10.1.4 Fit Engine

The fit engine should not claim exact certainty unless the page provides structured garment measurements and the user profile is complete.

#### Inputs

* user body profile
* user preferred fit
* garment measurements
* product type
* fabric stretch level
* size chart data
* brand sizing patterns
* historical user feedback

#### Output

* recommended size
* fit confidence score
* reasons for recommendation
* warning if measurements are incomplete
* suggested alternate size

#### Fit Labels

* Perfect Fit
* Good Fit
* Slightly Tight
* Slightly Loose
* Size Unclear
* Need More Info

### 10.1.5 UX for Check Fit

The product card should show:

* likely size
* confidence percentage
* button: Check Fit
* explanation chips like:

  * chest may be tight
  * sleeve length seems short
  * waist fit looks good

### 10.1.6 Manual URL Paste Flow

The manual link paste flow should behave exactly like the discovered page flow.

* User pastes URL
* App fetches page data
* System runs the same parser and fit engine
* User sees check fit output and save/share options

### 10.1.7 AJAX / Dynamic Page Support

Support both:

* server-side HTML fetch
* headless browser render fallback if page is JS-heavy

Preferred order:

1. Direct HTML fetch
2. Parse metadata
3. If insufficient data, use Playwright headless render
4. Re-parse DOM after render

### 10.1.8 Fallback Rules

If the product page is missing a size chart:

* use general brand logic if historical data exists
* ask the user to upload screenshots or copy size chart text
* mark fit confidence lower

If images are unavailable:

* still store metadata and keep the page import usable

---

## 10.2 Tab 2: AI Fashion Expert Chat

### Goal

The user can chat with an AI fashion expert using text and photos.

### Supported Inputs

* text message
* uploaded outfit photo
* product image
* screenshot of a product page
* voice later if added

### Core AI Capabilities

* outfit advice
* size advice
* color matching
* occasion planning
* wardrobe pairing
* resale and shopping decision help
* style profile evolution

### AI Response Rules

* Ask clarifying questions when needed
* Prefer concise actionable suggestions
* Reference user measurements and preferred style
* Never pretend certainty when fit data is weak
* Return structured outputs where possible

### Chat Features

* chat history
* image attachment
* file attachment from media vault
* suggested prompts
* saved advice cards
* export or share conversation snippets

### Suggested Prompt Types

* "What size should I buy in this shirt?"
* "Does this outfit suit my body type?"
* "Suggest a wedding look under this budget"
* "Which jacket works best with these pants?"

### AI Message Format

The backend should return both:

* human-readable response
* structured metadata

Example:

```ts
{
  answer: "Go with L. The chest looks safer than M.",
  confidence: 0.81,
  reasons: ["garment chest is narrow", "your chest measurement is above chart median"],
  suggestedProducts: [...],
  actionButtons: ["Check Fit", "Save Look", "Book Expert"]
}
```

---

## 10.3 Tab 3: Human Fashion Expert Booking

### Goal

Allow the user to schedule a call with a real fashion expert.

### Booking Flow

1. User opens expert booking tab
2. System shows available time slots
3. User chooses expert type or category
4. User books slot
5. Booking is placed into pending status
6. Assigned freelancer accepts or declines
7. Once accepted, both parties receive email notification
8. Meeting link is shared
9. Booking appears in accepted meets with tracking and payment status

### Calendar Features

* weekly calendar view
* available slots
* timezone handling
* reschedule support
* cancellation support
* reminder notifications

### Meeting Link Logic

* After freelancer confirms a request, generate a meeting link flow
* Send link to customer and freelancer via Gmail SMTP
* Track meeting status:

  * requested
  * accepted
  * link sent
  * started
  * completed
  * cancelled
  * refunded

### GMeet Handling

Do not hardcode direct Meet creation unless Google Workspace OAuth is implemented later.

Practical implementation paths:

1. Store an externally generated Google Meet link created by the freelancer
2. Use Google Calendar OAuth for automatic meeting creation
3. Use a provider-neutral meeting link field initially

The model should support all three so the system does not trap itself in one fragile flow.

### Payment Tracking

Store:

* booking fee
* expert fee
* platform fee
* refund status
* payout status
* payment gateway reference

---

## 11. User + Freelance Fashion Expert Signup Flow

### 11.1 Required Fields

A freelancer account must submit:

* personal details
* email
* phone
* location
* portfolio links
* past work links
* specialization tags
* years of experience
* verification documents if needed
* selfie or identity verification if required by business policy
* profile photo
* sample consultation topics

### 11.2 Verification Workflow

Statuses:

* draft
* submitted
* under_review
* needs_more_info
* approved
* rejected
* suspended

### 11.3 Approval Criteria

Admin reviews:

* identity completeness
* portfolio quality
* past work validity
* expertise category
* professionalism
* fraud risk score

### 11.4 Approved Freelancer Capabilities

Once approved, the freelancer can:

* view open fashion expert requests
* accept or decline requests
* add notes to booking
* view upcoming meetings
* see payment status
* share meeting links
* see customer profile summary before the session

---

## 12. Open Request Workflow for Freelancers

### Lifecycle

1. User submits expert request
2. Request enters open pool
3. Approved freelancers can view request details
4. Freelancer clicks View
5. Freelancer clicks Confirm
6. System locks request to that freelancer
7. Meeting link is generated or attached
8. Emails go out via SMTP
9. Status changes to accepted

### Request Details Visible to Freelancer

* customer name
* age group optional
* style preference
* requested topic
* preferred time
* body measurement summary if user has allowed it
* uploaded references
* urgency
* payment status

### Race Condition Control

Use database transactions and row locking so two freelancers do not accept the same request at the same time. Human beings cannot be trusted with concurrency, and neither can your backend unless you lock it properly.

---

## 13. Admin Panel

### 13.1 Purpose

The admin panel is for platform operations, audit, support, and cost control.

### 13.2 Admin Modules

* Dashboard overview
* User management
* Freelancer verification queue
* Booking management
* Trial management
* Storage usage by user
* API usage by user
* Failed job logs
* Payment audit
* Support escalation view
* Content moderation and abuse reports

### 13.3 Admin Dashboard Widgets

* total users
* active trials
* paid users
* pending freelancer approvals
* booked consultations today
* S3 storage usage trend
* Gemini token usage trend
* request acceptance rate
* cancellation rate
* refund count

---

## 14. Database Design

Use PostgreSQL and Prisma.

### 14.1 Primary Tables

#### users

* id
* name
* email
* passwordHash
* role
* status
* createdAt
* updatedAt

#### user_profiles

* id
* userId
* gender
* skinTone
* preferredStyle
* preferredFit
* preferredColors
* measurementsJson
* profileCompletion
* createdAt
* updatedAt

#### user_media

* id
* userId
* s3Key
* fileName
* mimeType
* fileSize
* category
* isDeleted
* createdAt
* deletedAt

#### product_imports

* id
* userId
* sourceUrl
* domainType
* title
* brand
* price
* rawHtmlHash
* normalizedJson
* fitSummaryJson
* createdAt

#### product_images

* id
* productImportId
* imageUrl
* sourceType
* s3Key optional

#### chat_sessions

* id
* userId
* title
* mode
* createdAt

#### chat_messages

* id
* sessionId
* senderType
* contentText
* contentJson
* attachmentsJson
* createdAt

#### freelancer_profiles

* id
* userId
* bio
* portfolioLinksJson
* pastWorkLinksJson
* expertiseTagsJson
* verificationStatus
* verificationNotes
* approvedAt

#### booking_requests

* id
* userId
* freelancerId nullable until assigned
* status
* topic
* notes
* preferredTime
* durationMinutes
* meetingLink
* paymentStatus
* createdAt
* acceptedAt
* completedAt

#### booking_slots

* id
* freelancerId
* startAt
* endAt
* isBooked
* timezone

#### api_usage_daily

* id
* userId
* date
* geminiRequests
* geminiTokensIn
* geminiTokensOut
* imageAnalysisCount
* estimatedCost

#### storage_usage_daily

* id
* userId
* date
* bytesUsed
* fileCount

#### trials

* id
* userId
* startAt
* endAt
* status
* proEnabled

#### payments

* id
* bookingId
* provider
* amount
* currency
* status
* providerRef
* createdAt

#### audit_logs

* id
* actorUserId
* action
* entityType
* entityId
* payloadJson
* createdAt

---

## 15. API Design

Use route handlers under `/app/api`.

### 15.1 Auth

* `POST /api/auth/signup`
* `POST /api/auth/login`
* `POST /api/auth/logout`
* `GET /api/auth/session`

### 15.2 Profile

* `GET /api/profile`
* `PATCH /api/profile`
* `POST /api/profile/measurements`
* `POST /api/profile/media/presign-upload`
* `DELETE /api/profile/media/:id`

### 15.3 Product Import

* `POST /api/product/import`
* `POST /api/product/check-fit`
* `GET /api/product/:id`
* `GET /api/product/:id/images`

### 15.4 AI Chat

* `POST /api/chat/session`
* `GET /api/chat/session/:id`
* `POST /api/chat/message`
* `POST /api/chat/attachment/presign-upload`

### 15.5 Booking

* `GET /api/experts/available`
* `POST /api/bookings/request`
* `POST /api/bookings/:id/accept`
* `POST /api/bookings/:id/decline`
* `POST /api/bookings/:id/complete`
* `POST /api/bookings/:id/cancel`

### 15.6 Freelancer Approval

* `POST /api/freelancer/apply`
* `GET /api/freelancer/application`
* `PATCH /api/freelancer/application`
* `POST /api/admin/freelancer/:id/approve`
* `POST /api/admin/freelancer/:id/reject`

### 15.7 Admin

* `GET /api/admin/dashboard`
* `GET /api/admin/users`
* `GET /api/admin/bookings`
* `GET /api/admin/storage-usage`
* `GET /api/admin/api-usage`
* `GET /api/admin/trials`
* `GET /api/admin/audit-logs`

---

## 16. Product Page Extraction Strategy

### 16.1 Parsing Layers

1. **Metadata layer**

   * Open Graph
   * Twitter cards
   * schema.org Product JSON-LD

2. **HTML selector layer**

   * platform-specific selectors
   * image gallery extraction
   * variant buttons
   * size tables

3. **Rendered DOM layer**

   * Playwright fetch for JS-heavy pages

4. **LLM normalization layer**

   * convert messy extracted text into structured fashion fields

### 16.2 Normalized Product Schema

```ts
{
  title: string,
  brand: string,
  category: string,
  genderTarget: string,
  images: string[],
  variants: {
    size: string[],
    color: string[]
  },
  measurements: {
    chest?: number,
    waist?: number,
    length?: number,
    sleeve?: number
  },
  material: string,
  fitType: string,
  confidence: number
}
```

### 16.3 Domain Adapters

Create a pluggable adapter system:

* `shopifyAdapter`
* `woocommerceAdapter`
* `genericFashionAdapter`
* `myntraLikeAdapter`
* `meeshoLikeAdapter`
* `ajioLikeAdapter`

Each adapter returns the same normalized format.

### 16.4 Anti-Fragility Rules

* Never assume an element selector is permanent
* Always store raw page text for debugging
* Recompute normalized data if parser logic changes
* Keep parser version numbers in DB

---

## 17. AI Architecture

### 17.1 Use Cases

* fit recommendation
* style recommendation
* color suggestion
* wardrobe pairing
* expert assistant chat
* image interpretation
* summary of a product page

### 17.2 AI Request Pipeline

1. Build compact prompt
2. Inject user profile summary
3. Inject product data summary or chat history summary
4. Add safety and output format rules
5. Call Gemini
6. Parse result into structured output
7. Store token and latency metrics

### 17.3 Token Cost Control

Use a layered strategy:

* cheap model for routine chat
* more capable model only for difficult fit or image reasoning
* summarize chat history aggressively
* keep only last N turns in full detail
* store compressed memory profile per user

### 17.4 Prompt Template Rules

The prompt should always include:

* user body profile summary
* fit preference
* occasion
* budget if known
* brand sizing context if known
* instruction not to hallucinate missing measurements

### 17.5 Caching Rules

Cache AI answers for repeated product imports if:

* same product URL hash
* same user profile version
* same parser version
* same model version

---

## 18. Trial and Monetization

### 18.1 Free Trial

* 7-day free trial
* pro features available during trial
* no payment required at start if business wants low friction

### 18.2 Pro Gating Ideas

Possible pro features:

* more AI chat quota
* more product checks
* more storage
* premium expert booking priority
* advanced fit analysis

### 18.3 Trial Logic

* trial begins at signup or first activation
* trial end timestamp stored in DB
* show banner in app
* limit features after expiry
* keep read access to past data

### 18.4 Cost Safety for Indian Audience

Budget-first tactics:

* default to low-cost model tier
* reduce image analysis calls
* compress images before upload
* use pre-signed S3 uploads from client
* use lazy loading and image thumbnails
* cap storage per user
* cap daily AI messages on free tier
* summarize long chats instead of resending full history
* batch non-urgent analytics in jobs

---

## 19. Storage and Usage Metering

### 19.1 Storage Quota Enforcement

Every upload request must check:

* current used bytes
* file size about to be uploaded
* quota remaining

### 19.2 Deleting Old Photos

Provide:

* sort by oldest
* sort by largest
* multi-select delete
* keep important pinned files safe

### 19.3 API Usage Metering

Track by user:

* Gemini requests
* image analysis count
* total input tokens
* total output tokens
* estimated monthly cost

### 19.4 Metering Implementation

* write usage events on every AI call
* aggregate daily in background jobs
* expose in admin dashboard
* optionally show to users in their plan screen

---

## 20. Booking and Payment Workflow

### 20.1 Booking States

* draft
* requested
* accepted
* meeting_link_sent
* in_progress
* completed
* cancelled
* refunded

### 20.2 Payment States

* pending
* authorized
* captured
* failed
* refunded
* disputed

### 20.3 Acceptance Flow

* user requests slot
* freelancer sees request in open queue
* freelancer accepts
* system triggers email to both sides
* meeting becomes visible under accepted bookings

### 20.4 Payment Triggers

Payments can be:

* pre-paid before acceptance
* paid after freelancer accepts
* held in pending state until completion

Choose one model early and do not change it every Friday because the business team had a revelation.

---

## 21. Email System

### 21.1 SMTP

Use Gmail SMTP with app passwords for early stage.

### 21.2 Email Events

* signup confirmation
* freelancer application received
* freelancer approved/rejected
* booking requested
* booking accepted
* meeting link shared
* booking reminder
* cancellation
* refund update

### 21.3 Delivery Requirements

* HTML and text versions
* retry on transient failures
* log message IDs
* keep audit trail

---

## 22. Security Requirements

### Authentication

* hashed passwords using bcrypt or Argon2
* secure session handling
* CSRF protection where applicable
* rate limiting on auth and AI endpoints

### Authorization

* route guards by role
* server-side authorization checks only
* do not trust client role flags

### File Security

* private S3 bucket
* signed URLs with expiry
* validate mime type and size before upload
* virus scan optional later

### Abuse Prevention

* rate-limit AI chat
* rate-limit page imports
* detect repeated scraping abuse
* block unsupported or suspicious domains if needed

### Data Protection

* encrypt secrets in environment variables
* separate production and staging resources
* keep audit logs for admin actions

---

## 23. Mobile First UI Structure

### 23.1 User Panel Navigation

Bottom tabs:

* Home / Import
* Fit Check
* AI Chat
* Book Expert
* Vault / Profile

### 23.2 Freelancer Panel Navigation

* Dashboard
* Open Requests
* Accepted Meetings
* Calendar
* Profile / Verification

### 23.3 Admin Panel Navigation

* Overview
* Users
* Freelancers
* Bookings
* Storage
* API Usage
* Trials
* Logs

### 23.4 UI Principles

* thumb friendly actions
* compact cards
* sticky primary CTA
* minimal typing
* progressive disclosure

---

## 24. Deployment Plan

## 24.1 Local Development

Use Docker Compose for:

* Next.js app
* PostgreSQL
* optional Redis
* optional local mail catcher

### 24.2 Dockerfile Goals

* deterministic builds
* lightweight production image
* multi-stage build
* environment driven config

### 24.3 Suggested Containers

* `web` for Next.js
* `db` for PostgreSQL
* `redis` optional for queues and rate limiting

### 24.4 Production on Vercel

* deploy via Git integration
* use environment variables in Vercel project settings
* serverless route handlers for API
* external DB and S3 remain outside Vercel

### 24.5 Environment Variables

```env
DATABASE_URL=
NEXTAUTH_SECRET=
GEMINI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
APP_BASE_URL=
```

### 24.6 Build Strategy

* run Prisma migrations in deployment pipeline
* seed admin account separately
* verify upload and AI keys before turning public on

---

## 25. Suggested Folder Structure

```text
app/
  (auth)/
  (user)/
  (freelancer)/
  (admin)/
  api/
    auth/
    profile/
    product/
    chat/
    booking/
    freelancer/
    admin/
components/
  ui/
  profile/
  product/
  chat/
  booking/
  admin/
lib/
  auth/
  prisma/
  ai/
  s3/
  email/
  scraper/
  fit-engine/
  validators/
  billing/
  usage/
prisma/
  schema.prisma
  migrations/
public/
```

---

## 26. Background Jobs

### Needed Jobs

* clear expired upload drafts
* aggregate daily API usage
* aggregate daily storage usage
* send booking reminders
* retry failed emails
* cleanup orphaned S3 files
* refresh parser normalization summaries

### Job Runner Options

* cron on Vercel for lightweight scheduled tasks
* external queue worker for heavier workflows
* dedicated worker service if traffic grows

---

## 27. Observability and Logging

### Log Every Important Event

* signups
* logins
* uploads
* imports
* fit calculations
* AI calls
* booking transitions
* payment transitions
* admin actions

### Metrics to Track

* AI latency
* import success rate
* fit check click-through rate
* booking conversion rate
* freelancer acceptance rate
* storage over-limit attempts
* cost per active user

### Error Reporting

Use a central error tracker later if desired. At minimum, maintain structured server logs.

---

## 28. Testing Strategy

### Unit Tests

* measurement normalization
* fit score calculation
* file quota enforcement
* booking state transitions
* role checks

### Integration Tests

* signup to profile completion
* URL import to fit result
* booking request to freelancer acceptance
* upload and delete to quota update

### E2E Tests

* user on mobile
* freelancer approval workflow
* admin dashboard actions
* trial expiry behavior

### Parser Regression Tests

Maintain a set of sample product pages from supported platforms and verify extraction output on every parser change.

---

## 29. Implementation Phases

### Phase 1: Foundation

* auth
* roles
* profile
* S3 upload
* storage quota
* admin shell

### Phase 2: Product Import + Fit Engine

* URL paste flow
* extraction pipeline
* measurement mapping
* Check Fit UI

### Phase 3: AI Chat

* multimodal chat
* image upload
* conversation memory
* prompt cost control

### Phase 4: Freelance Workflow

* freelancer signup
* verification workflow
* open requests
* accept and schedule
* email notifications

### Phase 5: Admin Monitoring

* usage dashboards
* trial dashboard
* approval queue
* booking queue

### Phase 6: Hardening

* rate limiting
* audit logs
* tests
* deployment polish
* analytics

---

## 30. Critical Product Decisions

1. Use a modular monolith, not microservices.
2. Store all media in S3, never in the app server filesystem.
3. Keep profile data structured and versioned.
4. Treat all imported product pages as untrusted input.
5. Use fallback parsing for every external store.
6. Keep AI responses bounded, structured, and cheap.
7. Make bookings transactional.
8. Log usage at the source of action.
9. Enforce storage quotas before upload.
10. Design for mobile first from day one.

---

## 31. Final Notes for Engineering

This platform is not just a shopping app. It is a profile-driven fit assistant, AI styling layer, and human expert marketplace combined into one system.

The main engineering risks are:

* unreliable third-party product page markup
* expensive AI usage
* poor storage discipline
* booking race conditions
* confusing user profile inputs

The main success factors are:

* strong mobile UX
* low-friction import flow
* accurate fit guidance
* cost-aware AI routing
* simple freelancer onboarding
* admin visibility into usage and approvals

Build the system with strict data models, aggressive validation, and modular server code so the app can grow without turning into a repair shop for future-you.
