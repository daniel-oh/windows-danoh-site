// No "use client": there are no hooks or handlers here, so the /resume
// page can render this fully static (zero hydration), while the client
// WindowBody tree keeps importing it exactly as before.
import Image from "next/image";
import styles from "./Resume.module.css";

export function Resume() {
  return (
    <div className={styles.resumeContainer}>
      <div className={styles.header}>
        <Image
          src="/headshot-resume.jpg"
          alt="Daniel Oh"
          width={144}
          height={144}
          sizes="(max-width: 768px) 56px, 72px"
          className={styles.headshot}
        />
        <h1 className={styles.name}>DANIEL OH</h1>
        <div className={styles.contact}>
          Chicago, IL
        </div>
        <div className={styles.contact}>
          <a href="mailto:hello@danoh.com">hello@danoh.com</a>
          {" · "}
          <a href="https://www.linkedin.com/in/daniel-oh/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          {" · "}
          <a href="https://github.com/daniel-oh" target="_blank" rel="noopener noreferrer">GitHub</a>
          {" · "}
          <a href="https://danoh.com" target="_blank" rel="noopener noreferrer">danoh.com</a>
        </div>
      </div>

      <Section title="PROFILE">
        <p style={{ fontStyle: "italic", marginBottom: 8 }}>
          Senior platform engineer in cybersecurity, 8+ years across AWS, Azure, and GCP. At Nike I build self-service security platforms that let teams ship secure by default. I also build <strong>Floeberg</strong> on the side.
        </p>
      </Section>

      <Section title="EXPERIENCE">
        <Job
          company="Nike"
          location="Remote"
          title="Senior Platform Engineer, Cybersecurity"
          dates="Apr 2023 · Present"
        >
          <li>Built the GitOps infrastructure on <strong>Argo CD</strong> that lets <strong>Wiz</strong> auto-remediate cloud security findings.</li>
          <li>Secured <strong>500+ AWS accounts</strong> with self-service <strong>Crossplane</strong> setups that come out compliant and tuned.</li>
          <li>Launched a <strong>Slack</strong> security assistant on <strong>Databricks</strong> AI agents that anyone can ask for tips.</li>
          <li>Saved <strong>$150K+ a year</strong> by replacing vendor tools and tuning Kubernetes clusters.</li>
          <li>Protected <strong>100+ global endpoints</strong> with self-service Azure WAF, blocking <strong>10,000+ bot attacks</strong> a day.</li>
          <li>Built shared infrastructure for <strong>10+ teams</strong>, from a Databricks lakehouse to Terraform modules.</li>
        </Job>

        <Job
          company="Capital Markets Gateway"
          location="New York, NY"
          title="Platform Engineer"
          dates="Jul 2021 · Apr 2023"
        >
          <li>Moved the network stack from public to private on <strong>Azure</strong> with Terragrunt and Cloudflare.</li>
          <li>Gated every build with <strong>Snyk</strong> and <strong>Trivy</strong> and replaced CircleCI with self-hosted GitHub Actions.</li>
          <li>Ran <strong>50+ releases a week</strong> and year-round on-call, with OpenTelemetry and Datadog for incidents.</li>
          <li>Introduced change management and incident response processes for <strong>SOC 2</strong> compliance.</li>
        </Job>

        <Job
          company="Avanade"
          location="Chicago, IL"
          title="Site Reliability Engineer, Consultant"
          dates="2019 · 2021"
        >
          <li>Led a healthcare client&apos;s <strong>72 teams</strong> onto self-serve Azure with Terraform Enterprise.</li>
        </Job>

        <Job
          company="Allstate Insurance"
          location="Northbrook, IL"
          title="DevOps Engineer, Technology Leadership Program"
          dates="2017 · 2019"
        >
          <li>Shipped a production serverless iOS app for cybersecurity and fraud detection on AWS.</li>
        </Job>
      </Section>

      <Section title="VENTURES">
        <ul className={styles.ventureList}>
          <li><strong>Floeberg</strong> · floeberg.com · Storytelling workspace that takes creators from an idea to research, script, and scenes.</li>
          <li><strong>Kayrage</strong> · kayrage.com · Side project where I try brand systems with AI.</li>
          <li><strong>FindMyFeels</strong> · findmyfeels.com · Find words for what you&apos;re feeling.</li>
        </ul>
      </Section>

      <Section title="EDUCATION">
        <div className={styles.jobHeader}>
          <div>
            <strong>University of Michigan</strong>
            <div className={styles.jobTitle}>B.S.E., Computer Engineering</div>
          </div>
          <div className={styles.jobDates}>2018</div>
        </div>
      </Section>

      <Section title="TECHNICAL SKILLS">
        <ul className={styles.skillsList}>
          <li><strong>Cloud</strong> · Amazon Web Services (AWS), multi-account AWS, Microsoft Azure, Google Cloud Platform (GCP)</li>
          <li><strong>Security and compliance</strong> · Wiz (CNAPP, CSPM), auto-remediation, vulnerability management, Snyk, Trivy, SOC 2, HIPAA</li>
          <li><strong>Platform and IaC</strong> · Kubernetes, AKS, Crossplane, Infrastructure as Code (IaC), Terraform, Terragrunt, Helm, Ansible</li>
          <li><strong>CI/CD and GitOps</strong> · GitOps, Argo CD (ArgoCD), GitHub Actions, Jenkins, Harness CD</li>
          <li><strong>Observability</strong> · Datadog, OpenTelemetry, incident response, on-call, change management</li>
          <li><strong>Data, AI, and code</strong> · Databricks, AI agents, Claude API, Python, TypeScript, Bash, Swift</li>
        </ul>
      </Section>

      <div className={styles.downloadSection}>
        <a href="/Daniel_Oh_Resume.pdf" download className={styles.downloadButton}>Download PDF</a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </div>
  );
}

function Job({
  company,
  location,
  title,
  dates,
  children,
}: {
  company: string;
  location: string;
  title: string;
  dates: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.job}>
      <div className={styles.jobHeader}>
        <div>
          <strong>{company}</strong> · {location}
          <div className={styles.jobTitle}>{title}</div>
        </div>
        <div className={styles.jobDates}>{dates}</div>
      </div>
      <ul className={styles.jobBullets}>{children}</ul>
    </div>
  );
}
