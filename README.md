# Maps 🌍

Maps is a web app for building and sharing interactive world maps. Users can colour countries, add labels and links, drop markers, export a PNG, and generate shareable URLs for quick distribution.

![World map preview](public/WorldMap.png)

## What it does

- Customize country colours and popups on a world map
- Add markers with labels, colours, and links
- Export the map as an image
- Share a generated URL or send via email/Telegram/WhatsApp
- Create an account, log in, and save maps with descriptions
- View saved maps with preview image, saved date, and URL copy action

## Tech stack

- Next.js (App Router) + React
- TypeScript
- CSS modules/global styles
- SVG-based map rendering
- MongoDB (user auth + saved map records)

## Environment variables

Add these variables to `.env.local`:

```bash
MONGODB_URI=<your-mongodb-connection-string>
MONGODB_DB_NAME=borderlesscitizen
AUTH_SECRET=<long-random-secret>
PINATA_JWT=<your-pinata-jwt>
```

Collections used:

- `users`
- `saved_maps`

## Development

```bash
npm run dev
```

Then open http://localhost:3000.
