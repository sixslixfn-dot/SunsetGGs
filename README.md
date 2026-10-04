# Sunset Esports

A polished, responsive landing page for Sunset Esports, an independent esports organization established in 2026. Built with React, TypeScript, and Vite with a black-and-gold visual identity.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

1. Install Node.js if it is not already installed.
2. In this folder, install dependencies with `npm install`.
3. In VS Code, run the **Set up Sunset admin account** task. Enter your username and password in its terminal prompts; password input is hidden. It stores only a scrypt password hash and username in the ignored `.env` file. Do not share or commit that file.
4. Start both the website and auth API with the **Start Vite dev server** task (or press F5). After configuring credentials, restart the task so the API reloads `.env`.
5. Open the local URL printed by Vite. The merchandise preview is at `/merch`; the private login page is at `/tacos7`.

Create a production build with `npm run build`. To serve the built website and API together, run `npm start` with `NODE_ENV=production` and `PUBLIC_ORIGIN` set to the exact public HTTPS origin behind a TLS-terminating proxy. Production auth cookies are `Secure`, `HttpOnly`, and `SameSite=Strict`; never deploy admin sign-in over plain HTTP.

## Customize

- Update the organization copy, milestones, and links in `src/App.tsx`.
- Adjust colors, layout, and responsive behavior in `src/styles.css`.
- Brand imagery is stored locally in `public/images/`: the supplied square logo, transparent gold emblem, and wide background banner are used directly in the hero.
- Change page metadata and title in `index.html`.

The contact action currently opens an email draft to `hello@sunsetesports.gg`; update it with a working organization contact before publishing. The social links are local section placeholders and should be connected to official profiles before launch.

## Admin security

- The only permitted admin username is `admin432`; the server rejects all other usernames. The password hash is read only by the server from `.env`; neither is embedded in the React bundle or returned by the API.
- The setup prompt does not echo passwords. Passwords are stored as scrypt hashes, and `.env` is excluded from Git.
- Login attempts are rate-limited; authenticated access uses a random, server-side, four-hour session with an `HttpOnly` cookie. Sessions are invalidated when the server restarts.
- Run the complete dev command so the Vite proxy and auth server are both available. Do not put passwords or hashes in source code, browser storage, or screenshots.
- The browser necessarily sends the credentials you type to the server during sign-in; someone controlling your device/browser can inspect their own submission. This design protects the stored admin credentials from being bundled into or fetched from the website.

## Editing website copy

After signing in at `/tacos7`, the admin page shows a live preview of the public site and a searchable panel of editable text. Edit any field and select **Publish changes**; the server validates the content shape and saves it to the ignored `data/site-content.json` file. Published copy loads on the homepage and Merch page. Images, layout, navigation destinations, and functionality are intentionally not editable through this text editor.
