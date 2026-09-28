import { Schema, model } from "mongoose";
import {
  DEFAULT_ABOUT,
  DEFAULT_FAQ,
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_TERMS_AND_CONDITIONS,
  DEFAULT_PARTNERSHIP,
  DEFAULT_HOME_INTRO,
  DEFAULT_WHY_US,
  DEFAULT_TEAM_INTRO,
} from "../config/site-content-defaults.js";

// Singleton document (same pattern as SiteSettings - see site-settings.model.js's
// own header comment and site-content.repository.js's findOrCreateSiteContent,
// the only way this model is ever read) - exactly one SiteContent ever exists.
//
// This is deliberately a SEPARATE collection from SiteSettings, not more fields
// bolted onto it: SiteSettings is operational CONFIG (hero image, booking
// policy, currency, working hours - things that change how the business
// runs), while this is editorial CONTENT (marketing/legal copy - things that
// change what the site SAYS). Splitting them keeps a future white-label
// client's "just the copy" export/import separate from its operational
// settings, and keeps this document (which holds long legal text) from
// bloating every read of the much more frequently-read SiteSettings.
//
// Every field here used to be a literal, code-deployed JS constant inside
// presenters/public/index.presenter.js and presenters/public/expert.presenter.js
// (see that history in site-content-defaults.js's header comment) - moving it
// here is what makes it admin-editable without a redeploy, and what lets a new
// client (see the multi-site/white-label plan) start from real, sensible
// defaults and then rewrite just the words, not the code.
//
// Deliberately schema-loose (Schema.Types.Mixed) for the nested content
// shapes (sections/items/steps/subsections) rather than a fully-typed nested
// schema for every optional field combination: this content's real shape
// (paragraphs vs. list vs. subsections vs. closingParagraphs, all optional,
// nested one level for legal pages) is presentation-driven, not
// business-rule-driven - there's no invariant here worth a mongoose validator
// enforcing, and a rigid schema would only get in the way of a page adding a
// new optional field later. Basic shape (isArray, string trims) is validated
// in site-content.service.js at write time instead.
const SiteContentSchema = new Schema(
  {
    about: {
      intro: { type: String, default: DEFAULT_ABOUT.intro },
      sections: { type: [Schema.Types.Mixed], default: () => DEFAULT_ABOUT.sections },
    },
    faq: {
      items: { type: [Schema.Types.Mixed], default: () => DEFAULT_FAQ.items },
    },
    privacyPolicy: {
      lastUpdated: { type: String, default: DEFAULT_PRIVACY_POLICY.lastUpdated },
      intro: { type: String, default: DEFAULT_PRIVACY_POLICY.intro },
      sections: { type: [Schema.Types.Mixed], default: () => DEFAULT_PRIVACY_POLICY.sections },
    },
    termsAndConditions: {
      lastUpdated: { type: String, default: DEFAULT_TERMS_AND_CONDITIONS.lastUpdated },
      intro: { type: String, default: DEFAULT_TERMS_AND_CONDITIONS.intro },
      sections: { type: [Schema.Types.Mixed], default: () => DEFAULT_TERMS_AND_CONDITIONS.sections },
    },
    partnership: {
      intro: { type: String, default: DEFAULT_PARTNERSHIP.intro },
      steps: { type: [Schema.Types.Mixed], default: () => DEFAULT_PARTNERSHIP.steps },
      highlights: { type: [String], default: () => DEFAULT_PARTNERSHIP.highlights },
    },
    homeIntro: {
      title: { type: String, default: DEFAULT_HOME_INTRO.title },
      lead: { type: String, default: DEFAULT_HOME_INTRO.lead },
      who: { type: String, default: DEFAULT_HOME_INTRO.who },
      massages: { type: [Schema.Types.Mixed], default: () => DEFAULT_HOME_INTRO.massages },
      packages: { type: String, default: DEFAULT_HOME_INTRO.packages },
      closing: { type: String, default: DEFAULT_HOME_INTRO.closing },
    },
    whyUs: { type: [Schema.Types.Mixed], default: () => DEFAULT_WHY_US },
    teamIntro: {
      eyebrow: { type: String, default: DEFAULT_TEAM_INTRO.eyebrow },
      title: { type: String, default: DEFAULT_TEAM_INTRO.title },
      lead: { type: String, default: DEFAULT_TEAM_INTRO.lead },
      highlights: { type: [Schema.Types.Mixed], default: () => DEFAULT_TEAM_INTRO.highlights },
    },
  },
  { timestamps: true, minimize: false }
);

export default model("SiteContent", SiteContentSchema);
