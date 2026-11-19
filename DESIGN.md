---
name: UniData 360
description: A monochrome university workspace with Mercury typography, liquid accents and light and dark themes.
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
  on-primary: "#ffffff"
  dark-background: "#0b0b0d"
  dark-surface: "#19191d"
  dark-surface-raised: "#27272d"
  dark-line: "#36363d"
  dark-foreground: "#f4f4f5"
  dark-muted: "#b5b5bf"
  dark-accent: "#e6e6eb"
  dark-primary: "#f4f4f5"
  dark-on-primary: "#151517"
  dark-primary-hover: "#d6d6de"
  dark-success: "#8fdbb2"
  dark-warning: "#f2c778"
  dark-danger: "#ff9aad"
  dark-success-background: "#163a2b"
  dark-warning-background: "#3b2e16"
  dark-danger-background: "#421f2a"
  mercury-light: "#dedee4"
  mercury-dark: "#bcbcc6"
  dark-mercury-light: "#9b9b9f"
  dark-mercury-dark: "#45454a"
  field-underline: "#75757f"
  dark-field-underline: "#858590"
typography:
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
    fontSize: "clamp(1.875rem, 4vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  workspace-panel-title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 740
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  directory-title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 740
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  summary-value:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  sign-in-headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  sign-in-headline-mobile:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.04em"
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
  sign-in-action: "16px"
  sign-in-drop: "20px"
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
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    padding: "0"
  sign-in-input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "0"
    padding: "12px 0"
    height: "56px"
  sign-in-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sign-in-action}"
    padding: "8px 14px"
    height: "58px"
  sign-in-action-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-on-primary}"
  theme-toggle:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "44px"
---

# Design System: UniData 360

## Overview

**Creative North Star: "The Connected University Desk"**

The supplied learning-dashboard reference establishes a light, monochrome university workspace: a white application workspace fills the browser viewport, with an inset black navigation rail. Soft gray records and confident black actions give operational data a friendly, composed rhythm.

Geist typography, compact labeled controls and generous separation between dashboard columns support UniData 360. Restrained green, amber and rose identify status; they accompany readable labels. Light remains the default; the persistent dark theme maps the same workspace, presentation, account and modal roles to dark neutrals and contrasting actions.

The 21st.dev MercuryLogin design sets the visual direction across UniData. Bold Geist titles mark the current task, compact section headings organize records and tables, and underlined fields and rounded primary actions connect account access to the workspace. The liquid accent moves behind account forms and rests behind workspace headings.

The user's supplied reference replaces the former navy identity. The frontmatter owns normative primitives. The final reference-led stylesheet section and scoped responsive overrides take precedence over inherited rules. This merge records the requested sign-in replacement and themes only; unrelated pre-existing documentation/layout drift has been preserved rather than rescanned.

**Key Characteristics:**

- Full-width white workspace with a narrow black rail.
- Soft gray student rows, black record actions and a complementary statistics column.
- Bold greeting and large cohort counts above compact operational typography.
- Geist text, tabular metrics and Geist Mono identifiers.
- Default light theme, persistent dark choice and a MercuryLogin sign-in entrance.
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

**The Monochrome Anchor Rule.** Use black for primary actions and selected filters in light mode, reversing their contrast in dark mode; reserve status hues for meaningful record or process states.

### Theme Mapping

The unprefixed tokens describe light mode. Under `data-theme="dark"`, the `dark-` tokens map to the corresponding CSS roles: background, surface, raised surface, line, foreground, muted, accent, primary, on-primary, hover and semantic status. Primary actions reverse to pale fill and dark text; readable semantic labels retain their brighter status colors over dark status fills. The black rail and workspace structure remain. Mercury backdrop endpoints and sign-in underlines have their own theme pairs.

The account and workspace headers expose a named moon/sun theme toggle. It stores the selection under `unidata-theme` in localStorage, restores it before the page becomes interactive and synchronizes other tabs. A new visitor starts in light mode. Switching still works when storage is unavailable; persistence then cannot be guaranteed.

## Typography

**Display and Body Font:** Geist, supplied by `next/font/google`, with Arial and sans-serif fallbacks.

**Label/Mono Font:** Geist Mono for identifiers, with monospace fallback.

The hierarchy pairs a bold greeting and large counts with compact operational text. Observed component roles determine the scale. Metrics use tabular figures. Paragraphs retain a maximum width of 72ch; page descriptions use 66ch.

### Hierarchy

- **Display:** presentation headings use `display` (36px), reducing to 26px on narrow screens. Generic headings retain `headline` (28px) and `title` (18px).
- **Workspace:** page titles and greetings use uppercase `workspace-headline` (30–52px, weight 800). Panel, directory, insight and dialog titles use 18px Geist at weight 740 for a clear second level.
- **Body:** the inherited baseline uses `body` (14px, line height 1.55). Page descriptions use 13px; greeting copy and ordinary operational data use 12px. Directory descriptions use 11px.
- **Records:** list names use 12px and weight 680, reducing to 11px at 760px. Metadata uses 10px, reducing to 9px. Black record actions use 9px, reducing to 8px. These are scoped compact details rather than the default label scale.
- **Labels:** `label` uses 12px, weight 550. Badges and metadata use 9–10px; rail labels use 9px. `mono` uses 11px, with student IDs scoped to 10px.
- **Metrics:** `insight-value` uses 39px, weight 760 and line height 1, reducing to 34px at 1200px and becoming 40px on mobile. Existing summary strips retain `summary-value` (30px, weight 600), with inherited responsive reductions.
- **Sign-in:** the uppercase `sign-in-headline` is stacked within 4ch (64px, weight 800, line height 0.92), reducing to `sign-in-headline-mobile` (56px) at 760px. Fields use 17px text and 12px muted labels. The shared account-header brand uses 20px; helper links use 14px.

**The Scoped Hierarchy Rule.** Keep greeting and cohort counts prominent while using compact labeled type for records and controls.

## Layout

The white workspace fills the browser viewport at every breakpoint: 100% width, no maximum width, no outer margin or padding, no outer radius or shadow, and a 100dvh minimum height. Its left content inset is 132px. An absolutely positioned 86px rail sits 18px inside the frame and has a 700px minimum height; it belongs to the frame rather than staying fixed to the viewport. Header and workspace right padding is 34px; workspace top/bottom padding is 22px/28px.

The student dashboard uses a flexible main column and a 310px statistics column with a 36px gap. At 1550px and above, the statistics column becomes 340px with a 48px gap. Greeting and connected-record strip lead the main column, followed by directory controls, counted risk filters and records separated by 10px. The right column contains two counts, a GPA/attendance plot, source health and a short attention queue. Other tabs retain operational panels and divided summary strips.

At 1200px and below, the workspace remains full width, content inset becomes 118px, and rail width 80px with a 14px left inset. Workspace right padding becomes 24px. The dashboard uses a 280px statistics column and 24px gap. Separate row risk badges hide and readable status moves under identity.

At 1000px, dashboard columns stack. Insights first becomes a two-column grid: counters and source health occupy the left while statistics spans the right. At 960px, the rail hides and four named compact navigation choices appear. The workspace remains edge-to-edge with 24px left content inset. Compact navigation has a 44px minimum height.

At 760px, the frame fills the viewport, with no outer padding, radius or shadow. Content uses 18px horizontal insets, the header is static and identity controls have their own row. Compact navigation uses vertically arranged icon/label buttons with a 58px minimum height. Insights becomes one vertical sequence. Directory search spans the full width above program and sort controls; risk filters wrap. The default list remains a list. Card mode becomes one column and the view selector remains visible. Comparison tables scroll locally with a 680px minimum width.

Panels retain 24px body padding and 20px by 22px heading padding. Split panels and forms stack at 760px; pipeline connectors turn downward. Standard dialogs are limited to 640px wide, wide dialogs to 1050px, with 16px viewport gutters and internal scrolling. Presentation reaches 1440px wide and 94dvh high, switching to 8px gutters and 96dvh on narrow screens. Mobile slides start at the top; comparative tables keep local scrolling.

Account pages share a centered form beneath the same header and liquid backdrop. Sign-in uses a 440px shell with a stacked title and 28px row gaps. Registration and recovery use a 560px shell with 32–48px titles and 16px row gaps. At 760px and below the horizontal inset is 28px and longer account headings use 32–44px type. The workspace uses a static liquid accent that fades into the canvas behind the heading area.

## Elevation & Depth

Ordinary rows, cards and panels use tonal separation and fine borders. The selected view segment uses a small local shadow (`0 1px 4px #0000000c`). Dialogs use structural elevation (`0 24px 80px #0003`) and a translucent backdrop (`#15151c66`).

**The Quiet Surface Rule.** Use tonal fills and fine separators for ordinary content. Reserve substantial elevation for the modal layer.

State feedback uses 160ms background, text and border-color transitions. Existing ETL progress and loading animation remain. Reduced-motion preferences remove animations, transitions and smooth scrolling.

Sign-in alone uses six blurred gray gradient blobs combined through an SVG goo filter, with backdrop opacity 0.48 in light and 0.38 in dark. They drift over 24s or 30s with staggered delays; mouse movement adds small background parallax. The submit wrapper applies the same local goo filter to its button and decorative drop. Hover or keyboard focus expands the drop with a 400ms transition; the wrapper retains a separate 2px focus outline with 6px offset. Pending submission prevents the expansion. Reduced motion stops backdrop drift, parallax and drop expansion.

## Shapes

The outer workspace has square edges; the inset rail retains its rounded silhouette. Welcome and source-health blocks are softly rounded; panels retain the shared 12px radius. List rows use 11px corners, controls 8px and record actions 6px. Badges use 5px; dialogs 16px. List avatars are rounded rectangles; dossier avatars and small indicators may remain circular. Fine borders define fields and tables; upload targets use dashed edges.

The greeting emblem is a Lucide graduation-cap SVG inside an outlined circle with small rotated SIS, LMS and Library tags. The tags correspond to implemented feeds. Sign-in uses circular gray liquid blobs, square underlined fields and a rounded (16px) submit action with a decorative drop (20px corners). The former campus raster is removed.

## Components

### Buttons

Shared controls have a 38px minimum height, 8px icon gap and 12px medium-weight labels. Primary actions are black with white text in light mode and pale with dark text in dark mode. Secondary actions use soft gray; quiet actions use supporting text on transparent fill. Destructive actions use pale rose fill and dark rose text with a fine rose border, mapped to dark rose surfaces in dark mode. Disabled controls use opacity 0.48 and a not-allowed cursor. Icon buttons are 36px squares with accessible names. Shared buttons remain stationary; sign-in's decorative submit drop has the scoped liquid response described below.

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

The header retains UniData 360, current location, Present, Run ETL and actor controls, plus a theme toggle. The same toggle appears in account navigation. It is a bordered 44px square, reducing to 40px in the mobile workspace header, and names its next action (**Use dark theme** or **Use light theme**). Location hides at 1200px. At 960px compact navigation and course/account controls replace the rail. Selected compact navigation follows primary/on-primary colors. At 760px Present and Run ETL hide visible labels but retain accessible names. Account mode keeps the assigned **Account role** readable in a disabled selector; demo mode permits **Demo persona** switching.

### Cohort Statistics

The black line plot switches between cumulative GPA and LMS attendance through labeled, underlined metric buttons. It plots permitted records in alphabetical student order, with initials, a 0–4 GPA scale or 0–100 attendance scale, point titles and a full accessible chart description. Attendance omits records without enrolled LMS courses. Captions identify metric and aggregate; empty scope receives an explicit message. This is a current cohort snapshot, not a longitudinal prediction. The attention queue opens the two lowest-GPA flagged records available in scope.

### Account Access

Sign-in adapts the supplied MercuryLogin template to real school-ID/staff-email authentication. Transparent fields use a single fine underline, square corners, 12px vertical padding and a 56px minimum height; focus strengthens the underline to the foreground color while retaining visible keyboard focus. The full-width submit action is at least 58px high, with 16px corners and weight 750. Its localized SVG-filtered drop expands on hover and keyboard focus without moving the button label; reduced motion keeps it still.

Pending submission disables fields and changes the action to **Signing in…**. Errors appear above the form in the semantic alert message. An active session replaces credentials with **Open workspace**. Student registration, student password recovery and administrator help remain below; available demo access uses a separate divided row. The backdrop is decorative and hidden from assistive technology. Theme selection carries into registration, recovery and permitted workspaces.

### Presentation and Dialogs

Native dialogs retain Escape behavior, sticky headings, named close controls and scrolling bodies. Dossier identity and report actions wrap; Download PDF and Export JSON remain reachable. Presentation retains persistent navigation, slide selector, keyboard controls, fullscreen and optional speaker notes. Fullscreen targets the document root to preserve the native modal top layer. Desktop slide dots supplement the selector and hide on mobile. Wide comparative tables scroll locally.

**The Reachable Content Rule.** Responsive layouts must keep content beginnings and controls reachable; stack pipeline stages and top-align overflowing mobile slides.

## Do's and Don'ts

### Do:

- **Do** reuse the monochrome materials and their theme mappings across workspace, presentation and account surfaces.
- **Do** use the shared Mercury account layout for sign-in, registration and recovery. Use the still liquid accent in workspaces and preserve field labels, keyboard focus and reduced motion in both themes.
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
