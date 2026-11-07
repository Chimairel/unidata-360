# UniData 360 course alignment

Reviewed 6 November 2026 against all 19 slides of the supplied `integration.pptx`.

The assignment on slide 19 is an industry map and presentation: choose one industry, map sources → integration → governance → outputs, present a flowchart, and place the industry in the comparative matrix. Examples of ETL, ELT, APIs, CDC, virtualization and Data Fabric are alternative approaches, not a requirement to implement all of them. Hotel-specific requirements in the reference SRS are formatting examples, not university requirements.

| Evidence | UniData coverage |
| --- | --- |
| Slides 3–7: integration, DQM and ETL | Schema validation, text/email normalization, duplicate-key policy, studentId reconciliation, atomic golden master and ETL reports. |
| Slide 8: method choices | Controlled batch ETL and same-origin API; alternative methods and latency/scale trade-offs explained in presentation. |
| Slides 9–13: governance, quality, ownership and outcomes | Server RBAC, field masking, scoped exports, append-only hash-chained audit, source responsibility map and human-reviewed warning indicators. Encryption, legal compliance and production controls are not claimed. |
| Slide 17: university sources and enrollment-to-alumni lifecycle | SIS, LMS, HR/payroll, Library and Alumni CRM mapped with business owners and explicit implementation status. Enrollment/learning implemented; graduation review uses credits/status/clearance context; alumni handoff is modeled. |
| Slide 18: comparative matrix | All five industries and the complete Education row retained in Course matrix and slides. |
| Slide 19: activity | Education selected; working source-to-output flowchart, comparative matrix and ten-slide classroom presentation supplied. |

Three feeds are implemented: SIS, LMS and Library. HR/payroll and Alumni CRM are modeled extensions. A source business owner does not create a new application role or approval workflow. No live Canvas, payroll, alumni, Data Fabric, legal certification, degree award or automated student decision is implied.

## Changes from this review

- The five-source responsibility map, lifecycle scope, and assignment traceability are in `frontend/lib/courseAlignment.ts`.
- Expanded Course matrix with the source/owner, integration, governance/output and implementation boundary.
- Added two presentation slides covering enrollment-to-alumni scope and integration trade-offs; presentation now contains ten slides.
- Created the SRS with the reference's college cover, short-bond page geometry, heading hierarchy, sign-off/history/preface, contents and lists, requirements, diagrams, verification and appendices.

## Verification

- 13 automated unit/store tests passed.
- 26 demo-mode live API checks passed against an isolated database.
- 27 account-mode live API checks passed against an isolated database.
- Production TypeScript/build completed. The installed Next.js version reported a known security advisory; dependency remediation remains outstanding.
- Updated presentation content is source/build reviewed; a fresh browser rehearsal is still required. Existing October UI captures in the SRS are labeled as prototype evidence and not substituted for November testing.
- Performance targets and production compliance/capacity remain explicit acceptance work.
