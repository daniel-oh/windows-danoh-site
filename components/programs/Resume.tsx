"use client";

import styles from "./Resume.module.css";

export function Resume() {
  return (
    <div className={styles.resumeContainer}>
      <div className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/headshot-resume.jpg"
          alt="Daniel Oh"
          className={styles.headshot}
        />
        <h1 className={styles.name}>DANIEL OH</h1>
        <div className={styles.contact}>
          Chicago, IL
        </div>
        <div className={styles.contact}>
          <a href="https://www.linkedin.com/in/daniel-oh/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          {" · "}
          <a href="https://github.com/daniel-oh" target="_blank" rel="noopener noreferrer">GitHub</a>
          {" · "}
          <a href="https://danoh.com" target="_blank" rel="noopener noreferrer">danoh.com</a>
        </div>
      </div>

      <Section title="PROFILE">
        <p style={{ fontStyle: "italic", marginBottom: 8 }}>
          I build the platforms that engineering teams actually want to use.
        </p>
        <ul style={{ paddingLeft: 18, margin: "4px 0" }}>
          <li><strong>8+ years</strong> in cloud-native infrastructure across enterprise and startup environments</li>
          <li><strong>10+ engineering teams</strong> shipping on platform infrastructure I designed and maintain at Nike</li>
          <li><strong>50+ AWS accounts</strong> secured through an enterprise compliance strategy I built from scratch</li>
          <li><strong>$150K+ saved annually</strong> by replacing vendor tooling with in-house platforms</li>
          <li><strong>Fortune 100 clients</strong> in healthcare, financial services, and e-commerce</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          University of Michigan Computer Engineering. Azure Expert certified across DevOps, Architecture, and Network Security.
        </p>
      </Section>

      <Section title="EXPERIENCE">
        <Job
          company="Nike"
          location="Remote"
          title="Cybersecurity, Sr. Platform Engineer"
          dates="Apr 2023 – Present"
        >
          <li>Designed a two-pronged enterprise security compliance strategy across 50+ AWS accounts: a managed services platform using Crossplane Kubernetes manifests with developer-friendly CLI tools for baked-in security and NFRs (happy path), paired with Wiz auto-remediation to shut down non-compliant resources (enforcement path)</li>
          <li>Built and maintained platform infrastructure used by 10+ engineering teams, including the CIS Data Lakehouse on Databricks, Kubernetes Terraform modules, and ArgoCD GitOps deployment patterns</li>
          <li>Saved $150K+ annually by replacing vendor tooling with in-house platforms, optimizing Kubernetes clusters, and introducing open-source Helm charts for networking and security</li>
          <li>Architected the Azure Native WAF Deployer with an enterprise-wide WAF reporting dashboard and developer self-service process, securing 79 global endpoints and blocking 10,000+ daily bot attacks</li>
          <li>Built a custom Slack bot integration with Databricks that gave non-technical analysts a chat-like query interface, reducing data engineering toil and improving cross-team access to insights</li>
        </Job>

        <Job
          company="Capital Markets Gateway"
          location="New York, NY"
          title="DevOps Engineer"
          dates="Jul 2021 – Apr 2023"
        >
          <li>Migrated the full network stack from public-facing to private architecture on Azure using Terragrunt, Cloudflare, GitHub Actions, and Harness CD</li>
          <li>Replaced CircleCI with self-hosted private GitHub Actions runners, improving pipeline security and reducing external dependency</li>
          <li>Implemented Snyk and Trivy container scanning as gated build validations, eliminating critical vulnerabilities before deployment</li>
          <li>Instrumented applications with OpenTelemetry and Datadog for full-stack observability during incident response</li>
          <li>Managed 50+ weekly releases and on-call incident response 52 weeks/year; introduced formal change management and incident response processes</li>
        </Job>

        <Job
          company="Avanade"
          location="Chicago, IL"
          title="Consultant, Site Reliability Engineer"
          dates="2019 – 2021"
        >
          <li>Delivered cloud enterprise solutions on Azure Kubernetes Service with IaC, Ansible, and CI/CD for Fortune 100 healthcare, financial services, and e-commerce clients including Zoro (Grainger)</li>
          <li>Platform architect for a healthcare provider with 72 distributed teams, migrating from IBM Bluemix to Azure with self-serve provisioning via ServiceNow, Terraform Enterprise, and GitHub Actions</li>
          <li>Led migration of a monolithic AWS application to microservices on Kubernetes with Google Cloud Platform at Zoro (Grainger)</li>
          <li>Founded a DevOps Community of Practice at a client site; introduced Gitflow and automated 12-Factor App principles into developer workflows</li>
        </Job>

        <Job
          company="Allstate Insurance"
          location="Northbrook, IL"
          title="Technology Leadership Program – DevOps Engineer"
          dates="2017 – 2019"
        >
          <li>Deployed a production serverless iOS application for cybersecurity and fraud detection; configured AWS VPC automation with Jenkins</li>
          <li>Led triage as Scrum Master for 20+ developers across 3 product lines using JIRA</li>
        </Job>
      </Section>

      <Section title="VENTURES">
        <p className={styles.ventureSubtitle}>Founder — Building with Swift/SwiftUI, Supabase, Cloudflare, Stripe, and Claude API</p>
        <ul className={styles.ventureList}>
          <li><strong>AM Training Hall</strong> – Fitness coaching marketplace connecting trainers and clients. Stripe Connect payments, multi-role architecture.</li>
          <li><strong>312eats / 312 Built</strong> – Chicago directory platforms: 3,700+ restaurant listings and 1,600+ vetted contractors across 15 categories.</li>
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
          <li><strong>Cloud</strong> — All three major clouds (Azure, AWS, GCP). Three Azure Expert certifications: DevOps, Architecture, and Network Security.</li>
          <li><strong>Infrastructure</strong> — Kubernetes, Terraform, Terragrunt, Crossplane, Helm, ArgoCD, Ansible.</li>
          <li><strong>Delivery</strong> — GitHub Actions, Jenkins, Harness CD. GitOps and trunk-based development.</li>
          <li><strong>Security & Observability</strong> — Wiz, Snyk, Trivy, Cloudflare WAF, Azure WAF, Datadog, OpenTelemetry, Splunk.</li>
          <li><strong>Languages & Tools</strong> — Python, Swift, Bash. Databricks, JIRA, ServiceNow, Terraform Enterprise.</li>
        </ul>
      </Section>

      <div className={styles.downloadSection}>
        <a href="/Daniel_Oh_Resume.pdf" download className={styles.downloadButton}>Download PDF</a>
      </div>

      <div className={styles.footer}>
        Certified Advanced PADI scuba diver. Marathon runner. Avid reader of Money Stuff by Matt Levine.
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
          <strong>{company}</strong> — {location}
          <div className={styles.jobTitle}>{title}</div>
        </div>
        <div className={styles.jobDates}>{dates}</div>
      </div>
      <ul className={styles.jobBullets}>{children}</ul>
    </div>
  );
}
