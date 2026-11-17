# Privacy

Datawriter, By CUAI is a browser extension that helps residents find the data center planned near them and write to the officials who decide. It is built by student volunteers of CU Amnesty International, the Columbia University chapter of Amnesty International.

**Datawriter sends nothing on its own.** It has no server, no account, no analytics and no advertising. Nothing you type is transmitted anywhere except in a letter you choose to send from your own email.

## What stays on your computer

These are kept in the browser's local extension storage and never leave it:

- Your name, street, town, email and phone, if you enter them for the letter signature.
- Your home ZIP, if you set one, and the ZIPs you searched recently.
- Which officials you have marked as written to, per project.
- Your preferences: language, letter tone and length, preferred mail service, and whether the panel opens full-screen.
- A copy of the tracker's public project data, cached for 30 minutes so the panel opens quickly.

Remove the extension and all of it is deleted. You can also clear any field in the composer.

## What it connects to

- **trackdatacenters.com**: the panel runs on the tracker's own pages and reads the same public project data the site's map loads.
- **Esri's public map services** (server.arcgisonline.com): satellite and street images of the project site. Esri receives the coordinates of the project, not your ZIP.
- **api.zippopotam.us**: a public ZIP-code lookup, used only for a ZIP outside the 34 states bundled with the extension. It receives the five-digit ZIP and nothing else.

When you choose to send a letter, your browser opens Gmail, Outlook, Yahoo Mail or your desktop mail program with the letter filled in. Those services receive the letter from you, not from Datawriter. The "Open in Google Maps" and "Add a reminder to your calendar" links open Google with the project's coordinates or a reminder title, only when you click them.

## Permissions it asks for

- **storage** and **unlimitedStorage**: to keep the preferences above and the cached project data on your computer.
- **scripting**: to move the tracker's own map to the project you are looking at.
- Access to **trackdatacenters.com** (where the panel appears) and **api.zippopotam.us** (the ZIP lookup).

## Officials' information

Names, titles, emails, phone numbers and portraits of public officials come from government websites, collected in October 2026 and dated in each record. Only official portraits are used; none come from news sites or social media. If you are an official and something is wrong or out of date, tell CU Amnesty International and the next build will correct it.

## Contact

CU Amnesty International, Columbia University. Contact details for the chapter will be added here before the Chrome Web Store listing goes live.
