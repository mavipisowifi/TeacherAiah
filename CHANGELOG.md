# Changelog

All notable changes to TEACHERaiah are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-09-11

### Changed — DepEd trimester (three-term school calendar)

Following **DepEd Order No. 009, s. 2026** (Three-Term School Calendar for Basic
Education, SY 2026–2027), every K–12 section now runs on **three terms — Term 1,
Term 2, and Term 3** — replacing the previous two-semester model.

- **Every grade, K to Senior High, gets three separate timetables.** A term switch
  on the schedule and teacher-schedule views flips between Term 1, 2, and 3, and each
  term is generated, hand-edited, and printed independently.
- **Any subject can be limited to a single term.** When adding or editing a subject —
  in any grade, Kindergarten through Senior High — you can now choose a Term (Term 1, 2,
  or 3) or leave it on **All terms**. A subject pinned to a term is scheduled, hand-edited,
  and printed only in that term; a subject left on All terms repeats in every term, so
  existing subjects are unaffected.
- **Printing covers all three terms.** Printing one section — or a whole room — now
  produces a page per term (Term 1 · 2 · 3), and conflict checking is done within
  each term.
- **Your existing data is kept.** Sections you built under the old two semesters
  become Term 1 and Term 2 untouched, and a blank Term 3 is added for you to fill;
  nothing you scheduled before this release changes.

### Added — Sample data & quick-reset shortcuts

Two keyboard shortcuts make it easy to try the app or reset it for a fresh
demonstration, without wiring anything up by hand.

- **Shift + F2 — Load random sample data.** Instantly fills K–12 with a built-in
  example school, freshly generated on every press so it's never the same twice.
  Each press also rolls a **size — small, half, or full**: a small one is a single
  grade with a section or two, while a full one spans several grades (always
  including a Senior High grade) with multiple sections each. The data is realistic
  — real subjects and teachers, one subject shared by two teachers, and for Senior
  High the Core, Applied, Elective and strand subjects — with fully generated,
  conflict-free timetables for all three terms, so there's always something to look
  at right away.
- **Shift + F1 — Clear all K–12 data.** Empties every subject, teacher, room and
  section in one step. Both shortcuts ask for confirmation before replacing or
  erasing anything, and both leave Tertiary (college / university) data untouched.

### Added — Senior High School electives

Following the DepEd sample Senior High schedule (**DepEd Order No. 009, s. 2026**,
Annex A, Table 6 for Key Stage 4 — e.g. *Human Movement 1 (Elective)*), Senior High
subjects can now be marked as an **Elective**.

- **New "Elective (all strands)" strand category.** When adding or editing a Grade 11
  or 12 subject, the Strand choice now offers **Elective** alongside Core and Applied.
  Like Core and Applied, an elective is taken by every section of the grade regardless
  of strand, and it carries its own **Elective** badge on subject cards, the schedule,
  and printouts so it reads apart from Core and Applied subjects.
- **Schedules the same way as any subject.** An elective is auto-generated, hand-edited,
  conflict-checked, and printed exactly like other subjects, and it obeys the same
  one-teacher-per-subject rule and per-term pinning. K–10 grades are unaffected.

### Added — College & University scheduling (Tertiary mode)

TEACHERaiah now schedules **colleges and universities** alongside K–12. A switch
in the sidebar flips between two completely separate systems that share only the
app theme, printing, and backup file — your basic-education data and your tertiary
data never touch.

- **Top-level K–12 ⇄ Tertiary mode switch.** Existing K–12 data is preserved and
  migrated untouched; nothing you built before this release changes.
- **Programs, Courses, Faculty, Rooms, and Block Sections.** Model a degree program
  (e.g. BSIT), its courses (with units and lecture / laboratory hours), the faculty
  who teach them, lecture rooms and laboratories, and block sections (e.g. BSIT 1-A)
  that take a set of courses together.
- **Terms.** 1st Semester, 2nd Semester, and Summer / Midyear, each with its own
  timetable per block.
- **One-click generation on day patterns.** Lecture hours become MWF / TTh blocks
  and lab hours meet as a longer session in a laboratory room, placed within your
  configurable day window — never double-booking a faculty member or a room.
- **Hand-editing.** Click any meeting to change its course, instructor, room, day,
  or time, or click an empty part of a day to add one.
- **Live faculty loads and clash detection.** See each instructor's weekly hours
  (against an optional cap) and every faculty / room / block conflict for the term.
- **Printing.** Print one block's weekly timetable or every block for a term, as a
  colour-coded merged time-slot grid that mirrors the K–12 print style.

### Added — earlier, now shipping in this release

- **About & version.** The Appearance & Data screen shows developer info and the
  live app version, and the version also appears in the sidebar footer.

### Added — K–12 conflict report

- **Check Conflicts button.** The sidebar now has a live **Check conflicts**
  button (visible from every K–12 tab) that shows a running count and opens a
  single consolidated report of every teacher double-booking — who, when, and the
  two sections involved — instead of leaving the count passive in the footer.
- **One-click fixes.** Fix a single clash from its report entry, or **Fix all
  conflicts** to re-stagger every shared teacher into a free period at once.
- **Conflicting cells are highlighted.** In a classroom's editing grid, the exact
  clashing period cells are ringed in red and marked, so a conflict is easy to
  spot in place (printed copies stay clean).


## [1.0.0]

Initial release — automated class-program maker for K–12 teachers on every campus
(Kindergarten to Senior High).

- Global subjects with per-week or per-month meeting frequency; teachers own the
  subjects they teach, and a subject can be shared across teachers.
- One-click, conflict-free schedule generation with a staggered diagonal across a
  grade's sections, plus side-by-side hand-editing of any period.
- Per-grade bell schedules with optional Friday activity period and early dismissal.
- Senior High strands (10 DepEd strands + Core / Applied) and per-semester programs.
- Teacher conflict detection with a one-click fixer, auto-generated individual
  teacher schedules, colour themes, PDF export, and JSON backup / restore.
