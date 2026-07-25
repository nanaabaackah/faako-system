# TTN GH client requirements baseline

Status: requirements captured; content and operational details remain subject to client approval.

## Project purpose

The Thriving Network GH currently relies on Facebook, Instagram, LinkedIn, and WhatsApp. The new
website will establish a credible, professional central presence where individuals, partners,
clients, donors, volunteers, and other stakeholders can understand the organization, access verified
support pathways, discover programs and events, and engage with its work.

## Desired outcomes

- Communicate the mission, vision, services, programs, advocacy, partnerships, and evidenced impact.
- Increase awareness, enquiries, partnership opportunities, registrations, and meaningful engagement.
- Provide a trusted, mobile-friendly hub for information, resources, news, and future growth.
- Make routine content manageable for an organization expecting approximately monthly updates.
- Give each visitor a clear, low-friction next step without making the experience feel clinical,
  institutional, crowded, or intimidating.

## Audiences

1. Individuals seeking mental health support and their families.
2. Young adults, students, professionals, and mental wellness communities.
3. Organizations and prospective program or advocacy partners.
4. Donors, volunteers, mental health advocates, and community supporters.
5. Media, institutions, and other stakeholders seeking credible organizational information.

These audiences have different risk and information needs. Support-seeking journeys must be direct,
calm, private, and unambiguous; partnership and donor journeys may provide deeper evidence,
governance, and impact information.

## Approved brand direction

- Tagline: **Peace Over Everything.**
- Primary: Thriving Pink `#E52477`
- Secondary: Soft Blush Pink `#F5E4EC`
- Primary text: Black `#0A0A0A`
- Secondary text: Charcoal Gray `#4E4B4C`
- Background: White `#FFFFFF`
- Character: modern, compassionate, uplifting, hopeful, supportive, community-centred, and professional.

Use black for normal text on Thriving Pink. The measured contrast is approximately 4.57:1; white on
Thriving Pink is approximately 4.33:1 and should not be used for normal-sized text intended to meet
WCAG AA. Black on Soft Blush and Charcoal on White provide strong text contrast.

Avoid dark or gloomy visual systems, clinical/hospital cues, overly corporate layouts, clutter,
aggressive messaging, harsh colour combinations, excessive animation, and staged or impersonal stock
photography.

## Information architecture

### Primary launch navigation

- Home
- About
- Services and Programs
- Events
- Resources
- News
- Get Involved
- Contact

### Supporting pages and sections

- Mission, vision, values, story, team, governance, and safeguarding
- Mental health advocacy
- Support groups
- Program overview and individual program detail
- Event listing, event detail, and registration handoff
- Partnerships and partnership enquiry
- Volunteer opportunities and volunteer enquiry
- Donation information and donation flow
- Impact and community stories
- Testimonials, only with explicit informed permission
- Photo gallery, with captions, consent, and appropriate image rights
- Newsletter signup
- Privacy, cookies, terms, donation/refund information, accessibility, and complaints

The client's five requested top-level pages—Home, About, Services, Contact, and Blog/News—remain the
minimum. Events, Resources, and Get Involved should be treated as first-class discoverability needs,
whether they launch as pages or clearly separated sections.

## Priority visitor journeys

1. **Find support:** understand available support, eligibility, format, boundaries, and the next safe
   step. Do not imply emergency, clinical, or therapeutic services unless these are verified.
2. **Join the community:** understand support groups and participation expectations, then register.
3. **Attend an event:** find current events, check accessibility and logistics, and register.
4. **Partner with TTN GH:** understand partnership themes and submit a focused enquiry.
5. **Volunteer:** review roles, safeguarding expectations, time commitments, and apply.
6. **Donate:** understand use of funds and policies, choose an approved provider, and receive a
   verifiable outcome and receipt.
7. **Contact directly:** use approved WhatsApp, email, phone, or form channels and know expected
   response times.
8. **Stay informed:** read news/resources, subscribe with consent, and follow verified social accounts.

## Functional scope

- Responsive static-first Astro pages
- Manageable news/blog and event content workflow
- Contact/quote/request, partnership, volunteer, and registration forms
- WhatsApp deep link using an approved number and prefilled plain-language message
- Newsletter integration selected after ownership, consent, and retention review
- Photo gallery with image optimization, captions, permissions, and meaningful alternative text
- Testimonials with documented consent and no sensitive health disclosure by default
- Google Analytics setup, initially disabled and blocked pending privacy/consent approval
- Search basics: metadata, canonicals, robots, XML sitemap, structured data, redirects, and ownership
- Future Paystack and MTN MoMo donation flows through the Railway API

## Content still required from the client

- Legal/registered organization name and registration information
- Approved mission, vision, values, history, governance, safeguarding, and complaints process
- Program and support-group names, owners, audiences, formats, schedules, prices if any, capacity,
  eligibility, locations, boundaries, accessibility, and registration destinations
- Team biographies, approved photographs, roles, credentials, and publication consent
- Verified impact figures with period, methodology, source, and accountable owner
- Approved testimonials with informed publication consent and withdrawal process
- Event data and registration ownership
- Official email, phone, WhatsApp number, address/service area, operating hours, and response times
- Verified Facebook, Instagram, LinkedIn, and other social URLs
- Partnership, volunteer, donation, refund, privacy, cookie, and newsletter policies
- Logo files, image library, licenses/releases, and photography consent records
- Google Analytics property owner and measurement ID
- Domain name, DNS owner, Cloudflare account owner, Railway account owner, and launch approvers

## Mental-health content and safeguarding rules

- Use respectful, person-centred, non-stigmatizing language and avoid labels, blame, stereotypes,
  sensational stories, fear, or promises of recovery.
- Separate advocacy, peer/community support, education, and clinical care accurately.
- Do not diagnose, prescribe, or imply professional treatment without verified qualified ownership.
- Support and resource content needs a named reviewer, last-reviewed date, sources, and review cycle.
- Clearly state service boundaries and what to do when urgent help is needed, using only resources
  verified and approved for the visitor's location. Do not guess emergency or crisis contacts.
- Collect the minimum possible sensitive information. General enquiry forms should not invite detailed
  health histories. Safeguarding disclosures need a documented human escalation process before launch.
- Obtain informed permission for identifiable stories, testimonials, and photographs. Avoid exposing a
  person's mental-health status through URLs, analytics events, email subjects, or public content.
- Authentic imagery should represent diverse African individuals and communities with dignity, agency,
  hope, resilience, and connection. Image rights and subject consent must be documented.

## Definition of launch-ready

The website is not launch-ready merely because it builds. Launch requires approved content and
policies, verified contact and social destinations, completed privacy and safeguarding reviews,
tested mobile and accessible journeys, analytics consent, production monitoring, and documented
owners for forms, events, donations, updates, and incidents.
