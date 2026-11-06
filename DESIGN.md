---
name: UniData 360
description: A light monochrome university workspace with a black rail, soft gray records and clear operational actions.
colors:
  canvas: "#f1f1f3"
  rail: "#111113"
  rail-active: "#2c2c31"
  secondary-button: "#f2f2f5"
  secondary-hover: "#e8e8ed"
  background: "#ffffff"
  surface: "#f5f5f7"
  surface-raised: "#ececef"
  line: "#e7e7eb"
  foreground: "#171719"
  muted: "#65656f"
  accent: "#202024"
  primary: "#171719"
  success: "#267053"
  warning: "#8a590d"
  danger: "#ae3349"
  white: "#ffffff"
  primary-hover: "#35353b"
  success-background: "#e5f4ec"
  warning-background: "#fff2d9"
  danger-background: "#fbe9ed"
typography:
  greeting:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "31px"
    fontWeight: 780
    lineHeight: 1.22
    letterSpacing: "-0.035em"
  insight-value:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "39px"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "-0.04em"
  display:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "36px"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.22
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 620
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.55
  mono:
    fontFamily: "Geist Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.55
  workspace-headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 740
    lineHeight: 1.22
    letterSpacing: "-0.035em"
  workspace-panel-title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 620
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  directory-title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 720
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  summary-value:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  sign-in-headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "38px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  sign-in-headline-mobile:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "29px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  sign-in-title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 620
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  sign-in-brand:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.03em"
rounded:
  frame: "28px"
  rail: "20px"
  welcome: "14px"
  record: "11px"
  record-action: "6px"
  badge: "5px"
  control: "8px"
  message: "10px"
  panel: "12px"
  dialog: "16px"
  circle: "50%"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  mobile-inset: "18px"
  section: "20px"
  panel: "24px"
  workspace-inset: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary-button}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "#fbe9ed"
    textColor: "#a12c42"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  badge-success:
    backgroundColor: "{colors.success-background}"
    textColor: "{colors.success}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  student-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "18px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  navigation-rail:
    backgroundColor: "transparent"
    textColor: "#bdbdc5"
    rounded: "{rounded.panel}"
    padding: "8px 2px"
    width: "66px"
  navigation-rail-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.white}"
  navigation-compact:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "10px 8px"
  navigation-compact-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
  risk-filter:
    textColor: "{colors.muted}"
    rounded: "{rounded.record-action}"
    padding: "6px 8px"
  risk-filter-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
  student-list-record:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.record}"
    padding: "16px 15px"
  record-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.record-action}"
    padding: "10px"
  directory-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  dialog:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.dialog}"
    padding: "0"
  sign-in-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "32px"
  sign-in-panel-mobile:
    padding: "24px"
  sign-in-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    height: "44px"
  sign-in-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "44px"
---

# Design System: UniData 360

## Overview

**Creative North Star: "The Connected University Desk"**

The supplied learning-dashboard reference establishes a light, monochrome university workspace: a white application workspace fills the browser viewport, with an inset black navigation rail. Soft gray records and confident black actions give operational data a friendly, composed rhythm.

Geist typography, compact labeled controls and generous separation between dashboard columns support UniData 360. Restrained green, amber and rose identify status; they accompany readable labels. Presentation, account access and modal tasks share the same light materials.

The user's supplied reference replaces the former navy identity. This document records the shipped CSS and component patterns; the frontmatter owns normative primitives. The final reference-led stylesheet section and scoped responsive overrides take precedence over inherited rules.

**Key Characteristics:**

- Full-width white workspace with a narrow black rail.
- Soft gray student rows, black record actions and a complementary statistics column.
- Bold greeting and large cohort counts above compact operational typography.
- Geist text, tabular metrics and Geist Mono identifiers.
- Visible keyboard focus, readable status labels and reduced-motion support.

## Colors

The palette is near-monochrome, supported by restrained semantic status hues.

### Primary

- **Ink action** (`primary`): filled operational buttons, record actions and selected filters, with white text. `primary-hover` supplies shared hover feedback.
- **Focus ink** (`accent`): shared keyboard outlines and inherited active details.
- **Rail black** (`rail`): the inset navigation surface; `rail-active` marks its selected item.

### Secondary

- **Forest status** (`success`), **amber status** (`warning`) and **rose status** (`danger`) indicate safe/success, moderate/pending and critical/error states. Each pairs with its corresponding pale background and readable label.

### Neutral

- **White workspace** (`background`): frame, dialogs and presentation slides; `white` also names inverse control text.
- **Pale canvas** (`canvas`): the outer page surround.
- **Soft record gray** (`surface`): greeting, records, panels and source health.
- **Raised gray** (`surface-raised`): inherited quiet hover surfaces and the selected governance role.
- **Fine gray** (`line`): field boundaries and dividers.
- **Reading ink** (`foreground`) and **supporting gray** (`muted`): primary content and secondary copy. Inactive chart tabs and the app footer use supporting gray. Text selection uses foreground ink on a pale gray fill.
- Secondary buttons use the distinct `secondary-button` and `secondary-hover` fills. Neutral and informational badges use gray.

**The Monochrome Anchor Rule.** Use black for primary actions and selected filters; reserve status hues for meaningful record or process states.

## Typography

**Display and Body Font:** Geist, supplied by `next/font/google`, with Arial and sans-serif fallbacks.

**Label/Mono Font:** Geist Mono for identifiers, with monospace fallback.

The hierarchy pairs a bold greeting and large counts with compact operational text. Observed component roles determine the scale. Metrics use tabular figures. Paragraphs retain a maximum width of 72ch; page descriptions use 66ch.

### Hierarchy

- **Display:** presentation headings use `display` (36px), reducing to 26px on narrow screens. Generic headings retain `headline` (28px) and `title` (18px).
- **Greeting:** `greeting` uses 31px, weight 780 and line height 1.22, reducing to 27px at 760px.
- **Workspace:** page titles use `workspace-headline` (28px, weight 740). Panel titles use `workspace-panel-title` (16px); directory titles use `directory-title` (19px, weight 720), reducing to 18px at 760px. Statistics headings use 18px, weight 720; source-health and attention headings use 17px.
- **Body:** the inherited baseline uses `body` (14px, line height 1.55). Page descriptions use 13px; greeting copy and ordinary operational data use 12px. Directory descriptions use 11px.
- **Records:** list names use 12px and weight 680, reducing to 11px at 760px. Metadata uses 10px, reducing to 9px. Black record actions use 9px, reducing to 8px. These are scoped compact details rather than the default label scale.
- **Labels:** `label` uses 12px, weight 550. Badges and metadata use 9–10px; rail labels use 9px. `mono` uses 11px, with student IDs scoped to 10px.
- **Metrics:** `insight-value` uses 39px, weight 760 and line height 1, reducing to 34px at 1200px and becoming 40px on mobile. Existing summary strips retain `summary-value` (30px, weight 600), with inherited responsive reductions.
- **Account access:** `sign-in-headline` is 38px, reducing to `sign-in-headline-mobile` (29px) at 760px. Form title uses 22px and standalone brand 21px. Introduction copy is 14px, benefit titles 13px, field labels 12px and footer 11px.

**The Scoped Hierarchy Rule.** Keep greeting and cohort counts prominent while using compact labeled type for records and controls.

## Layout

The white workspace fills the browser viewport at every breakpoint: 100% width, no maximum width, no outer margin or padding, no outer radius or shadow, and a 100dvh minimum height. Its left content inset is 132px. An absolutely positioned 86px rail sits 18px inside the frame and has a 700px minimum height; it belongs to the frame rather than staying fixed to the viewport. Header and workspace right padding is 34px; workspace top/bottom padding is 22px/28px.

The student dashboard uses a flexible main column and a 310px statistics column with a 36px gap. At 1550px and above, the statistics column becomes 340px with a 48px gap. Greeting and connected-record strip lead the main column, followed by directory controls, counted risk filters and records separated by 10px. The right column contains two counts, a GPA/attendance plot, source health and a short attention queue. Other tabs retain operational panels and divided summary strips.

At 1200px and below, the workspace remains full width, content inset becomes 118px, and rail width 80px with a 14px left inset. Workspace right padding becomes 24px. The dashboard uses a 280px statistics column and 24px gap. Separate row risk badges hide and readable status moves under identity.

At 1000px, dashboard columns stack. Insights first becomes a two-column grid: counters and source health occupy the left while statistics spans the right. At 960px, the rail hides and four named compact navigation choices appear. The workspace remains edge-to-edge with 24px left content inset. Compact navigation has a 44px minimum height.

At 760px, the frame fills the viewport, with no outer padding, radius or shadow. Content uses 18px horizontal insets, the header is static and identity controls have their own row. Compact navigation uses vertically arranged icon/label buttons with a 58px minimum height. Insights becomes one vertical sequence. Directory search spans the full width above program and sort controls; risk filters wrap. The default list remains a list. Card mode becomes one column and the view selector remains visible. Comparison tables scroll locally with a 680px minimum width.

Panels retain 24px body padding and 20px by 22px heading padding. Split panels and forms stack at 760px; pipeline connectors turn downward. Standard dialogs are limited to 640px wide, wide dialogs to 1050px, with 16px viewport gutters and internal scrolling. Presentation reaches 1440px wide and 94dvh high, switching to 8px gutters and 96dvh on narrow screens. Mobile slides start at the top; comparative tables keep local scrolling.

Sign-in retains a 1200px maximum width, 40px padding and 100dvh minimum height. Introduction and form have a 1.15-to-1 column ratio and 90px gap, reduced to 40px at 1050px. At 760px, content stacks with a 28px gap and 24px padding; benefits hide and the forced heading break clears. Brand/content spacing changes from 64px to 36px and the footer gap from 64px to 28px.

## Elevation & Depth

Ordinary rows, cards and panels use tonal separation and fine borders. The selected view segment uses a small local shadow (`0 1px 4px #0000000c`). Dialogs use structural elevation (`0 24px 80px #0003`) and a translucent backdrop (`#15151c66`).

**The Quiet Surface Rule.** Use tonal fills and fine separators for ordinary content. Reserve substantial elevation for the modal layer.

State feedback uses 160ms background, text and border-color transitions. Existing ETL progress and loading animation remain. Reduced-motion preferences remove animations, transitions and smooth scrolling.

## Shapes

The outer workspace has square edges; the inset rail retains its rounded silhouette. Welcome and source-health blocks are softly rounded; panels retain the shared 12px radius. List rows use 11px corners, controls 8px and record actions 6px. Badges use 5px; dialogs 16px. List avatars are rounded rectangles; dossier avatars and small indicators may remain circular. Fine borders define fields and tables; upload targets use dashed edges.

The greeting emblem is a Lucide graduation-cap SVG inside an outlined circle with small rotated SIS, LMS and Library tags. No illustration raster ships. The tags correspond to implemented feeds.

## Components

### Buttons

Shared controls have a 38px minimum height, 8px icon gap and 12px medium-weight labels. Primary actions are black with white text. Secondary actions use soft gray; quiet actions use supporting text on transparent fill. Destructive actions use pale rose fill and dark rose text with a fine rose border. Disabled controls use opacity 0.48 and a not-allowed cursor. Icon buttons are 36px squares with accessible names. No button translates or scales on hover.

Focus uses a 2px ink outline and 4px offset. Rail controls use a white outline with 3px offset against black.

### Chips

Badges remain distinct from interactive filters. Status badges pair semantic foregrounds and pale fills with readable labels; neutral and informational badges use gray. Counted directory filters have a black selected state, white text and explicit pressed state. Their minimum height is 34px, reducing to 32px on mobile. Reset filters stays visible when scope applies. The advisor-attention count toggles non-safe students and exposes a dismissible scope message.

### Cards / Containers

The default record is a soft gray whole-row dossier button with initials, identity, GPA, readable risk and a black **View record** treatment. Hover darkens the fill and adds a subtle edge. Repeating peach, lavender, green and ochre avatar tints distinguish initials without encoding risk. Narrow rows move risk into identity text. Optional card mode retains the same content in a two-column grid, reducing to one column on mobile, with 18px card padding. Table mode compares identity, program, GPA, attendance, clearance and risk while preserving named dossier and sort controls.

The greeting block pairs personal copy with the source emblem. Connected records use a white icon tile and source-completeness copy. Counts and source health share the soft-gray material. Generic panels retain heading/body separation; other tabs keep divided summary cells.

### Inputs / Fields

Inputs, selects and textareas use white fill, foreground text, a fine gray border, 8px corners and at least 40px height with 9px by 12px padding. Directory fields use soft-gray fill and transparent borders. Search has a leading SVG, 40px left inset and a named clear action. Preserve visible labels or accessible names. Errors use feedback messages and validation text; no separate error-border field variant is established.

### Navigation

The black rail starts with a compact **U.** home mark, followed by labeled SVG buttons for Students, Pipeline, Analytics and Governance. Active fill is charcoal with white text; hover adds charcoal feedback. Course matrix and account controls occupy the lower area. Rail buttons are 66px wide and at least 65px high, narrowing to 60px at 1200px.

The header retains UniData 360, current location, Present, Run ETL and actor controls. Location hides at 1200px. At 960px compact navigation and course/account controls replace the rail. Selected compact navigation is black with white text. At 760px Present and Run ETL hide visible labels but retain accessible names. Account mode keeps the assigned **Account role** readable in a disabled selector; demo mode permits **Demo persona** switching.

### Cohort Statistics

The black line plot switches between cumulative GPA and LMS attendance through labeled, underlined metric buttons. It plots permitted records in alphabetical student order, with initials, a 0–4 GPA scale or 0–100 attendance scale, point titles and a full accessible chart description. Attendance omits records without enrolled LMS courses. Captions identify metric and aggregate; empty scope receives an explicit message. This is a current cohort snapshot, not a longitudinal prediction. The attention queue opens the two lowest-GPA flagged records available in scope.

### Account Access

Sign-in extends shared light surfaces and black primary actions. Panel padding is 32px, reducing to 24px at 760px. Fields and submit have a 44px minimum height; form rows have an 18px gap and labels a 7px field gap. Pending submission disables fields and changes the action to **Signing in…**. Errors appear above the form in the rose alert message. An active session replaces credentials with **Open workspace**. Administrator help remains below; available demo access uses a separate divided row.

### Presentation and Dialogs

Native dialogs retain Escape behavior, sticky headings, named close controls and scrolling bodies. Dossier identity and report actions wrap; Download PDF and Export JSON remain reachable. Presentation retains persistent navigation, slide selector, keyboard controls, fullscreen and optional speaker notes. Fullscreen targets the document root to preserve the native modal top layer. Desktop slide dots supplement the selector and hide on mobile. Wide comparative tables scroll locally.

**The Reachable Content Rule.** Responsive layouts must keep content beginnings and controls reachable; stack pipeline stages and top-align overflowing mobile slides.

## Do's and Don'ts

### Do:

- **Do** reuse the white, gray and black materials across workspace, presentation and account surfaces.
- **Do** pair status colors with explicit readable labels.
- **Do** plot GPA or attendance from records available to the current role and label the metric and scale.
- **Do** retain tabular figures for comparable metrics and Geist Mono for identifiers.
- **Do** preserve visible focus, native dialogs, reduced motion and local table scrolling.

### Don't:

- **Don't** reintroduce the former navy palette into new surfaces.
- **Don't** add prominent shadows to ordinary records or panels.
- **Don't** treat avatar tints as risk categories or invent additional source feeds.
- **Don't** replace named controls or status labels with unexplained icons.
- **Don't** center overflowing mobile slide content so its beginning becomes unreachable.
