import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import {
  DEEPFAKE_PROHIBITION,
  MINORS_PROHIBITION,
  NSFW_PROHIBITION,
  SUPPORT_EMAIL,
} from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — Flashant",
  description: "Acceptable use of Flashant, including the ban on NSFW and harmful image generation.",
};

export default function AcceptableUsePage() {
  return (
    <LegalDocument
      title="Acceptable Use Policy"
      description="This policy describes what you may and may not generate with Flashant."
    >
      <section>
        <h2>What Flashant is for</h2>
        <p>
          Flashant is for commercial product photography: white-background shots, scenes, and
          related catalog images of products you have the right to show. Use it for that purpose.
        </p>
      </section>
      <section>
        <h2>Prohibited image generation</h2>
        <p>{NSFW_PROHIBITION}</p>
        <p>{DEEPFAKE_PROHIBITION}</p>
        <p>{MINORS_PROHIBITION}</p>
        <p>
          Harmful image generation is also prohibited. That includes requests for violent,
          hateful, fraudulent, or harassing images, and any request meant to deceive a shopper
          about the product being sold. Do not try to bypass these rules by encoding a request,
          splitting it across prompts, or wrapping it in a style template.
        </p>
      </section>
      <section>
        <h2>How we enforce this</h2>
        <p>
          User-written prompt text is screened before it is sent to an image model. A prompt that
          is denied or flagged is not generated. If screening is unavailable, generation is
          refused until screening works again. We may also remove content and suspend accounts.
        </p>
        <p>
          These rules are part of the <Link href="/terms">Terms of Service</Link>.
        </p>
      </section>
      <section>
        <h2>Report a problem</h2>
        <p>
          Report prohibited content or an account that breaks this policy to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalDocument>
  );
}
