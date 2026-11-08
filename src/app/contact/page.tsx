import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { OPERATOR_LINE, SITE_URL, SUPPORT_EMAIL } from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Contact — Flashant",
  description: "Contact Flashant support.",
};

export default function ContactPage() {
  return (
    <LegalDocument
      title="Contact"
      description="Product help, privacy requests, and reports of prohibited content."
    >
      <section>
        <h2>Support email</h2>
        <p>{OPERATOR_LINE}</p>
        <p>
          Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          {" "}for product support, billing questions, privacy requests, and reports that someone
          is using Flashant to generate prohibited images. This is the only support address.
        </p>
        <p>
          Site: <a href={SITE_URL}>{SITE_URL}</a>
        </p>
      </section>
      <section>
        <h2>Policies</h2>
        <p>
          <Link href="/privacy">Privacy Policy</Link>
          {" · "}
          <Link href="/terms">Terms of Service</Link>
          {" · "}
          <Link href="/acceptable-use">Acceptable Use Policy</Link>
        </p>
      </section>
    </LegalDocument>
  );
}
