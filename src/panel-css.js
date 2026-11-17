// Styles for the in-page panel. They live inside a shadow root, so they never touch the tracker's own styles.
const DCF_CSS = `
:host {
  --green: #4b7a4e;
  --green-deep: #2f5a33;
  --link: #1b5e20;
  --ink: #162016;
  --muted: #56625a;
  --line: #dde4dd;
  --card: #ffffff;
  --soft: #f3f6f3;
  --shadow: -1px 0 0 var(--line), 0 8px 24px rgba(10, 30, 12, .12);
  --focus: #f2b134;
  all: initial;
  font-family: "Roboto Flex", "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: var(--ink);
}
:host(.dark) {
  --green: #3f6c43;
  --green-deep: #24442a;
  --link: #9fd6a3;
  --ink: #e6efe6;
  --muted: #a7b6aa;
  --line: #2c3b2e;
  --card: #111b12;
  --soft: #172318;
  --shadow: -1px 0 0 var(--line), 0 8px 24px rgba(0, 0, 0, .4);
}
*, *::before, *::after { box-sizing: border-box; }
button, input { font: inherit; color: inherit; }
a { color: var(--link); }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

/* ---------- launcher ---------- */
/* Sits just under the tracker's dialogs (z-index 1200) so its help dialog stays clickable. */
.launch {
  position: fixed; right: 18px; bottom: 46px; z-index: 1150;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px 10px 12px; border: 0; border-radius: 8px;
  background: var(--green); color: #fff; font-size: 15px; font-weight: 650; letter-spacing: .1px;
  box-shadow: 0 2px 8px rgba(10, 30, 12, .25); cursor: pointer;
  transition: background .15s ease;
}
.launch:hover { background: var(--green-deep); }
.launch svg { width: 20px; height: 20px; flex: none; }
.launch[hidden] { display: none; }

/* ---------- drawer ---------- */
.drawer {
  position: fixed; top: 0; right: 0; z-index: 2147483001; overflow: hidden;
  width: min(480px, 100vw); height: 100vh; height: 100dvh;
  display: flex; flex-direction: column;
  background: var(--card); box-shadow: var(--shadow);
  transform: translateX(105%); transition: transform .22s ease;
  font-size: 15px; line-height: 1.45;
}
.drawer.open { transform: none; }
/* Full screen: the drawer covers the page; content stays a readable width in the middle. */
.drawer.full { width: 100vw; }
.drawer.full .top, .drawer.full .search { padding-left: max(16px, calc((100vw - 1040px) / 2)); padding-right: max(16px, calc((100vw - 1040px) / 2)); }
.drawer.full .body > *, .drawer.full .composer .cbody > * { max-width: 1000px; margin-left: auto; margin-right: auto; }
.drawer.full .composer .ctop { padding-left: max(16px, calc((100vw - 1040px) / 2)); padding-right: max(16px, calc((100vw - 1040px) / 2)); }
.top .full-btn {
  margin-left: auto; width: 36px; height: 36px; border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, .14); color: #fff; font-size: 19px; line-height: 1; cursor: pointer;
}
.top .full-btn:hover { background: rgba(255, 255, 255, .26); }
.top .full-btn + .x { margin-left: 0; }
.toast {
  position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 7; padding: 9px 12px; border-radius: 6px;
  background: var(--green-deep); color: #fff; font-size: 13px; line-height: 1.35;
  opacity: 0; transform: translateY(8px); transition: opacity .18s ease, transform .18s ease; pointer-events: none;
}
.toast.show { opacity: 1; transform: none; }
.toast.err { background: #8c2b2b; }
.top {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: var(--green); color: #fff; flex: none;
}
.top svg { width: 28px; height: 28px; flex: none; }
.top .t { font-size: 18px; font-weight: 750; line-height: 1.15; }
.top .s { font-size: 12.5px; opacity: .85; }
.top .x, .ctop .x {
  margin-left: auto; width: 36px; height: 36px; border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, .14); color: #fff; font-size: 22px; line-height: 1; cursor: pointer;
}
.top .x:hover, .ctop .x:hover { background: rgba(255, 255, 255, .26); }

.search { padding: 14px 16px 12px; border-bottom: 1px solid var(--line); background: var(--soft); flex: none; }
.search label.lbl { display: block; font-size: 13px; font-weight: 650; color: var(--muted); margin-bottom: 6px; }
.search .row { display: flex; gap: 8px; position: relative; }
.sug {
  position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 6; margin: 0; padding: 4px; list-style: none;
  background: var(--card); border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 4px 12px rgba(10, 30, 12, .12);
  max-height: 260px; overflow-y: auto;
}
.sug li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 14px; }
.sug li.on, .sug li:hover { background: var(--soft); }
.sug .nm { font-weight: 650; }
.sug .st { color: var(--muted); font-size: 12px; white-space: nowrap; }
.bcontact, .altc { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; color: var(--muted); padding: 2px 10px 6px; }
.altc { padding: 6px 0 0; }
.altc .lbl { font-weight: 650; }
.bcontact a, .altc a { color: var(--link); text-decoration: none; font-weight: 600; }
.write.alt { opacity: .85; }
.search input[type=text] {
  flex: 1; min-width: 0; padding: 10px 12px; font: 600 18px/1.3 "Roboto Flex", "Helvetica Neue", Helvetica, Arial, sans-serif;
  letter-spacing: 0; color: var(--ink); border: 1px solid var(--line); border-radius: 6px; background: var(--card);
}
.search input[type=text]::placeholder { font-weight: 400; color: var(--muted); }
.search input[type=text]:focus { border-color: var(--green); outline: none; }
.btn-go {
  padding: 0 20px; border: 0; border-radius: 6px; background: var(--green); color: #fff;
  font-size: 16px; font-weight: 700; cursor: pointer;
}
.btn-go:hover { background: var(--green-deep); }
.btn-go:disabled { opacity: .6; cursor: progress; }
.hint { min-height: 20px; margin-top: 6px; font-size: 13px; color: var(--muted); }
.hint.err { color: #c62828; }
:host(.dark) .hint.err { color: #ff8a80; }
.toggle { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; color: var(--muted); cursor: pointer; }
.toggle input { width: 16px; height: 16px; accent-color: var(--green); }

.body { flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 0 0 24px; }

/* ---------- states ---------- */
.state { padding: 36px 24px; text-align: center; color: var(--muted); }
.state.error { color: var(--ink); }
.state p { margin: 8px 0 0; }
.spinner {
  width: 34px; height: 34px; margin: 0 auto 12px; border-radius: 50%;
  border: 3px solid var(--line); border-top-color: var(--green); animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.retry { margin-top: 12px; padding: 8px 16px; border-radius: 6px; border: 1px solid var(--green); background: none; color: var(--link); font-weight: 650; cursor: pointer; }

/* ---------- result ---------- */
.hero { padding: 16px 16px 10px; }
.dist {
  display: flex; align-items: baseline; gap: 8px; font-size: 13.5px; color: var(--muted);
}
.dist .dnum { font-size: 20px; font-weight: 750; letter-spacing: -.3px; font-variant-numeric: tabular-nums; color: var(--link); }
h2 { margin: 8px 0 6px; font-size: 24px; line-height: 1.15; font-weight: 750; letter-spacing: -.3px; }
.where { font-size: 14px; color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12.5px; font-weight: 650; background: var(--soft); border: 1px solid var(--line); color: var(--ink); }
/* Stage colors (one system everywhere: chips, hero band, nearby dots, stage card). Red = decision pending. */
.ph-proposed { background: #ffe3e3; border-color: #c62828; color: #8e1a1a; }
.ph-preliminary { background: #fff1d6; border-color: #e08a00; color: #7a4a00; }
.ph-delayed { background: #f3e5f5; border-color: #8e24aa; color: #5a1470; }
.ph-expansion { background: #ffe9d6; border-color: #ef6c00; color: #8a3300; }
.ph-construction { background: #efe7e4; border-color: #6d4c41; color: #4e342e; }
.ph-operational { background: #e1f1e2; border-color: #2e7d32; color: #1b5e20; }
.ph-withdrawn { background: #eceff1; border-color: #607d8b; color: #37474f; }
.ph-rejected, .ph-retired { background: #eceff1; border-color: #455a64; color: #263238; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; background: var(--stage, #9e9e9e); flex: none; }
.stage { margin: 0 16px 12px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--stage); background: var(--stage-bg); color: var(--stage-ink); }
:host(.dark) .stage { background: color-mix(in srgb, var(--stage) 18%, var(--card)); color: var(--ink); }
.stage .st-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14.5px; }
.stage .win { margin-left: auto; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 750; background: var(--stage); color: #fff; }
.stage .st-short { margin-top: 4px; font-weight: 700; }
.stage .st-note { margin-top: 3px; font-size: 13px; line-height: 1.4; }
.stage .legend { margin-top: 8px; font-size: 13px; }
.stage .legend summary { cursor: pointer; font-weight: 650; }
.stage .legend ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 4px; }
.stage .legend li { display: flex; align-items: center; gap: 6px; padding: 2px 6px; border-radius: 4px; }
.stage .legend li.cur { background: rgba(255, 255, 255, .55); }
:host(.dark) .stage .legend li.cur { background: rgba(255, 255, 255, .12); }
.stage .legend .lw { margin-left: auto; font-size: 12px; font-weight: 650; opacity: .85; }
.stage .legend .fine { color: inherit; opacity: .85; }
.gap { margin: 12px 16px 0; padding: 10px 12px; border-radius: 6px; background: #fff8e1; border: 1px solid #e6b422; color: #5c4300; font-size: 13.5px; line-height: 1.45; }
:host(.dark) .gap { background: #2b2410; border-color: #a8861f; color: #ffe39a; }
:host(.dark) .chip { filter: brightness(.9) saturate(.9); }
:host(.dark) .ph-rejected, :host(.dark) .ph-withdrawn, :host(.dark) .ph-retired { background: #2a2a2a; border-color: #444; color: #ddd; }

.pic { margin: 6px 16px 0; }
.views { display: flex; gap: 4px; margin-bottom: 6px; }
.views button {
  flex: 1; padding: 7px 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--card);
  font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer;
}
.views button[aria-pressed=true] { background: var(--green); border-color: var(--green); color: #fff; }
.frame { position: relative; aspect-ratio: 16 / 10; border-radius: 6px; overflow: hidden; background: #2b3a2c; }
.frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.frame svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.frame .loading { position: absolute; inset: 0; display: grid; place-items: center; color: #cfe3d0; font-size: 13px; }
.cap { margin-top: 6px; font-size: 12px; color: var(--muted); }
.media { margin: 12px 16px 0; }
.media video, .media img { width: 100%; border-radius: 6px; display: block; background: #000; }
.media .mcap { font-size: 12.5px; color: var(--muted); margin-top: 6px; }

/* ---------- by the numbers ---------- */
section.numbers { margin: 18px 16px 0; }
section.numbers h3 { margin: 0 0 4px; font-size: 13px; font-weight: 750; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); }
.fig {
  --fc: #b45309;
  display: flex; gap: 12px; margin-top: 10px; padding: 12px 14px;
  border-radius: 6px; background: var(--card); border: 1px solid var(--line);
}
.fig.land { --fc: #2e7d32; }
.fig.building { --fc: #1558b0; }
.fig.cost { --fc: #b42318; }
:host(.dark) .fig { --fc: #fbbf24; }
:host(.dark) .fig.land { --fc: #8fd694; }
:host(.dark) .fig.building { --fc: #79b8ff; }
:host(.dark) .fig.cost { --fc: #ff9b8f; }
.fig .ico {
  width: 22px; height: 22px; flex: none; margin-top: 2px; display: grid; place-items: center; color: var(--fc);
}
.fig .ico svg { width: 22px; height: 22px; }
.fbody { flex: 1; min-width: 0; }
.fk { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); }
.big {
  margin: 2px 0 6px; color: var(--fc); font-size: 30px; font-weight: 750; line-height: 1.05;
  letter-spacing: -.5px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
}
.big .unit { margin-left: 6px; font-size: 15px; font-weight: 650; letter-spacing: 0; opacity: .85; }
ul.ana { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
ul.ana li { font-size: 14px; line-height: 1.4; }
ul.ana b { color: var(--fc); font-weight: 750; }
.meter { position: relative; height: 12px; margin-top: 10px; border-radius: 3px; overflow: hidden; background: color-mix(in srgb, var(--fc) 14%, transparent); }
.meter span {
  display: block; width: 0; height: 100%;
  background: var(--fc); transition: width 1.1s cubic-bezier(.2, .8, .2, 1);
}
.meter em { position: absolute; right: 8px; top: 0; font-size: 10px; line-height: 12px; font-weight: 700; font-style: normal; color: var(--card); }
.mcap { margin-top: 4px; font-size: 12px; font-weight: 650; color: var(--fc); }
.fnote { margin-top: 8px; font-size: 12px; color: var(--muted); }
/* "could instead…" callout inside each figure card */
.alt {
  margin-top: 12px; padding: 10px 12px; border-radius: 6px;
  background: var(--soft);
}
.alt-h { margin-bottom: 6px; font-size: 12.5px; font-weight: 700; color: var(--fc); }
.alt ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.alt li { font-size: 13.5px; line-height: 1.4; }
.alt li b { color: var(--fc); font-weight: 750; }
.alt.fresh li { animation: pop .35s ease both; }
.alt.fresh li + li { animation-delay: .06s; }
@keyframes pop { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.shuffle {
  margin-top: 8px; padding: 0; cursor: pointer; border: 0; background: none;
  color: var(--fc); font-size: 12.5px; font-weight: 650; text-decoration: underline;
}
.missing { margin-top: 10px; font-size: 12.5px; color: var(--muted); }
.fig.carbon { --fc: #4e5d6c; }
.fig.jobs { --fc: #5c4a8a; }
.fig.timeline { --fc: #3b6d7a; }
:host(.dark) .fig.carbon { --fc: #aab8c6; }
:host(.dark) .fig.jobs { --fc: #c3b3f0; }
:host(.dark) .fig.timeline { --fc: #9fcbd6; }
/* "Did you know?": one sourced fact under the figures */
section.dyk { margin: 14px 16px 0; padding: 12px 14px; border-radius: 6px; border: 1px solid var(--line); background: var(--soft); }
section.dyk h3 { margin: 0 0 4px; font-size: 13px; font-weight: 750; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); }
section.dyk p { margin: 0; font-size: 14px; line-height: 1.45; }
section.dyk .shuffle { color: var(--link); }
.tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 750; vertical-align: middle; letter-spacing: .3px; }
.tag.rep { background: #e1f1e2; color: #1b5e20; }
.tag.est { background: #fff3dc; color: #7a4a00; }

.summary { margin: 12px 16px 0; font-size: 14.5px; }
.numbers + .summary { margin-top: 16px; }
section.blk { margin: 18px 16px 0; padding-top: 14px; border-top: 1px solid var(--line); }
section.blk h3 { margin: 0 0 10px; font-size: 13px; font-weight: 750; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); }
dl.facts { display: grid; grid-template-columns: minmax(120px, 40%) 1fr; gap: 7px 12px; margin: 0; font-size: 14px; }
dl.facts dt { color: var(--muted); }
dl.facts dd { margin: 0; font-weight: 550; }

.gov { font-size: 13.5px; color: var(--muted); margin-bottom: 8px; }
.leaders { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.leaders li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; background: var(--card); border: 1px solid var(--line); }
.leaders .av {
  width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center; overflow: hidden;
  background: var(--green); color: #fff; font-weight: 750; font-size: 13px;
}
.leaders .av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.leaders .av.has-photo { background: var(--line); }
.leaders li.sm { padding: 6px 10px; }
.leaders li.sm .av { width: 32px; height: 32px; font-size: 11.5px; }
.leaders .who { min-width: 0; flex: 1; }
.leaders .nm { font-weight: 700; }
.leaders .nm a { color: inherit; text-decoration: none; border-bottom: 1px dotted var(--muted); }
.leaders .ti { font-size: 13px; color: var(--muted); }
.leaders .ti i { font-style: italic; }
.leaders.staff { margin-top: 8px; }

/* most-impactful highlighting */
.leaders li.star { border-color: var(--green); }
.leaders li .why { display: block; margin-top: 3px; font-size: 12px; font-weight: 650; color: var(--link); }
.starbox { margin: 10px 0 4px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--green); }
.starbox .sh { font-size: 13.5px; font-weight: 700; margin-bottom: 8px; }
.starbox ol.start { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.starbox ol.start li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 6px; background: var(--card); border: 1px solid var(--line); }
.starbox ol.start li .why { display: none; }

/* write buttons and the letter composer */
.leaders li .write {
  flex: none; width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--green); background: var(--card);
  color: var(--link); cursor: pointer; margin: 0 0 0 4px; align-self: center;
  display: inline-flex; align-items: center; justify-content: center; padding: 0; line-height: 1;
}
.leaders li .write svg { width: 16px; height: 16px; }
.leaders li .party { align-self: center; margin-top: 0; margin-bottom: 0; }
.leaders li .write:hover { background: var(--green); color: #fff; }
.writeall { margin: 10px 0 4px; }
.writeall .btn { width: 100%; }
.leaders li.sent { opacity: .78; }
.leaders li .sentmark, .composer .sentmark { flex: none; color: #1b5e20; font-weight: 800; font-size: 13px; }
:host(.dark) .leaders li .sentmark, :host(.dark) .composer .sentmark { color: #9fd6a3; }

/* sticky call-to-action under the title: the people whose decision matters most */
.cta {
  position: sticky; top: 0; z-index: 3; margin: 10px 0 0; padding: 10px 16px;
  background: var(--card); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
}
.cta[hidden] { display: none; }
.cta .row { display: flex; align-items: center; gap: 10px; }
.cta .faces { display: flex; flex: none; }
.cta .faces .av {
  width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; overflow: hidden;
  background: var(--green); color: #fff; font-weight: 750; font-size: 12px; border: 2px solid var(--card); margin-left: -9px;
}
.cta .faces .av:first-child { margin-left: 0; }
.cta .faces .av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cta .faces .av.has-photo { background: var(--line); }
.cta .btn { flex: 1; padding: 9px 12px; }
.cta .sub { margin-top: 5px; font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cta .prog, .composer .prog { color: #1b5e20; font-weight: 750; }
:host(.dark) .cta .prog, :host(.dark) .composer .prog { color: #9fd6a3; }

/* composer: tone and detail sliders, personal line, send options, scripts, done box, hand-off strip */
.sliders { display: grid; gap: 12px; margin-bottom: 10px; }
.drawer.full .sliders { grid-template-columns: 1fr 1fr; column-gap: 32px; }
.slide .sl { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.slide input[type=range] { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 24px; margin: 2px 0 0; padding: 0; background: none; cursor: pointer; }
.slide input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--line); }
.slide input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; margin-top: -7px; border: 0; border-radius: 4px; background: var(--green); }
.slide input[type=range]:focus-visible { outline: none; }
.slide input[type=range]:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px var(--focus); }
.slide .stops { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
.slide .stop { padding: 2px 0; border: 0; background: none; font-size: 12.5px; font-weight: 600; color: var(--muted); text-align: center; cursor: pointer; }
.slide .stop:first-child { text-align: left; }
.slide .stop:last-child { text-align: right; }
.slide .stop.on { color: var(--ink); font-weight: 750; }
.slide .sv { min-height: 18px; font-size: 12.5px; line-height: 1.4; color: var(--muted); }
.handoff { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: #e1f1e2; border: 1px solid #2e7d32; color: #1b5e20; font-size: 13px; }
.handoff.err { background: #fff3dc; border-color: #c98a00; color: #6a4200; }
.handoff span { flex: 1 1 100%; }
.handoff .btn { flex: 0 0 auto; padding: 6px 10px; font-size: 13px; }
:host(.dark) .handoff { background: #13261a; border-color: #2f6b35; color: #bfe6c1; }
:host(.dark) .handoff.err { background: #3a2e14; border-color: #a8861f; color: #f3d39a; }
.need.long { margin-bottom: 8px; }
input.personal { width: 100%; margin-bottom: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); font-size: 13.5px; }
input.personal::placeholder { color: var(--muted); }
details.you .yn { font-weight: 500; color: var(--muted); }
details.you .yf .lbl { font-size: 11.5px; line-height: 1.4; color: var(--muted); }
.composer .send .btn.off { opacity: .45; cursor: not-allowed; }
.composer .send2 { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.composer .send2 .btn { flex: 1 1 30%; padding: 7px 10px; font-size: 13px; }
.need { margin: 8px 0 0; padding: 8px 10px; border-radius: 6px; background: #fff3dc; color: #6a4200; font-size: 13px; font-weight: 650; }
:host(.dark) .need { background: #3a2e14; color: #f3d39a; }
.script { margin-top: 10px; padding: 10px 12px; border-radius: 6px; background: var(--soft); border: 1px solid var(--line); font-size: 13.5px; }
.script h4 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.script p { margin: 0 0 8px; }
.script .send2 { margin-top: 2px; }
.done { margin-bottom: 10px; padding: 10px 12px; border-radius: 6px; background: #e1f1e2; border: 1px solid #2e7d32; color: #1b5e20; font-size: 13.5px; }
:host(.dark) .done { background: #13261a; border-color: #2f6b35; color: #bfe6c1; }
.done .fine { margin-top: 4px; color: inherit; opacity: .92; }
.done a { color: inherit; }
.composer {
  position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; background: var(--card);
}
.composer[hidden] { display: none; }

/* first-open tutorial: one card over the drawer */
.tour { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; padding: 20px; background: rgba(10, 30, 12, .55); }
.tour .tcard { width: min(360px, 100%); padding: 18px 18px 14px; border-radius: 8px; background: var(--card); }
.tour .tt { font-size: 18px; font-weight: 750; margin-bottom: 10px; }
.tour ol { list-style: none; margin: 0 0 14px; padding: 0; display: grid; gap: 10px; }
.tour li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.4; }
.tour .ti { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--green); color: #fff; font-size: 12.5px; font-weight: 700; margin-top: 1px; }
.tour .btn { width: 100%; }
.tour .tf { margin-top: 8px; text-align: center; font-size: 12px; color: var(--muted); }
.composer .ctop { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--green); color: #fff; flex: none; }
.composer .ctop .t { font-size: 17px; font-weight: 750; }
.composer .ctop .s { font-size: 12.5px; opacity: .85; }
.composer .cbody { flex: 1; overflow-y: auto; padding: 12px 16px 24px; }
details.you { border: 1px solid var(--line); border-radius: 6px; background: var(--soft); padding: 8px 12px; margin-bottom: 10px; }
details.you summary { cursor: pointer; font-weight: 650; font-size: 13.5px; }
details.you .yf { display: grid; gap: 6px; margin-top: 8px; }
details.you input { padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); font-size: 14px; }
.modes { display: flex; gap: 4px; margin-bottom: 10px; }
.modes button { flex: 1; padding: 7px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; }
.modes button[aria-pressed=true] { background: var(--green); border-color: var(--green); color: #fff; }
.composer .to { font-size: 14px; margin-bottom: 8px; }
.composer .to .fine { margin-top: 2px; overflow-wrap: anywhere; }
textarea.letter {
  width: 100%; min-height: 360px; padding: 12px; border: 1px solid var(--line); border-radius: 6px; resize: vertical;
  font: 14px/1.5 Georgia, "Times New Roman", serif; color: var(--ink); background: var(--card);
}
.composer .send { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.composer .send .btn { flex: 1 1 45%; }
.composer .steps { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; font-size: 13.5px; font-weight: 650; color: var(--muted); }
.composer .steps .btn { flex: 0 0 auto; }
.composer .steps .btn[disabled] { opacity: .4; cursor: default; }

/* who-decides tiers */
.tier { margin-top: 14px; padding: 12px 0 0; border-top: 1px solid var(--line); }
.tier .th { margin-bottom: 8px; }
.tier .tk { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); }
.tier .tt { font-size: 15px; font-weight: 700; }
.tier .ts { font-size: 12.5px; color: var(--muted); }
details.board { margin-top: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--soft); }
details.board summary { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; font-size: 13.5px; list-style: none; }
details.board summary::-webkit-details-marker { display: none; }
details.board summary::after { content: '▸'; margin-left: auto; color: var(--muted); transition: transform .15s; }
details.board[open] summary::after { transform: rotate(90deg); }
details.board .cnt { padding: 0 6px; border-radius: 4px; background: var(--line); font-size: 11.5px; font-weight: 650; }
details.board .blink { font-size: 12px; }
details.board > ul { padding: 0 8px 8px; }
.party { margin-left: auto; padding: 2px 7px; border-radius: 4px; font-size: 12px; font-weight: 750; }
.party.D { background: #dbe7fb; color: #0d47a1; }
.party.R { background: #fbdcdc; color: #b71c1c; }
.party.I { background: #e8e8e8; color: #444; }
.links { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: 13.5px; }
.fine { margin-top: 8px; font-size: 12.5px; color: var(--muted); }
.warn { margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: #fff3dc; color: #6a4200; font-size: 12.5px; }
:host(.dark) .warn { background: #3a2e14; color: #f3d39a; }

ul.plain { margin: 0; padding-left: 18px; font-size: 14px; }
ul.plain li { margin-bottom: 6px; }
.co { display: flex; flex-wrap: wrap; gap: 6px; }
.co .chip { font-weight: 550; }
.co .chip b { font-weight: 750; }
.src { font-size: 13.5px; }
.src .d { color: var(--muted); font-size: 12px; }
.more { margin-top: 6px; border: 0; background: none; color: var(--link); font-weight: 650; cursor: pointer; padding: 0; }

.actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 16px 0; }
.btn {
  flex: 1 1 auto; display: inline-flex; justify-content: center; align-items: center; gap: 6px;
  padding: 9px 14px; border-radius: 6px; border: 1px solid var(--green);
  color: var(--link); text-decoration: none; font-weight: 650; font-size: 14px; background: none; cursor: pointer;
}
.btn.primary { background: var(--green); color: #fff; }
.btn:hover { background: var(--soft); }
.btn.primary:hover { background: var(--green-deep); }

ol.near { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
ol.near li { min-width: 0; }
ol.near button {
  width: 100%; display: flex; align-items: center; gap: 10px; text-align: left;
  padding: 9px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); cursor: pointer;
}
ol.near button:hover { border-color: var(--green); }
ol.near button[aria-current=true] { border-color: var(--green); background: var(--soft); }
ol.near .mi { flex: none; width: 62px; font-weight: 800; font-variant-numeric: tabular-nums; }
ol.near .nn { flex: 1; min-width: 0; }
ol.near .nn div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
ol.near .sub { font-size: 12.5px; color: var(--muted); }

.foot { margin: 22px 16px 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
.foot button { border: 0; background: none; padding: 0; color: var(--link); font-size: 12px; font-weight: 650; cursor: pointer; }

/* Red marks urgency only: while the stage still allows a decision, the distance figure and the Start-here box turn red. */
.body[data-win=high] .dist .dnum { color: #c62828; }
.body[data-win=high] .starbox { border-color: #c62828; }
.body[data-win=high] .starbox .sh { color: #a32d2d; }
.body[data-win=high] .leaders li.star { border-color: #c62828; }
.body[data-win=high] .leaders li .why { color: #a32d2d; }
:host(.dark) .body[data-win=high] .dist .dnum, :host(.dark) .body[data-win=high] .starbox .sh, :host(.dark) .body[data-win=high] .leaders li .why { color: #ff8a80; }
:host(.dark) .body[data-win=high] .starbox, :host(.dark) .body[data-win=high] .leaders li.star { border-color: #e24b4a; }

@media (prefers-reduced-motion: reduce) { .drawer, .launch, .meter span { transition: none; } .spinner { animation-duration: 2s; } .alt.fresh li { animation: none; } }
`;
