// HTML + plain-text bodies for the three emails this site sends:
//   1. the visitor's receipt after the contact form ("Got your note")
//   2. the contact notification to the admin inbox
//   3. the guestbook moderation notice to the admin inbox
//
// They were plain text only. That is the most deliverable format there
// is, so the text part stays (every email here is multipart), but the one
// email a visitor actually receives looked like a system log. The HTML
// part is the site's Win98 window, built the way mail clients demand:
//
//   - tables + inline styles only. Gmail strips <style> in several
//     contexts and Outlook (Word's renderer) ignores flex, grid, max-width
//     and most of CSS. Hence the <!--[if mso]> fixed-width wrapper.
//   - no images, no web fonts, no external anything. Remote content is
//     blocked by default in most clients, and a broken-image icon is worse
//     than no image. The bevels are borders; the glyphs are text.
//   - fluid by default (width 100%, max-width 560) rather than relying on
//     media queries, which Gmail's mobile apps drop for non-Google
//     accounts. One column, 16px body text, 44px tap targets.
//   - color-scheme: light. A grey Win98 dialog auto-inverted into dark
//     mode turns into mud; this asks clients to leave it alone.
//
// EVERYTHING a visitor typed goes through escapeHtml before it touches
// markup, and through encodeURIComponent before it touches a mailto:.

const FONT =
  "Tahoma, 'MS Sans Serif', Geneva, Verdana, Arial, sans-serif";
const MONO = "'Courier New', Courier, monospace";
const SITE = "https://danoh.com";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, with the visitor's line breaks kept. */
function multiline(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, "<br>");
}

// Raised (button / window) and sunken (field) bevels, as border shorthands.
const RAISED =
  "border-top:2px solid #ffffff;border-left:2px solid #ffffff;border-right:2px solid #404040;border-bottom:2px solid #404040;";
const SUNKEN =
  "border-top:2px solid #808080;border-left:2px solid #808080;border-right:2px solid #ffffff;border-bottom:2px solid #ffffff;";

/** A sunken white field holding preformatted visitor text. */
function field(innerHtml: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td bgcolor="#ffffff" style="${SUNKEN}background:#ffffff;padding:12px 14px;` +
    `font-family:${FONT};font-size:15px;line-height:22px;color:#000000;` +
    // Long URLs or unbroken strings must wrap, not push the layout wide.
    `word-break:break-word;overflow-wrap:anywhere;">${innerHtml}</td></tr></table>`
  );
}

/** Bulletproof button: the <td> carries the look, the <a> the tap area. */
function button(label: string, href: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td bgcolor="#c0c0c0" style="${RAISED}background:#c0c0c0;">` +
    `<a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 22px;` +
    `font-family:${FONT};font-size:15px;line-height:20px;color:#000000;` +
    `text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`
  );
}

function shell(opts: {
  /** Title-bar text. */
  title: string;
  /** Inbox preview line (hidden in the body). */
  preheader: string;
  bodyHtml: string;
  /** Left cell of the status bar. */
  status: string;
}): string {
  const glyph = (g: string) =>
    `<td width="20" height="18" align="center" bgcolor="#c0c0c0" ` +
    `style="${RAISED}border-width:1px;background:#c0c0c0;font-family:${FONT};` +
    `font-size:11px;line-height:14px;color:#000000;font-weight:bold;">${g}</td>` +
    `<td width="3" style="font-size:0;line-height:0;">&nbsp;</td>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#008080;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(
    opts.preheader
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#008080" style="background:#008080;">
<tr><td align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#c0c0c0" style="max-width:560px;background:#c0c0c0;${RAISED}">
<tr><td style="padding:3px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000080" style="background:#000080;background:linear-gradient(90deg,#000080,#1084d0);">
<tr>
<td style="padding:5px 8px;font-family:${FONT};font-size:14px;line-height:18px;font-weight:bold;color:#ffffff;">${escapeHtml(
    opts.title
  )}</td>
<td align="right" style="padding:3px 0 3px 4px;" aria-hidden="true">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${glyph(
    "_"
  )}${glyph("&#9633;")}${glyph("&times;")}</tr></table>
</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:20px 18px 18px;font-family:${FONT};font-size:16px;line-height:24px;color:#000000;">
${opts.bodyHtml}
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="${SUNKEN}border-width:1px;padding:4px 8px;font-family:${FONT};font-size:12px;line-height:16px;color:#222222;">${escapeHtml(
    opts.status
  )}</td>
<td width="4" style="font-size:0;line-height:0;">&nbsp;</td>
<td width="110" align="center" style="${SUNKEN}border-width:1px;padding:4px 8px;font-family:${FONT};font-size:12px;line-height:16px;">
<a href="${SITE}" style="color:#000080;text-decoration:underline;">danoh.com</a></td>
</tr>
</table>

</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

const p = (html: string, extra = "") =>
  `<p style="margin:0 0 14px;${extra}">${html}</p>`;

const label = (text: string) =>
  `<div style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:18px;color:#222222;">${escapeHtml(
    text
  )}</div>`;

export type RenderedEmail = { subject: string; text: string; html: string };

// ---------------------------------------------------------------------
// 1. Visitor receipt
// ---------------------------------------------------------------------

export function renderVisitorReceipt(input: {
  name: string | null;
  /** Already clipped by the caller (see quoteBack in the contact route). */
  quote: string;
}): RenderedEmail {
  const who = input.name ?? "there";
  const subject = "Got your note · danoh.com";

  const text =
    `Hey ${who},\n\n` +
    `Thanks for writing in. Your note arrived and I'll read it soon.\n` +
    `Replies come from me directly, usually within a few days.\n\n` +
    `For reference, you wrote:\n\n` +
    input.quote
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n") +
    `\n\n` +
    `Anything to add? Just reply to this email.\n\n` +
    `Daniel\n` +
    `danoh.com\n`;

  const html = shell({
    title: "Message received",
    preheader: "Your note arrived. I read everything and reply myself.",
    status: "1 message delivered",
    bodyHtml:
      p(`Hey ${escapeHtml(who)},`) +
      p(
        `Thanks for writing in. Your note arrived, and I'll read it soon. ` +
          `Replies come from me directly, usually within a few days.`
      ) +
      label("For reference, you wrote:") +
      field(multiline(input.quote)) +
      `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>` +
      p(`Anything to add? Just reply to this email.`) +
      p(`Daniel`, "margin-bottom:18px;") +
      button("Back to the desktop", SITE),
  });

  return { subject, text, html };
}

// ---------------------------------------------------------------------
// Admin notices: a label/value sheet, then the message.
// ---------------------------------------------------------------------

function sheet(rows: [string, string][]): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td valign="top" width="96" style="padding:3px 10px 3px 0;font-family:${FONT};font-size:13px;line-height:20px;color:#444444;">${escapeHtml(
            k
          )}</td><td valign="top" style="padding:3px 0;font-family:${FONT};font-size:15px;line-height:20px;color:#000000;word-break:break-word;overflow-wrap:anywhere;">${v}</td></tr>`
      )
      .join("") +
    `</table>`
  );
}

const meta = (s: string) =>
  `<span style="font-family:${MONO};font-size:13px;color:#333333;">${escapeHtml(s)}</span>`;

// ---------------------------------------------------------------------
// 2. Contact notification (admin)
// ---------------------------------------------------------------------

export function renderContactNotice(input: {
  name: string | null;
  replyTo: string | null;
  subject: string | null;
  message: string;
  visitorId: string;
  ip: string;
}): RenderedEmail {
  const subject = `[danoh.com contact] ${input.subject ?? "Hello"} · ${
    input.name ?? "Anonymous"
  }`;

  const text =
    `From: ${input.name ?? "(no name)"}\n` +
    `Reply-To: ${input.replyTo ?? "(none provided)"}\n` +
    `Visitor: ${input.visitorId}\n` +
    `IP: ${input.ip}\n` +
    `\n` +
    `${input.message}\n`;

  const replyHref = input.replyTo
    ? `mailto:${encodeURIComponent(input.replyTo).replace(/%40/g, "@")}` +
      `?subject=${encodeURIComponent(`Re: ${input.subject ?? "your note"}`)}`
    : null;

  const html = shell({
    title: "New message · contact form",
    preheader: `${input.name ?? "Someone"}: ${input.message.slice(0, 90)}`,
    status: input.replyTo ? "Reply-To is set: just hit Reply" : "No reply address given",
    bodyHtml:
      sheet([
        ["From", escapeHtml(input.name ?? "(no name)")],
        [
          "Reply to",
          input.replyTo
            ? `<a href="${escapeHtml(replyHref!)}" style="color:#000080;text-decoration:underline;">${escapeHtml(
                input.replyTo
              )}</a>`
            : escapeHtml("(none provided)"),
        ],
        ["Subject", escapeHtml(input.subject ?? "(none)")],
      ]) +
      field(multiline(input.message)) +
      `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>` +
      (replyHref
        ? button(`Reply to ${input.name ?? "sender"}`, replyHref) +
          `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>`
        : "") +
      sheet([
        ["Visitor", meta(input.visitorId)],
        ["IP", meta(input.ip)],
      ]),
  });

  return { subject, text, html };
}

// ---------------------------------------------------------------------
// 3. Guestbook moderation notice (admin)
// ---------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  approved: "#006400",
  pending: "#7a5c00",
  rejected: "#800000",
};

export function renderGuestbookNotice(input: {
  status: string;
  reason: string | null;
  name: string | null;
  message: string;
  visitorId: string;
  ip: string;
  userAgent: string | null;
}): RenderedEmail {
  const subject = `[danoh.com guestbook] ${input.status}: ${
    input.name ? input.name.slice(0, 30) : "Anonymous"
  }`;

  const text =
    `Status: ${input.status}\n` +
    `Reason: ${input.reason ?? "-"}\n` +
    `Name: ${input.name ?? "(none)"}\n` +
    `Message: ${input.message}\n` +
    `Visitor: ${input.visitorId}\n` +
    `IP: ${input.ip}\n` +
    `User-Agent: ${input.userAgent ?? "(none)"}\n`;

  const color = STATUS_COLORS[input.status] ?? "#000000";
  const badge =
    `<span style="display:inline-block;padding:1px 8px;background:#ffffff;${SUNKEN}border-width:1px;` +
    `font-family:${FONT};font-size:13px;line-height:18px;font-weight:bold;color:${color};">` +
    `${escapeHtml(input.status.toUpperCase())}</span>`;

  const html = shell({
    title: "Guestbook · new entry",
    preheader: `${input.status}: ${input.message.slice(0, 90)}`,
    status:
      input.status === "approved"
        ? "Already live on the wall"
        : "Not shown publicly",
    bodyHtml:
      sheet([
        ["Status", badge],
        ["Reason", escapeHtml(input.reason ?? "-")],
        ["Name", escapeHtml(input.name ?? "(none)")],
      ]) +
      field(multiline(input.message)) +
      `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>` +
      sheet([
        ["Visitor", meta(input.visitorId)],
        ["IP", meta(input.ip)],
        ["Browser", meta(input.userAgent ?? "(none)")],
      ]),
  });

  return { subject, text, html };
}
