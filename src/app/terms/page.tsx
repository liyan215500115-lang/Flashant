import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  DEEPFAKE_PROHIBITION,
  MINORS_PROHIBITION,
  NSFW_PROHIBITION,
  OPERATOR_LINE,
  PAYMENTS_LINE,
  SITE_URL,
  SUPPORT_EMAIL,
} from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Terms of Service — Flashant",
  description: "Terms for using Flashant, including the ban on NSFW and harmful image generation.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description="These terms govern use of Flashant."
    >
      <section>
        <h2>The service</h2>
        <p>{OPERATOR_LINE}</p>
        <p>
          Flashant at <a href={SITE_URL}>{SITE_URL}</a> is an independent interface for generating
          product images from photos and prompts you supply. It is not affiliated with or endorsed
          by the companies that create the underlying image models. We only provide features that
          the product actually offers.
        </p>
      </section>
      <section>
        <h2>Accounts</h2>
        <p>
          You are responsible for the activity on your account and for keeping your credentials
          private. You must give accurate account information and you must be old enough to enter
          a contract where you live.
        </p>
      </section>
      <section>
        <h2>Image generation is limited</h2>
        <p>{NSFW_PROHIBITION}</p>
        <p>{DEEPFAKE_PROHIBITION}</p>
        <p>{MINORS_PROHIBITION}</p>
        <p>
          The same rules are set out in the <Link href="/acceptable-use">Acceptable Use Policy</Link>,
          which is part of these terms. We may block a prompt, refuse a generation, or close an
          account that breaks them. Automated moderation can reject a prompt before any image is
          created.
        </p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You keep the rights you already have in photos and text you submit. You give us permission
          to host that material and send it to an image model solely to run the service for you.
          You confirm you have the rights needed to upload a photo and to ask for an image of the
          product or person it shows.
        </p>
      </section>
      <section>
        <h2>Payments</h2>
        <p>{PAYMENTS_LINE}</p>
      </section>
      <section>
        <h2>Disclaimers and liability</h2>
        <p>
          The service is provided as available. Generated images can be wrong, incomplete, or
          unsuitable for a marketplace, and you are responsible for reviewing them before you
          publish. To the extent the law allows, we are not liable for indirect or consequential
          loss, or for loss of profits, data, or goodwill, arising from use of the service.
        </p>
      </section>
      <section>
        <h2>Ending access</h2>
        <p>
          You may stop using Flashant at any time. We may suspend or close access if you break
          these terms, if a payment fails, or if we have to protect the service or other people.
        </p>
      </section>
      <section>
        <h2>Law and contact</h2>
        <p>
          These terms are governed by the laws of the People’s Republic of China, except where a
          mandatory consumer rule in your place of residence says otherwise. Questions about these
          terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalDocument>
  );
}
