# UniData 360 course and product gap review

Reviewed 17 November 2026 against the original 19-slide course deck, the current code at `c6f2ae4`, the existing SRS and public documentation for established university applications.

The implemented paths passed the latest MVP verification. This review asks a different question: which capabilities are absent or incomplete? UniData demonstrates the assignment's integration pattern, and its role boundaries work. The largest remaining gaps are managing data quality as ongoing work, completing advising cases, and representing the university lifecycle beyond a current student snapshot.

## Course requirements and current evidence

The explicit activity is on slide 19: choose an industry, map sources → integration methods → governance → outputs, present a flowchart and contribute to the comparative matrix. Slides 17–18 describe the Education example. They do not explicitly require a deployed connection to every named vendor, every integration technology, a particular database or a complete university ERP. The user's request for a full system extends beyond the mapping assignment.

| Course evidence | Current implementation | Assessment |
| --- | --- | --- |
| Slide 19: select one industry | Education / Universities; school departments BSIT, BEED, BSED and BSHM. | Covered. |
| Slides 18–19: flowchart and comparative matrix | Pipeline flow, Course matrix, five-industry comparison and ten presentation slides. | Covered. |
| Slides 3–7: extraction, transformation and load | CSV/JSON import, validation, normalization, key deduplication, reconciliation and transactional master publication. | Working batch ETL demonstration. |
| Slide 8: integration approaches | Batch ETL through application APIs; presentation explains alternatives. | Method choice is explained. An internal import API is not a live Canvas/SIS vendor connector; no CDC, virtualization or Data Fabric is deployed. Implementing all approaches is not an explicit assignment requirement. |
| Slides 3, 12–13: quality validation, metadata and monitoring | Strict validation, reconciliation notices, presence-based health heuristic, saved ETL reports. | Partial operational coverage: no data catalog, per-field lineage, persistent quality issue queue or stewardship workflow. |
| Slides 3, 9, 11–13: governance, ownership, security and audit | Six roles, department/student scope, runtime field masking, governed exports, sessions, append-only audit chain; source responsibility map. | Technical controls are demonstrated. A masking matrix and audit trail do not establish institutional FERPA/GDPR compliance. Business owners are descriptive metadata rather than assigned operational stewards. |
| Slide 17: SIS, LMS, HR/payroll, Library and Alumni CRM | SIS, LMS and Library have stored feeds and ETL. HR and Alumni are mapped in `courseAlignment.ts`. | All five sources are mapped, but only three are integrated. Stronger lifecycle implementation would need the remaining relationships. |
| Slide 17: enrollment → learning → graduation → alumni | SIS enrollment status, academic summary, LMS courses and library clearance. | Enrollment/learning are represented as current data. Graduation has review context; alumni handoff is not implemented. |
| Slides 9, 12, 17–18: analytics and useful outcomes | GPA/program summaries, probation counts, warning rules, personal reports and saved follow-ups. | Useful outputs exist. No term history, measured retention, case resolution or outcome measurement. |
| Slide 17: siloed departments and secure student/faculty access | Department-assigned Deans; student self-access; staff permissions. | Department boundaries are implemented. There is no teacher/course-assignment workspace; that is a possible expansion, not a newly discovered mandatory role. |

Slide 13 is an image-only DQM/governance/integration diagram. It was visually inspected as well as extracting the text from the other slides. Its healthcare illustration is an example of the pattern, not a requirement to add medical features.

## Concrete gaps in this implementation

### 1 Advising stops after saving an open follow-up

`assignIntervention()` in [backend/store.ts](../backend/store.ts#L328) copies `student.advisorName` into a single open entry. It does not select or link an actual staff account. [Intervention](../shared/types.ts#L150) contains an ID, student ID, advisor name, creation date and Open/Resolved status, but the API only creates the entry. There is no resolution command, assignee inbox, notes, next action, due date, closure reason or case history.

The **Assign advisor** label therefore suggests more than the action performs. A working next release should link an assignee to a real user ID, record the reason and subsequent activity, and support Open → In progress → Resolved with a recorded outcome. Case notes should remain staff-only, with department and assigned-case permissions enforced on the server. A separate student-facing task or message should be explicit rather than exposing internal notes.

### 2 Quality results need definitions and a correction workflow

The pipeline starts `dataHealthScore` at 100 and subtracts 20 for missing LMS and 10 for missing Library. The dashboard calls that value **source completeness**. A local pure-function probe with one SIS record and no LMS/Library produced:

```text
Feeds present: 1 of 3
Displayed health score: 70
ETL status: SUCCESS
Missing-source notices: 2
```

This is a weighted heuristic, not the percentage of connected sources or validated fields. ETL success is also currently based on duplicate/orphan anomalies; missing-source notices can coexist with SUCCESS. See [pipeline scoring](../backend/etl/pipeline.ts#L86), [status calculation](../backend/etl/pipeline.ts#L203) and [dashboard label](../frontend/components/tabs/Student360Tab.tsx#L101).

Show processing status separately from data-quality status. Define each metric, show source presence and freshness explicitly, and explain how scores are calculated. Add persistent issues with a source/key, rule, severity, owner and resolution history. Invalid batches already reject atomically; an issue queue should preserve that behavior. Corrections should update staged source data or mappings, rerun ETL, and record resolution rather than editing the published master arbitrarily.

### 3 Historical academic data is absent

SIS and LMS records have no academic year/term identity. LMS keys are `studentId + courseCode`, so repeating a course in another term overwrites that logical key. The golden master is replaced on each ETL run; saved run reports do not retain every prior student state.

Introduce academic terms and term-scoped enrollment/course records before adding trends, year-to-year comparisons or retention. Retention needs a defined starting cohort, comparison period and outcome; the current active-enrollment count must continue to be labeled as a snapshot.

### 4 Graduation and alumni are presentation concepts

Library clearance and total credits can inform a review. There is no graduation review record, configured program requirements, review status, decision history, graduation date or linked alumni record. HR/payroll does not supply actual staff/advising relationships.

A bounded school demonstration could add synthetic staff/teaching/advising data, a Registrar graduation-review checklist, and an audited handoff to a minimal Alumni feed. HR records should join through staff IDs and assignments, rather than incorrectly using `studentId` for all sources. Do not invent school graduation rules or award degrees automatically. Model alumni contact preferences if outreach is introduced; payroll amounts are unnecessary for demonstrating the relationship.

### 5 Integration operations remain manual

All working sources enter through uploaded CSV/JSON. No source connection configuration, vendor authentication, scheduled extraction, retry history or source freshness monitor exists. The UI exposes the latest ETL report even though past reports are stored.

For a stronger EDM demonstration, add an adapter boundary and source status/run-history view. Independent synthetic source APIs can demonstrate extraction without access to a real school platform; identify them as simulated. Live Canvas or other vendor access requires genuine credentials and institutional authorization. Scheduling is useful operational scope, not a new mandatory course technology.

### 6 School conventions and documentation lag behind the code

The existing Word SRS still specifies SQLite, a combined Dean/Registrar role, one Next.js application and presentation access for all roles. The actual app uses PostgreSQL, separate frontend/backend services, six roles, student registration/recovery and an Admin Accounts workspace. The SRS needs a new version with current diagrams, endpoints, permissions, screenshots and verification evidence. It is intentionally ignored by Git because it contains course/personal details, so the presentation device also needs the final document transferred separately.

The app still requires SSN-format data and uses dollar fines, a 4.00 GPA scale and US year-level terms. The four departments are customized, but these conventions were inherited from the initial demonstration. Confirm the school's grading/term conventions before changing validation and risk thresholds; do not assume a grading scale. Use the school ID as the primary identity, configure currency and year labels, and keep any SSN masking example clearly separated as a course demonstration. Retain the FERPA/GDPR discussion required by the supplied matrix without claiming legal certification.

## Reference applications

These references were reviewed through public vendor documentation and university user guides, not access to private customer tenants. They inform product patterns; their complete feature sets and paid services are not assignment requirements.

| Reference | Documented behavior | Appropriate lesson for UniData |
| --- | --- | --- |
| [EAB Edify](https://eab.com/solutions/edify/) | Governed campus data warehouse/integration platform with metadata definitions, lineage, snapshotting, monitoring and role-based access. | The closest reference for the EDM core. Make data definitions, provenance, freshness and quality work visible. |
| [EAB Navigate360](https://eab.com/solutions/navigate360/), [UW–La Crosse case guide](https://kb.uwlax.edu/112704), [UNH workflow](https://td.usnh.edu/TDClient/60/Portal/KB/Article/4333/UNH-EAB-Navigate360-Case-Management-Process-and-Workflow) | Cases have assigned staff, activity/comments and closure outcomes. University guides show assigned-case filters and a case details view. | Turn a risk flag into owned work that can be tracked and closed. The publicly documented case-list screenshot was inspected: it separates student, reason, opened/updated dates, owner and assignees. Preserve UniData's current visual style while adopting the workflow. |
| [Ellucian Platform](https://www.ellucian.com/products/platform), [Data Connect solution sheet](https://www.ellucian.com/assets/en/solution-sheet/data-connect.pdf) | Role-oriented campus experiences and integration flows that support bulk/event-driven data and operational scheduling. | Separate staff responsibilities and source adapters; expose integration runs and source status instead of calling a file import a live vendor connection. |
| [Instructure analytics documentation](https://community.instructure.com/en/instructure/kb/articles/660583-what-is-intelligent-insights) | Students-needing-attention analytics with configurable indicators and course/student views. The documentation identifies Intelligent Insights as a legacy add-on with capabilities now in Canvas Plus/Next. | Make warning criteria and supporting evidence clear, with drill-down and an action path. Copy the useful interaction pattern, not a legacy product name or unsupported AI claim. |

EAB Navigate360 is the higher-education CRM referenced here. The separately branded `navigate360.com` school-safety product is a different product and was excluded from this comparison.

## Recommended next release

1. **Before presentation:** update the SRS; correct or define the quality labels; identify demonstration currency/grading conventions and all modeled/live boundaries.
2. **Complete EDM operations:** add a Data Quality workspace with issue ownership, correction/reprocessing, source definitions, per-field provenance, freshness and run history.
3. **Complete the student-support workflow:** real staff assignment, cases, notes, next actions, due dates, resolution and outcome counts. Add role-specific queues rather than more general dashboards.
4. **Extend the lifecycle:** term/enrollment history, synthetic HR relationships, graduation review and Alumni handoff. Build retention/trend outputs only once the relevant historical data exists.
5. **Then extend connectivity:** simulated source APIs first if no real vendor access is available, followed by authorized live adapters and scheduling as required.

A useful acceptance journey is: ingest conflicting or incomplete source data → inspect a quality issue → correct and republish → see the student's risk evidence → assign an actual advisor → record follow-up → resolve the case → review graduation clearance → create the alumni handoff. Each stage should leave evidence and enforce the same permissions in UI, API and exports.

UniData should remain an integration and governed decision-support hub. Course content authoring, a complete gradebook, payment processing and library circulation would normally belong to the upstream systems; adding them would substantially change the project scope.

## Review boundary

This pass inspected all course slide text, the image-only diagram, relevant source code, the Word SRS text and public product documentation/screenshots. The quality-score probe ran locally without a database. It did not change student data, broaden account access, deploy anything or implement the proposed expansions. Functional pass counts remain in [MVP verification](MVP_JOURNEYS.md); those checks cover existing behavior, while this report identifies absent capabilities.
