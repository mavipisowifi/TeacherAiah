# TEACHERaiah

**TEACHERaiah** is a Windows desktop app that automates weekly **class program** creation for teachers — on any campus, from **Kindergarten to Senior High School**. Create your **subjects** first (each one picks its grade level and how many days a week it meets), add your **teachers** and link each one to the subjects they teach, set your **schedule times** for each grade, set up your **Grade Level Rooms** and their classrooms — then **click one button** and the app builds the whole color‑coded schedule for you — no dragging, no building it cell by cell (though you can still hand‑edit any cell whenever you want). It staggers each subject across the week and leaves free periods as **rest time for the teacher**, just like a real class program. You also get an **auto‑generated personal schedule for every teacher** and one‑click **Print / Save as PDF**.

It's made to take the hassle out of schedule‑making for busy teachers — especially in large public schools with many teachers and classrooms.

**Now for colleges and universities, too.** A single switch in the sidebar flips the whole app between **K–12** and **Tertiary** mode. Tertiary mode is a separate scheduling system built for higher education — **programs, courses, faculty, rooms, and block sections** — that schedules on real college **day patterns** (MWF / TTh) across a flexible day window, with **units and lecture/laboratory hours**, up to three **terms** (two semesters plus Summer/Midyear), and full **room booking with clash detection**. The two systems keep their data completely apart (only the app theme, printing, and backups are shared), so your basic‑education schedules and your college schedules never touch. See **[College & University scheduling](#college--university-scheduling-tertiary-mode)** below.

Built with **Electron + React + Tailwind CSS**. All data is saved locally on the PC (no account, no internet needed).

---

## What it does

- **Subjects (created first, shared everywhere).** In the **Subjects tab** you create each subject with **Subject Name**, **Subject Code** *(optional)*, **Grade Level**, and how often it meets, plus a color. Most subjects meet **per week** (1–5 days, default **4** — leaving a free day as rest time in that classroom). Subjects that only meet a few times a **month** (e.g. Values Education, Guidance) can instead be set to **per month** (1–4 times): the app reserves one weekly slot for them, places it on any free day, and stamps the cell with its real cadence (e.g. `2×/mo`) so the printed program stays honest. A subject belongs to its grade level and automatically links to **every classroom of that grade**, so you never re‑enter it per room. You don't pick a teacher here — teachers are linked to subjects in the next tab. The list is **grouped and sorted by Grade Level**, and grade levels are organized into the four campus **categories**: Preschool (Kindergarten), Grade School (Grades 1–6), Junior High School (Grades 7–10), and Senior High School (Grades 11–12).
- **Senior High strands & semesters.** For **Senior High** subjects (Grades 11–12) the Subjects form adds two more choices: a **Strand** and a **Semester**. Pick **Core (all strands)** or **Applied (all strands)** for a subject every SHS section takes — *Core* for the common core subjects (e.g. Oral Communication, PE) and *Applied* for the contextualized **Applied Track** subjects (e.g. English for Academic & Professional Purposes, Practical Research, Empowerment Technologies) — or one of the **DepEd strands** — STEM, ABM, HUMSS, GAS, the four TVL strands (Home Economics, ICT, Agri‑Fishery Arts, Industrial Arts), Sports, or Arts and Design — to limit it to sections of that strand. Choose **1st Semester** or **2nd Semester** for a subject that runs in only one term, or **Both semesters** for one that runs all year. Each Senior High section then keeps a **separate program for each semester** (with its own subjects), and a **1st / 2nd Semester** switch lets you generate, preview, and print each term on its own. Kindergarten through Grade 10 are unaffected — they have no strand or semester and work exactly as before.
- **Subject Teachers.** Add each teacher's Last Name, First Name, **Home / advisory grade**, and whether they're a **Moderator** (can be a section adviser for Homeroom) or **Non‑moderator**, then **link the subjects they teach** — a teacher can pick subjects from **any grade level** (e.g. a Grade 11 teacher who also handles a Grade 12 subject). The home grade is only for advisory/Homeroom; the teaching load comes entirely from the subjects you link. **A subject can be shared by several teachers** — when it is, the app splits that subject's sections evenly among them (a round‑robin), so no one is overloaded. A section can only be generated once **every subject it takes** has at least one teacher.
- **Grade Level Rooms.** Everything is organized under a **Grade Level Room** (e.g. *Grade 1*), grouped by campus category. Inside a room you create one or more **Classrooms (Sections)**, each with an adviser. Every section of a grade takes that grade's subjects. For a **Senior High** room, each section also picks a **Strand** — it then takes that strand's subjects plus all the shared **Core** subjects, kept separate for each semester.
- **Schedule Times (per grade).** In the **Schedule Times tab** you set each grade's daily bell schedule — the start time and how long **Homeroom**, each **class period**, **Recess**, **Lunch**, and **Dismissal** last (any break set to 0 is removed). A live preview shows the exact time column, and you can copy one grade's times to a whole category or to every grade at once. Whatever you save here is exactly what the generator uses for that grade.
- **Optional Friday tweaks (per grade).** Right in the Schedule Times tab, each grade can turn on two **Friday‑only** options — both off by default, and Monday–Thursday are never touched. A **Friday activity period** reserves a no‑class block (e.g. for **club meetings**) at a time you choose (default **1:30–2:30 PM**, with a customizable start, length, and label); the generator leaves it free and the printed grid shows it on Friday. An **early dismissal** ends Friday at a time you set (default **2:30 PM**) — no class is scheduled at or after it, and the freed Friday slots are marked *Early dismissal*. Because not every grade has these, you enable them per grade (and can copy them along with the rest of the bell schedule to a whole category or every grade).
- **One‑click automatic scheduling.** Open a classroom (or a whole room) and press **Generate**. TEACHERaiah fills the weekly program automatically: each subject is placed on its **set number of days per week** (default 4), kept in the **same period across those days** (e.g. *Gen. Math* in the 8:30 row, Mon–Thu — each day in its own cell, exactly like the reference sheet) with the remaining day(s) left **blank as rest time** for the teacher — with Homeroom, Recess, Lunch, and Dismissal bands placed for you. Press **Regenerate** anytime to rebuild the week from the current subjects, teachers, and times.
- **Hand‑edit any cell, too.** Automatic generation and manual editing work side by side. Open a classroom and its weekly grid is shown — blank at first, or filled once generated — and **every period cell is clickable**. Click an empty cell to **add** a subject (on one weekday or several at once, at that period — a **per‑month subject takes a single day**, its one reserved weekly slot); click a filled cell to **change** or **remove** it. Each subject's teacher is filled in for you (the same one Generate would pick), and when a subject is shared by several teachers you choose which one teaches this section. The reserved **Friday** activity/early‑dismissal cells and the Homeroom/Recess/Lunch/Dismissal bands stay locked. This is perfect for a one‑off tweak; a fresh **Regenerate** rebuilds the whole week and replaces manual edits. Want to start from a blank grid instead? **Clear all** wipes every placed subject from the table in one step (for a Senior High section, only the semester you're viewing — the other term is left untouched), keeping the time rows and bands so you can Generate again or rebuild by hand.
- **Shared teachers are staggered into a clean diagonal — even across grades.** When a teacher is used in more than one section of a grade, each section places their subject **one period later than the last** — e.g. *Gen. Math* at 8:30 in the first section, 10:45 in the second, 12:30 in the third, 1:30 in the fourth — exactly the staggered pattern on a real class program. Because no two sections ever ask the same teacher for the same period, the teacher is never double‑booked **and keeps a whole day free each week**; the freed period in each section is **backfilled by another subject** so the week stays full. The scheduler checks real time intervals, so this holds even when two grades run different bell schedules. If some sessions still can't be fit conflict‑free (too few periods, or the teacher is saturated elsewhere), the app tells you exactly how many and how to fix it.
- **Fixed, standardized layout** matching the reference format — a TIME column with MON–FRI, full‑width bands for **Homeroom, Recess, Lunch, and Dismissal**, and **every day in its own cell** (nothing is merged, just like the real class program).
- **Fully automated helpers:**
  - **Teacher conflict warnings** — flags any teacher double‑booked at the same day and time across every classroom (in any room).
  - **Individual teacher schedules** — each teacher's personal weekly program is generated automatically from the classroom schedules; no extra data entry.
  - **Copy a classroom as a template** — duplicate a finished classroom, rename the section, and Regenerate.
- **Your own colors.** Choose from preset schemes (default is a **hierarchy of green**) or fine‑tune every part. Solid colors only — no gradients.
- **Print or Save as PDF** — one classroom, all classrooms in a room, one teacher, or all teachers. For Senior High, you print the semester you're viewing, and **all classrooms in a room** prints both semesters of every section.
- **Tidy up in bulk.** The **Subjects**, **Subject Teachers**, and **Grade Level Rooms** lists each have a **Select** mode and a **Clear all** button. Press **Select** to tick several items with checkboxes (with **Select all / none**) and delete them together, or **Clear all** to remove every item in the list at once — each asks you to confirm first and tells you exactly how many will go. The deletes clean up after themselves: removing a **subject** also unlinks it from every teacher and clears it from any generated grid; removing a **teacher** unassigns them from every schedule and advisory role (the subjects they taught stay); removing a **Grade Level Room** also deletes all the classrooms inside it. Inside a room, the **Classrooms (Sections)** list has the same **Select** / **Clear all** for deleting whole sections (the room itself stays) — not to be confused with an open classroom's own **Clear all**, which just empties that one section's timetable. Global subjects are never touched by deleting rooms or classrooms.
- **Local save + backup** — everything is stored on the computer automatically. Export a `.json` backup and import it on another PC. Backups from earlier versions are upgraded automatically on import.

---

## College & University scheduling (Tertiary mode)

Switch the sidebar toggle from **K–12** to **Tertiary** and the app becomes a scheduler for higher education. It works the way a college registrar thinks: you build **block sections** (a cohort like *BSIT 1‑A* that takes a set of courses together — the tertiary equivalent of a K–12 class), and the app lays each course onto the week as one or more **meetings** on the day patterns colleges actually use. Everything here lives in its own separate store, kept completely apart from your K–12 data; only the app theme, printing, and backups are shared.

The setup follows its own tabs, left to right:

- **Programs.** Each degree program (e.g. *BSIT*, *BSED*) with a code, name, and number of year levels.
- **Courses.** Course **code & title**, its **program**, **year level**, and **term**, plus **units** and **lecture / laboratory hours**. The lec/lab hours drive how the course is placed: lecture hours become the familiar MWF / TTh blocks, and lab hours meet as one longer session in a laboratory room.
- **Faculty.** Instructors and the **courses they can teach** — a course can be shared by several instructors, and the generator spreads the load across them (round‑robin, respecting an optional **max‑hours** cap). A faculty member can also be a block's **adviser**.
- **Rooms.** **Lecture** rooms and **Laboratories**. The generator keeps labs in lab rooms and lectures in lecture rooms, and never double‑books a room. (If you add no rooms of a type, those sessions are simply placed unroomed.)
- **Block Sections.** Group a program + year level into blocks (e.g. *BSIT 1‑A*, *1‑B*). Each block carries its own timetable **per term**.

**Terms.** Every block keeps a separate timetable for **1st Semester**, **2nd Semester**, and **Summer / Midyear**. A term switch on the Schedules tab lets you build, view, and print each one on its own; a course only appears in the term you assigned it.

**Day patterns & the day window.** Instead of a fixed daily bell of equal periods, tertiary courses meet on patterns — **MWF**, **TTh**, **MW**, **TF**, **Daily**, or **Saturday** — with session lengths derived from each course's hours (e.g. a 3‑unit/3‑hour lecture becomes three 1‑hour MWF sessions; a 2‑hour lecture becomes 1‑hour TTh). Classes are placed inside a configurable **day window** (default **7:00 AM – 8:00 PM**) at a 30‑minute granularity. Colleges commonly run Monday–Saturday, so Saturday is available and appears the moment a meeting is placed there.

**One‑click generation.** On the **Schedules** tab, press **Generate** for the selected block or **Generate all** to build every block for the term at once. The placer schedules the heaviest courses first, assigns the least‑loaded eligible instructor, and drops each session into the day window **without ever double‑booking the block cohort, a shared instructor, or a room**. When several blocks are generated together they're threaded so the whole batch is mutually clash‑free. If some sessions can't be fit, the app tells you exactly how many.

**Hand‑edit any meeting.** The weekly grid is fully editable. Click an empty part of a day column to **add** a meeting (choose the course, instructor, room, day, and start/end time), or click any meeting to **change or remove** it. Overlapping meetings render side by side. **Generate**/**Generate all** rebuild the term and replace manual edits; **Clear** empties just the selected block's term.

**Faculty loads & clash detection, live.** A right‑hand panel shows each instructor's **total scheduled hours** for the term (flagged red when over their cap) and a running list of **conflicts** — the same faculty booked twice, a room booked twice, or a block overlapping itself — updated as you generate or edit.

**Print or Save as PDF.** Print one block's timetable (the **print** button on the Schedules tab) or **Print all** to print every block that has meetings for the current term. Because a college block meets at different times on different days, the printed timetable is a **merged time‑slot grid**: a shared time column down the left with each course painted as a single color‑filled cell spanning its exact minutes, under a header showing the program, block, year level, term, and adviser. It shares the same color theme and A4‑landscape output as the K–12 schedules.

---

## Requirements

- **Windows 10 or 11**
- **[Node.js](https://nodejs.org/) 18 or newer** (includes `npm`) — needed to run or build the app.

Check it's installed by opening **PowerShell** or **Command Prompt** and running:

```bash
node --version
npm --version
```

---

## Quick start (run it)

From the project folder (`class-schedule-maker`):

```bash
npm install
npm run dev
```

`npm run dev` starts the app in development mode — the desktop window opens automatically and reloads as you work.

> The first `npm install` downloads Electron and can take a few minutes.

---

## Build the Windows app (.exe)

To create an installer and a portable executable you can share:

```bash
npm install        # first time only
npm run dist
```

The finished files appear in the **`release/`** folder:

- **`TEACHERaiah Setup <version>.exe`** — installer (lets the user pick an install folder and adds a desktop shortcut).
- **`TEACHERaiah <version>.exe`** — portable build; no installation, just double‑click to run.

To build **only** the portable version:

```bash
npm run dist:portable
```

---

## How to use

> **Scheduling for a college or university instead?** Flip the sidebar switch to **Tertiary** and follow the [College & University scheduling](#college--university-scheduling-tertiary-mode) workflow above. The steps below are for **K–12** (basic education).

The workflow follows the tabs top to bottom. **Create your subjects first, then your teachers** — then scheduling is a single click.

1. **Subjects tab** — click **Add subject** and fill in **Subject Name**, **Subject Code** *(optional)*, **Grade Level**, and how often it meets — **per week** (default 4 days) for regular subjects, or **per month** (1–4 times) for ones that only run a few times a month — then pick a color. You don't assign a teacher here. Subjects link to every classroom of their grade and are grouped and sorted by grade level within their campus category. **For Grade 11–12 subjects, also choose a Strand** (or *Core* / *Applied* for one every strand takes) **and a Semester** (or *Both semesters*). To prune the list, use **Select** to tick several subjects and delete them together, or **Clear all** to remove every subject at once.
2. **Subject Teachers tab** — add every teacher. Mark section advisers as *Moderator*. Set each teacher's **home / advisory grade** (used only for Homeroom), then tick the **subjects they teach** from the list — you can pick subjects from any grade. Several teachers may share a subject; the app splits its sections evenly among them. Every subject a section takes needs at least one teacher before that section can be generated. To prune the roster, use **Select** to tick several teachers and delete them together, or **Clear all** to remove every teacher at once (the subjects they taught stay).
3. **Schedule Times tab** *(optional but recommended)* — pick a grade and set its start time and the length of Homeroom, each class period, Recess, Lunch, and Dismissal. Under **Friday only** you can optionally turn on a **Friday activity period** (a no‑class block for club meetings — default 1:30–2:30 PM, customizable) and/or an **early dismissal** (Friday ends early — default 2:30 PM), per grade; leave them off and Friday matches the other days. Use **Copy these times to…** to apply one grade's schedule (including its Friday settings) to a whole category or every grade at once. Grades you don't touch use the sensible default (six 60‑minute periods from 8:10, recess after P2, lunch after P3).
4. **Grade Level Rooms tab** — click **New room** and choose a grade level (add an optional label to tell apart two rooms of the same grade). Open the room and, under **Classrooms (Sections)**, click **New classroom**, give it a section name and adviser. Every section of the grade takes that grade's subjects. In a **Senior High** room each classroom also picks a **Strand**, and takes that strand's subjects plus the shared Core ones. To clean house, use **Select** to tick and delete several rooms at once (or **Clear all rooms**) — this also removes the classrooms inside them — and inside a room use the classroom list's **Select** / **Clear all** to delete whole sections.
5. **Generate the schedule (one click):**
   - In the room, press **Generate** on a classroom — or **Generate all** to build every section at once. Each subject is placed on the number of days per week you set for it, taught by its teacher; across the sections of a grade the same subject **steps one period later in each section** (a clean diagonal), which keeps every shared teacher clash‑free and leaves each of them a whole free day — that freed slot is filled by another subject so the week stays full. Shared teachers are staggered across sections **and grades** automatically.
   - Open a classroom to see its grid. **Click any period cell to add, change, or remove a subject by hand** — pick the subject (and, if it's shared, the teacher), tick the weekday(s) at that period, and Save; a per‑month subject takes a single day (its one weekly slot), and the reserved Friday and break rows stay locked. Prefer to start over automatically? Press **Regenerate** to rebuild the whole week from the grade's subjects, teachers, and times (this replaces manual edits), or **Clear all** to empty the table and start from scratch (for a Senior High section this clears only the semester you're viewing). **For a Senior High section, use the 1st / 2nd Semester switch at the top** to build, edit, and view each term separately — the two semesters have their own subjects and never clash with each other, so a teacher can teach in both.
   - A banner appears if some sessions couldn't be placed conflict‑free (it tells you how many and how to fix it), or if a teacher is unavoidably double‑booked — even against a classroom in another room or grade.
   - Toggle **Show teacher names** to include the teacher in each cell, then click **Preview / Print** to print or save the classroom's schedule as PDF.
6. **Teacher Schedules tab** — view or print each teacher's auto‑generated personal program (gathered from every grade they teach in). When your school runs Senior High semesters, a **1st / 2nd Semester** switch shows each teacher's program for the chosen term.
7. **Appearance & Data tab** — choose a color scheme, customize colors, and export/import/reset your data. The **About** card here shows the app version and developer info.

### Printing tips

- In the print preview, **Save as PDF** opens a save dialog and writes a PDF directly.
- **Print** opens the system print dialog — choose a physical printer, or *Microsoft Print to PDF*.
- Schedules print in **A4 landscape**; background colors are preserved.

---

## Where is my data?

Everything is stored locally in the app (browser‑style local storage inside Electron), so it stays on the PC and persists between launches. Use **Appearance & Data → Export all data** to save a `.json` backup, and **Import from backup** to restore it or move it to another computer.

---

## Project structure

```
class-schedule-maker/
├─ electron/
│  ├─ main.js         # Electron main process (window, PDF export, print)
│  └─ preload.js      # Secure bridge → window.scheduleAPI
├─ src/
│  ├─ store.jsx       # Dual-mode state: K–12 + tertiary slices, business logic, conflicts, themes
│  ├─ tertiary.js     # Tertiary domain (pure): model, scheduling engine, reducer, selectors
│  ├─ App.jsx         # Shell + K–12 ⇄ Tertiary mode switch + tab navigation
│  ├─ components/     # Panels, tables, print portal, UI kit (K–12 + Tertiary*)
│  ├─ index.css       # Tailwind + print styles
│  └─ main.jsx        # React entry
├─ index.html
├─ vite.config.mjs
├─ tailwind.config.js
├─ postcss.config.js
└─ package.json
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app in development (hot reload). |
| `npm run build` | Build the web assets into `dist/`. |
| `npm start` | Build once, then launch the Electron app. |
| `npm run dist` | Build the Windows installer **and** portable `.exe` into `release/`. |
| `npm run dist:portable` | Build only the portable `.exe`. |

---

## Troubleshooting

- **`npm install` fails or is slow** — check your internet connection; the Electron binary is downloaded on first install. Corporate networks/proxies can block it.
- **The window is blank in `npm run dev`** — make sure nothing else is using port `5173`, then re‑run `npm run dev`.
- **Colors don't show when printing** — enable *Background graphics* in the print dialog (the app requests this automatically for PDF export).

---

## Developer

**TEACHERaiah** is developed by **Marvin T. Bangcailan**.

- **GitHub repository:** [github.com/mavipisowifi/TeacherAiah](https://github.com/mavipisowifi/TeacherAiah)
- **GitHub:** [github.com/mavipisowifi](https://github.com/mavipisowifi)
- **LinkedIn:** [Marvin T. Bangcailan](https://www.linkedin.com/in/marvin-bangcailan-a519582ab/)

This program is **free for all teachers all over the Philippines**. It was built to help lighten your load — to take the slow, tedious work of building class programs off your hands so you can pour more of your time and energy into what matters most: your students.

To every teacher out there: your work shapes the future of our nation, one learner at a time. Thank you for your patience, your dedication, and your heart. I hope TEACHERaiah makes your week a little lighter and your schedule-making a whole lot easier — and if it saves you even one late night, it has done its job. *Para sa mga guro — salamat sa inyong walang sawang paglilingkod.*

---

*TEACHERaiah — built for teachers on every campus to take the hassle out of schedule‑making.*
