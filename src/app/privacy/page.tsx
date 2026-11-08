import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { OPERATOR_LINE, PAYMENTS_LINE, SITE_URL, SUPPORT_EMAIL } from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Privacy Policy — Flashant",
  description: "How Flashant handles accounts, uploaded images, generated images, and payments.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="This policy explains what Flashant collects and why."
    >
      <section>
        <h2>Who we are</h2>
        <p>{OPERATOR_LINE}</p>
        <p>
          The service is available at <a href={SITE_URL}>{SITE_URL}</a>. Flashant is an independent
          product-image tool. It is not a model provider and is not affiliated with the companies
          that build the image models it can call.
        </p>
      </section>
      <section>
        <h2>Account information</h2>
        <p>
          If you create an account we store your email address, the name you provide, a password
          hash when you use a password, and the subject identifier returned by Google if you sign
          in with Google. We use this information to authenticate you and to keep your projects
          attached to you.
        </p>
      </section>
      <section>
        <h2>Uploaded images</h2>
        <p>
          Product photos you upload are stored so we can send them to an image model as the
          reference for a generation and so you can download or publish the result. We do not use
          your uploads to train a Flashant model.
        </p>
      </section>
      <section>
        <h2>Generated images</h2>
        <p>
          Images the service creates are stored with the prompt text that produced them, the
          project they belong to, and basic technical metadata such as size and status. You can
          delete generated images from your account. Deletion removes them from the product views
          we control.
        </p>
      </section>
      <section>
        <h2>Payments</h2>
        <p>{PAYMENTS_LINE}</p>
      </section>
      <section>
        <h2>Other data</h2>
        <ul>
          <li>A session cookie that keeps you signed in.</li>
          <li>A locale cookie (NEXT_LOCALE) that remembers your language.</li>
          <li>Quota and subscription status so the plan limits can be applied.</li>
          <li>Messages you send to {SUPPORT_EMAIL}.</li>
        </ul>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Hosting, the database, object storage, email delivery, and third-party image models
          process data only so the product can run. Those providers see the account, file, or
          prompt data required for their part of the request.
        </p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep account data and images for as long as the account is open and you have not
          deleted the item. Payment records are kept by the merchant of record under its own
          retention rules. You can ask us to delete your account by emailing {SUPPORT_EMAIL}.
        </p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>
          We do not sell personal information. We share it with the providers above, with Creem
          when a card payment is processed, and when the law requires it.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Privacy requests go to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also the{" "}
          <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/acceptable-use">Acceptable Use Policy</Link>.
        </p>
      </section>
    </LegalDocument>
  );
}
