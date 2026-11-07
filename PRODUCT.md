# UniData 360
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
University registrars, academic advisors, students and compliance auditors are the demonstration personas. The group presents the system to its Enterprise Data Management class.

## Product Purpose
Demonstrate the education industry's complete EDM lifecycle: sources, integration, governance and outputs, with a working persistent full-stack application.

## Operating Context
Course demonstration using synthetic SIS, LMS and Library feeds. Presentation mode explains the lifecycle and comparative industry matrix supplied by the user.

## Capabilities and Constraints
Next.js App Router, React, TypeScript and Tailwind. Use port 3005 exclusively. PostgreSQL stores student records and accounts. The workspace supports CSV/JSON ingestion, Student 360, academic analytics, role-based server projections, an audit trail, PDF reports and classroom slides. HR and Alumni CRM are planned extensions in the course's wider industry model.

Account mode uses email/password sign-in with fixed server-assigned roles. Students self-register using an existing master student ID and matching university email, then verify their email before choosing a password and activating a Student account. The project administrator creates Dean / Registrar, Academic Advisor and Compliance Auditor accounts through the account CLI; there is no separate administrator dashboard. Student accounts link to their own student ID and access only their permitted record. Demo mode keeps classroom persona switching. Authentication is application-managed, not institutional SSO.

## Brand Commitments
Preserve UniData's name and university data purpose. The user's latest supplied reference replaces the former navy direction with a light, monochrome learning dashboard: a black navigation rail, white canvas, soft gray rows, bold black actions, and a complementary statistics column.

## Evidence on Hand
Eight synthetic SIS students and matching learning/library seed data. Two supplied classroom reference slides. No real institution, live Canvas integration, regulatory certification or longitudinal retention dataset is supplied.

## Product Principles
Make every lifecycle stage demonstrable. Enforce permissions before sending data to the browser. Distinguish synthetic demonstration data from institutional claims. Preserve audit history across demo resets.
