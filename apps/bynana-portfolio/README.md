# 🌐 bynana — Developer Portfolio

This is the personal portfolio website of **Nana Aba Ackah**, built to showcase professional experience, technical skills, and select frontend projects. The site is developed using modern web technologies including **React**, **Vite**, and **Tailwind CSS**, and is designed with accessibility, performance, and responsiveness in mind.

---

## Tech Stack

| Tech | Description |
|------|-------------|
| **React** | JavaScript library for building interactive UIs |
| **Vite** | Lightning-fast build tool for modern web development |
| **Tailwind CSS** | Utility-first CSS framework for responsive design |
| **React Router** | Handles client-side routing |
| **Netlify** | Hosting and deployment (specify if used) |

---

## Features

- Fast, responsive, and SEO-friendly design
- Clear presentation of skills, tools, and experience
- Projects section with detailed case study (customizable)
- External links to GitHub, LinkedIn, and contact
- Mobile-first responsive layout
- Accessibility-conscious components and structure

---

## 🛠 Setup Instructions

1. **Clone the repo:**

```bash
git clone https://github.com/your-username/portfolio-site.git
cd portfolio-site
```

2. **Install dependencies:**

```bash
npm install
```

3. **Run locally:**

```bash
npm run dev
```

**Build for Production**

```bash
npm run build
```

## API Security (Trust Stats)

The homepage now reads live trust stats through a Netlify Function proxy:

- Browser calls only: `/api/public/trust-stats`
- Server function calls upstream API: `netlify/functions/trust-stats-proxy.js`
- Upstream URL/token stay server-side (not exposed in browser bundle)
- Response is sanitized to only return `{ "organizations": number }`

Set these environment variables in Netlify (or local function env):

- `TRUST_STATS_UPSTREAM_URL` (required): full upstream URL
- `TRUST_STATS_UPSTREAM_TOKEN` (optional): bearer token for upstream auth
- `TRUST_STATS_ALLOWED_ORIGINS` (optional): comma-separated origin allowlist
- `TRUST_STATS_UPSTREAM_TIMEOUT_MS` (optional): upstream timeout in ms

## Contact Security

The contact form now posts to a Netlify Function before forwarding to the static Netlify form target:

- Browser calls only: `/api/contact`
- Server function validates input, rejects filled honeypots, applies server-side rate limiting, and sends a Resend email notification after the Netlify form submission succeeds
- A hidden static form definition in `index.html` keeps Netlify form detection intact for production

Optional environment variables:

- `RESEND_API_KEY`: required for contact notification emails
- `CONTACT_NOTIFICATION_TO`: recipient email address for notifications
- `CONTACT_NOTIFICATION_FROM`: Resend sender identity, for example `Portfolio Contact <onboarding@resend.dev>` or a verified domain sender
- `CONTACT_NOTIFICATION_SUBJECT_PREFIX`: prefix added to the notification email subject
- `CONTACT_ALLOWED_ORIGINS`: comma-separated origin allowlist for contact submissions
- `CONTACT_RATE_LIMIT_WINDOW_MS`: rate-limit window for the contact function
- `CONTACT_RATE_LIMIT_MAX_REQUESTS`: allowed submissions per client within the window
- `CONTACT_FORM_SUBMISSION_URL`: explicit absolute URL for the Netlify form submission target
- `CONTACT_FORM_SITE_ORIGIN`: fallback site origin if forwarded host headers are unavailable

If you are still using Resend's onboarding sender, keep `CONTACT_NOTIFICATION_FROM=Portfolio Contact <onboarding@resend.dev>`. For production deliverability, switch that value to a sender address on a domain you have verified in Resend.

**Folder Structure**

src/
├── assets/         # Images and static files
├── components/     # Reusable UI components
├── pages/          # Route-based views (About, Projects, etc.)
├── App.jsx
├── main.jsx

**To Do**

- Add more featured projects
- Lighthouse performance + accessibility badge

License

This project is open-sourced for learning and inspiration purposes.
All content and visuals belong to Nana Aba Ackah © 2025.

🌍 [Portfolio Website](nanaabaackah.com)
💼 [LinkedIn](https://www.linkedin.com/in/nana-aba-ackah/)
💻 <nanaabaackah@gmail.com>
📝 [Resume](https://nanaabaackah.com/documents/Nana%20Aba%20Ackah%20Resume.pdf)
