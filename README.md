# showclock

Full-screen running-order clock for live shows. Shows the current phase, time left in it, a progress bar for that phase, and what's next.

Working name — rename when you have a better one.

## Run

Open `index.html` in a browser. No build, no server. The Antonio font loads from Google Fonts; offline it falls back to Arial Narrow.

## Keys

| Key | Action |
|-----|--------|
| E | Edit schedule |
| F | Toggle fullscreen |

## Schedule format

One line per phase, `HH:MM Name`. The last line is the end point (e.g. curfew). Times that go past midnight are handled.

The current phase is purely driven by the clock against the schedule. The schedule is saved in the browser's localStorage.
