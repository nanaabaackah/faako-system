import React from "react";
import { Link } from "react-router-dom";
import LegalLayout, { type LegalSection } from "../components/LegalLayout";
import useSEOMeta from "../hooks/useSEOMeta";

const SECTIONS: LegalSection[] = [
  {
    heading: "What Are Cookies?",
    body: (
      <p>
        Cookies are small text files placed on your device when you visit a
        website. They are widely used to make sites work, remember your
        preferences, and help site owners understand how their site is being
        used.
      </p>
    ),
  },
  {
    heading: "How We Use Cookies",
    body: (
      <>
        <p>Stroane uses cookies to:</p>
        <ul>
          <li>Keep the site working and secure.</li>
          <li>Remember preferences such as your basket and category filters.</li>
          <li>Understand how visitors find and use the site, in aggregate.</li>
        </ul>
        <p>
          We do not use cookies to build advertising profiles or sell data to
          third parties.
        </p>
      </>
    ),
  },
  {
    heading: "Types of Cookies We Use",
    body: (
      <>
        <p>
          <strong>Strictly necessary.</strong> These are required for core
          functions such as page navigation, session security, and the store
          basket. The site does not work properly without them.
        </p>
        <p>
          <strong>Preference.</strong> Remember choices you make &mdash; for
          example, the last shop category you viewed or whether you dismissed
          a notice.
        </p>
        <p>
          <strong>Analytics.</strong> Help us understand which pages and
          guides are useful, in aggregate, so we can improve them. Data is not
          linked to your identity.
        </p>
      </>
    ),
  },
  {
    heading: "Third-Party Cookies",
    body: (
      <p>
        When you click through to an external service &mdash; for example,
        WhatsApp, social platforms, or our payment processors &mdash; those
        services may set their own cookies. Their cookies are governed by
        their own policies, which we recommend reviewing.
      </p>
    ),
  },
  {
    heading: "Managing Cookies",
    body: (
      <>
        <p>
          Most browsers let you view, block, or delete cookies. You can
          usually find these controls under settings or preferences, often
          under &ldquo;Privacy &amp; security&rdquo;.
        </p>
        <p>
          Blocking strictly-necessary cookies may break parts of the site
          (such as the basket or signed-in admin areas). Blocking preference
          and analytics cookies has no functional impact.
        </p>
      </>
    ),
  },
  {
    heading: "Changes to This Policy",
    body: (
      <p>
        If we add new cookies or change how existing ones are used, we will
        update this page and the &ldquo;last updated&rdquo; date above. See
        our <Link to="/privacy">Privacy Policy</Link> for the broader picture
        of how we handle data.
      </p>
    ),
  },
];

const Cookies: React.FC = () => {
  useSEOMeta({
    title: "Cookie Policy | Stroane",
    description:
      "How Stroane uses cookies to keep the website working, remember your preferences, and improve our content.",
    canonical: "https://stroanesolutions.com/cookies",
  });

  return (
    <LegalLayout
      title="Cookie Policy"
      lastUpdated="14 May 2026"
      intro={
        <p>
          This page lists the cookies Stroane uses, why we use them, and how
          you can manage them in your browser. For broader data practices, see
          our <Link to="/privacy">Privacy Policy</Link>.
        </p>
      }
      sections={SECTIONS}
    />
  );
};

export default Cookies;
