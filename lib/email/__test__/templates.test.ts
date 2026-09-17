/**
 * @jest-environment node
 */
import {
  escapeHtml,
  renderContactNotice,
  renderGuestbookNotice,
  renderVisitorReceipt,
} from "@/lib/email/templates";

const XSS = `<script>alert(1)</script><img src=x onerror=alert(2)> "q" 'a' &`;

const all = () => [
  renderVisitorReceipt({ name: XSS, quote: XSS }),
  renderContactNotice({
    name: XSS,
    replyTo: "ana+test@example.com",
    subject: XSS,
    message: XSS,
    visitorId: "v_12345678",
    ip: "203.0.113.5",
  }),
  renderGuestbookNotice({
    status: "pending",
    reason: XSS,
    name: XSS,
    message: XSS,
    visitorId: "v_12345678",
    ip: "203.0.113.5",
    userAgent: XSS,
  }),
];

describe("email templates", () => {
  it("escapeHtml covers the five characters that matter in markup and attributes", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    );
  });

  // Every field a visitor controls is rendered into HTML that lands in the
  // admin's (or a stranger's) mail client.
  it("never lets visitor input through as markup", () => {
    for (const { html } of all()) {
      expect(html).not.toContain("<script>alert");
      expect(html).not.toContain("<img src=x");
      expect(html).not.toMatch(/onerror=alert\(2\)>/);
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    }
  });

  it("always ships a plain-text part that carries the content too", () => {
    for (const { text, subject } of all()) {
      expect(text).toContain("alert(1)"); // text part is literal, unescaped
      expect(text).not.toMatch(/<table|<td/);
      expect(subject.length).toBeGreaterThan(0);
    }
  });

  it("is self-contained: no images, scripts, stylesheets or web fonts to be blocked", () => {
    for (const { html } of all()) {
      expect(html).not.toMatch(/<img\s/i);
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<link\s/i);
      expect(html).not.toMatch(/@import|@font-face/i);
    }
  });

  it("asks mail clients not to dark-mode-invert the grey window, and has an Outlook width fallback", () => {
    for (const { html } of all()) {
      expect(html).toContain('<meta name="color-scheme" content="light">');
      expect(html).toContain("<!--[if mso]>");
    }
  });

  it("house style: no em-dashes in anything a person reads", () => {
    for (const { html, text, subject } of all()) {
      expect(html + text + subject).not.toMatch(/—/);
    }
  });

  it("receipt: keeps the visitor's line breaks and falls back to a neutral greeting", () => {
    const r = renderVisitorReceipt({ name: null, quote: "line one\nline two" });
    expect(r.html).toContain("line one<br>line two");
    expect(r.html).toContain("Hey there,");
    expect(r.text).toContain("> line one\n> line two");
  });

  it("contact notice: reply button is a well-formed, encoded mailto", () => {
    const r = renderContactNotice({
      name: "Ana",
      replyTo: "ana+test@example.com",
      subject: `Hello & "welcome"`,
      message: "hi",
      visitorId: "v_12345678",
      ip: "203.0.113.5",
    });
    expect(r.html).toContain(
      'href="mailto:ana%2Btest@example.com?subject=Re%3A%20Hello%20%26%20%22welcome%22"'
    );
    expect(r.html).toContain("Reply to Ana");
  });

  it("contact notice: no reply address means no reply button and says so", () => {
    const r = renderContactNotice({
      name: null,
      replyTo: null,
      subject: null,
      message: "hi",
      visitorId: "v_12345678",
      ip: "203.0.113.5",
    });
    expect(r.html).not.toContain("mailto:");
    expect(r.html).toContain("No reply address given");
  });

  it("guestbook notice: status drives the badge and the status bar", () => {
    const approved = renderGuestbookNotice({ status: "approved", reason: null, name: "A", message: "m", visitorId: "v", ip: "i", userAgent: null });
    const rejected = renderGuestbookNotice({ status: "rejected", reason: "spam", name: "A", message: "m", visitorId: "v", ip: "i", userAgent: null });
    expect(approved.html).toContain("APPROVED");
    expect(approved.html).toContain("Already live on the wall");
    expect(rejected.html).toContain("REJECTED");
    expect(rejected.html).toContain("Not shown publicly");
  });
});
