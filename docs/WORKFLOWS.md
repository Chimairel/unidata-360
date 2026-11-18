# Data quality and advising workflows

UniData now supports two operational workspaces alongside the existing pipeline, student records and analytics. They use the same shared PostgreSQL database and fixed account roles. Frontend remains on 3005 and backend on 3006.

## Access

| Role | Data quality | Advising cases |
| --- | --- | --- |
| Registrar | Inspect, assign a Registrar steward, stage corrections and run ETL | Create, assign and manage school-wide cases |
| Dean | No access to the source-quality workspace | Assigned department only; assign eligible staff and manage follow-up |
| Academic Advisor | No access to source-quality workspace | Assigned cases, cases they opened and unassigned referrals; claim an unassigned referral or manage their assigned cases |
| Compliance Auditor | Read-only issues, source metadata and run history | No case notes or case-management access |
| Student | No access | No access; personal records and reports remain available |
| System Admin | No student-data access | No student-data access; staff account management remains separate |

Both workspaces require an actual staff account. Classroom demo personas do not substitute for staff identity. Advisors may assign cases to themselves only; Registrar and Dean can assign active Registrar/Advisor staff or a Dean from the student's department. API checks independently enforce these rules. An advisor who opened a case can continue reviewing it after reassignment, while the assigned advisor or leadership manages its follow-up.

## Data quality journey

1. Sign in as Registrar and open **Data quality**. On an existing database, run **Run ETL and recheck** once to initialize checks. This publishes the current staged sources using the same explicit ETL action as Pipeline.
2. Inspect missing LMS/Library records and LMS/Library keys with no matching SIS student. The four checks are relationship/completeness checks, not a general accuracy or legal-compliance score.
3. Assign an active Registrar as steward, mark work In progress, and record a steward note. A business source owner (Library services or Academic departments) remains separate from the app's accountable Registrar steward.
4. For an unlinked record, choose the correct existing SIS identity and **Stage identity correction**. Destination-key collisions are rejected instead of overwriting another record. If the SIS identity is itself missing, import/publish it first.
5. For a missing or incorrect source record, upload a corrected CSV/JSON feed using the existing Pipeline templates. Validation rejects an invalid batch without partial writes. Importing does not publish the master.
6. Run ETL again. Checks that now pass resolve automatically, with a timestamp, history and audit event. A steward cannot manually declare a still-failing check resolved. If the failure reappears, its stable issue record reopens with the previous history preserved.

The queue supports source/status/search filters. Resolved issues remain available. The source catalog identifies business ownership and keys. Receipt metadata records who staged each key, its receipt time and import revision; legacy records retain an explicit unknown receipt time instead of inventing a date. Field lineage identifies which source groups provide identity/enrollment/GPA, learning results and library clearance, and distinguishes staged receipt metadata from the last master publication. It does not retain a full versioned history of every field value.

Source completeness now means the fraction of the three feeds present: SIS only = 33%, SIS plus one feed = 67%, all three = 100%. Missing LMS data is still treated as missing data rather than evidence of zero attendance. A processing result can be **Completed with notices**; that does not mean the source data passed every quality check. Run history exposes the latest 30 stored ETL reports.

## Advising journey

1. From the early-warning radar, select **Open support case** or **Review case**, or open **Cases** directly.
2. Create a case with the student, a real active responsible staff account, concern, priority and optional due date. There is one continuous support case per student. Reopen an existing case for further support rather than overwriting its history.
3. The assigned advisor records an internal note and changes the case to In progress. Registrar or the student's department Dean can coordinate the same case. Unassigned referrals must be assigned before follow-up is recorded.
4. Resolve the case with an outcome of at least five characters. Reopening requires an explanatory note. Previous outcomes and status changes remain in activity history.
5. Filter the queue by status, search or **Assigned to me**. Active, resolved and overdue counts are computed within the current permitted case set.

Old saved follow-ups remain in the queue as legacy referrals. They need a real staff assignment before being managed through the new workflow. The compatibility follow-up command never overwrites an existing case, its notes or its history.

Cases are internal coordination records. Saving a note, assignment or outcome does not email staff or students. Student and auditor responses withhold case notes; the main academic snapshot contains permitted case summaries only. Case creation and changes append attributed audit events. This workflow supports human review and does not change grades or make eligibility decisions.

## Verification

`npm run test:workflows` requires disposable, isolated `EDM_TEST_DATABASE_URL`, production builds and free ports 3005/3006. It starts both services and checks role restrictions, real assignment, private notes, department boundaries, closure/reopening, staged correction, collision rejection, ETL resolution, source revision metadata and audit integrity. The regular test suite includes database and pure-rule coverage for these workflows.

Academic-term history, HR/Alumni feeds, graduation review, real vendor connectors, institutional grading conventions and the next Word SRS version remain separate work described in the course/product review. These additions complete the quality and advising phase of that plan.
